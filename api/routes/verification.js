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
    preHandler: [authenticateToken],
    schema: {
      tags: ['Verification'],
      summary: 'Проверка возможности подачи заявки',
      description: 'Проверяет, может ли текущий пользователь подать заявку на верификацию',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            canSubmit: { type: 'boolean' },
            reason: { type: 'string', nullable: true }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken],
    schema: {
      tags: ['Verification'],
      summary: 'Получение статуса верификации',
      description: 'Возвращает текущий статус верификации пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            verification: { type: 'object', nullable: true, additionalProperties: true }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken],
    schema: {
      tags: ['Verification'],
      summary: 'Отправка заявки на верификацию',
      description: 'Отправляет заявку на верификацию пользователя с указанием ФИО и реферальной ссылки',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['full_name', 'referral_link'],
        properties: {
          full_name: { type: 'string' },
          referral_link: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            verificationId: { type: 'integer' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
        415: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      const contentType = req.headers['content-type'] || '';
      let fullName = null;
      let referralLink = null;

      if (req.isMultipart()) {
        const parts = req.parts();

        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'full_name') {
              fullName = part.value;
            } else if (part.fieldname === 'referral_link') {
              referralLink = part.value;
            }
          }
        }
      } else if (contentType.includes('application/json') && req.body && typeof req.body === 'object') {
        fullName = req.body.full_name;
        referralLink = req.body.referral_link;
      } else {
        return reply.code(415).send({ error: 'Форма должна отправляться как multipart/form-data или application/json' });
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

      return reply.code(200).send({
        success: true,
        message: 'Заявка на верификацию отправлена. Ожидайте проверки администратором.',
        verificationId: result.verificationId
      });

    } catch (err) {
      console.error('[VERIFICATION] Ошибка отправки заявки:', err);

      const msg = String(err?.message || '');

      // уже верифицирован → 409
      if (msg === 'Вы уже верифицированы' || msg.includes('уже верифицирован')) {
        return reply.code(409).send({ error: 'Вы уже верифицированы' });
      }

      // на всякий: уже есть активная заявка → 409
      if (msg.includes('активная заявка') || msg.includes('hasPendingRequest')) {
        return reply.code(409).send({ error: msg });
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка: ${msg}`
        : 'Не удалось отправить заявку. Попробуйте позже.';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  // Получить историю верификации пользователя
  app.get('/api/verification/history', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Verification'],
      summary: 'Получить историю верификации',
      description: 'Возвращает историю всех заявок на верификацию текущего пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  full_name: { type: 'string' },
                  status: { type: 'string' },
                  rejection_reason: { type: 'string', nullable: true },
                  submitted_at: { type: 'string', format: 'date-time' },
                  processed_at: { type: 'string', format: 'date-time', nullable: true },
                  processed_by_username: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken],
    schema: {
      tags: ['Verification'],
      summary: 'Отмена заявки на верификацию',
      description: 'Отменяет активную заявку на верификацию текущего пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
