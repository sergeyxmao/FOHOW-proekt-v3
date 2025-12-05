// api/routes/relationships.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerRelationshipRoutes(app) {
  
  // POST /api/relationships - Создать запрос на связь
  app.post('/api/relationships', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    // Фронтенд шлет targetId, мы это учитываем
    const { targetId, type } = req.body;
    const target_id = targetId; // Маппинг для БД

    if (!target_id || !['mentor', 'downline'].includes(type)) {
      return reply.code(400).send({ error: 'Неверные параметры. Требуется targetId и type.' });
    }

    if (target_id == req.user.id) {
      return reply.code(400).send({ error: 'Нельзя создать связь с самим собой' });
    }

    try {
      // Проверка существования
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [target_id]);
      if (userCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      // Создание связи
      const result = await pool.query(
        'INSERT INTO relationships (initiator_id, target_id, type, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, target_id, type, 'pending']
      );

      // Уведомление
      const senderInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const senderName = senderInfo.rows[0]?.full_name || 'Пользователь';

      const notifText = type === 'mentor'
        ? `${senderName} хочет добавить вас как наставника`
        : `${senderName} хочет добавить вас в свою структуру`;

      await pool.query(
        'INSERT INTO fogrup_notifications (user_id, type, from_user_id, relationship_id, text) VALUES ($1, $2, $3, $4, $5)',
        [target_id, 'relationship_request', req.user.id, result.rows[0].id, notifText]
      );

      // Возвращаем в формате для фронтенда (camelCase)
      const row = result.rows[0];
      return reply.send({ 
        success: true, 
        relationship: {
          id: row.id,
          initiatorId: row.initiator_id,
          targetId: row.target_id,
          type: row.type,
          status: row.status
        }
      });

    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Связь уже существует' });
      }
      console.error('[RELATIONSHIPS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/relationships/:id - Ответить на запрос (принимаем status)
  app.put('/api/relationships/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;
    const { status } = req.body; // Фронтенд шлет confirmed или rejected

    if (!['confirmed', 'rejected'].includes(status)) {
      return reply.code(400).send({ error: 'Неверный статус' });
    }

    try {
      // Обновляем только если пользователь является ЦЕЛЬЮ запроса (target_id)
      const result = await pool.query(
        'UPDATE relationships SET status = $1, updated_at = NOW() WHERE id = $2 AND target_id = $3 RETURNING *',
        [status, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Связь не найдена или вы не можете её подтвердить' });
      }

      const row = result.rows[0];

      // Уведомление инициатору
      const responderInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const responderName = responderInfo.rows[0]?.full_name || 'Пользователь';
      
      const notifText = status === 'confirmed'
        ? `${responderName} подтвердил(а) связь`
        : `${responderName} отклонил(а) связь`;

      await pool.query(
        'INSERT INTO fogrup_notifications (user_id, type, from_user_id, relationship_id, text) VALUES ($1, $2, $3, $4, $5)',
        [row.initiator_id, 'relationship_response', req.user.id, id, notifText]
      );

      return reply.send({ 
        success: true, 
        relationship: {
          id: row.id,
          initiatorId: row.initiator_id,
          targetId: row.target_id,
          type: row.type,
          status: row.status
        }
      });
    } catch (err) {
      console.error('[RELATIONSHIPS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // GET /api/relationships/my - Получить ВСЕ связи (и активные, и заявки)
  app.get('/api/relationships/my', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      // Выбираем все связи, где пользователь либо инициатор, либо цель
      const result = await pool.query(`
        SELECT id, initiator_id, target_id, type, status, created_at
        FROM relationships
        WHERE initiator_id = $1 OR target_id = $1
      `, [req.user.id]);

      // Преобразуем в формат для фронтенда (camelCase)
      const relationships = result.rows.map(row => ({
        id: row.id.toString(),
        initiatorId: row.initiator_id.toString(),
        targetId: row.target_id.toString(),
        type: row.type,
        status: row.status
      }));

      return reply.send({ success: true, relationships });
    } catch (err) {
      console.error('[RELATIONSHIPS] Ошибка загрузки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
