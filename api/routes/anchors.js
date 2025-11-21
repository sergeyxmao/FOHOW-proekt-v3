import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация маршрутов для работы с точками (anchors)
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerAnchorRoutes(app) {
  // Получить все точки пользователя для конкретной доски
  app.get(
    '/api/boards/:boardId/anchors',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const { boardId } = req.params;
        const userId = req.user.id;

        const boardCheck = await pool.query(
          'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
          [boardId, userId]
        );

        if (boardCheck.rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'Доска не найдена или нет доступа' });
        }

        const result = await pool.query(
          `SELECT id, board_id, user_id, pos_x, pos_y, description, created_at, updated_at
           FROM board_anchors
           WHERE board_id = $1 AND user_id = $2
           ORDER BY created_at ASC`,
          [boardId, userId]
        );

        return reply.send({ anchors: result.rows });
      } catch (err) {
        console.error('❌ Ошибка получения точек:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // Создать новую точку
  app.post(
    '/api/boards/:boardId/anchors',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const { boardId } = req.params;
        const userId = req.user.id;
        const { pos_x, pos_y, description } = req.body || {};

        if (pos_x === undefined || pos_y === undefined) {
          return reply.code(400).send({
            error: 'Обязательные поля: pos_x, pos_y'
          });
        }

        const boardCheck = await pool.query(
          'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
          [boardId, userId]
        );

        if (boardCheck.rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'Доска не найдена или нет доступа' });
        }

        const result = await pool.query(
          `INSERT INTO board_anchors (board_id, user_id, pos_x, pos_y, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, board_id, user_id, pos_x, pos_y, description, created_at, updated_at`,
          [boardId, userId, pos_x, pos_y, description]
        );

        return reply.send({ anchor: result.rows[0] });
      } catch (err) {
        console.error('❌ Ошибка создания точки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // Обновить описание точки
  app.put(
    '/api/anchors/:anchorId',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const { anchorId } = req.params;
        const userId = req.user.id;
        const { description } = req.body || {};

        const result = await pool.query(
          `UPDATE board_anchors
           SET description = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND user_id = $3
           RETURNING id, board_id, user_id, pos_x, pos_y, description, created_at, updated_at`,
          [description, anchorId, userId]
        );

        if (result.rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'Точка не найдена или нет доступа' });
        }

        return reply.send({ anchor: result.rows[0] });
      } catch (err) {
        console.error('❌ Ошибка обновления точки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // Удалить точку
  app.delete(
    '/api/anchors/:anchorId',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const { anchorId } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
          'DELETE FROM board_anchors WHERE id = $1 AND user_id = $2',
          [anchorId, userId]
        );

        if (result.rowCount === 0) {
          return reply
            .code(404)
            .send({ error: 'Точка не найдена или нет доступа' });
        }

        return reply.code(204).send();
      } catch (err) {
        console.error('❌ Ошибка удаления точки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );
}
