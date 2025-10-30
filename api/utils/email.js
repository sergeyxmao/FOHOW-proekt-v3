import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true для 465, false для других портов
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Сброс пароля - FOHOW Interactive Board',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Восстановление пароля</h2>
        <p>Вы запросили сброс пароля для вашей учетной записи.</p>
        <p>Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Сбросить пароль
          </a>
        </div>
        <p>Или скопируйте эту ссылку в браузер:</p>
        <p style="color: #666; font-size: 14px;">${resetUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          Эта ссылка действительна в течение 1 часа.<br>
          Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email отправлен:', email);
  } catch (error) {
    console.error('❌ Ошибка отправки email:', error);
    throw new Error('Не удалось отправить email');
  }
}
