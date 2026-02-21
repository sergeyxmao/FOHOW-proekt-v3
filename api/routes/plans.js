/**
 * Маршруты для работы с тарифными планами
 * - GET /api/user/plan - Получить информацию о тарифном плане пользователя
 * - GET /api/plans - Получить список публичных тарифных планов
 */

import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация маршрутов для работы с тарифами
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerPlanRoutes(app) {

  // === ПОЛУЧИТЬ ИНФОРМАЦИЮ О ТАРИФНОМ ПЛАНЕ ПОЛЬЗОВАТЕЛЯ ===
  app.get('/api/user/plan', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Plans'],
      summary: 'Получить информацию о тарифном плане пользователя',
      description: 'Возвращает информацию о текущем тарифном плане пользователя, включая лимиты и текущее использование',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                email: { type: 'string' },
                subscriptionStartedAt: { type: 'string', format: 'date-time', nullable: true },
                subscriptionExpiresAt: { type: 'string', format: 'date-time', nullable: true },
                gracePeriodUntil: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            scheduledPlan: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                code_name: { type: 'string' },
                paidAt: { type: 'string', format: 'date-time', nullable: true },
                expiresAt: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            plan: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                code_name: { type: 'string' },
                priceMonthly: { type: 'number' }
              }
            },
            features: { type: 'object', additionalProperties: true },
            usage: {
              type: 'object',
              properties: {
                boards: { type: 'object', properties: { current: { type: 'integer' }, limit: { type: 'integer' } } },
                notes: { type: 'object', properties: { current: { type: 'integer' }, limit: { type: 'integer' } } },
                stickers: { type: 'object', properties: { current: { type: 'integer' }, limit: { type: 'integer' } } },
                userComments: { type: 'object', properties: { current: { type: 'integer' }, limit: { type: 'integer' } } },
                cards: { type: 'object', properties: { current: { type: 'integer' }, limit: { type: 'integer' } } }
              }
            }
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

      // Выполняем ОДИН SQL-запрос для получения всех данных
      const result = await pool.query(
        `SELECT
          u.id,
          u.username,
          u.email,
          u.subscription_started_at,
          u.subscription_expires_at,
          u.grace_period_until,
          u.scheduled_plan_id,
          u.scheduled_plan_paid_at,
          u.scheduled_plan_expires_at,
          sp.id as plan_id,
          sp.name as plan_name,
          sp.code_name as plan_code_name,
          sp.price_monthly as plan_price_monthly,
          sp.features as plan_features,
          sp_sched.name as scheduled_plan_name,
          sp_sched.code_name as scheduled_plan_code_name,
          (SELECT COUNT(*) FROM boards WHERE owner_id = u.id) as boards_count,
          (SELECT COUNT(*) FROM notes n JOIN boards b ON n.board_id = b.id WHERE b.owner_id = u.id) as notes_count,
          (SELECT COUNT(*) FROM stickers s JOIN boards b ON s.board_id = b.id WHERE b.owner_id = u.id) as stickers_count,
          (SELECT COUNT(*) FROM user_comments WHERE user_id = u.id) as comments_count,
          (
            SELECT COALESCE(MAX(card_count), 0)
            FROM (
              SELECT COUNT(*) as card_count
              FROM boards b,
                   jsonb_array_elements(COALESCE(b.content->'objects', '[]'::jsonb)) obj
              WHERE b.owner_id = u.id
                AND obj->>'type' IN ('small', 'large', 'gold', 'avatar')
              GROUP BY b.id
            ) as board_cards
          ) as cards_count
        FROM users u
        LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
        LEFT JOIN subscription_plans sp_sched ON u.scheduled_plan_id = sp_sched.id
        WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const data = result.rows[0];

      // Проверяем наличие тарифного плана
      if (!data.plan_id) {
        return reply.code(404).send({ error: 'Тарифный план не найден' });
      }

      const features = data.plan_features || {};

      // Формируем ответ
      const response = {
        user: {
          id: data.id,
          username: data.username,
          email: data.email,
          subscriptionStartedAt: data.subscription_started_at,
          subscriptionExpiresAt: data.subscription_expires_at,
          gracePeriodUntil: data.grace_period_until
        },
        scheduledPlan: data.scheduled_plan_id ? {
          id: data.scheduled_plan_id,
          name: data.scheduled_plan_name,
          code_name: data.scheduled_plan_code_name,
          paidAt: data.scheduled_plan_paid_at,
          expiresAt: data.scheduled_plan_expires_at
        } : null,
        plan: {
          id: data.plan_id,
          name: data.plan_name,
          code_name: data.plan_code_name,
          priceMonthly: data.plan_price_monthly
        },
        features: features,
        usage: {
          boards: {
            current: parseInt(data.boards_count, 10),
            limit: parseInt(features.max_boards, 10) || -1
          },
          notes: {
            current: parseInt(data.notes_count, 10),
            limit: parseInt(features.max_notes, 10) || -1
          },
          stickers: {
            current: parseInt(data.stickers_count, 10),
            limit: parseInt(features.max_stickers, 10) || -1
          },
          userComments: {
            current: parseInt(data.comments_count, 10),
            limit: parseInt(features.max_comments, 10) || -1
          },
          cards: {
            current: parseInt(data.cards_count, 10),
            limit: parseInt(features.max_licenses, 10) || -1
          }
        }
      };

      return reply.send(response);
    } catch (err) {
      console.error('❌ Ошибка получения информации о тарифном плане:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПОЛУЧИТЬ СПИСОК ПУБЛИЧНЫХ ТАРИФНЫХ ПЛАНОВ ===
  app.get('/api/plans', {
    schema: {
      tags: ['Plans'],
      summary: 'Получить список публичных тарифных планов',
      description: 'Возвращает список всех публичных тарифных планов, доступных для подписки',
      response: {
        200: {
          type: 'object',
          properties: {
            plans: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  code_name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  price_monthly: { type: 'number', nullable: true },
                  price_yearly: { type: 'number', nullable: true },
                  price_original: { type: 'number', nullable: true },
                  features: { type: 'object', additionalProperties: true },
                  display_order: { type: 'integer' },
                  is_public: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT id, name, code_name, description, price_monthly, price_yearly,
                price_original, features, display_order, is_public, created_at, updated_at
         FROM subscription_plans
         WHERE is_public = true
         ORDER BY display_order ASC`
      );

      return reply.send({ plans: result.rows });
    } catch (err) {
      console.error('❌ Ошибка получения списка тарифных планов:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
