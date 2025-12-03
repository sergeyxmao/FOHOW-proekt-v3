// api/routes/users.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export function registerUserRoutes(app) {
  // POST /api/users/block - Заблокировать пользователя
  app.post('/api/users/block', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { user_id } = req.body;

    if (!user_id) {
      return reply.code(400).send({ error: 'user_id обязателен' });
    }

    try {
      const result = await pool.query(
        `UPDATE users
         SET blocked_users = CASE
           WHEN blocked_users @> $1::jsonb THEN blocked_users
           ELSE blocked_users || $1::jsonb
         END
         WHERE id = $2
         RETURNING blocked_users`,
        [JSON.stringify([user_id]), req.user.id]
      );

      return reply.send({ success: true, blocked_users: result.rows[0].blocked_users });
    } catch (err) {
      console.error('[USERS] Ошибка блокировки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // DELETE /api/users/block/:id - Разблокировать пользователя
  app.delete('/api/users/block/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;

    try {
      await pool.query(
        `UPDATE users
         SET blocked_users = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM jsonb_array_elements(blocked_users) elem
           WHERE elem::text::int != $1
         )
         WHERE id = $2`,
        [parseInt(id), req.user.id]
      );

      return reply.send({ success: true });
    } catch (err) {
      console.error('[USERS] Ошибка разблокировки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
