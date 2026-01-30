import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// =====================
// 🚀 ТРАНСПОРТ SMTP
// =====================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// =======================================================================
// 🟢 1. ПОДТВЕРЖДЕНИЕ EMAIL — ШАБЛОН №1 (адаптив + dark/light)
// =======================================================================

export async function sendVerificationEmail(email, code) {
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

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Код подтверждения — FOHOW',
      html,
    });
    console.log('✅ Код подтверждения отправлен:', email);
  } catch (error) {
    console.error('❌ Ошибка отправки кода подтверждения:', error);
    throw new Error('Не удалось отправить код подтверждения');
  }
}



// =======================================================================
// 🟡 2. ВОССТАНОВЛЕНИЕ ПАРОЛЯ — ШАБЛОН №2 (адаптив)
// =======================================================================

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

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

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Сброс пароля — FOHOW Interactive Board',
      html,
    });
    console.log('✅ Email отправлен (reset):', email);
  } catch (error) {
    console.error('❌ Ошибка отправки reset-email:', error);
    throw new Error('Не удалось отправить email');
  }
}



// =======================================================================
// 🔵 3. WELCOME EMAIL — ШАБЛОН №3 (адаптив + бренд FOHOW)
// =======================================================================

export async function sendWelcomeEmail(email) {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Добро пожаловать</title>

<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
  }

  .email-container {
    max-width: 620px;
    margin: 25px auto;
    background: #fff;
    padding: 40px 32px;
    border-radius: 18px;
    text-align: center;
  }

  h1 {
    color: #4CAF50;
    font-size: 28px;
    margin-bottom: 10px;
  }

  .button {
    background: #4CAF50;
    display: inline-block;
    color: #fff !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 28px;
    font-size: 18px;
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
    <h1>Добро пожаловать в FOHOW Interactive Board 🎉</h1>
    <p>
      Вы успешно зарегистрировались в системе.<br>
      Теперь вы можете создавать структуры, доски, управлять партнёрами и пользоваться всеми инструментами.
    </p>

    <a href="${loginUrl}" class="button">Перейти к входу</a>

    <div class="footer">
      Если вы не создавали аккаунт — игнорируйте письмо.
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Добро пожаловать в FOHOW 🎉',
      html,
    });

    console.log('✅ Welcome email отправлен:', email);
  } catch (error) {
    console.error('❌ Ошибка отправки Welcome Email:', error);
  }
}



// =======================================================================
// 🔔 4. УВЕДОМЛЕНИЯ О ПОДПИСКЕ — ШАБЛОН №4 (new, renewed, cancelled)
// =======================================================================

/**
 * Отправка email-уведомлений о событиях подписки
 * @param {string} email - Email получателя
 * @param {string} eventType - Тип события: 'new', 'renewed', 'cancelled'
 * @param {Object} data - Данные подписки
 * @param {string} data.userName - Имя пользователя
 * @param {string} data.planName - Название тарифа (Premium, Individual)
 * @param {number} data.amount - Сумма оплаты
 * @param {string} data.currency - Валюта (RUB)
 * @param {string} data.startDate - Дата начала (ISO строка)
 * @param {string} data.expiresDate - Дата окончания (ISO строка)
 */
