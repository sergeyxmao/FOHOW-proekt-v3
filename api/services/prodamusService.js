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
 * Парсинг URL-encoded строки аналогично PHP parse_str().
 * Поддерживает вложенные ключи: products[0][name]=X → { products: { '0': { name: 'X' } } }
 * '+' декодируется как пробел (поведение PHP).
 * HTML-сущности (&quot;) НЕ декодируются (поведение PHP parse_str).
 *
 * @param {string} rawBody - Сырая URL-encoded строка
 * @returns {object} Объект с вложенной структурой
 */
function phpParseStr(rawBody) {
  const result = {};

  for (const pair of rawBody.split('&')) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    const rawVal = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);

    // Декодируем: '+' → пробел, %XX → символ
    const value = decodeURIComponent(rawVal.replace(/\+/g, ' '));

    // Разбираем ключ: products[0][name] → ['products', '0', 'name']
    const keyParts = [];
    const baseMatch = rawKey.match(/^([^[]*)/);
    if (baseMatch) {
      keyParts.push(decodeURIComponent(baseMatch[1].replace(/\+/g, ' ')));
    }
    const bracketRe = /\[([^\]]*)\]/g;
    let m;
    while ((m = bracketRe.exec(rawKey)) !== null) {
      keyParts.push(decodeURIComponent(m[1].replace(/\+/g, ' ')));
    }

    // Записываем значение во вложенную структуру
    let ref = result;
    for (let i = 0; i < keyParts.length - 1; i++) {
      const k = keyParts[i];
      if (!(k in ref) || typeof ref[k] !== 'object' || ref[k] === null) {
        ref[k] = {};
      }
      ref = ref[k];
    }
    ref[keyParts[keyParts.length - 1]] = value;
  }

  return result;
}

/**
 * Рекурсивное приведение всех значений объекта к строкам.
 * Аналог поведения PHP, где все значения из parse_str — строки.
 *
 * @param {*} obj - Объект или примитив
 * @returns {*} Объект с теми же ключами, но все значения — строки
 */
function deepStringify(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) return obj.map(deepStringify);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = deepStringify(v);
  }
  return out;
}

/**
 * Верификация подписи webhook от Продамуса.
 * Подпись приходит в HTTP заголовке Sign.
 *
 * Алгоритм (аналогичен PHP-серверу Продамуса):
 * 1. Берём сырое тело запроса (__rawBody)
 * 2. Парсим через phpParseStr() — аналог PHP parse_str()
 * 3. Приводим все значения к строкам через deepStringify()
 * 4. Рекурсивно сортируем по ключам через deepSortByKeys()
 * 5. JSON.stringify → HMAC-SHA256 → hex
 * 6. Сравниваем через crypto.timingSafeEqual()
 *
 * @param {object} data - Данные из тела запроса (должны содержать __rawBody)
 * @param {string} receivedSignature - Подпись из заголовка Sign
 * @param {string} secretKey - Секретный ключ Продамуса
 * @returns {boolean} Результат верификации
 */
export function verifySignature(data, receivedSignature, secretKey) {
  const rawBody = data.__rawBody;
  if (!rawBody) {
    console.error('[PRODAMUS] verifySignature: __rawBody отсутствует в данных');
    return false;
  }

  // Парсим сырое тело как PHP parse_str()
  const parsed = phpParseStr(rawBody);

  // Приводим все значения к строкам
  const stringified = deepStringify(parsed);

  // Считаем подпись: deepSortByKeys → JSON → HMAC-SHA256
  const computed = createSignature(stringified, secretKey);

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
// Формирование ссылки на оплату (DEPRECATED)
// Больше не используется — перешли на готовые ссылки Продамуса.
// Оставлено для обратной совместимости.
// ============================================

/**
 * @deprecated Не используется — перешли на готовые ссылки Продамуса.
 * Сериализация вложенного объекта в плоский формат PHP-нотации.
 * { products: { '0': { name: 'X' } } } → { 'products[0][name]': 'X' }
 */
function flattenToPhpNotation(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenToPhpNotation(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

/**
 * @deprecated Не используется — перешли на готовые ссылки Продамуса.
 * Создание ссылки на оплату через Продамус (программное формирование с HMAC-подписью).
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

  // Параметры платежа — вложенная структура (как PHP видит данные)
  // Подпись считается от этой вложенной структуры
  const params = {
    do: 'link',
    products: {
      '0': {
        name: `Доступ к платформе FoBoard, тариф "${planName}", подписка на 30 дней`,
        price: String(price),
        quantity: '1',
        sku: `plan_${planId}`
      }
    },
    customer_email: email,
    order_id: orderId,
    urlReturn: returnUrl,
    urlSuccess: successUrl,
    urlNotification: webhookUrl,
    _param_user_id: String(userId),
    payment_method: 'AC',
    available_payment_methods: 'AC|SBP|sbol|tpay'
  };

  // Подпись от вложенной структуры (deepSortByKeys обрабатывает вложенные объекты)
  const signature = createSignature(params, secretKey);

  // Для URL сериализуем обратно в плоский формат PHP-нотации
  const flatParams = flattenToPhpNotation(params);
  flatParams.signature = signature;

  const queryString = Object.entries(flatParams)
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

  // products может прийти в разных форматах:
  // 1. Массив: [{ name, sku, ... }] — из JSON
  // 2. Объект с числовыми ключами: { '0': { name, sku, ... } } — из phpParseStr
  // 3. Плоские ключи в data: data['products[0][sku]'] — из URLSearchParams (без phpParseStr)
  let resolvedProducts = products;
  if (!resolvedProducts) {
    // Fallback: собираем products из плоских ключей (products[0][name], products[0][sku], ...)
    const flatProducts = {};
    for (const [key, value] of Object.entries(data)) {
      const match = key.match(/^products\[(\d+)\]\[(\w+)\]$/);
      if (match) {
        const idx = match[1];
        const field = match[2];
        if (!flatProducts[idx]) flatProducts[idx] = {};
        flatProducts[idx][field] = value;
      }
    }
    if (Object.keys(flatProducts).length > 0) {
      resolvedProducts = flatProducts;
    }
  }

  if (resolvedProducts) {
    const product = Array.isArray(resolvedProducts)
      ? resolvedProducts[0]
      : resolvedProducts['0'] || Object.values(resolvedProducts)[0];
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
          await sendSubscriptionEmail(user.email, 'new', {
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
