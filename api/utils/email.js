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
