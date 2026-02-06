import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkUsageLimit } from '../middleware/checkUsageLimit.js';

/**
 * Регистрация роутов для работы с личными комментариями пользователя (user_comments)
 * @param {FastifyInstance} app - экземпляр Fastify
 */
export function registerCommentRoutes(app) {
  // Получить все личные комментарии пользователя
  app.get('/api/comments', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Comments'],
      summary: 'Получить комментарии (с фильтрами)',
      description: 'Возвращает список комментариев пользователя с возможностью фильтрации',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          board_id: { type: 'integer', description: 'ID доски (опционально)' },
          sticker_id: { type: 'integer', description: 'ID стикера (опционально)' },
          type: { type: 'string', description: 'Тип комментария (опционально)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            comments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {}
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      // Получаем все комментарии пользователя, отсортированные по дате создания (новые вверху)
      const result = await pool.query(
        `SELECT id, user_id, content, color, created_at, updated_at
         FROM user_comments
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      return reply.send({ comments: result.rows });
    } catch (err) {
      console.error('❌ Ошибка получения комментариев:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Создать новый личный комментарий
  app.post('/api/comments', {
    preHandler: [authenticateToken, checkUsageLimit('comments', 'max_comments')],
    schema: {
      tags: ['Comments'],
      summary: 'Создать комментарий',
      description: 'Создаёт новый личный комментарий',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          board_id: { type: 'integer', description: 'ID доски' },
          sticker_id: { type: 'integer', nullable: true, description: 'ID стикера (опционально)' },
          content: { type: 'string', description: 'Содержимое комментария' },
          type: { type: 'string', nullable: true, description: 'Тип комментария (опционально)' }
        },
        required: ['content']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            comment: { type: 'object', properties: {} }
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
      const { content, color } = req.body;

      // Валидация входных данных
      if (!content || content.trim() === '') {
        return reply.code(400).send({
          error: 'Содержимое комментария обязательно'
        });
      }

      // Создаём новый комментарий
      const result = await pool.query(
        `INSERT INTO user_comments (user_id, content, color)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, content, color, created_at, updated_at`,
        [req.user.id, content.trim(), color || null]
      );

      return reply.send({
        success: true,
        comment: result.rows[0]
      });
    } catch (err) {
      console.error('❌ Ошибка создания комментария:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Обновить личный комментарий
  app.put('/api/comments/:commentId', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Comments'],
      summary: 'Обновить комментарий',
      description: 'Обновляет существующий комментарий по его ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          commentId: { type: 'integer', description: 'ID комментария' }
        },
        required: ['commentId']
      },
      body: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Содержимое комментария' }
        },
        required: ['content']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            comment: { type: 'object', properties: {} }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { commentId } = req.params;
      const { content, color } = req.body;

      // Валидация commentId
      if (!commentId || commentId === 'undefined' || commentId === 'null') {
        console.error('❌ Некорректный commentId:', commentId);
        return reply.code(400).send({ error: 'Некорректный ID комментария' });
      }

      // Проверяем, что commentId является числом
      const commentIdNum = Number(commentId);
      if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
        console.error('❌ commentId не является положительным числом:', commentId);
        return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
      }

      // Валидация входных данных
      if (!content || content.trim() === '') {
        return reply.code(400).send({
          error: 'Содержимое комментария обязательно'
        });
      }

      // Проверяем, что комментарий принадлежит текущему пользователю
      const ownerCheck = await pool.query(
        'SELECT user_id FROM user_comments WHERE id = $1',
        [commentIdNum]
      );

      if (ownerCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Комментарий не найден' });
      }

      // Администраторы могут редактировать любые комментарии
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
        return reply.code(403).send({ error: 'Нет доступа к редактированию этого комментария' });
      }

      // Обновляем комментарий
      const query = isAdmin
        ? `UPDATE user_comments
           SET content = $1,
               color = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING id, user_id, content, color, created_at, updated_at`
        : `UPDATE user_comments
           SET content = $1,
               color = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND user_id = $4
           RETURNING id, user_id, content, color, created_at, updated_at`;
      const params = isAdmin
        ? [content.trim(), color || null, commentIdNum]
        : [content.trim(), color || null, commentIdNum, req.user.id];

      const result = await pool.query(query, params);

      return reply.send({
        success: true,
        comment: result.rows[0]
      });
    } catch (err) {
      console.error('❌ Ошибка обновления комментария:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // Удалить личный комментарий
  app.delete('/api/comments/:commentId', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Comments'],
      summary: 'Удалить комментарий',
      description: 'Удаляет комментарий по его ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          commentId: { type: 'integer', description: 'ID комментария' }
        },
        required: ['commentId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { commentId } = req.params;

      // Валидация commentId
      if (!commentId || commentId === 'undefined' || commentId === 'null') {
        console.error('❌ Некорректный commentId:', commentId);
        return reply.code(400).send({ error: 'Некорректный ID комментария' });
      }

      // Проверяем, что commentId является числом
      const commentIdNum = Number(commentId);
      if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
        console.error('❌ commentId не является положительным числом:', commentId);
        return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
      }

      // Проверяем, что комментарий принадлежит текущему пользователю
      const ownerCheck = await pool.query(
        'SELECT user_id FROM user_comments WHERE id = $1',
        [commentIdNum]
      );

      if (ownerCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Комментарий не найден' });
      }

      // Администраторы могут удалить любой комментарий
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
        return reply.code(403).send({ error: 'Нет доступа к удалению этого комментария' });
      }

      // Удаляем комментарий
      const query = isAdmin
        ? 'DELETE FROM user_comments WHERE id = $1'
        : 'DELETE FROM user_comments WHERE id = $1 AND user_id = $2';
      const params = isAdmin ? [commentIdNum] : [commentIdNum, req.user.id];

      await pool.query(query, params);

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Ошибка удаления комментария:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
