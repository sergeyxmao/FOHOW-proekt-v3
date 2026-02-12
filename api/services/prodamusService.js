import crypto from 'crypto';
import { pool } from '../db.js';
import boardLockService from '../services/boardLockService.js';
import { sendSubscriptionEmail } from '../utils/emailService.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import { getSubscriptionActivatedMessage } from '../templates/telegramTemplates.js';

/**
 * Сервис интеграции с платёжной системой Продамус (Prodamus)
 *
 * Функции:
 * - Создание/верификация HMAC SHA-256 подписей
 * - Формирование ссылок на оплату
 * - Обработка webhook уведомлений
 */

// ============================================
// HMAC SHA-256 подпись (алгоритм Продамуса)
// ============================================

/**
 * Рекурсивная сортировка объекта по ключам + приведение значений к строкам.
 * Аналог PHP ksort() — стандарт Продамуса.
 */
function deepSortByKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(deepSortByKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((sorted, key) => {
      sorted[key] = deepSortByKeys(obj[key]);
      return sorted;
    }, {});
  }
  return String(obj);
}

/**
 * Создание HMAC SHA-256 подписи.
 * Алгоритм: значения→строки → рекурсивный ksort → JSON → HMAC-SHA256 → hex
 */
export function createSignature(data, secretKey) {
  const sorted = deepSortByKeys(data);
  const json = JSON.stringify(sorted);
  return crypto.createHmac('sha256', secretKey).update(json).digest('hex');
}

/**
 * Верификация подписи webhook от Продамуса.
 * Подпись приходит в HTTP заголовке Sign.
 */
