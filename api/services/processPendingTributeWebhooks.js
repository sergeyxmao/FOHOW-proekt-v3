/**
 * Утилита для обработки отложенных webhook от Tribute
 *
 * Когда webhook приходит от Tribute раньше, чем пользователь
 * привязал свой Telegram к аккаунту, webhook сохраняется
 * в таблицу pending_tribute_webhooks.
 *
 * После привязки Telegram эта функция обрабатывает
 * отложенные webhook для данного пользователя.
 */

import { pool } from '../db.js';
import { handleNewSubscription } from './tributeService.js';

/**
 * Обработать отложенные webhook для пользователя после привязки Telegram
 * @param {string} telegramUserId - Telegram user ID (chat_id)
 * @returns {Promise<{processed: number, errors: number}>}
 */
export async function processPendingTributeWebhooks(telegramUserId) {
  const client = await pool.connect();
  let processed = 0;
  let errors = 0;

  try {
    // Найти необработанные webhook
    const result = await client.query(
      `SELECT id, payload FROM pending_tribute_webhooks
       WHERE telegram_user_id = $1 AND processed = FALSE
       ORDER BY created_at ASC`,
      [String(telegramUserId)]
    );

    if (result.rows.length === 0) {
      console.log(`[Pending Webhooks] Нет отложенных webhook для telegram_user_id=${telegramUserId}`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[Pending Webhooks] 📥 Найдено ${result.rows.length} отложенных webhook для telegram_user_id=${telegramUserId}`);

    for (const row of result.rows) {
      try {
        // Парсим payload
        let payload;
        if (typeof row.payload === 'string') {
          payload = JSON.parse(row.payload);
        } else {
          payload = row.payload;
        }

        // Обрабатываем как новую подписку
        await handleNewSubscription(payload);

        // Отмечаем как обработанный
        await client.query(
          `UPDATE pending_tribute_webhooks
           SET processed = TRUE, processed_at = NOW()
           WHERE id = $1`,
          [row.id]
        );

        console.log(`✅ Обработан отложенный webhook id=${row.id}`);
        processed++;

      } catch (error) {
        console.error(`❌ Ошибка обработки pending webhook id=${row.id}:`, error);
        errors++;
      }
    }

    console.log(`[Pending Webhooks] 📊 Итог: обработано ${processed}, ошибок ${errors}`);
    return { processed, errors };

  } catch (error) {
    console.error('❌ Ошибка обработки отложенных webhook:', error);
    return { processed, errors: errors + 1 };
  } finally {
    client.release();
  }
}
