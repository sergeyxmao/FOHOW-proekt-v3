/**
 * Email Templates
 * HTML-шаблоны для email-уведомлений
 */

/**
 * Базовый стиль для всех email-шаблонов
 */
const baseStyles = {
  container: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;',
  header: 'background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%); padding: 40px 20px; text-align: center;',
  headerTitle: 'color: #3a2800; font-size: 28px; font-weight: 700; margin: 0;',
  content: 'padding: 40px 30px;',
  title: 'color: #1a202c; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;',
  text: 'color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;',
  highlight: 'background-color: #fffbeb; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;',
  highlightText: 'color: #2d3748; font-size: 16px; margin: 0;',
  button: 'display: inline-block; background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%); color: #3a2800; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; transition: transform 0.2s;',
  buttonContainer: 'text-align: center; margin: 30px 0;',
  footer: 'background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;',
  footerText: 'color: #718096; font-size: 14px; margin: 0 0 10px 0;',
  divider: 'border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;',
  accentColor: '#ffc107',
  accentHover: '#e8a900',
  buttonTextColor: '#3a2800'
};

/**
 * Шаблон уведомления о скором истечении подписки
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {number} params.daysLeft - Количество дней до истечения
 * @param {string} params.expirationDate - Дата истечения подписки (DD.MM.YYYY)
 * @param {string} params.renewUrl - URL для продления подписки
 * @returns {string} HTML-шаблон письма
 */
function getSubscriptionExpiringTemplate({ userName, daysLeft, expirationDate, renewUrl = '#' }) {
  const urgencyColor = daysLeft <= 3 ? '#e53e3e' : '#ed8936';
  const urgencyText = daysLeft <= 3 ? 'срочно' : 'скоро';

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Подписка истекает</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">⏰ FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Здравствуйте, ${userName}!</h2>

          <p style="${baseStyles.text}">
            Ваша подписка скоро заканчивается!
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} border-left-color: ${urgencyColor};">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 20px; color: ${urgencyColor};">
                🗓 Осталось: ${daysLeft} ${getDaysWord(daysLeft)}
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 10px;">
              📅 Дата окончания: <strong>${expirationDate}</strong>
            </p>
          </div>

          <p style="${baseStyles.text}">
            Продлите подписку сейчас, чтобы не потерять доступ к премиум&#8209;функциям! 🚀
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${renewUrl}" style="${baseStyles.button}">
              🔄 Продлить подписку
            </a>
          </div>
          <div style="${baseStyles.buttonContainer}">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button}">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон уведомления об истечении подписки
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.pricingUrl - URL страницы с тарифами
 * @returns {string} HTML-шаблон письма
 */
function getSubscriptionExpiredTemplate({ userName, pricingUrl = '#' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Подписка истекла</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">🧾 FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Здравствуйте, ${userName}!</h2>

          <p style="${baseStyles.text}">
            К сожалению, срок действия вашей премиум&#8209;подписки истёк.
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight}">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 18px; color: #667eea;">
                🪪 Переход на гостевой тариф
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 15px; font-size: 15px;">
              Ваш аккаунт автоматически переведён на гостевой тариф.
            </p>
          </div>

          <p style="${baseStyles.text}">
            <strong>✅ Что сейчас доступно:</strong>
          </p>

          <ul style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>До 3&#8209;х досок</li>
            <li>До 10 стикеров</li>
            <li>До 10 заметок и комментариев</li>
            <li>Скачать доску (структуру) как изображение (в формате A4)</li>
          </ul>

          <p style="${baseStyles.text}">
            <strong>⭐ Хотите вернуть все возможности?</strong>
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${pricingUrl}" style="${baseStyles.button}">
              ⭐ Выбрать тариф
            </a>
          </div>
          <div style="${baseStyles.buttonContainer}">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button}">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Приветственное письмо для новых пользователей
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {number} params.demoDays - Количество дней демо-периода (по умолчанию 3)
 * @param {string} params.dashboardUrl - URL личного кабинета
 * @returns {string} HTML-шаблон письма
 */
