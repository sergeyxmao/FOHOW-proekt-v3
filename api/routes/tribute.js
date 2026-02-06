/**
 * Маршруты для интеграции с Tribute Payment System
 *
 * Endpoints:
 * - POST /api/webhook/tribute - Приём webhook от Tribute
 * - GET /api/webhook/tribute/health - Проверка доступности
 */

import {
  verifyTributeWebhook,
  handleNewSubscription,
  handleSubscriptionCancelled,
  handleSubscriptionRenewed
} from '../services/tributeService.js';

/**
 * Регистрация маршрутов Tribute
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerTributeRoutes(app) {

  /**
   * Webhook от Tribute
   * Принимает уведомления о новых подписках, продлениях, отменах
   */
  app.post('/api/webhook/tribute', {
    schema: {
      tags: ['Tribute'],
      summary: 'Webhook от Tribute (payment system)',
      description: 'Принимает уведомления от Tribute о новых подписках, продлениях и отменах',
      body: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          data: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            received: { type: 'string' },
            result: { type: 'object' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const signature = req.headers['x-tribute-signature'];
      const payload = req.body;

      app.log.info('[Tribute Webhook] 📩 Получен запрос:', {
        event: payload?.event,
        subscription_id: payload?.data?.subscription_id
      });

      // 1. Проверка подписи (если настроен секрет)
      if (!verifyTributeWebhook(payload, signature)) {
        app.log.warn('❌ Неверная подпись Tribute webhook');
        return reply.code(403).send({ error: 'Invalid signature' });
      }

      // 2. Проверить формат payload
      const { event, data } = payload || {};

      if (!event || !data) {
        app.log.warn('❌ Некорректный формат webhook от Tribute:', { payload });
        return reply.code(400).send({ error: 'Invalid payload format' });
      }

      // 3. Обработать событие
      let result;
      switch (event) {
        case 'subscription.created':
        case 'subscription.started':
          result = await handleNewSubscription(data);
          break;

        case 'subscription.renewed':
        case 'subscription.payment_received':
          result = await handleSubscriptionRenewed(data);
          break;

        case 'subscription.cancelled':
        case 'subscription.expired':
        case 'subscription.failed':
          result = await handleSubscriptionCancelled(data);
          break;

        default:
          app.log.info(`ℹ️ Неизвестное событие от Tribute: ${event}`);
          result = { success: true, ignored: true };
      }

      return reply.send({
        success: true,
        received: event,
        result
      });

    } catch (error) {
      app.log.error('❌ Ошибка обработки Tribute webhook:', error);

      // Всегда возвращаем 200, чтобы Tribute не повторял запрос
      return reply.send({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Health check endpoint для проверки доступности webhook
   */
  app.get('/api/webhook/tribute/health', {
    schema: {
      tags: ['Tribute'],
      summary: 'Health check для Tribute webhook',
      description: 'Проверка доступности webhook эндпоинта для Tribute',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (req, reply) => {
    return reply.send({
      status: 'ok',
      service: 'tribute-webhook',
      timestamp: new Date().toISOString()
    });
  });

  console.log('✅ Tribute routes registered');
}
