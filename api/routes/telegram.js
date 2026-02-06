/**
 * Маршруты для интеграции с Telegram
 * - POST /api/user/telegram/generate-code - Генерация кода для привязки
 * - GET /api/user/telegram/check-link-status - Проверка статуса привязки (polling)
 * - POST /api/user/connect-telegram - Привязка Telegram к аккаунту
 * - GET /api/user/telegram-status - Проверка статуса привязки Telegram
 */

import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getBot } from '../bot/telegramBot.js';
import { getTelegramDisconnectedMessage } from '../templates/telegramTemplates.js';

/**
 * Регистрация маршрутов для интеграции с Telegram
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerTelegramRoutes(app) {

  // === ГЕНЕРАЦИЯ КОДА ДЛЯ ПРИВЯЗКИ TELEGRAM ===
  app.post('/api/user/telegram/generate-code', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Telegram'],
      summary: 'Генерация кода для привязки Telegram',
      description: 'Генерирует уникальный код для привязки Telegram аккаунта к профилю пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            code: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            botUsername: { type: 'string' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Генерируем уникальный код (6 символов, буквы и цифры)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Удаляем старые неиспользованные коды этого пользователя
      await pool.query(
        'DELETE FROM telegram_link_codes WHERE user_id = $1 AND used = false',
        [userId]
      );

      // Создаем новый код (expires_at вычисляется в SQL для корректной работы с timezone)
      const result = await pool.query(
        `INSERT INTO telegram_link_codes (user_id, code, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
         RETURNING expires_at`,
        [userId, code]
      );
      const expiresAt = result.rows[0].expires_at;

      console.log(`✅ Код для привязки Telegram сгенерирован: пользователь ID=${userId}, код=${code}`);

      return reply.send({
        success: true,
        code: code,
        expiresAt: expiresAt,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || 'fohow_bot'
      });
    } catch (err) {
      console.error('❌ Ошибка генерации кода привязки Telegram:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПРОВЕРКА СТАТУСА ПРИВЯЗКИ TELEGRAM (POLLING) ===
  app.get('/api/user/telegram/check-link-status', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Telegram'],
      summary: 'Проверка статуса привязки Telegram',
      description: 'Проверяет, привязан ли Telegram аккаунт к профилю текущего пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            linked: { type: 'boolean' },
            telegram: {
              type: 'object',
              nullable: true,
              properties: {
                chat_id: { type: 'string' },
                username: { type: 'string', nullable: true }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получаем информацию о пользователе
      const result = await pool.query(
        'SELECT telegram_chat_id, telegram_user, full_name FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const user = result.rows[0];
      const isLinked = !!user.telegram_chat_id;

      return reply.send({
        success: true,
        linked: isLinked,
        telegram: isLinked ? {
          chat_id: user.telegram_chat_id,
          username: user.telegram_user
        } : null
      });
    } catch (err) {
      console.error('❌ Ошибка проверки статуса привязки Telegram:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПРИВЯЗКА TELEGRAM К АККАУНТУ (используется ботом) ===
  app.post('/api/user/connect-telegram', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Telegram'],
      summary: 'Привязка Telegram к аккаунту',
      description: 'Привязывает Telegram аккаунт к профилю пользователя по chat_id',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['telegram_chat_id'],
        properties: {
          telegram_chat_id: { type: ['string', 'integer'] },
          telegram_username: { type: 'string', nullable: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            telegram: {
              type: 'object',
              properties: {
                chat_id: { type: 'string' },
                username: { type: 'string', nullable: true }
              }
            }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { telegram_chat_id, telegram_username } = req.body;

      // Валидация входных данных
      if (!telegram_chat_id) {
        return reply.code(400).send({
          error: 'Обязательное поле: telegram_chat_id'
        });
      }

      // Проверяем, что chat_id является числом или строкой с числом
      const chatId = String(telegram_chat_id).trim();
      if (chatId.length === 0) {
        return reply.code(400).send({
          error: 'telegram_chat_id не может быть пустым'
        });
      }

      // Проверяем, не привязан ли уже этот Telegram к другому пользователю
      const existingConnection = await pool.query(
        'SELECT id, email FROM users WHERE telegram_chat_id = $1 AND id != $2',
        [chatId, userId]
      );

      if (existingConnection.rows.length > 0) {
        return reply.code(409).send({
          error: 'Этот Telegram аккаунт уже привязан к другому пользователю'
        });
      }

      // Обновляем данные пользователя
      const result = await pool.query(
        `UPDATE users
         SET telegram_chat_id = $1,
             telegram_user = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, email, telegram_chat_id, telegram_user`,
        [chatId, telegram_username || null, userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ Telegram привязан к пользователю ID=${userId}, chat_id=${chatId}`);

      // Обработать отложенные Tribute webhooks для этого telegram_chat_id
      try {
        const { processPendingTributeWebhooks } = await import('../services/processPendingTributeWebhooks.js');
        const pendingResult = await processPendingTributeWebhooks(chatId);
        if (pendingResult.processed > 0) {
          console.log(`✅ Pending Tribute webhooks обработаны для telegram_chat_id=${chatId}: ${pendingResult.processed} шт.`);
        }
      } catch (pendingError) {
        // Не прерываем выполнение, только логируем ошибку
        console.error('⚠️ Ошибка обработки pending Tribute webhooks:', pendingError);
      }

      return reply.send({
        success: true,
        message: 'Telegram успешно привязан к аккаунту',
        telegram: {
          chat_id: result.rows[0].telegram_chat_id,
          username: result.rows[0].telegram_user
        }
      });
    } catch (err) {
      console.error('❌ Ошибка привязки Telegram:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ОТКЛЮЧЕНИЕ TELEGRAM ОТ АККАУНТА ===
  app.post('/api/user/telegram/unlink', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Telegram'],
      summary: 'Отключение Telegram от аккаунта',
      description: 'Отвязывает Telegram аккаунт от профиля текущего пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получаем данные пользователя ПЕРЕД удалением
      const userResult = await pool.query(
        'SELECT telegram_chat_id, telegram_user, full_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const chatId = userResult.rows[0].telegram_chat_id;

      // Обнуляем данные Telegram у пользователя
      const result = await pool.query(
        `UPDATE users
         SET telegram_chat_id = NULL,
             telegram_user = NULL,
             telegram_channel = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, email`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ Telegram отключен для пользователя ID=${userId}`);

      // Отправить уведомление в Telegram (если chat_id был)
      if (chatId) {
        try {
          const bot = getBot(); // Получаем экземпляр бота через функцию getBot()
          if (bot) {
// Получаем имя пользователя для персонализации
const userName = userResult.rows[0].full_name || 'Пользователь';
const profileUrl = process.env.FRONTEND_URL || 'https://interactive.marketingfohow.ru';

// Используем шаблон
const message = getTelegramDisconnectedMessage(userName, profileUrl);

await bot.sendMessage(chatId, message.text, {
  parse_mode: message.parse_mode,
  disable_web_page_preview: message.disable_web_page_preview,
  reply_markup: message.reply_markup
});
console.log(`✅ Уведомление об отключении отправлено в Telegram: chat_id=${chatId}`);

          }
        } catch (botError) {
          console.error('⚠️ Не удалось отправить уведомление в Telegram:', botError);
          // Не прерываем выполнение, если бот недоступен
        }
      }

      return reply.send({
        success: true,
        message: 'Telegram успешно отключен от аккаунта'
      });
    } catch (err) {
      console.error('❌ Ошибка отключения Telegram:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
