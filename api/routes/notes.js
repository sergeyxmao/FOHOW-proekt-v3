import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkUsageLimit } from '../middleware/checkUsageLimit.js';

/**
 * Регистрация роутов для работы с заметками (notes)
 * @param {FastifyInstance} app - экземпляр Fastify
 */
export function registerNoteRoutes(app) {
  // Получить все заметки для доски
  app.get('/api/boards/:boardId/notes', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Notes'],
      summary: 'Получить заметки доски',
      description: 'Возвращает все заметки для указанной доски',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          boardId: { type: 'integer', description: 'ID доски' }
        },
        required: ['boardId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {}
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
      const { boardId } = req.params;

      // Проверяем, что пользователь является владельцем доски
      // Администраторы могут получить заметки любой доски
      const isAdmin = req.user.role === 'admin';
      const query = isAdmin
        ? 'SELECT id FROM boards WHERE id = $1'
        : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
      const params = isAdmin ? [boardId] : [boardId, req.user.id];

      const boardCheck = await pool.query(query, params);

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
      }

      // Получаем все заметки для этой доски
      const result = await pool.query(
        `SELECT id, card_uid, note_date, content, color, created_at, updated_at
         FROM notes
         WHERE board_id = $1
         ORDER BY note_date ASC`,
        [boardId]
      );

      return reply.send({ notes: result.rows });
    } catch (err) {
      console.error('❌ Ошибка получения заметок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Создать/обновить/удалить заметку (UPSERT + DELETE)
  app.post('/api/notes', {
    preHandler: [authenticateToken, checkUsageLimit('notes', 'max_notes')],
    schema: {
      tags: ['Notes'],
      summary: 'Создать/обновить/удалить заметку (UPSERT)',
      description: 'Создаёт или обновляет заметку. Если content равен null или пустой — удаляет заметку',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          board_id: { type: 'integer', description: 'ID доски' },
          content: { type: 'string', nullable: true, description: 'Содержимое заметки (null — удаление)' },
          type: { type: 'string', nullable: true, description: 'Тип заметки' }
        },
        required: ['board_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            note: { type: 'object', properties: {} },
            deleted: { type: 'boolean' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { boardId, cardUid, noteDate, content, color } = req.body;

      // Валидация входных данных
      if (!boardId || !cardUid || !noteDate) {
        return reply.code(400).send({
          error: 'Обязательные поля: boardId, cardUid, noteDate'
        });
      }

      // Проверяем, что пользователь является владельцем доски
      // Администраторы могут создать/обновить заметку для любой доски
      const isAdmin = req.user.role === 'admin';
      const query = isAdmin
        ? 'SELECT id FROM boards WHERE id = $1'
        : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
      const params = isAdmin ? [boardId] : [boardId, req.user.id];

      const boardCheck = await pool.query(query, params);

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
      }

      // Проверяем, нужно ли удалить заметку (пустой текст = удаление, независимо от цвета)
      const shouldDelete = !content || content.trim() === '';

      if (shouldDelete) {
        // Удаляем заметку
        const deleteResult = await pool.query(
          `DELETE FROM notes
           WHERE board_id = $1 AND card_uid = $2 AND note_date = $3
           RETURNING id`,
          [boardId, cardUid, noteDate]
        );

        if (deleteResult.rows.length > 0) {
          return reply.send({
            success: true,
            deleted: true,
            message: 'Заметка удалена'
          });
        } else {
          return reply.send({
            success: true,
            deleted: false,
            message: 'Заметка не найдена'
          });
        }
      }

      // UPSERT: создаём или обновляем заметку
      const result = await pool.query(
        `INSERT INTO notes (board_id, card_uid, note_date, content, color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (board_id, card_uid, note_date)
         DO UPDATE SET
           content = EXCLUDED.content,
           color = EXCLUDED.color,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [boardId, cardUid, noteDate, content || null, color || null]
      );

      return reply.send({
        success: true,
        note: result.rows[0]
      });
    } catch (err) {
      console.error('❌ Ошибка сохранения заметки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
