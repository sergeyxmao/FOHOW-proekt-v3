import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

/**
 * Создание транспорта для отправки email
 * Использует настройки SMTP из переменных окружения
 */
const createTransporter = () => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === '465', // Автоматически true для порта 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Дополнительные настройки для надежности
      pool: true, // Использование пула соединений
      maxConnections: 5, // Максимум 5 одновременных соединений
      maxMessages: 100, // Максимум 100 сообщений на соединение
    });

    console.log('✅ Email транспорт успешно создан');
    return transporter;
  } catch (error) {
    console.error('❌ Ошибка создания email транспорта:', error.message);
    throw error;
  }
};

// Инициализация транспорта
let transporter = null;

/**
 * Получение или создание транспорта
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

/**
 * Универсальная функция отправки email
 *
 * @param {string} to - Email получателя (или массив email'ов)
 * @param {string} subject - Тема письма
 * @param {string} html - HTML содержимое письма
 * @param {string} [text] - Текстовая версия письма (опционально)
 * @param {Object} [options] - Дополнительные опции
 * @param {string} [options.from] - Email отправителя (по умолчанию из ENV)
 * @param {Array} [options.attachments] - Вложения
 * @param {Array} [options.cc] - Копия письма
 * @param {Array} [options.bcc] - Скрытая копия
 * @returns {Promise<Object>} Результат отправки
 * @throws {Error} При ошибке отправки
 */
export async function sendEmail(to, subject, html, text = null, options = {}) {
  // Валидация обязательных параметров
  if (!to) {
    throw new Error('Параметр "to" (получатель) обязателен');
  }

  if (!subject) {
    throw new Error('Параметр "subject" (тема) обязателен');
  }

  if (!html && !text) {
    throw new Error('Необходимо указать хотя бы один из параметров: "html" или "text"');
  }

  try {
    const emailTransporter = getTransporter();

    // Формирование опций письма
    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Если text не указан, создаем из html
      ...options, // Дополнительные опции (cc, bcc, attachments и т.д.)
    };

    // Логирование попытки отправки
    console.log(`📧 Отправка email на: ${mailOptions.to}`);
    console.log(`   Тема: ${subject}`);

    // Отправка email
    const info = await emailTransporter.sendMail(mailOptions);

    // Логирование успешной отправки
    console.log('✅ Email успешно отправлен');
    console.log(`   MessageID: ${info.messageId}`);
    console.log(`   Получатель: ${mailOptions.to}`);
    console.log(`   Время: ${new Date().toISOString()}`);

    return {
      success: true,
      messageId: info.messageId,
      to: mailOptions.to,
      subject,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Детальное логирование ошибки
    console.error('❌ Ошибка отправки email:');
    console.error(`   Получатель: ${to}`);
    console.error(`   Тема: ${subject}`);
    console.error(`   Ошибка: ${error.message}`);
    console.error(`   Код ошибки: ${error.code || 'N/A'}`);
    console.error(`   Время: ${new Date().toISOString()}`);

    // Пробрасываем ошибку с дополнительной информацией
    const enhancedError = new Error(`Не удалось отправить email: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.recipient = to;
    enhancedError.subject = subject;

    throw enhancedError;
  }
}

/**
 * Проверка конфигурации email
 * Проверяет наличие всех необходимых переменных окружения
 *
 * @returns {Object} Результат проверки конфигурации
 */
export function checkEmailConfig() {
  const requiredVars = [
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn('⚠️  Отсутствуют переменные окружения для email:');
    missingVars.forEach(varName => {
      console.warn(`   - ${varName}`);
    });

    return {
      configured: false,
      missing: missingVars,
    };
  }

  console.log('✅ Конфигурация email настроена корректно');
  return {
    configured: true,
    missing: [],
  };
}

/**
 * Тестовая отправка email
 * Используется для проверки работоспособности email сервиса
 *
 * @param {string} to - Email получателя для теста
 * @returns {Promise<Object>} Результат тестовой отправки
 */
export async function sendTestEmail(to) {
  const subject = 'Тестовое письмо - FOHOW Interactive Board';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Тестовое письмо</h2>
      <p>Это тестовое письмо для проверки работоспособности email сервиса.</p>
      <p>Если вы получили это письмо, значит настройка email прошла успешно! ✅</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        Отправлено: ${new Date().toLocaleString('ru-RU')}<br>
        Система: FOHOW Interactive Board
      </p>
    </div>
  `;
  const text = 'Это тестовое письмо. Если вы получили это письмо, значит настройка email прошла успешно!';

  return await sendEmail(to, subject, html, text);
}

// =====================================================
// Обёртки для конкретных типов email-уведомлений
// =====================================================

import {
  getVerificationCodeTemplate,
  getPasswordResetTemplate,
  getWelcomeTemplate,
  getSubscriptionEventTemplate,
  getPasswordChangedTemplate
} from '../templates/emailTemplates.js';

/**
 * Отправка кода подтверждения email
 * @param {string} email - адрес получателя
 * @param {string} code - 6-значный код
 */
export async function sendVerificationEmail(email, code) {
  const { subject, html } = getVerificationCodeTemplate({ code });
  return await sendEmail(email, subject, html);
}

/**
 * Отправка письма для сброса пароля
 * @param {string} email - адрес получателя
 * @param {string} token - JWT-токен сброса
 */
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const { subject, html } = getPasswordResetTemplate({ resetUrl });
  return await sendEmail(email, subject, html);
}

/**
 * Отправка приветственного письма
 * @param {string} email - адрес получателя
 * @param {string} userName - имя пользователя
 */
export async function sendWelcomeEmail(email, userName = '') {
  const dashboardUrl = `${process.env.FRONTEND_URL}/boards`;
  const { subject, html } = getWelcomeTemplate({
    userName: userName || email.split('@')[0],
    demoDays: 14,
    dashboardUrl
  });
  return await sendEmail(email, subject, html);
}

/**
 * Отправка email-уведомлений о событиях подписки
 * @param {string} email - Email получателя
 * @param {string} eventType - Тип события: 'new', 'renewed', 'cancelled', 'promo'
 * @param {Object} data - Данные подписки
 * @param {string} data.userName - Имя пользователя
 * @param {string} data.planName - Название тарифа
 * @param {number} data.amount - Сумма оплаты
 * @param {string} data.currency - Валюта
 * @param {string} data.startDate - Дата начала (ISO)
 * @param {string} data.expiresDate - Дата окончания (ISO)
 * @param {string} [data.promoCode] - Промокод (для eventType='promo')
 */
export async function sendSubscriptionEmail(email, eventType, data) {
  const { subject, html } = getSubscriptionEventTemplate({ eventType, ...data });
  return await sendEmail(email, subject, html);
}

/**
 * Отправка уведомления о смене пароля
 * @param {string} email - Email получателя
 * @param {Object} data - Данные события
 * @param {Date} [data.changedAt] - Время смены пароля
 * @param {string} [data.locationString] - Местоположение
 */
export async function sendPasswordChangedEmail(email, data = {}) {
  const changedAt = data.changedAt || new Date();
  const formattedDate = changedAt.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const { subject, html } = getPasswordChangedTemplate({
    formattedDate,
    locationString: data.locationString
  });
  return await sendEmail(email, subject, html);
}

// Экспорт по умолчанию
export default {
  sendEmail,
  checkEmailConfig,
  sendTestEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSubscriptionEmail,
  sendPasswordChangedEmail,
};