export async function sendSubscriptionEmail(email, eventType, data) {
  const { userName, planName, amount, currency, startDate, expiresDate } = data;

  // Форматирование дат на русском
  const formatDate = (isoDate) => {
    return new Date(isoDate).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formattedStartDate = formatDate(startDate);
  const formattedExpiresDate = formatDate(expiresDate);

  // Определить возможности тарифа
  const planFeatures = planName === 'Premium'
    ? 'Безлимитное количество досок, все премиум-функции'
    : planName === 'Individual'
      ? 'До 9 интерактивных досок, расширенные функции'
      : 'Базовые функции';

  const boardsUrl = `${process.env.FRONTEND_URL}/boards`;
  const pricingUrl = `${process.env.FRONTEND_URL}/pricing`;

  let subject, html;

  // ===== ШАБЛОН: НОВАЯ ПОДПИСКА =====
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
    background: #e8f5e9;
    border-left: 4px solid #4CAF50;
    padding: 15px 20px;
    margin: 20px 0;
    text-align: left;
    border-radius: 0 8px 8px 0;
  }
  .button {
    background: #4CAF50;
    display: inline-block;
    color: #fff !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
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
    <h1>Подписка успешно активирована! 🎉</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>Спасибо за оплату подписки на FOHOW Interactive Board!</p>

    <div class="details-box">
      <p><strong>Тариф:</strong> ${planName}</p>
      <p><strong>Стоимость:</strong> ${amount} ${currency}</p>
      <p><strong>Начало:</strong> ${formattedStartDate}</p>
      <p><strong>Действует до:</strong> ${formattedExpiresDate}</p>
    </div>

    <div class="features">
      <strong>Ваши возможности:</strong><br>
      ${planFeatures}
    </div>

    <a href="${boardsUrl}" class="button">Начать работу</a>

    <div class="footer">
      С уважением, команда FOHOW Interactive Board
    </div>
  </div>
</body>
</html>
    `;
  }

  // ===== ШАБЛОН: ПРОДЛЕНИЕ ПОДПИСКИ =====
  else if (eventType === 'renewed') {
    subject = '🔄 Подписка продлена — FOHOW Interactive Board';
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
  .button {
    background: #4CAF50;
    display: inline-block;
    color: #fff !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
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
    <h1>Ваша подписка продлена 🔄</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>Оплата успешно прошла, подписка автоматически продлена.</p>

    <div class="details-box">
      <p><strong>Тариф:</strong> ${planName}</p>
      <p><strong>Сумма:</strong> ${amount} ${currency}</p>
      <p><strong>Действует до:</strong> ${formattedExpiresDate}</p>
    </div>

    <a href="${boardsUrl}" class="button">Перейти к доскам</a>

    <div class="footer">
      С уважением, команда FOHOW Interactive Board
    </div>
  </div>
</body>
</html>
    `;
  }

  // ===== ШАБЛОН: ОТМЕНА ПОДПИСКИ =====
  else if (eventType === 'cancelled') {
    subject = '⚠️ Подписка отменена — FOHOW Interactive Board';
    html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Подписка отменена</title>
<style>
  body {
    margin: 0; padding: 0;
    background: #f3f3f3;
    font-family: Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e0e0e; color: #fff; }
    .email-container { background: #1a1a1a; }
    .info-box { background: #252525; }
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
    color: #ff9800;
    font-size: 26px;
    margin-bottom: 15px;
  }
  p {
    font-size: 16px;
    line-height: 1.6;
    margin: 10px 0;
  }
  .info-box {
    background: #fff3e0;
    border-left: 4px solid #ff9800;
    padding: 20px;
    margin: 25px 0;
    text-align: left;
    border-radius: 0 8px 8px 0;
  }
  .info-box p {
    margin: 8px 0;
    font-size: 15px;
  }
  .button {
    background: #4CAF50;
    display: inline-block;
    color: #fff !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
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
    <h1>Ваша подписка отменена ⚠️</h1>
    <p>Здравствуйте, ${userName}!</p>
    <p>Подписка <strong>${planName}</strong> была отменена. Вы переведены на гостевой тариф.</p>

    <div class="info-box">
      <p><strong>Доступ сохраняется до:</strong> ${formattedExpiresDate}</p>
      <p>После этой даты будут доступны только функции гостевого тарифа.</p>
    </div>

    <p>Вы можете продлить подписку в любой момент:</p>

    <a href="${pricingUrl}" class="button">Продлить подписку</a>

    <div class="footer">
      С уважением, команда FOHOW Interactive Board
    </div>
  </div>
</body>
</html>
    `;
  }

  // ===== ШАБЛОН: ПРИМЕНЕНИЕ ПРОМОКОДА =====
  else if (eventType === 'promo') {
    const promoCodeValue = data.promoCode || 'PROMO';
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
  .promo-code {
    display: inline-block;
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: bold;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 16px;
  }
  .button {
    background: #4CAF50;
    display: inline-block;
    color: #fff !important;
    padding: 14px 36px;
    text-decoration: none;
    border-radius: 9px;
    margin-top: 25px;
    font-size: 18px;
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

    <a href="${boardsUrl}" class="button">🚀 Начать работу</a>

    <div class="footer">
      С уважением, команда FOHOW Interactive Board
    </div>
  </div>
</body>
</html>
    `;
  }

  // Неизвестный тип события
  else {
    console.error(`❌ Email error: Неизвестный eventType: ${eventType}`);
    throw new Error(`Неизвестный тип события: ${eventType}`);
  }

  // Отправка письма
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Email sent (${eventType}):`, email);
  } catch (error) {
    console.error(`❌ Email error (${eventType}):`, error);
    throw new Error(`Не удалось отправить email: ${error.message}`);
  }
}


// =======================================================================
// 🔐 5. УВЕДОМЛЕНИЕ О СМЕНЕ ПАРОЛЯ — ШАБЛОН №5 (безопасность)
// =======================================================================

/**
 * Отправка уведомления о смене пароля
 * @param {string} email — Email получателя
 * @param {Object} data — Данные события
 * @param {string} data.ipAddress — IP-адрес (опционально)
 * @param {Date} data.changedAt — Время смены пароля
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
      ${data.locationString ? `
      <tr>
        <td>Местоположение:</td>
        <td>${data.locationString}</td>
      </tr>
      ` : ''}
    </table>

    <div class="warning-box">
      ⚠️ Если вы не меняли пароль, немедленно свяжитесь с поддержкой или восстановите доступ через форму "Забыли пароль?"
    </div>

    <a href="https://interactive.marketingfohow.ru/" style="display: inline-block; background: #4CAF50; color: #fff !important; padding: 14px 36px; text-decoration: none; border-radius: 9px; margin-top: 25px; font-size: 18px;">Перейти на сайт</a>

    <p style="margin-top: 20px; font-size: 14px;">
      📞 Связь с админом: <a href="https://t.me/FOHOWadmin" style="color: #4CAF50;">@FOHOWadmin</a>
    </p>

    <div class="footer">
      С уважением, команда FOHOW Interactive Board
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🔐 Пароль изменён — FOHOW Interactive Board',
      html,
    });
    console.log('✅ Password changed email sent to:', email);
  } catch (error) {
    console.error('❌ Ошибка отправки email о смене пароля:', error);
    throw new Error(`Не удалось отправить email: ${error.message}`);
  }
}
