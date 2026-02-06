import https from 'https';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

/**
 * Базовый URL Telegram Bot API
 */
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Обёртка с повторными попытками при временных ошибках
 * @param {Function} fn - Асинхронная функция для выполнения
 * @param {number} maxRetries - Максимальное количество повторов (по умолчанию 3)
 * @param {number} baseDelay - Базовая задержка в мс (по умолчанию 1000)
 * @returns {Promise<*>} Результат выполнения функции
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Повторять только при сетевых/серверных ошибках
      const isRetryable = !error.status || error.status >= 500 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
      if (!isRetryable) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Telegram] Попытка ${attempt + 1}/${maxRetries} не удалась, повтор через ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Выполнение HTTP запроса к Telegram Bot API
 *
 * @param {string} method - Метод API (например, 'sendMessage', 'getMe')
 * @param {Object} data - Данные для отправки
 * @returns {Promise<Object>} Ответ от Telegram API
 * @throws {Error} При ошибке запроса
 */
async function telegramApiRequest(method, data = {}) {
  return new Promise((resolve, reject) => {
    const url = `${TELEGRAM_API_URL}/${method}`;
    const postData = JSON.stringify(data);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);

          if (parsedData.ok) {
            resolve(parsedData.result);
          } else {
            reject(new Error(parsedData.description || 'Telegram API error'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Telegram API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Telegram API request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Отправка обычного сообщения в Telegram
 *
 * @param {string|number} chatId - ID чата получателя
 * @param {string} text - Текст сообщения
 * @param {Object} [options] - Дополнительные опции
 * @param {string} [options.parse_mode] - Режим парсинга (HTML, Markdown, MarkdownV2)
 * @param {boolean} [options.disable_web_page_preview] - Отключить предпросмотр ссылок
 * @param {boolean} [options.disable_notification] - Отправить без звука
 * @param {number} [options.reply_to_message_id] - ID сообщения для ответа
 * @returns {Promise<Object>} Результат отправки
 * @throws {Error} При ошибке отправки
 */
export async function sendTelegramMessage(chatId, text, options = {}) {
  // Валидация обязательных параметров
  if (!chatId) {
    throw new Error('Параметр "chatId" (ID чата) обязателен');
  }

  if (!text) {
    throw new Error('Параметр "text" (текст сообщения) обязателен');
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN не настроен в переменных окружения');
  }

  try {
    // Формирование данных для отправки
    const messageData = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview || false,
      disable_notification: options.disable_notification || false,
      ...options,
    };

    // Логирование попытки отправки
    console.log(`📱 Отправка Telegram сообщения в чат: ${chatId}`);
    console.log(`   Текст: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    // Отправка сообщения с retry при временных ошибках
    const result = await withRetry(() => telegramApiRequest('sendMessage', messageData));

    // Логирование успешной отправки
    console.log('✅ Telegram сообщение успешно отправлено');
    console.log(`   Message ID: ${result.message_id}`);
    console.log(`   Чат ID: ${chatId}`);
    console.log(`   Время: ${new Date().toISOString()}`);

    return {
      success: true,
      messageId: result.message_id,
      chatId: result.chat.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Детальное логирование ошибки
    console.error('❌ Ошибка отправки Telegram сообщения:');
    console.error(`   Чат ID: ${chatId}`);
    console.error(`   Текст: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    console.error(`   Ошибка: ${error.message}`);
    console.error(`   Время: ${new Date().toISOString()}`);

    // Пробрасываем ошибку с дополнительной информацией
    const enhancedError = new Error(`Не удалось отправить Telegram сообщение: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.chatId = chatId;

    throw enhancedError;
  }
}

/**
 * Отправка сообщения с inline-кнопками в Telegram
 *
 * @param {string|number} chatId - ID чата получателя
 * @param {string} text - Текст сообщения
 * @param {Array<Array<Object>>} buttons - Массив массивов кнопок
 *   Формат кнопки: { text: 'Текст кнопки', callback_data: 'данные' } или { text: 'Текст', url: 'ссылка' }
 * @param {Object} [options] - Дополнительные опции (parse_mode и т.д.)
 * @returns {Promise<Object>} Результат отправки
 * @throws {Error} При ошибке отправки
 *
 * @example
 * // Одна строка с двумя кнопками
 * sendTelegramMessageWithButtons(
 *   chatId,
 *   'Выберите действие:',
 *   [[
 *     { text: '✅ Подтвердить', callback_data: 'confirm' },
 *     { text: '❌ Отменить', callback_data: 'cancel' }
 *   ]]
 * );
 *
 * @example
 * // Две строки кнопок
 * sendTelegramMessageWithButtons(
 *   chatId,
 *   'Меню:',
 *   [
 *     [{ text: 'Опция 1', callback_data: 'opt1' }],
 *     [{ text: 'Опция 2', callback_data: 'opt2' }]
 *   ]
 * );
 */
export async function sendTelegramMessageWithButtons(chatId, text, buttons, options = {}) {
  // Валидация параметров
  if (!chatId) {
    throw new Error('Параметр "chatId" (ID чата) обязателен');
  }

  if (!text) {
    throw new Error('Параметр "text" (текст сообщения) обязателен');
  }

  if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
    throw new Error('Параметр "buttons" должен быть непустым массивом кнопок');
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN не настроен в переменных окружения');
  }

  try {
    // Формирование inline клавиатуры
    const replyMarkup = {
      inline_keyboard: buttons,
    };

    // Объединение опций с клавиатурой
    const messageOptions = {
      ...options,
      reply_markup: replyMarkup,
    };

    // Логирование попытки отправки
    console.log(`📱 Отправка Telegram сообщения с кнопками в чат: ${chatId}`);
    console.log(`   Количество кнопок: ${buttons.flat().length}`);

    // Отправка сообщения с кнопками
    const result = await sendTelegramMessage(chatId, text, messageOptions);

    console.log('✅ Telegram сообщение с кнопками успешно отправлено');

    return result;
  } catch (error) {
    console.error('❌ Ошибка отправки Telegram сообщения с кнопками:');
    console.error(`   Чат ID: ${chatId}`);
    console.error(`   Ошибка: ${error.message}`);

    const enhancedError = new Error(`Не удалось отправить Telegram сообщение с кнопками: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.chatId = chatId;

    throw enhancedError;
  }
}

/**
 * Проверка подключения к Telegram Bot API
 * Проверяет валидность токена и доступность бота
 *
 * @returns {Promise<Object>} Информация о боте и результат проверки
 * @throws {Error} При ошибке подключения
 */
export async function checkBotConnection() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не настроен в переменных окружения');
    return {
      connected: false,
      error: 'TELEGRAM_BOT_TOKEN не настроен',
    };
  }

  try {
    console.log('🔍 Проверка подключения к Telegram Bot API...');

    // Вызов метода getMe для проверки токена
    const botInfo = await telegramApiRequest('getMe');

    console.log('✅ Подключение к Telegram Bot API успешно');
    console.log(`   Имя бота: ${botInfo.first_name}`);
    console.log(`   Username: @${botInfo.username}`);
    console.log(`   ID: ${botInfo.id}`);

    return {
      connected: true,
      bot: {
        id: botInfo.id,
        firstName: botInfo.first_name,
        username: botInfo.username,
        canJoinGroups: botInfo.can_join_groups,
        canReadAllGroupMessages: botInfo.can_read_all_group_messages,
        supportsInlineQueries: botInfo.supports_inline_queries,
      },
    };
  } catch (error) {
    console.error('❌ Ошибка подключения к Telegram Bot API:');
    console.error(`   Ошибка: ${error.message}`);

    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Отправка тестового сообщения
 * Используется для проверки работоспособности Telegram сервиса
 *
 * @param {string|number} chatId - ID чата для тестового сообщения
 * @returns {Promise<Object>} Результат тестовой отправки
 * @throws {Error} При ошибке отправки
 */
export async function sendTestMessage(chatId) {
  const text = `
🧪 <b>Тестовое уведомление</b>

Это тестовое сообщение для проверки работоспособности Telegram сервиса.

Если вы получили это сообщение, значит настройка Telegram бота прошла успешно! ✅

━━━━━━━━━━━━━━━━━━━━
<i>Отправлено: ${new Date().toLocaleString('ru-RU')}</i>
<i>Система: FOHOW Interactive Board</i>
  `.trim();

  console.log(`🧪 Отправка тестового сообщения в чат: ${chatId}`);

  return await sendTelegramMessage(chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

/**
 * Проверка конфигурации Telegram
 * Проверяет наличие токена бота
 *
 * @returns {Object} Результат проверки конфигурации
 */
export function checkTelegramConfig() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не настроен в переменных окружения');
    return {
      configured: false,
      missing: ['TELEGRAM_BOT_TOKEN'],
    };
  }

  console.log('✅ Конфигурация Telegram настроена корректно');
  return {
    configured: true,
    missing: [],
  };
}

// Экспорт по умолчанию
export default {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  checkBotConnection,
  sendTestMessage,
  checkTelegramConfig,
};
