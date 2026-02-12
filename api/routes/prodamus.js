import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { verifySignature, processWebhook } from '../services/prodamusService.js';

// Маппинг plan_id → готовая ссылка Продамуса
const PRODAMUS_LINKS = {
  6: process.env.PRODAMUS_LINK_INDIVIDUAL || 'https://payform.ru/hqaEqyT/',
  7: process.env.PRODAMUS_LINK_PREMIUM || 'https://payform.ru/nkaEqBZ/'
};

/**
 * Регистрация маршрутов для платёжной системы Продамус
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerProdamusRoutes(app) {

  // ============================================
  // POST /api/webhook/prodamus — приём webhook от Продамуса
  // ============================================
  app.post('/api/webhook/prodamus', {
    schema: {
      tags: ['Prodamus'],
      summary: 'Webhook уведомление от Продамуса об оплате',
      description: 'Принимает уведомления о статусе платежа от Продамуса. Публичный эндпоинт без аутентификации, но с верификацией HMAC SHA-256 подписи в заголовке Sign.',
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const secretKey = process.env.PRODAMUS_SECRET_KEY;
      if (!secretKey) {
        console.error('[PRODAMUS] PRODAMUS_SECRET_KEY не задан в переменных окружения');
        return reply.code(500).send({ error: 'Payment system not configured' });
      }

      // Получаем данные из тела запроса
      let body = req.body;

      // Для multipart/form-data парсим поля
      if (req.isMultipart && req.isMultipart()) {
        body = {};
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'field') {
            body[part.fieldname] = part.value;
          }
        }
      }

      if (!body || Object.keys(body).length === 0) {
        console.error('[PRODAMUS] Пустое тело запроса');
        return reply.code(400).send({ error: 'Empty request body' });
      }

      // Подпись в заголовке Sign (стандарт Продамуса)
      const receivedSignature = req.headers['sign'];
      if (!receivedSignature) {
        console.error('[PRODAMUS] Отсутствует заголовок Sign');
        return reply.code(400).send({ error: 'Missing signature' });
      }

      // Верификация подписи
      if (!verifySignature(body, receivedSignature, secretKey)) {
        console.error('[PRODAMUS] Невалидная подпись webhook');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      console.log(`[PRODAMUS] Webhook получен: order_id=${body.order_id}, status=${body.payment_status}`);

      // Удаляем служебное поле __rawBody перед обработкой
      const cleanBody = { ...body };
      delete cleanBody.__rawBody;

      // Обработка webhook
      const result = await processWebhook(cleanBody);
      console.log(`[PRODAMUS] Webhook обработан: ${JSON.stringify(result)}`);

      // Всегда 200 при валидной подписи (требование Продамуса)
      return reply.code(200).send({ success: true });

    } catch (error) {
      console.error('[PRODAMUS] Ошибка обработки webhook:', error);
      // Возвращаем 200 даже при ошибке обработки, чтобы Продамус не повторял запрос
      return reply.code(200).send({ success: true });
    }
  });

  // ============================================
  // POST /api/payments/create-link — создание ссылки на оплату
  // ============================================
  app.post('/api/payments/create-link', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Prodamus'],
      summary: 'Создание ссылки на оплату через Продамус',
      description: 'Возвращает готовую ссылку Продамуса с GET-параметрами пользователя для оплаты выбранного тарифа.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'integer', description: 'ID тарифного плана (6 = Индивидуальный, 7 = Премиум)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            paymentUrl: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { planId } = req.body;

      // Проверка допустимых тарифов по маппингу готовых ссылок
      const baseUrl = PRODAMUS_LINKS[planId];
      if (!baseUrl) {
        return reply.code(400).send({ error: 'Недопустимый тарифный план. Доступны: Индивидуальный (6) и Премиум (7).' });
      }

      // Получаем email пользователя
      const userResult = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(400).send({ error: 'Пользователь не найден' });
      }

      const userEmail = userResult.rows[0].email;

      // Формируем ссылку: готовая ссылка Продамуса + GET-параметры
      const params = new URLSearchParams({
        _param_user_id: String(userId),
        customer_email: userEmail
      });

      const paymentUrl = `${baseUrl}?${params.toString()}`;

      return reply.send({ paymentUrl });

    } catch (error) {
      console.error('[PRODAMUS] Ошибка создания ссылки на оплату:', error);
      return reply.code(500).send({ error: 'Ошибка сервера при создании ссылки на оплату' });
    }
  });
}
