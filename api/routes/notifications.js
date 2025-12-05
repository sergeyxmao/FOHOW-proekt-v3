// api/routes/notifications.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerNotificationRoutes(app) {

  // GET: Только непрочитанные уведомления
  app.get('/api/fogrup/notifications', {
    preHandler: [authenticateToken]
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
        read: row.is_read, // важно: поле в БД is_read
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

  // PUT: Пометить прочитанным
  app.put('/api/fogrup/notifications/:id/read', {
    preHandler: [authenticateToken]
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