export function verifySignature(data, receivedSignature, secretKey) {
  // Удаляем поле signature из данных, если оно есть
  const dataWithoutSign = { ...data };
  delete dataWithoutSign.signature;

  const computed = createSignature(dataWithoutSign, secretKey);

  // Защита от timing-атак
  try {
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(receivedSignature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================
// Формирование ссылки на оплату
// ============================================

/**
 * Создание ссылки на оплату через Продамус.
 *
 * @param {object} params
 * @param {number} params.userId - ID пользователя
 * @param {number} params.planId - ID тарифного плана
 * @param {string} params.planName - Название плана
 * @param {number} params.price - Цена в рублях
 * @param {string} params.email - Email пользователя
 * @returns {string} URL ссылки на оплату
 */
export function createPaymentLink({ userId, planId, planName, price, email }) {
  const secretKey = process.env.PRODAMUS_SECRET_KEY;
  const payformUrl = process.env.PRODAMUS_PAYFORM_URL || 'https://foboard.payform.ru';
  const successUrl = process.env.PRODAMUS_SUCCESS_URL;
  const webhookUrl = process.env.PRODAMUS_WEBHOOK_URL;
  const returnUrl = process.env.PRODAMUS_RETURN_URL;

  const orderId = `FB-${userId}-${planId}-${Date.now()}`;

  // Параметры платежа по документации Продамуса
  const params = {
    do: 'link',
    'products[0][name]': `Доступ к платформе FoBoard, тариф "${planName}", подписка на 30 дней`,
    'products[0][price]': String(price),
    'products[0][quantity]': '1',
    'products[0][sku]': `plan_${planId}`,
    customer_email: email,
    order_id: orderId,
    urlReturn: returnUrl,
    urlSuccess: successUrl,
    urlNotification: webhookUrl,
    _param_user_id: String(userId),
    payment_method: 'AC',
    available_payment_methods: 'AC|SBP|sbol|tpay'
  };

  // Подпись параметров
  const signature = createSignature(params, secretKey);
  params.signature = signature;

  // Сборка URL
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${payformUrl}?${queryString}`;
}

// ============================================
// Обработка webhook
// ============================================

/**
 * Обработка webhook уведомления от Продамуса.
 * Записывает платёж и активирует подписку при успешной оплате.
 *
 * @param {object} data - Данные webhook от Продамуса
 * @returns {object} Результат обработки
 */
export async function processWebhook(data) {
  const {
    order_id,
    order_num,
    sum,
    customer_phone,
    customer_email,
    payment_type,
    payment_status,
    payment_init,
    products,
    _param_user_id
  } = data;

  // Определяем plan_id из SKU продукта или order_id
  let planId = null;
  if (products) {
    // products может быть объектом с числовыми ключами (из form-data)
    const product = Array.isArray(products) ? products[0] : products['0'] || Object.values(products)[0];
    if (product && product.sku) {
      const match = product.sku.match(/plan_(\d+)/);
      if (match) planId = parseInt(match[1], 10);
    }
  }
  if (!planId && order_id) {
    // Fallback: извлекаем из order_id формата FB-{userId}-{planId}-{timestamp}
    const parts = order_id.split('-');
    if (parts.length >= 3) planId = parseInt(parts[2], 10);
  }

  // Находим пользователя
  let userId = _param_user_id ? parseInt(_param_user_id, 10) : null;
  let user = null;

  if (userId) {
    const result = await pool.query(
      'SELECT id, email, full_name, telegram_chat_id, subscription_expires_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length > 0) user = result.rows[0];
  }

  if (!user && customer_email) {
    const result = await pool.query(
      'SELECT id, email, full_name, telegram_chat_id, subscription_expires_at FROM users WHERE email = $1',
      [customer_email]
    );
    if (result.rows.length > 0) {
      user = result.rows[0];
      userId = user.id;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Записываем платёж в prodamus_payments
    await client.query(
      `INSERT INTO prodamus_payments
       (user_id, plan_id, order_id, prodamus_order_id, amount, currency, payment_status, payment_type, payment_init, customer_email, customer_phone, prodamus_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId,
        planId,
        order_id || null,
        order_num || null,
        parseFloat(sum) || 0,
        'RUB',
        payment_status || 'unknown',
        payment_type || null,
        payment_init || null,
        customer_email || null,
        customer_phone || null,
        JSON.stringify(data)
      ]
    );

    // Активация подписки только при успешной оплате
    if (payment_status === 'success' && user && planId) {
      const now = new Date();
      const expiresAt = new Date(now);

      // Если подписка ещё активна — продлеваем от текущей даты окончания
      if (user.subscription_expires_at && new Date(user.subscription_expires_at) > now) {
        expiresAt.setTime(new Date(user.subscription_expires_at).getTime());
      }
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Обновляем подписку пользователя
      await client.query(
        `UPDATE users
         SET plan_id = $1,
             subscription_expires_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [planId, expiresAt, userId]
      );

      // Записываем в историю подписок
      await client.query(
        `INSERT INTO subscription_history
         (user_id, plan_id, start_date, end_date, source, amount_paid, payment_method, currency, transaction_id)
         VALUES ($1, $2, NOW(), $3, 'prodamus', $4, $5, 'RUB', $6)`,
        [userId, planId, expiresAt, parseFloat(sum) || 0, payment_type || 'prodamus', order_id || null]
      );

      await client.query('COMMIT');

      // Пересчёт блокировок досок (вне транзакции)
      try {
        const boardsStatus = await boardLockService.recalcUserBoardLocks(userId);
        console.log(`[PRODAMUS] Блокировки обновлены для user_id=${userId}: unlocked=${boardsStatus.unlocked}, softLocked=${boardsStatus.softLocked}`);
      } catch (lockError) {
        console.error('[PRODAMUS] Ошибка при пересчете блокировок досок:', lockError);
      }

      // Отправка уведомлений
      try {
        const planResult = await pool.query(
          'SELECT name, features FROM subscription_plans WHERE id = $1',
          [planId]
        );
        const plan = planResult.rows[0];

        const expiresDateFormatted = expiresAt.toLocaleDateString('ru-RU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Email
        if (user.email) {
          await sendSubscriptionEmail(user.email, 'new_subscription', {
            userName: user.full_name || 'Пользователь',
            planName: plan ? plan.name : 'Подписка',
            amount: parseFloat(sum) || 0,
            currency: 'RUB',
            startDate: now.toISOString(),
            expiresDate: expiresAt.toISOString()
          });
          console.log(`[PRODAMUS] Email уведомление отправлено: ${user.email}`);
        }

        // Telegram
        if (user.telegram_chat_id) {
          const telegramMessage = getSubscriptionActivatedMessage(
            user.full_name || 'Пользователь',
            plan ? plan.name : 'Подписка',
            parseFloat(sum) || 0,
            'RUB',
            expiresDateFormatted
          );

          await sendTelegramMessage(user.telegram_chat_id, telegramMessage.text, {
            parse_mode: telegramMessage.parse_mode,
            reply_markup: telegramMessage.reply_markup,
            disable_web_page_preview: telegramMessage.disable_web_page_preview
          });
          console.log(`[PRODAMUS] Telegram уведомление отправлено: chatId=${user.telegram_chat_id}`);
        }
      } catch (notifyError) {
        console.error('[PRODAMUS] Ошибка системы уведомлений:', notifyError);
      }

      return { success: true, activated: true, userId, planId };
    }

    await client.query('COMMIT');
    return { success: true, activated: false, reason: payment_status !== 'success' ? 'non-success status' : 'user or plan not found' };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
