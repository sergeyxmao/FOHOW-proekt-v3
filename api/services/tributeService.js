/**
 * Сервис для интеграции с платёжной системой Tribute (Telegram подписки)
 *
 * Функции:
 * - Маппинг product_id от Tribute на plan_id в БД
 * - Проверка подписи webhook
 * - Обработка новых подписок
 * - Обработка продления подписок
 * - Обработка отмены/истечения подписок
 */

import crypto from 'crypto';
import { pool } from '../db.js';
import { sendSubscriptionEmail } from '../utils/email.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import {
  getSubscriptionActivatedMessage,
  getSubscriptionRenewedMessage,
  getSubscriptionCancelledMessage
} from '../templates/telegramTemplates.js';

/**
 * Маппинг Tribute product_id на plan_id в БД
 * sLc8 → Individual (249₽/мес, 2490₽/год)
 * sLe1 → Premium (399₽/мес, 3990₽/год)
 */
const TRIBUTE_PRODUCT_MAPPING = {
  'sLc8': 6,  // Individual - 249₽/мес
  'sLe1': 7   // Premium - 399₽/мес
};

/**
 * Определить plan_id по product_id из Tribute
 * @param {string} tributeProductId
 * @returns {number|null}
 */
export function mapTributeProductToPlan(tributeProductId) {
  return TRIBUTE_PRODUCT_MAPPING[tributeProductId] || null;
}

/**
 * Проверка подписи webhook от Tribute
 * @param {Object} payload - тело запроса
 * @param {string} signature - подпись из заголовка
 * @returns {boolean}
 */
export function verifyTributeWebhook(payload, signature) {
  // Если секрет не настроен или подпись не передана — пропускаем проверку
  if (!process.env.TRIBUTE_WEBHOOK_SECRET || !signature) {
    return true;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', process.env.TRIBUTE_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return computedSignature === signature;
  } catch (error) {
    console.error('❌ Ошибка проверки подписи Tribute:', error);
    return false;
  }
}

/**
 * Обработка новой подписки
 * @param {Object} data - данные от Tribute
 */
