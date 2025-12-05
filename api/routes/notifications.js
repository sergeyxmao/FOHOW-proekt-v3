// api/routes/notifications.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerNotificationRoutes(app) {
  
  // GET /api/fogrup/notifications - Получить список уведомлений
  app.get('/api/fogrup/notifications', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const result = await pool.query(`
        SELECT 
          n.id, 
          n.type, 
          n.text, 
          n.is_read as read, 
          n.created_at,
          n.from_user_id,
          n.relationship_id
        FROM fogrup_notifications n
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 50
      `, [req.user.id]);

      // Приводим к формату фронтенда
      const notifications = result.rows.map(row => ({
        id: row.id.toString(),
        type: row.type,
        text: row.text,
        read: row.read,
        timestamp: new Date(row.created_at).getTime(),
        fromUserId: row.from_user_id ? row.from_user_id.toString() : null,
        relationshipId: row.relationship_id ? row.relationship_id.toString() : null
      }));

      return reply.send({ success: true, notifications });
    } catch (err) {
      console.error('[NOTIFICATIONS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/fogrup/notifications/:id/read - Отметить как прочитанное
  app.put('/api/fogrup/notifications/:id/read', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      await pool.query(
        'UPDATE fogrup_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      return reply.send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: 'Ошибка' });
    }
  });
}
