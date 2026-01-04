/**
 * Маршруты для интеграции с Telegram
 * - POST /api/user/telegram/generate-code - Генерация кода для привязки
 * - GET /api/user/telegram/check-link-status - Проверка статуса привязки (polling)
 * - POST /api/user/connect-telegram - Привязка Telegram к аккаунту
 * - GET /api/user/telegram-status - Проверка статуса привязки Telegram
 */

import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация маршрутов для интеграции с Telegram
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerTelegramRoutes(app) {

  // === ГЕНЕРАЦИЯ КОДА ДЛЯ ПРИВЯЗКИ TELEGRAM ===
  app.post('/api/user/telegram/generate-code', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Генерируем уникальный код (6 символов, буквы и цифры)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Код действителен 15 минут
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Удаляем старые неиспользованные коды этого пользователя
      await pool.query(
        'DELETE FROM telegram_link_codes WHERE user_id = $1 AND used = false',
        [userId]
      );

      // Создаем новый код
      await pool.query(
        `INSERT INTO telegram_link_codes (user_id, code, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, code, expiresAt]
      );

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
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получаем информацию о пользователе
      const result = await pool.query(
        'SELECT telegram_chat_id, telegram_user FROM users WHERE id = $1',
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
    preHandler: [authenticateToken]
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
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получаем данные пользователя ПЕРЕД удалением
      const userResult = await pool.query(
        'SELECT telegram_chat_id, telegram_user FROM users WHERE id = $1',
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
          const bot = app.telegramBot; // Получаем экземпляр бота из app
          if (bot) {
            await bot.telegram.sendMessage(
              chatId,
              '🔕 <b>Уведомления отключены</b>\n\n' +
              'Ваш Telegram больше не привязан к аккаунту FOHOW Interactive Board.\n\n' +
              'Чтобы снова включить уведомления, зайдите в настройки профиля.',
              { parse_mode: 'HTML' }
            );
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
