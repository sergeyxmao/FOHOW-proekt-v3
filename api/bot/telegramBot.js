/**
 * Telegram бот для обработки команд и привязки аккаунтов
 *
 * Функционал:
 * - Обработка команды /start
 * - Обработка команды /start с кодом для привязки аккаунта
 * - Отправка приветственных сообщений
 */

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

let bot = null;

/**
 * Инициализация Telegram бота
 */
export function initializeTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не настроен. Бот не будет запущен.');
    return null;
  }

  try {
    // Создаем бота с long polling
    bot = new TelegramBot(token, { polling: true });

    console.log('✅ Telegram бот запущен и готов к работе');

    // Обработка команды /start
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from.username || null;
      const firstName = msg.from.first_name || 'Пользователь';

      // Извлекаем код из команды (если есть)
      const code = match[1].trim();

      if (code) {
        // Пользователь отправил /start с кодом
        await handleLinkCode(chatId, username, firstName, code);
      } else {
        // Обычное приветствие
        await sendWelcomeMessage(chatId, firstName);
      }
    });

    // Обработка ошибок polling
    bot.on('polling_error', (error) => {
      console.error('❌ Ошибка Telegram bot polling:', error);
    });

    return bot;
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram бота:', error);
    return null;
  }
}

/**
 * Обработка кода привязки аккаунта
 */
async function handleLinkCode(chatId, username, firstName, code) {
  try {
    console.log(`🔗 Попытка привязки аккаунта: chatId=${chatId}, код=${code}`);

    // Ищем код в базе данных, проверяя срок действия в SQL для корректной работы с timezone
    const codeResult = await pool.query(
      `SELECT user_id, expires_at, used, expires_at < NOW() as is_expired
       FROM telegram_link_codes
       WHERE code = $1`,
      [code]
    );

    // Проверяем, существует ли код
    if (codeResult.rows.length === 0) {
      await bot.sendMessage(
        chatId,
        `❌ <b>Неверный код</b>\n\n` +
        `Код <code>${code}</code> не найден.\n\n` +
        `Пожалуйста, проверьте код и попробуйте снова.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const linkCode = codeResult.rows[0];

    // Проверяем, не использован ли код
    if (linkCode.used) {
      await bot.sendMessage(
        chatId,
        `❌ <b>Код уже использован</b>\n\n` +
        `Код <code>${code}</code> уже был использован ранее.\n\n` +
        `Сгенерируйте новый код в настройках профиля.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Проверяем, не истек ли код (результат вычислен в SQL)
    if (linkCode.is_expired) {
      await bot.sendMessage(
        chatId,
        `⏰ <b>Код истек</b>\n\n` +
        `Код <code>${code}</code> истек.\n\n` +
        `Сгенерируйте новый код в настройках профиля.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Проверяем, не привязан ли уже этот Telegram к другому аккаунту
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE telegram_chat_id = $1',
      [chatId.toString()]
    );

    if (existingUser.rows.length > 0) {
      const existingEmail = existingUser.rows[0].email;
      await bot.sendMessage(
        chatId,
        `⚠️ <b>Аккаунт уже привязан</b>\n\n` +
        `Ваш Telegram уже привязан к аккаунту: <code>${existingEmail}</code>\n\n` +
        `Если вы хотите привязать другой аккаунт, сначала отвяжите текущий.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Все проверки пройдены - привязываем аккаунт
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Обновляем пользователя
      const userResult = await client.query(
        `UPDATE users
         SET telegram_chat_id = $1, telegram_user = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING email`,
        [chatId.toString(), username, linkCode.user_id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }

      const userEmail = userResult.rows[0].email;

      // Отмечаем код как использованный
      await client.query(
        'UPDATE telegram_link_codes SET used = true WHERE code = $1',
        [code]
      );

      await client.query('COMMIT');

      console.log(`✅ Telegram привязан: пользователь ${userEmail}, chatId=${chatId}`);

      // Отправляем сообщение об успешной привязке
      await bot.sendMessage(
        chatId,
        `✅ <b>Успешно привязано!</b>\n\n` +
        `Ваш Telegram успешно привязан к аккаунту:\n` +
        `<code>${userEmail}</code>\n\n` +
        `Теперь вы будете получать уведомления о:\n` +
        `• Истечении подписки\n` +
        `• Новых функциях\n` +
        `• Важных обновлениях\n\n` +
        `🔔 Уведомления активированы!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👤 В профиль', url: 'https://interactive.marketingfohow.ru/' }]
            ]
          }
        }
      );

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Ошибка обработки кода привязки:', error);
    await bot.sendMessage(
      chatId,
      `❌ <b>Ошибка</b>\n\n` +
      `Произошла ошибка при привязке аккаунта.\n\n` +
      `Пожалуйста, попробуйте позже или обратитесь в поддержку.`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Отправка приветственного сообщения
 */
async function sendWelcomeMessage(chatId, firstName) {
  try {
    // Проверяем, привязан ли этот chatId к какому-то аккаунту
    const userResult = await pool.query(
      'SELECT full_name FROM users WHERE telegram_chat_id = $1',
      [chatId.toString()]
    );

    let displayName = 'Друг'; // По умолчанию

    if (userResult.rows.length > 0) {
      // Пользователь привязан - берем имя из профиля
      const user = userResult.rows[0];
      if (user.full_name) {
        displayName = user.full_name;
      }
    } else if (firstName) {
      // Пользователь не привязан - используем имя из Telegram
      displayName = firstName;
    }

    const message = `
👋 <b>Привет, ${displayName}!</b>

Я бот FOHOW Interactive Board.

Чтобы привязать ваш Telegram аккаунт к профилю:

1️⃣ Зайдите в настройки профиля на <a href="https://interactive.marketingfohow.ru">FOHOW Interactive Board</a>
2️⃣ Найдите раздел "Telegram уведомления"
3️⃣ Нажмите "Подключить Telegram"
4️⃣ Скопируйте код и отправьте мне команду:
   <code>/start ВАШ_КОД</code>

После привязки вы будете получать:
• 🔔 Уведомления о подписке
• 📢 Новости и обновления
• ⚡ Важные оповещения

<i>Нужна помощь? Обратитесь в поддержку <a href="https://t.me/FOHOWadmin">@FOHOWadmin</a></i>

📢 Наш канал по маркетингу: <a href="https://t.me/MarketingFohow">@MarketingFohow</a>
    `.trim();

    await bot.sendMessage(chatId, message, { 
      parse_mode: 'HTML',
      disable_web_page_preview: true // Отключаем превью ссылок
    });
  } catch (error) {
    console.error('❌ Ошибка отправки приветственного сообщения:', error);
    // Отправляем упрощенное сообщение если произошла ошибка
    await bot.sendMessage(
      chatId, 
      `👋 Привет! Я бот FOHOW Interactive Board.\n\nДля привязки аккаунта зайдите на сайт https://interactive.marketingfohow.ru`
    );
  }
}

/**
 * Получить экземпляр бота
 */
export function getBot() {
  return bot;
}

export default {
  initializeTelegramBot,
  getBot
};
