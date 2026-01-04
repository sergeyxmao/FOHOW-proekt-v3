/**
 * Маршруты для работы со стикерами
 * - GET /api/boards/:boardId/stickers - Получить все стикеры для доски
 * - POST /api/boards/:boardId/stickers - Создать новый стикер
 * - PUT /api/stickers/:stickerId - Обновить стикер
 * - DELETE /api/stickers/:stickerId - Удалить стикер
 */

import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkUsageLimit } from '../middleware/checkUsageLimit.js';

/**
 * Регистрация маршрутов для работы со стикерами
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerStickerRoutes(app) {

  // === ПОЛУЧИТЬ ВСЕ СТИКЕРЫ ДЛЯ ДОСКИ ===
  app.get('/api/boards/:boardId/stickers', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { boardId } = req.params;

      // Проверяем, что пользователь является владельцем доски
      const boardCheck = await pool.query(
        'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
        [boardId, req.user.id]
      );

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
      }

      // Получаем все стикеры для этой доски с информацией об авторе
      const result = await pool.query(
        `SELECT
          s.id,
          s.board_id,
          s.user_id,
          s.content,
          s.color,
          s.pos_x,
          s.pos_y,
          s.created_at,
          s.updated_at,
          u.username AS author_username,
          u.avatar_url AS author_avatar
         FROM stickers s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.board_id = $1
         ORDER BY s.created_at ASC`,
        [boardId]
      );

      // Извлекаем только публичную часть avatar_url
      const stickers = result.rows.map(sticker => ({
        ...sticker,
        author_avatar: sticker.author_avatar?.split('|')[0] || sticker.author_avatar
      }));

      return reply.send({ stickers });
    } catch (err) {
      console.error('❌ Ошибка получения стикеров:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === СОЗДАТЬ НОВЫЙ СТИКЕР ===
  app.post('/api/boards/:boardId/stickers', {
    preHandler: [authenticateToken, checkUsageLimit('stickers', 'max_stickers')]
  }, async (req, reply) => {
    try {
      const { boardId } = req.params;
      const { pos_x, pos_y, color } = req.body;

      // Валидация входных данных
      if (pos_x === undefined || pos_y === undefined) {
        return reply.code(400).send({
          error: 'Обязательные поля: pos_x, pos_y'
        });
      }

      // Проверяем, что пользователь является владельцем доски
      const boardCheck = await pool.query(
        'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
        [boardId, req.user.id]
      );

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
      }

      // Создаём новый стикер
      const result = await pool.query(
        `INSERT INTO stickers (board_id, user_id, content, color, pos_x, pos_y)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [boardId, req.user.id, '', color || '#FFFF88', pos_x, pos_y]
      );

      // Получаем информацию об авторе
      const stickerWithAuthor = await pool.query(
        `SELECT
          s.*,
          u.username AS author_username,
          u.avatar_url AS author_avatar
         FROM stickers s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [result.rows[0].id]
      );

      // Извлекаем только публичную часть avatar_url
      const sticker = {
        ...stickerWithAuthor.rows[0],
        author_avatar: stickerWithAuthor.rows[0].author_avatar?.split('|')[0] || stickerWithAuthor.rows[0].author_avatar
      };

      return reply.send({
        success: true,
        sticker
      });
    } catch (err) {
      console.error('❌ Ошибка создания стикера:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ОБНОВИТЬ СТИКЕР ===
  app.put('/api/stickers/:stickerId', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { stickerId } = req.params;
      const { content, pos_x, pos_y, color } = req.body;

      // Проверяем, что стикер существует и принадлежит текущему пользователю
      const ownerCheck = await pool.query(
        'SELECT user_id FROM stickers WHERE id = $1',
        [stickerId]
      );

      if (ownerCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Стикер не найден' });
      }

      // Администраторы могут редактировать любые стикеры
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
        return reply.code(403).send({ error: 'Нет доступа к редактированию этого стикера' });
      }

      // Обновляем стикер
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(content);
      }
      if (pos_x !== undefined) {
        updateFields.push(`pos_x = $${paramIndex++}`);
        updateValues.push(pos_x);
      }
      if (pos_y !== undefined) {
        updateFields.push(`pos_y = $${paramIndex++}`);
        updateValues.push(pos_y);
      }
      if (color !== undefined) {
        updateFields.push(`color = $${paramIndex++}`);
        updateValues.push(color);
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: 'Нет полей для обновления' });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(stickerId);

      const result = await pool.query(
        `UPDATE stickers
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      // Получаем информацию об авторе
      const stickerWithAuthor = await pool.query(
        `SELECT
          s.*,
          u.username AS author_username,
          u.avatar_url AS author_avatar
         FROM stickers s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [result.rows[0].id]
      );

      // Извлекаем только публичную часть avatar_url
      const sticker = {
        ...stickerWithAuthor.rows[0],
        author_avatar: stickerWithAuthor.rows[0].author_avatar?.split('|')[0] || stickerWithAuthor.rows[0].author_avatar
      };

      return reply.send({
        success: true,
        sticker
      });
    } catch (err) {
      console.error('❌ Ошибка обновления стикера:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === УДАЛИТЬ СТИКЕР ===
  app.delete('/api/stickers/:stickerId', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { stickerId } = req.params;
      const userId = req.user.id;

      // Валидация ID стикера
      const stickerIdNum = parseInt(stickerId, 10);
      if (isNaN(stickerIdNum) || stickerIdNum <= 0) {
        return reply.code(400).send({ error: 'Некорректный ID стикера' });
      }

      // Выполняем ОДИН безопасный запрос на удаление
      // Администраторы могут удалить любой стикер
      const isAdmin = req.user.role === 'admin';
      const query = isAdmin
        ? 'DELETE FROM stickers WHERE id = $1'
        : 'DELETE FROM stickers WHERE id = $1 AND user_id = $2';
      const params = isAdmin ? [stickerIdNum] : [stickerIdNum, userId];

      const result = await pool.query(query, params);

      // Проверяем, была ли удалена строка
      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Стикер не найден или у вас нет прав на его удаление' });
      }

      // Отправляем успешный ответ (204 No Content)
      return reply.code(204).send();

    } catch (err) {
      console.error('❌ Ошибка удаления стикера:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