export async function handleNewSubscription(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      subscription_id,
      telegram_user_id,
      product_id,
      amount,
      currency = 'RUB',
      period // 'month' or 'year'
    } = data;

    console.log(`[Tribute] 🆕 Новая подписка: subscription_id=${subscription_id}, telegram_user_id=${telegram_user_id}, product_id=${product_id}`);

    // 1. Определить plan_id
    const planId = mapTributeProductToPlan(product_id);

    if (!planId) {
      console.error(`❌ Неизвестный product_id от Tribute: ${product_id}`);
      await client.query('ROLLBACK');
      return { success: false, error: 'Unknown product_id' };
    }

    // 2. Найти пользователя по telegram_chat_id
    const userResult = await client.query(
      'SELECT id FROM users WHERE telegram_chat_id = $1',
      [String(telegram_user_id)]
    );

    // Если пользователь не найден — сохранить в pending
    if (userResult.rows.length === 0) {
      console.log(`⚠️ Пользователь с telegram_chat_id=${telegram_user_id} не найден. Сохраняю в pending_tribute_webhooks.`);

      await client.query(
        `INSERT INTO pending_tribute_webhooks (telegram_user_id, tribute_subscription_id, payload)
         VALUES ($1, $2, $3)`,
        [String(telegram_user_id), subscription_id, JSON.stringify(data)]
      );

      await client.query('COMMIT');
      return { success: true, pending: true };
    }

    const userId = userResult.rows[0].id;

    // 3. Определить интервал подписки
    const interval = period === 'year' ? '1 year' : '1 month';

    // 4. Обновить тариф пользователя
    await client.query(
      `UPDATE users
       SET plan_id = $1,
           subscription_started_at = NOW(),
           subscription_expires_at = NOW() + INTERVAL '${interval}',
           payment_method = 'tribute',
           auto_renew = TRUE
       WHERE id = $2`,
      [planId, userId]
    );

    // 5. Создать/обновить запись в tribute_subscriptions
    await client.query(
      `INSERT INTO tribute_subscriptions (
        user_id, telegram_user_id, tribute_subscription_id,
        plan_id, status, expires_at, last_payment_at,
        tribute_product_id, amount_paid, currency
      )
      VALUES ($1, $2, $3, $4, 'active', NOW() + INTERVAL '${interval}', NOW(), $5, $6, $7)
      ON CONFLICT (tribute_subscription_id)
      DO UPDATE SET
        status = 'active',
        expires_at = NOW() + INTERVAL '${interval}',
        last_payment_at = NOW(),
        amount_paid = EXCLUDED.amount_paid,
        updated_at = NOW()`,
      [userId, String(telegram_user_id), subscription_id, planId, product_id, amount, currency]
    );

    // 6. Создать запись в subscription_history
    await client.query(
      `INSERT INTO subscription_history (
        user_id, plan_id, start_date, end_date,
        source, amount_paid, currency, transaction_id
      )
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '${interval}', 'tribute', $3, $4, $5)`,
      [userId, planId, amount, currency, subscription_id]
    );

    console.log(`✅ Подписка активирована для user_id=${userId}, plan_id=${planId}`);

    await client.query('COMMIT');

    // Отправка email-уведомления (НЕ блокирует основной процесс)
    try {
      // Получить данные пользователя и тарифа для email
const userData = await pool.query(
  `SELECT u.email, u.name, u.telegram_chat_id, sp.name as plan_name
   FROM users u
   JOIN subscription_plans sp ON u.plan_id = sp.id
   WHERE u.id = $1`,
  [userId]
);

      if (userData.rows.length > 0) {
        const user = userData.rows[0];
        const interval = period === 'year' ? 365 : 30;

        await sendSubscriptionEmail(user.email, 'new', {
          userName: user.name || 'Пользователь',
          planName: user.plan_name,
          amount: amount,
          currency: currency,
          startDate: new Date().toISOString(),
          expiresDate: new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    } catch (emailError) {
      // Ошибка отправки email НЕ должна ломать основной процесс
      console.error('❌ Не удалось отправить email о новой подписке:', emailError.message);
    }
    // Отправка Telegram-уведомления (НЕ блокирует основной процесс)
    if (user.telegram_chat_id) {
      try {
        const intervalDays = period === 'year' ? 365 : 30;
        const expiresDateFormatted = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
          .toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });

        const telegramMessage = getSubscriptionActivatedMessage(
          user.name || 'Пользователь',
          user.plan_name,
          amount,
          currency,
          expiresDateFormatted,
          process.env.FRONTEND_URL + '/boards'
        );

        await sendTelegramMessage(user.telegram_chat_id, telegramMessage.text, {
          parse_mode: telegramMessage.parse_mode,
          reply_markup: telegramMessage.reply_markup,
          disable_web_page_preview: telegramMessage.disable_web_page_preview
        });

        console.log(`✅ Telegram-уведомление о новой подписке отправлено: ${user.telegram_chat_id}`);
      } catch (telegramError) {
        console.error('❌ Не удалось отправить Telegram-уведомление о новой подписке:', telegramError.message);
      }
    } else {
      console.log('ℹ️ telegram_chat_id не указан, пропускаем отправку Telegram-уведомления');
    }

    return { success: true, userId, planId };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка обработки новой подписки:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Обработка продления подписки
 * @param {Object} data - данные от Tribute
 */
export async function handleSubscriptionRenewed(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      subscription_id,
      amount,
      currency = 'RUB',
      period
    } = data;

    console.log(`[Tribute] 🔄 Продление подписки: subscription_id=${subscription_id}`);

    // Найти подписку
    const subResult = await client.query(
      'SELECT user_id, plan_id FROM tribute_subscriptions WHERE tribute_subscription_id = $1',
      [subscription_id]
    );

    if (subResult.rows.length === 0) {
      console.error(`❌ Подписка ${subscription_id} не найдена в tribute_subscriptions`);
      await client.query('ROLLBACK');
      return { success: false, error: 'Subscription not found' };
    }

    const { user_id, plan_id } = subResult.rows[0];
    const interval = period === 'year' ? '1 year' : '1 month';

    // Обновить expires_at у пользователя
    await client.query(
      `UPDATE users
       SET subscription_expires_at = NOW() + INTERVAL '${interval}'
       WHERE id = $1`,
      [user_id]
    );

    // Обновить tribute_subscriptions
    await client.query(
      `UPDATE tribute_subscriptions
       SET expires_at = NOW() + INTERVAL '${interval}',
           last_payment_at = NOW(),
           status = 'active',
           amount_paid = $1,
           updated_at = NOW()
       WHERE tribute_subscription_id = $2`,
      [amount, subscription_id]
    );

    // Записать в историю
    await client.query(
      `INSERT INTO subscription_history (
        user_id, plan_id, start_date, end_date,
        source, amount_paid, currency, transaction_id
      )
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '${interval}', 'tribute_renewal', $3, $4, $5)`,
      [user_id, plan_id, amount, currency, subscription_id]
    );

    console.log(`✅ Подписка продлена для user_id=${user_id}`);

    await client.query('COMMIT');

    // Отправка email-уведомления
    try {
      const userData = await pool.query(
        `SELECT u.email, u.name, sp.name as plan_name, u.subscription_expires_at
         FROM users u
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [user_id]
      );

      if (userData.rows.length > 0) {
        const user = userData.rows[0];

        await sendSubscriptionEmail(user.email, 'renewed', {
          userName: user.name || 'Пользователь',
          planName: user.plan_name,
          amount: amount,
          currency: currency,
          startDate: new Date().toISOString(),
          expiresDate: user.subscription_expires_at
        });
      }
    } catch (emailError) {
      console.error('❌ Не удалось отправить email о продлении подписки:', emailError.message);
    }

    return { success: true, userId: user_id };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка продления подписки:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Обработка отмены/истечения подписки
 * @param {Object} data - данные от Tribute
 */
export async function handleSubscriptionCancelled(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { subscription_id } = data;

    console.log(`[Tribute] ❌ Отмена подписки: subscription_id=${subscription_id}`);

    // Найти подписку
    const subResult = await client.query(
      'SELECT user_id FROM tribute_subscriptions WHERE tribute_subscription_id = $1',
      [subscription_id]
    );

    if (subResult.rows.length === 0) {
      console.error(`❌ Подписка ${subscription_id} не найдена в tribute_subscriptions`);
      await client.query('ROLLBACK');
      return { success: false, error: 'Subscription not found' };
    }

    const { user_id } = subResult.rows[0];

    // Получить ID гостевого тарифа
    const guestPlanResult = await client.query(
      "SELECT id FROM subscription_plans WHERE code_name = 'guest'"
    );

    if (guestPlanResult.rows.length === 0) {
      console.error('❌ Гостевой тариф (guest) не найден в subscription_plans');
      await client.query('ROLLBACK');
      return { success: false, error: 'Guest plan not found' };
    }

    const guestPlanId = guestPlanResult.rows[0].id;

    // Перевести пользователя на гостевой тариф
    await client.query(
      `UPDATE users
       SET plan_id = $1,
           auto_renew = FALSE
       WHERE id = $2`,
      [guestPlanId, user_id]
    );

    // Обновить статус в tribute_subscriptions
    await client.query(
      `UPDATE tribute_subscriptions
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE tribute_subscription_id = $1`,
      [subscription_id]
    );

    console.log(`✅ Пользователь user_id=${user_id} переведён на гостевой тариф (plan_id=${guestPlanId})`);

    await client.query('COMMIT');

    // Отправка email-уведомления
    try {
      const userData = await pool.query(
        `SELECT u.email, u.name, ts.tribute_product_id, u.subscription_expires_at
         FROM users u
         JOIN tribute_subscriptions ts ON ts.user_id = u.id AND ts.tribute_subscription_id = $1
         WHERE u.id = $2`,
        [subscription_id, user_id]
      );

      if (userData.rows.length > 0) {
        const user = userData.rows[0];
        // Определить название тарифа по product_id
        const planName = user.tribute_product_id === 'sLe1' ? 'Premium' : 'Individual';

        await sendSubscriptionEmail(user.email, 'cancelled', {
          userName: user.name || 'Пользователь',
          planName: planName,
          amount: 0,
          currency: 'RUB',
          startDate: new Date().toISOString(),
          expiresDate: user.subscription_expires_at || new Date().toISOString()
        });
      }
    } catch (emailError) {
      console.error('❌ Не удалось отправить email об отмене подписки:', emailError.message);
    }

    return { success: true, userId: user_id, guestPlanId };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка отмены подписки:', error);
    throw error;
  } finally {
    client.release();
  }
}