function getWelcomeTemplate({ userName, demoDays = 14, dashboardUrl = '#' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Добро пожаловать в FOHOW</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">🚀 Рады видеть вас!</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Здравствуйте, ${userName}!</h2>

          <p style="${baseStyles.text}">
            Мы активировали для вас <strong>${demoDays}-дневный демо-доступ</strong>
            с полным набором премиум-функций.
          </p>

          <p style="${baseStyles.text}">
            <strong>✨ Что вы получаете:</strong>
          </p>

          <ul style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>Безлимитные доски</li>
            <li>Безлимитное количество лицензий на одной доске</li>
            <li>Безлимитное количество заметок на одной доске</li>
            <li>Безлимитное количество стикеров на одной доске</li>
            <li>Безлимитные комментарии</li>
            <li>Библиотеку изображений с возможностью создать свою собственную библиотеку</li>
            <li>Скачать доску (структуру) как изображение (в формате A4, A3)</li>
            <li>Поделиться доской (структурой) как веб‑страницей</li>
            <li>Режим рисования</li>
          </ul>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${dashboardUrl}" style="${baseStyles.button}">
              🚀 Перейти в личный кабинет
            </a>
          </div>
          <div style="${baseStyles.buttonContainer}">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button}">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px; margin-top: 15px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон письма об одобрении верификации
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.personalId - Компьютерный номер
 * @param {string} params.profileUrl - URL профиля
 * @returns {string} HTML-шаблон письма
 */
function getVerificationApprovedTemplate({ userName, personalId, profileUrl = 'https://interactive.marketingfohow.ru/' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Верификация одобрена</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">✅ FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Верификация одобрена!</h2>

          <p style="${baseStyles.text}">
            Здравствуйте, <strong>${userName}</strong>!
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left-color: #48bb78;">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 18px; color: #48bb78;">
                🎉 Поздравляем! Ваша заявка на верификацию одобрена!
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 15px;">
              ⭐ Компьютерный номер <strong>${personalId}</strong> успешно верифицирован.
            </p>
          </div>

          <p style="${baseStyles.text}">
            Теперь ваш профиль отмечен значком верификации.
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${profileUrl}" style="${baseStyles.button}">
              👤 В профиль
            </a>
          </div>

          <div style="${baseStyles.buttonContainer} margin-top: 8px;">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button} background: transparent; color: ${baseStyles.accentColor}; border: 2px solid ${baseStyles.accentColor};">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон письма об отмене верификации
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.profileUrl - URL профиля
 * @returns {string} HTML-шаблон письма
 */
function getVerificationRevokedTemplate({ userName, profileUrl = 'https://interactive.marketingfohow.ru/' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Статус верификации снят</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">⚠️ FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Статус верификации снят</h2>

          <p style="${baseStyles.text}">
            Здравствуйте, <strong>${userName}</strong>!
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} border-left-color: #ed8936;">
            <p style="${baseStyles.highlightText}">
              Ваш статус верификации был снят из-за изменения компьютерного номера или представительства.
            </p>
          </div>

          <p style="${baseStyles.text}">
            Вы можете подать новую заявку на верификацию в личном кабинете.
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${profileUrl}" style="${baseStyles.button}">
              👤 В профиль
            </a>
          </div>

          <div style="${baseStyles.buttonContainer} margin-top: 8px;">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button} background: transparent; color: ${baseStyles.accentColor}; border: 2px solid ${baseStyles.accentColor};">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон письма об автоматическом отклонении заявки
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.personalId - Компьютерный номер
 * @param {string} params.profileUrl - URL профиля
 * @returns {string} HTML-шаблон письма
 */
function getVerificationAutoRejectedTemplate({ userName, personalId, profileUrl = 'https://interactive.marketingfohow.ru/' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Заявка отклонена</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">❌ FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Заявка отклонена</h2>

          <p style="${baseStyles.text}">
            Здравствуйте, <strong>${userName}</strong>!
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} border-left-color: #e53e3e;">
            <p style="${baseStyles.highlightText}">
              Ваша заявка на верификацию номера <strong>${personalId || 'не указан'}</strong> была отклонена.
            </p>
            <p style="${baseStyles.highlightText}; margin-top: 15px;">
              <strong>Причина:</strong> номер уже верифицирован другим пользователем.
            </p>
          </div>

          <p style="${baseStyles.text}">
            Если вы считаете, что это ваш номер, обратитесь в поддержку:
          </p>

          <p style="${baseStyles.text}">
            📞 Telegram: <a href="https://t.me/FOHOWadmin" style="color: #667eea;">@FOHOWadmin</a><br>
            ✉️ Email: <a href="mailto:marketingfohow@yandex.com" style="color: #667eea;">marketingfohow@yandex.com</a>
          </p>

          <!-- Buttons -->
          <div style="${baseStyles.buttonContainer}">
            <a href="https://t.me/FOHOWadmin" style="${baseStyles.button}">
              📞 Поддержка
            </a>
          </div>

          <div style="${baseStyles.buttonContainer} margin-top: 8px;">
            <a href="${profileUrl}" style="${baseStyles.button} background: transparent; color: ${baseStyles.accentColor}; border: 2px solid ${baseStyles.accentColor};">
              👤 В профиль
            </a>
          </div>

          <div style="${baseStyles.buttonContainer} margin-top: 8px;">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button} background: transparent; color: ${baseStyles.accentColor}; border: 2px solid ${baseStyles.accentColor};">
              📢 MarketingFohow
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон письма об отклонении заявки на верификацию (администратором)
 * @param {Object} params - Параметры шаблона
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.rejectionReason - Причина отклонения
 * @param {string} params.profileUrl - URL профиля
 * @returns {string} HTML-шаблон письма
 */
function getVerificationRejectedTemplate({ userName, rejectionReason, profileUrl = 'https://interactive.marketingfohow.ru/' }) {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Заявка отклонена</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f7fafc;">
      <div style="${baseStyles.container}">
        <!-- Header -->
        <div style="${baseStyles.header}">
          <h1 style="${baseStyles.headerTitle}">❌ FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Заявка на верификацию отклонена</h2>

          <p style="${baseStyles.text}">
            Здравствуйте, <strong>${userName}</strong>!
          </p>

          <p style="${baseStyles.text}">
            К сожалению, ваша заявка на верификацию компьютерного номера была отклонена.
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} border-left-color: #ff9800; background-color: #fff3e0;">
            <p style="${baseStyles.highlightText}">
              <strong>Причина отклонения:</strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 10px;">
              ${rejectionReason}
            </p>
          </div>

          <p style="${baseStyles.text}">
            Вы можете подать новую заявку через 24 часа.
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${profileUrl}" style="${baseStyles.button}">
              👤 В профиль
            </a>
          </div>

          <div style="${baseStyles.buttonContainer} margin-top: 8px;">
            <a href="https://t.me/MarketingFohow" style="${baseStyles.button} background: transparent; color: ${baseStyles.accentColor}; border: 2px solid ${baseStyles.accentColor};">
              📢 MarketingFohow
            </a>
          </div>

          <p style="${baseStyles.text} font-size: 14px; color: #718096; margin-top: 20px;">
            Если у вас есть вопросы, обратитесь в поддержку:<br>
            📞 Telegram: <a href="https://t.me/FOHOWadmin" style="color: #667eea;">@FOHOWadmin</a><br>
            ✉️ Email: <a href="mailto:marketingfohow@yandex.com" style="color: #667eea;">marketingfohow@yandex.com</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда MarketingFohow</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px;">
            Это автоматическое уведомление. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Шаблон письма с кодом подтверждения email
 * @param {Object} params - Параметры шаблона
 * @param {string} params.code - 6-значный код подтверждения
 * @returns {{ subject: string, html: string }} Тема и HTML письма
 */
function getVerificationCodeTemplate({ code }) {
  const subject = 'Код подтверждения — FOHOW';
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Код подтверждения</title>

<style>
  body {
    margin: 0; padding: 0;
    background: #f5f5f5;
    font-family: Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #fff; }
    .email-container { background: #1a1a1a; }
    .code { color: #4CAF50 !important; }
  }

  .email-container {
    max-width: 600px;
    margin: 20px auto;
    background: #fff;
    border-radius: 14px;
    padding: 35px 28px;
  }

  h1, h2, p { margin: 0; padding: 0; text-align: center; }

  .code {
    font-size: 54px;
    font-weight: bold;
    letter-spacing: 12px;
    color: #4CAF50;
    margin: 35px 0;
  }

  .footer {
    margin-top: 30px;
    font-size: 12px;
    color: #777;
    text-align: center;
  }
</style>

</head>
<body>
  <div class="email-container">
    <h2>Подтверждение Email</h2>
    <p>Ваш код подтверждения:</p>

    <div class="code">${code}</div>

    <p>Код действителен 10 минут.</p>

    <p class="footer">
      Если вы не запрашивали регистрацию в FOHOW Interactive Board — просто игнорируйте письмо.
    </p>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

/**
 * Шаблон письма для сброса пароля
 * @param {Object} params - Параметры шаблона
 * @param {string} params.resetUrl - Готовая ссылка для сброса пароля
 * @returns {{ subject: string, html: string }} Тема и HTML письма
 */
function getPasswordResetTemplate({ resetUrl }) {
  const subject = 'Сброс пароля — FOHOW Interactive Board';
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Сброс пароля</title>

<style>
  body {
    margin: 0; padding: 0;
    background: #f0f0f0;
    font-family: Arial, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #fff; }
    .email-container { background: #1a1a1a; }
  }

  .email-container {
    max-width: 600px;
    background: #fff;
    margin: 20px auto;
    padding: 30px;
    border-radius: 16px;
    text-align: center;
  }

  a.button {
    display: inline-block;
    background: #4CAF50;
    color: #fff !important;
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 18px;
    text-decoration: none;
    margin-top: 20px;
  }

  .footer {
    margin-top: 30px;
    color: #888;
    font-size: 12px;
  }
</style>
</head>

<body>
  <div class="email-container">
    <h2>Сброс пароля</h2>
    <p>Вы запросили восстановление доступа к учётной записи.</p>

    <a href="${resetUrl}" class="button">Сбросить пароль</a>

    <p style="margin-top: 20px; font-size: 14px;">
      Или скопируйте ссылку вручную:<br>
      ${resetUrl}
    </p>

    <div class="footer">
      Ссылка действует 1 час.<br>
      Если вы не запрашивали сброс — игнорируйте письмо.
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

/**
 * Шаблон письма-уведомления о событии подписки
 * @param {Object} params - Параметры шаблона
 * @param {string} params.eventType - Тип события: 'new', 'renewed', 'cancelled', 'promo'
 * @param {string} params.userName - Имя пользователя
 * @param {string} params.planName - Название тарифа
 * @param {number} params.amount - Сумма оплаты
 * @param {string} params.currency - Валюта
 * @param {string} params.startDate - Дата начала (ISO)
 * @param {string} params.expiresDate - Дата окончания (ISO)
 * @param {string} [params.promoCode] - Промокод (для eventType='promo')
 * @returns {{ subject: string, html: string }} Тема и HTML письма
 */
function getSubscriptionEventTemplate({ eventType, userName, planName, amount, currency, startDate, expiresDate, promoCode }) {
  const formatDate = (isoDate) => {
    return new Date(isoDate).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formattedStartDate = startDate ? formatDate(startDate) : '';
  const formattedExpiresDate = expiresDate ? formatDate(expiresDate) : '';

  let planFeaturesHtml = '';
  switch (planName) {
    case 'Premium':
    case 'Премиум':
      planFeaturesHtml = `<li>Безлимитное количество досок</li><li>Безлимитное количество стикеров</li><li>Безлимитное количество заметок и комментариев</li><li>До 100 папок</li><li>Библиотека изображений</li><li>Скачать доску (структуру) как изображение (в формате A4, A3)</li><li>Поделиться доской (структурой) как веб‑страницей</li><li>Дублирование досок</li><li>Режим рисования</li>`;
      break;
    case 'Individual':
    case 'Индивидуальный':
      planFeaturesHtml = `<li>До 18 интерактивных досок</li><li>До 100 стикеров</li><li>До 100 заметок и комментариев</li><li>До 9 папок</li><li>Библиотека изображений</li><li>Скачать доску (структуру) как изображение (в формате A4, A3)</li><li>Поделиться доской (структурой) как веб‑страницей</li><li>Дублирование досок</li><li>Режим рисования</li>`;
      break;
    case 'Demo':
    case 'Демо':
      planFeaturesHtml = `<li>Безлимитное количество досок</li><li>Безлимитное количество стикеров</li><li>Безлимитное количество заметок и комментариев</li><li>До 30 папок</li><li>Библиотека изображений</li><li>Скачать доску (структуру) как изображение (в формате A4, A3)</li><li>Поделиться доской (структурой) как веб‑страницей</li><li>Режим рисования</li>`;
      break;
    default:
      planFeaturesHtml = `<li>До 3 интерактивных досок</li><li>До 10 стикеров</li><li>До 10 заметок и комментариев</li><li>Скачать доску (структуру) как изображение (в формате A4)</li>`;
  }

  const boardsUrl = `${process.env.FRONTEND_URL}/boards`;
  const pricingUrl = `${process.env.FRONTEND_URL}/pricing`;

  let subject, html;

  if (eventType === 'new') {
    subject = '✅ Подписка активирована — FOHOW Interactive Board';
    html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Подписка активирована</title>
<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
    .details-box { background: #252525; }
  }
  .email-container {
    max-width: 600px;
    margin: 25px auto;
    background: #fff;
    padding: 40px 32px;
    border-radius: 18px;
    text-align: center;
  }
  h1 {
    color: #4CAF50;
    font-size: 26px;
    margin-bottom: 15px;
  }
  p {
    font-size: 16px;
    line-height: 1.6;
    margin: 10px 0;
  }
  .details-box {
    background: #f9f9f9;
    border-radius: 12px;
    padding: 20px;
    margin: 25px 0;
    text-align: left;
  }
  .details-box p {
    margin: 8px 0;
    font-size: 15px;
  }
  .details-box strong {
    color: #333;
  }
  .features {
    background: #fffbeb;
    border-left: 4px solid #ffc107;
    padding: 15px 20px;
    margin: 20px 0;
    text-align: left;
    border-radius: 0 8px 8px 0;
  }
  .features ul {
    margin: 8px 0 0 0;
    padding-left: 18px;
    font-size: 15px;
    line-height: 1.7;
    color: #4a5568;
  }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
    color: #3a2800 !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
    font-weight: 600;
  }
  .footer {
    margin-top: 30px;
    font-size: 13px;
    color: #777;
  }
</style>
</head>
<body>
  <div class="email-container">
    <h1>✅ Подписка активирована!</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>🙏 Спасибо за оплату!</p>

    <div class="details-box">
      <p><strong>💎 Тариф:</strong> ${planName}</p>
      <p><strong>💰 Стоимость:</strong> ${amount} ${currency}</p>
      <p><strong>📅 Действует до:</strong> ${formattedExpiresDate}</p>
    </div>

    <div class="features">
      <strong>🚀 Ваши возможности:</strong>
      <ul>${planFeaturesHtml}</ul>
    </div>

    <a href="${boardsUrl}" class="button">👤 В профиль</a>
    <br>
    <a href="https://t.me/MarketingFohow" class="button">📢 MarketingFohow</a>

    <div class="footer">
      С уважением, команда MarketingFohow
    </div>
  </div>
</body>
</html>
    `;
  } else if (eventType === 'renewed') {
    subject = '🧩 Подписка продлена — FOHOW Interactive Board';
    html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Подписка продлена</title>
<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
    .details-box { background: #252525; }
  }
  .email-container {
    max-width: 600px;
    margin: 25px auto;
    background: #fff;
    padding: 40px 32px;
    border-radius: 18px;
    text-align: center;
  }
  h1 {
    color: #4CAF50;
    font-size: 26px;
    margin-bottom: 15px;
  }
  p {
    font-size: 16px;
    line-height: 1.6;
    margin: 10px 0;
  }
  .details-box {
    background: #f9f9f9;
    border-radius: 12px;
    padding: 20px;
    margin: 25px 0;
    text-align: left;
  }
  .details-box p {
    margin: 8px 0;
    font-size: 15px;
  }
  .details-box strong {
    color: #333;
  }
  .features {
    background: #fffbeb;
    border-left: 4px solid #ffc107;
    padding: 15px 20px;
    margin: 20px 0;
    text-align: left;
    border-radius: 0 8px 8px 0;
  }
  .features ul {
    margin: 8px 0 0 0;
    padding-left: 18px;
    font-size: 15px;
    line-height: 1.7;
    color: #4a5568;
  }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
    color: #3a2800 !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
    font-weight: 600;
  }
  .footer {
    margin-top: 30px;
    font-size: 13px;
    color: #777;
  }
</style>
</head>
<body>
  <div class="email-container">
    <h1>🧩 Подписка продлена!</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>Оплата успешно прошла. ✅</p>

    <div class="details-box">
      <p><strong>💎 Тариф:</strong> ${planName}</p>
      <p><strong>💰 Сумма:</strong> ${amount} ${currency}</p>
      <p><strong>📅 Действует до:</strong> ${formattedExpiresDate}</p>
    </div>

    <div class="features">
      <strong>🚀 Ваши возможности:</strong>
      <ul>${planFeaturesHtml}</ul>
    </div>

    <a href="${boardsUrl}" class="button">👤 В профиль</a>
    <br>
    <a href="https://t.me/MarketingFohow" class="button">📢 MarketingFohow</a>

    <div class="footer">
      С уважением, команда MarketingFohow
    </div>
  </div>
</body>
</html>
    `;
  } else if (eventType === 'promo') {
    const promoCodeValue = promoCode || 'PROMO';
    subject = '✅ Промокод успешно применён | FOHOW Interactive Board';
    html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Промокод применён</title>
<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
    .details-box { background: #252525; }
  }
  .email-container {
    max-width: 600px;
    margin: 25px auto;
    background: #fff;
    padding: 40px 32px;
    border-radius: 18px;
    text-align: center;
  }
  h1 {
    color: ${baseStyles.accentColor};
    font-size: 26px;
    margin-bottom: 15px;
  }
  p {
    font-size: 16px;
    line-height: 1.6;
    margin: 10px 0;
  }
  .details-box {
    background: #f9f9f9;
    border-radius: 12px;
    padding: 20px;
    margin: 25px 0;
    text-align: left;
  }
  .details-box p {
    margin: 8px 0;
    font-size: 15px;
  }
  .details-box strong {
    color: #333;
  }
  .promo-code {
    display: inline-block;
    background: #fff8e1;
    color: ${baseStyles.buttonTextColor};
    font-weight: bold;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 16px;
  }
  .button {
    background: ${baseStyles.accentColor};
    display: inline-block;
    color: ${baseStyles.buttonTextColor} !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 15px;
    font-size: 18px;
    font-weight: bold;
  }
  .button:hover {
    background: ${baseStyles.accentHover};
  }
  .button-secondary {
    background: transparent;
    display: inline-block;
    color: ${baseStyles.accentColor} !important;
    padding: 12px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 10px;
    font-size: 16px;
    font-weight: bold;
    border: 2px solid ${baseStyles.accentColor};
  }
  .footer {
    margin-top: 30px;
    font-size: 13px;
    color: #777;
  }
</style>
</head>
<body>
  <div class="email-container">
    <h1>✅ Промокод применён!</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>Промокод <span class="promo-code">${promoCodeValue}</span> успешно активирован.</p>

    <div class="details-box">
      <p><strong>💎 Тариф:</strong> ${planName}</p>
      <p><strong>💰 Стоимость:</strong> 0 ${currency} (Промокод)</p>
      <p><strong>📅 Действует до:</strong> ${formattedExpiresDate}</p>
    </div>

    <p>Приятной работы! 🎨</p>

    <a href="${boardsUrl}" class="button">👤 В профиль</a>
    <br>
    <a href="https://t.me/MarketingFohow" class="button-secondary">📢 MarketingFohow</a>

    <div class="footer">
      С уважением, команда MarketingFohow
    </div>
  </div>
</body>
</html>
    `;
  } else {
    throw new Error(`Неизвестный тип события подписки: ${eventType}`);
  }

  return { subject, html };
}

/**
 * Шаблон письма-уведомления о смене пароля
 * @param {Object} params - Параметры шаблона
 * @param {string} params.formattedDate - Отформатированная дата и время смены
 * @param {string} [params.locationString] - Местоположение (опционально)
 * @returns {{ subject: string, html: string }} Тема и HTML письма
 */
function getPasswordChangedTemplate({ formattedDate, locationString }) {
  const subject = '🔐 Пароль изменён — FOHOW Interactive Board';
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Пароль изменён</title>
<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
    .info-table td { color: #ccc; }
    .warning-box { background: #3d3000; }
  }
  .email-container {
    max-width: 600px;
    margin: 25px auto;
    background: #fff;
    padding: 40px 32px;
    border-radius: 18px;
    text-align: center;
  }
  h1 {
    color: #e53935;
    font-size: 26px;
    margin-bottom: 15px;
  }
  p {
    font-size: 16px;
    line-height: 1.6;
    margin: 10px 0;
  }
  .info-table {
    margin: 25px auto;
    border-collapse: collapse;
  }
  .info-table td {
    padding: 8px 16px;
    text-align: left;
  }
  .info-table td:first-child {
    color: #666;
  }
  .info-table td:last-child {
    font-weight: bold;
  }
  .warning-box {
    background: #fff3cd;
    padding: 16px 20px;
    border-radius: 12px;
    border-left: 4px solid #ffc107;
    margin: 25px 0;
    text-align: left;
  }
  .footer {
    margin-top: 30px;
    font-size: 13px;
    color: #777;
  }
</style>
</head>
<body>
  <div class="email-container">
    <h1>🔐 Пароль изменён</h1>
    <p>Ваш пароль в FOHOW Interactive Board был успешно изменён.</p>

    <table class="info-table">
      <tr>
        <td>Дата и время:</td>
        <td>${formattedDate} (МСК)</td>
      </tr>
      ${locationString ? `
      <tr>
        <td>Местоположение:</td>
        <td>${locationString}</td>
      </tr>
      ` : ''}
    </table>

    <div class="warning-box">
      ⚠️ Если вы не меняли пароль, немедленно свяжитесь с поддержкой или восстановите доступ через форму "Забыли пароль?"
    </div>

    <a href="https://t.me/FOHOWadmin" style="display: inline-block; background: ${baseStyles.accentColor}; color: ${baseStyles.buttonTextColor} !important; padding: 14px 36px; text-decoration: none; border-radius: 9px; margin-top: 25px; font-size: 18px; font-weight: 600;">📞 Поддержка</a>
    <br>
    <a href="https://interactive.marketingfohow.ru/" style="display: inline-block; background: transparent; color: ${baseStyles.accentColor} !important; padding: 12px 36px; text-decoration: none; border-radius: 9px; margin-top: 10px; font-size: 16px; font-weight: 600; border: 2px solid ${baseStyles.accentColor};">👤 В профиль</a>
    <br>
    <a href="https://t.me/MarketingFohow" style="display: inline-block; background: transparent; color: ${baseStyles.accentColor} !important; padding: 12px 36px; text-decoration: none; border-radius: 9px; margin-top: 10px; font-size: 16px; font-weight: 600; border: 2px solid ${baseStyles.accentColor};">📢 MarketingFohow</a>

    <div class="footer">
      С уважением, команда MarketingFohow
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

/**
 * Вспомогательная функция для склонения слова "день"
 * @param {number} days - Количество дней
 * @returns {string} Правильное склонение
 */
function getDaysWord(days) {
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }

  return 'дней';
}

export {
  getSubscriptionExpiringTemplate,
  getSubscriptionExpiredTemplate,
  getWelcomeTemplate,
  getVerificationApprovedTemplate,
  getVerificationRevokedTemplate,
  getVerificationAutoRejectedTemplate,
  getVerificationRejectedTemplate,
  getVerificationCodeTemplate,
  getPasswordResetTemplate,
  getSubscriptionEventTemplate,
  getPasswordChangedTemplate
};
