import { authenticateToken } from '../middleware/auth.js';
import {
  canSubmitVerification,
  submitVerification,
  getUserVerificationStatus,
  cancelVerificationByUser
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
      let referralLink = null;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'full_name') {
            fullName = part.value;
          } else if (part.fieldname === 'referral_link') {
            referralLink = part.value;
          }
        }
      }

      // Валидация обязательных полей
      if (!fullName || !fullName.trim()) {
        return reply.code(400).send({ error: 'Поле "Полное ФИО" обязательно для заполнения.' });
      }

      if (!referralLink || !referralLink.trim()) {
        return reply.code(400).send({ error: 'Поле "Персональная реферальная ссылка" обязательно для заполнения.' });
      }

      const link = referralLink.trim();

      // Валидация реферальной ссылки
      if (!link.startsWith('http://www.fohow')) {
        return reply.code(400).send({ error: 'Ссылка должна начинаться с http://www.fohow' });
      }

      if (!link.includes('id=')) {
        return reply.code(400).send({ error: 'Ссылка должна содержать параметр id=' });
      }

      if (link.length > 60) {
        return reply.code(400).send({ error: 'Ссылка не должна превышать 60 символов' });
      }

      // Отправить заявку
      const result = await submitVerification(userId, fullName.trim(), link);

      return reply.code(201).send({
        success: true,
        message: 'Заявка на верификацию отправлена. Ожидайте проверки администратором.',
        verificationId: result.verificationId
      });

    } catch (err) {
      console.error('[VERIFICATION] Ошибка отправки заявки:', err);

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
