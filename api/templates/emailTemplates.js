/**
 * Email Templates
 * HTML-шаблоны для email-уведомлений
 */

/**
 * Базовый стиль для всех email-шаблонов
 */
const baseStyles = {
  container: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;',
  header: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;',
  headerTitle: 'color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;',
  content: 'padding: 40px 30px;',
  title: 'color: #1a202c; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;',
  text: 'color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;',
  highlight: 'background-color: #f7fafc; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;',
  highlightText: 'color: #2d3748; font-size: 16px; margin: 0;',
  button: 'display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; transition: transform 0.2s;',
  buttonContainer: 'text-align: center; margin: 30px 0;',
  footer: 'background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;',
  footerText: 'color: #718096; font-size: 14px; margin: 0 0 10px 0;',
  divider: 'border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;'
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
            Напоминаем, что ваша подписка <strong style="color: ${urgencyColor};">${urgencyText} истекает</strong>.
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} border-left-color: ${urgencyColor};">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 20px; color: ${urgencyColor};">
                Осталось: ${daysLeft} ${getDaysWord(daysLeft)}
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 10px;">
              Дата истечения: <strong>${expirationDate}</strong>
            </p>
          </div>

          <p style="${baseStyles.text}">
            Чтобы продолжить пользоваться всеми преимуществами премиум-подписки,
            продлите её прямо сейчас.
          </p>

          <p style="${baseStyles.text}">
            <strong>Что вы получаете с премиум-подпиской:</strong>
          </p>

          <ul style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>Неограниченный доступ ко всем материалам</li>
            <li>Приоритетная поддержка</li>
            <li>Эксклюзивный контент</li>
            <li>Без рекламы</li>
          </ul>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${renewUrl}" style="${baseStyles.button}">
              🔄 Продлить подписку
            </a>
          </div>

          <p style="${baseStyles.text} font-size: 14px; color: #718096;">
            Если у вас возникли вопросы, мы всегда готовы помочь.
            Просто ответьте на это письмо.
          </p>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда FOHOW</strong>
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
          <h1 style="${baseStyles.headerTitle}">📋 FOHOW</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Здравствуйте, ${userName}!</h2>

          <p style="${baseStyles.text}">
            К сожалению, срок действия вашей премиум-подписки истёк.
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight}">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 18px; color: #667eea;">
                🔄 Переход на бесплатный план
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 15px; font-size: 15px;">
              Ваш аккаунт автоматически переведён на бесплатный тариф.
              Вы можете продолжать пользоваться базовыми функциями сервиса.
            </p>
          </div>

          <p style="${baseStyles.text}">
            <strong>Что доступно на бесплатном тарифе:</strong>
          </p>

          <ul style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>Ограниченный доступ к материалам</li>
            <li>Базовые функции сервиса</li>
            <li>Стандартная поддержка</li>
          </ul>

          <hr style="${baseStyles.divider}">

          <p style="${baseStyles.text}">
            <strong>Хотите вернуть все возможности?</strong>
          </p>

          <p style="${baseStyles.text}">
            Оформите новую подписку и снова получите полный доступ ко всем
            премиум-функциям, эксклюзивному контенту и приоритетной поддержке!
          </p>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${pricingUrl}" style="${baseStyles.button}">
              ⭐ Выбрать тариф
            </a>
          </div>

          <p style="${baseStyles.text} font-size: 14px; color: #718096;">
            Мы ценим каждого пользователя и готовы помочь с выбором подходящего тарифа.
            Свяжитесь с нами, если у вас есть вопросы!
          </p>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением,<br>
            <strong>Команда FOHOW</strong>
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
function getWelcomeTemplate({ userName, demoDays = 3, dashboardUrl = '#' }) {
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
          <h1 style="${baseStyles.headerTitle}">🎉 Добро пожаловать!</h1>
        </div>

        <!-- Content -->
        <div style="${baseStyles.content}">
          <h2 style="${baseStyles.title}">Здравствуйте, ${userName}!</h2>

          <p style="${baseStyles.text}">
            Рады приветствовать вас в <strong>FOHOW</strong>!
            Спасибо, что присоединились к нам. 🚀
          </p>

          <!-- Highlight Box -->
          <div style="${baseStyles.highlight} background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left-color: #48bb78;">
            <p style="${baseStyles.highlightText}">
              <strong style="font-size: 20px; color: #48bb78;">
                🎁 Подарок от нас!
              </strong>
            </p>
            <p style="${baseStyles.highlightText} margin-top: 15px;">
              Мы активировали для вас <strong>демо-период на ${demoDays} дня</strong>
              с полным доступом ко всем премиум-функциям. Попробуйте все возможности
              платформы абсолютно бесплатно!
            </p>
          </div>

          <p style="${baseStyles.text}">
            <strong>Что вас ждёт:</strong>
          </p>

          <ul style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>✨ <strong>Полный доступ</strong> ко всем материалам и функциям</li>
            <li>🎯 <strong>Эксклюзивный контент</strong> для премиум-пользователей</li>
            <li>💬 <strong>Приоритетная поддержка</strong> от нашей команды</li>
            <li>📚 <strong>Обучающие материалы</strong> и гайды</li>
            <li>🚫 <strong>Без рекламы</strong> — только полезный контент</li>
          </ul>

          <hr style="${baseStyles.divider}">

          <p style="${baseStyles.text}">
            <strong>С чего начать?</strong>
          </p>

          <ol style="color: #4a5568; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
            <li>Зайдите в личный кабинет</li>
            <li>Изучите доступные материалы</li>
            <li>Настройте профиль под себя</li>
            <li>Наслаждайтесь всеми возможностями!</li>
          </ol>

          <!-- Button -->
          <div style="${baseStyles.buttonContainer}">
            <a href="${dashboardUrl}" style="${baseStyles.button}">
              🚀 Перейти в личный кабинет
            </a>
          </div>

          <p style="${baseStyles.text} font-size: 14px; color: #718096; margin-top: 30px;">
            <strong>Совет:</strong> Не забудьте изучить все разделы в течение демо-периода,
            чтобы понять, какие возможности вам наиболее интересны!
          </p>

          <hr style="${baseStyles.divider}">

          <p style="${baseStyles.text}">
            Если у вас возникнут вопросы или нужна помощь, мы всегда на связи.
            Просто ответьте на это письмо, и мы обязательно вам поможем! 💙
          </p>
        </div>

        <!-- Footer -->
        <div style="${baseStyles.footer}">
          <p style="${baseStyles.footerText}">
            С уважением и наилучшими пожеланиями,<br>
            <strong>Команда FOHOW</strong>
          </p>
          <p style="${baseStyles.footerText} font-size: 12px; margin-top: 15px;">
            Вы получили это письмо, потому что зарегистрировались на нашей платформе.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
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

module.exports = {
  getSubscriptionExpiringTemplate,
  getSubscriptionExpiredTemplate,
  getWelcomeTemplate
};
