// api/routes/relationships.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export function registerRelationshipRoutes(app) {
  // POST /api/relationships - Создать запрос на связь
  app.post('/api/relationships', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { target_id, type } = req.body;

    if (!target_id || !['mentor', 'downline'].includes(type)) {
      return reply.code(400).send({ error: 'Неверные параметры' });
    }

    try {
      // Проверка существования пользователя
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [target_id]);
      if (userCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      // Создание связи
      const result = await pool.query(
        'INSERT INTO relationships (initiator_id, target_id, type, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, target_id, type, 'pending']
      );

      // Создание уведомления
      const senderInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const senderName = senderInfo.rows[0]?.full_name || 'Пользователь';

      const notifText = type === 'mentor'
        ? `${senderName} хочет добавить вас как наставника`
        : `${senderName} хочет добавить вас в свою структуру`;

      await pool.query(
        'INSERT INTO fogrup_notifications (user_id, type, from_user_id, relationship_id, text) VALUES ($1, $2, $3, $4, $5)',
        [target_id, 'relationship_request', req.user.id, result.rows[0].id, notifText]
      );

      return reply.send({ success: true, relationship: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Связь уже существует' });
      }
      console.error('[RELATIONSHIPS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/relationships/:id - Ответить на запрос
  app.put('/api/relationships/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;
    const { action } = req.body;

    if (!['confirm', 'reject'].includes(action)) {
      return reply.code(400).send({ error: 'Неверное действие' });
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';

    try {
      const result = await pool.query(
        'UPDATE relationships SET status = $1, updated_at = NOW() WHERE id = $2 AND target_id = $3 RETURNING *',
        [newStatus, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Связь не найдена или у вас нет прав' });
      }

      // Уведомление инициатору
      const responderInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const responderName = responderInfo.rows[0]?.full_name || 'Пользователь';

      const notifText = action === 'confirm'
        ? `${responderName} подтвердил(а) вашу заявку`
        : `${responderName} отклонил(а) вашу заявку`;

      await pool.query(
        'INSERT INTO fogrup_notifications (user_id, type, from_user_id, relationship_id, text) VALUES ($1, $2, $3, $4, $5)',
        [result.rows[0].initiator_id, 'relationship_response', req.user.id, id, notifText]
      );

      return reply.send({ success: true, relationship: result.rows[0] });
    } catch (err) {
      console.error('[RELATIONSHIPS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // GET /api/relationships/my - Мои связи
  app.get('/api/relationships/my', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { type = 'all' } = req.query;

    try {
      let mentors = [];
      let downline = [];

      if (type === 'mentor' || type === 'all') {
        const mentorResult = await pool.query(`
          SELECT
            r.id as relationship_id, r.status, r.created_at,
            u.id, u.personal_id, u.full_name, u.city, u.rank, u.avatar_url
          FROM relationships r
          JOIN users u ON u.id = r.target_id
          WHERE r.initiator_id = $1 AND r.type = 'mentor' AND r.status = 'confirmed'
        `, [req.user.id]);
        mentors = mentorResult.rows;
      }

      if (type === 'downline' || type === 'all') {
        const downlineResult = await pool.query(`
          SELECT
            r.id as relationship_id, r.status, r.created_at,
            u.id, u.personal_id, u.full_name, u.city, u.rank, u.avatar_url
          FROM relationships r
          JOIN users u ON u.id = r.target_id
          WHERE r.initiator_id = $1 AND r.type = 'downline' AND r.status = 'confirmed'
        `, [req.user.id]);
        downline = downlineResult.rows;
      }

      return reply.send({ success: true, mentors, downline });
    } catch (err) {
      console.error('[RELATIONSHIPS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
