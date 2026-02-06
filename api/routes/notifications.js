// api/routes/notifications.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerNotificationRoutes(app) {
  
  // GET /api/notifications - Получить непрочитанные уведомления
  // (УБРАЛИ /fogrup ИЗ ПУТИ)
  app.get('/api/notifications', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Notifications'],
      summary: 'Получить уведомления пользователя',
      description: 'Возвращает список непрочитанных уведомлений текущего пользователя',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          unread_only: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  text: { type: 'string' },
                  read: { type: 'boolean' },
                  timestamp: { type: 'integer' },
                  fromUserId: { type: 'string', nullable: true },
                  relationshipId: { type: 'string', nullable: true }
                }
              }
            },
            total: { type: 'integer' },
            unread_count: { type: 'integer' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await pool.query(`
        SELECT 
          n.id, n.type, n.text, n.is_read, n.created_at,
          n.from_user_id, n.relationship_id
        FROM fogrup_notifications n
        WHERE n.user_id = $1 
          AND n.is_read = FALSE 
        ORDER BY n.created_at DESC
        LIMIT 50
      `, [req.user.id]);

      const notifications = result.rows.map(row => ({
        id: row.id.toString(),
        type: row.type,
        text: row.text,
        read: row.is_read,
        timestamp: new Date(row.created_at).getTime(),
        fromUserId: row.from_user_id ? row.from_user_id.toString() : null,
        relationshipId: row.relationship_id ? row.relationship_id.toString() : null
      }));

      return reply.send({ success: true, notifications });
    } catch (err) {
      console.error('[NOTIFICATIONS GET] Error:', err);
      return reply.code(500).send({ error: 'Server error' });
    }
  });

  // PUT /api/notifications/:id/read - Отметить как прочитанное
  // (УБРАЛИ /fogrup ИЗ ПУТИ)
  app.put('/api/notifications/:id/read', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Notifications'],
      summary: 'Отметить уведомление как прочитанное',
      description: 'Отмечает указанное уведомление как прочитанное для текущего пользователя',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params;
    try {
      await pool.query(
        'UPDATE fogrup_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      return reply.send({ success: true });
    } catch (err) {
      console.error('[NOTIFICATIONS READ] Error:', err);
      return reply.code(500).send({ error: 'Error' });
    }
  });
}
