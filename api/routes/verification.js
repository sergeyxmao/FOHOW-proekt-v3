import { authenticateToken } from '../middleware/auth.js';
import {
  canSubmitVerification,
  submitVerification,
  getUserVerificationStatus,
  cancelVerificationByUser,
  MAX_SCREENSHOT_SIZE
} from '../services/verificationService.js';

export default async function verificationRoutes(app) {

  // Проверка возможности подачи заявки
  app.get('/api/verification/can-submit', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const result = await canSubmitVerification(userId);
      return reply.send(result);
    } catch (err) {
      console.error('[VERIFICATION] Ошибка проверки возможности подачи заявки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Получение статуса верификации
  app.get('/api/verification/status', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const status = await getUserVerificationStatus(userId);
      return reply.send(status);
    } catch (err) {
      console.error('[VERIFICATION] Ошибка получения статуса:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Отправка заявки на верификацию
  app.post('/api/verification/submit', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получить multipart данные
      const parts = req.parts();

      let fullName = null;
      let screenshot1Buffer = null;
      let screenshot2Buffer = null;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'full_name') {
            fullName = part.value;
          }
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();

          // Валидация MIME-типа
          if (part.mimetype !== 'image/jpeg' && part.mimetype !== 'image/png') {
            return reply.code(400).send({
              error: `Недопустимый формат файла ${part.fieldname}. Разрешены только JPG и PNG.`
            });
          }

          // Валидация размера
          if (buffer.length > MAX_SCREENSHOT_SIZE) {
            return reply.code(400).send({
              error: `Файл ${part.fieldname} превышает максимальный размер 5MB.`
            });
          }

          if (part.fieldname === 'screenshot_1') {
            screenshot1Buffer = buffer;
          } else if (part.fieldname === 'screenshot_2') {
            screenshot2Buffer = buffer;
          }
        }
      }

      // Валидация обязательных полей
      if (!fullName || !fullName.trim()) {
        return reply.code(400).send({ error: 'Поле "Полное ФИО" обязательно для заполнения.' });
      }

      if (!screenshot1Buffer) {
        return reply.code(400).send({ error: 'Первый скриншот обязателен.' });
      }

      if (!screenshot2Buffer) {
        return reply.code(400).send({ error: 'Второй скриншот обязателен.' });
      }

      // Отправить заявку
      } catch (err) {
        console.error('[VERIFICATION] Ошибка отправки заявки:', err);

        // Если пользователь уже верифицирован — это НЕ 500, а нормальная бизнес-ошибка
        if (err && err.message === 'Вы уже верифицированы') {
          return reply.code(409).send({ error: 'Вы уже верифицированы' });
        }

        const errorMessage = process.env.NODE_ENV === 'development'
          ? `Ошибка: ${err.message}`
          : 'Не удалось отправить заявку. Попробуйте позже.';

        return reply.code(500).send({ error: errorMessage });
      }
  });

  // Получить историю верификации пользователя
  app.get('/api/verification/history', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      const { pool } = await import('../db.js');

      const result = await pool.query(
        `SELECT
          id,
          full_name,
          status,
          rejection_reason,
          submitted_at,
          processed_at,
          (SELECT username FROM users WHERE id = v.processed_by) as processed_by_username
         FROM user_verifications v
         WHERE user_id = $1
         ORDER BY submitted_at DESC`,
        [userId]
      );

      return reply.send({
        success: true,
        history: result.rows
      });
    } catch (err) {
      console.error('[VERIFICATION] Ошибка получения истории:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Отмена заявки на верификацию пользователем
  app.delete('/api/verification/cancel', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      const result = await cancelVerificationByUser(userId);

      return reply.send({
        success: true,
        message: 'Заявка на верификацию отменена'
      });
    } catch (err) {
      console.error('[VERIFICATION] Ошибка отмены заявки:', err);

      // Если заявка не найдена - вернуть 404
      if (err.message === 'Активная заявка на верификацию не найдена') {
        return reply.code(404).send({ error: err.message });
      }

      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
