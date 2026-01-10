/**
 * Маршруты для работы с досками
 * - GET /api/boards - Получить все доски пользователя
 * - GET /api/boards/:id - Получить одну доску
 * - POST /api/boards - Создать новую доску
 * - PUT /api/boards/:id - Обновить доску (автосохранение)
 * - DELETE /api/boards/:id - Удалить доску
 * - POST /api/boards/:id/duplicate - Дублировать доску
 * - POST /api/boards/:id/thumbnail - Загрузить миниатюру
 */

import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkFeature } from '../middleware/checkFeature.js';
import { checkUsageLimit } from '../middleware/checkUsageLimit.js';
import {
  getUserBoardPreviewPath,
  ensureFolderExists,
  uploadFile,
  publishFile,
  deleteFile
} from '../services/yandexDiskService.js';

/**
 * Получить информацию о блокировке доски
 * @param {number} userId - ID пользователя
 * @returns {Promise<{daysLeft: number}|null>} Информация о блокировке
 */
async function getBoardLockInfo(userId) {
  const userResult = await pool.query(
    'SELECT boards_locked_at FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
    const lockedAt = new Date(userResult.rows[0].boards_locked_at);
    const now = new Date();
    const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, 14 - daysPassed);
    return { daysLeft };
  }
  return null;
}

/**
 * Регистрация маршрутов для работы с досками
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerBoardRoutes(app) {

  // === ПОЛУЧИТЬ ВСЕ ДОСКИ ПОЛЬЗОВАТЕЛЯ ===
  app.get('/api/boards', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT
          b.id,
          b.name,
          b.description,
          b.thumbnail_url,
          b.is_public,
          b.created_at,
          b.updated_at,
          b.object_count,
          COALESCE(
            json_agg(
              json_build_object('id', bf.id, 'name', bf.name)
            ) FILTER (WHERE bf.id IS NOT NULL),
            '[]'::json
          ) as folders
         FROM boards b
         LEFT JOIN board_folder_items bfi ON b.id = bfi.board_id
         LEFT JOIN board_folders bf ON bfi.folder_id = bf.id
         WHERE b.owner_id = $1
         GROUP BY b.id
         ORDER BY b.updated_at DESC`,
        [req.user.id]
      );

      return reply.send({ boards: result.rows });
    } catch (err) {
      console.error('❌ Ошибка получения досок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПОЛУЧИТЬ ОДНУ ДОСКУ ===
  app.get('/api/boards/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      const query = isAdmin
        ? 'SELECT * FROM boards WHERE id = $1'
        : 'SELECT * FROM boards WHERE id = $1 AND owner_id = $2';
      const params = isAdmin ? [id] : [id, req.user.id];

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const board = result.rows[0];

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin && board.is_locked) {
        const lockInfo = await getBoardLockInfo(req.user.id);
        if (lockInfo) {
          return reply.code(403).send({
            error: 'Доска заблокирована',
            message: `Эта доска заблокирована. Если в течение ${lockInfo.daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
            daysLeft: lockInfo.daysLeft,
            locked: true
          });
        }
      }

      return reply.send({ board: board });
    } catch (err) {
      console.error('❌ Ошибка получения доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === СОЗДАТЬ НОВУЮ ДОСКУ ===
  app.post('/api/boards', {
    preHandler: [authenticateToken, checkUsageLimit('boards', 'max_boards')]
  }, async (req, reply) => {
    try {
      const { name, description, content } = req.body;

      const result = await pool.query(
        `INSERT INTO boards (owner_id, name, description, content)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          req.user.id,
          name || 'Без названия',
          description || null,
          content ? JSON.stringify(content) : null
        ]
      );

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка создания доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ОБНОВИТЬ ДОСКУ (АВТОСОХРАНЕНИЕ) ===
  app.put('/api/boards/:id', {
    preHandler: [authenticateToken, checkUsageLimit('cards', 'max_licenses')]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description, content } = req.body;
      const isAdmin = req.user.role === 'admin';

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin) {
        const boardCheck = await pool.query(
          'SELECT is_locked FROM boards WHERE id = $1 AND owner_id = $2',
          [id, userId]
        );

        if (boardCheck.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        if (boardCheck.rows[0].is_locked) {
          const lockInfo = await getBoardLockInfo(userId);
          if (lockInfo) {
            return reply.code(403).send({
              error: 'Доска заблокирована',
              message: `Эта доска заблокирована. Если в течение ${lockInfo.daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
              daysLeft: lockInfo.daysLeft,
              locked: true
            });
          }
        }
      }

      // Подсчёт объектов
      let objectCount = 0;
      if (content && content.objects) {
        objectCount = content.objects.length;
      }

      const query = isAdmin
        ? `UPDATE boards
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               content = COALESCE($3, content),
               object_count = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5
           RETURNING *`
        : `UPDATE boards
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               content = COALESCE($3, content),
               object_count = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5 AND owner_id = $6
           RETURNING *`;

      const params = isAdmin
        ? [name || null, description || null, content ? JSON.stringify(content) : null, objectCount, id]
        : [name || null, description || null, content ? JSON.stringify(content) : null, objectCount, id, userId];

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка обновления доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === УДАЛИТЬ ДОСКУ ===
  app.delete('/api/boards/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin) {
        const boardCheck = await pool.query(
          'SELECT is_locked FROM boards WHERE id = $1 AND owner_id = $2',
          [id, req.user.id]
        );

        if (boardCheck.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        if (boardCheck.rows[0].is_locked) {
          const lockInfo = await getBoardLockInfo(req.user.id);
          if (lockInfo) {
            return reply.code(403).send({
              error: 'Доска заблокирована',
              message: `Эта доска заблокирована. Если в течение ${lockInfo.daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
              daysLeft: lockInfo.daysLeft,
              locked: true
            });
          }
        }
      }

    // Получить thumbnail_url перед удалением доски
    const thumbnailResult = await pool.query(
      'SELECT thumbnail_url FROM boards WHERE id = $1',
      [id]
    );

    const thumbnailUrl = thumbnailResult.rows[0]?.thumbnail_url;

    // Если превью хранится на Яндекс.Диске, удалить файл
    if (thumbnailUrl && thumbnailUrl.includes('|')) {
      const parts = thumbnailUrl.split('|');
      const yandexPath = parts[1]; // Извлекаем yandexPath

      if (yandexPath) {
        try {
          await deleteFile(yandexPath);
          console.log(`✅ Превью доски ${id} удалено с Яндекс.Диска: ${yandexPath}`);
        } catch (deleteError) {
          // Если файл не найден (404), игнорируем ошибку
          if (deleteError.status === 404) {
            console.warn(`⚠️ Превью доски ${id} не найдено на Яндекс.Диске (уже удалено или не существовало)`);
          } else {
            console.error(`❌ Ошибка удаления превью доски ${id} с Яндекс.Диска:`, deleteError);
            // Продолжаем удаление доски из БД даже если не удалось удалить превью
          }
        }
      }
    }

      const query = isAdmin
        ? 'DELETE FROM boards WHERE id = $1 RETURNING id'
        : 'DELETE FROM boards WHERE id = $1 AND owner_id = $2 RETURNING id';
      const params = isAdmin ? [id] : [id, req.user.id];

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Ошибка удаления доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ДУБЛИРОВАТЬ ДОСКУ ===
  app.post('/api/boards/:id/duplicate', {
    preHandler: [authenticateToken, checkFeature('can_duplicate_boards', true)]
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      const query = isAdmin
        ? 'SELECT * FROM boards WHERE id = $1'
        : 'SELECT * FROM boards WHERE id = $1 AND owner_id = $2';
      const params = isAdmin ? [id] : [id, req.user.id];

      const original = await pool.query(query, params);

      if (original.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const board = original.rows[0];

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin && board.is_locked) {
        const lockInfo = await getBoardLockInfo(req.user.id);
        if (lockInfo) {
          return reply.code(403).send({
            error: 'Доска заблокирована',
            message: `Эта доска заблокирована. Если в течение ${lockInfo.daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
            daysLeft: lockInfo.daysLeft,
            locked: true
          });
        }
      }

      const result = await pool.query(
        `INSERT INTO boards (owner_id, name, description, content, object_count)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          req.user.id,
          `${board.name} (копия)`,
          board.description,
          board.content,
          board.object_count
        ]
      );

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка дублирования доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ЗАГРУЗИТЬ МИНИАТЮРУ ДОСКИ ===
  app.post('/api/boards/:id/thumbnail', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { id: boardId } = req.params;
      const { image } = req.body || {};

      if (typeof image !== 'string' || image.length === 0) {
        return reply.code(400).send({ error: 'Отсутствует изображение' });
      }

      const prefix = 'data:image/png;base64,';
      const base64Data = image.startsWith(prefix) ? image.slice(prefix.length) : image;

      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        return reply.code(400).send({ error: 'Некорректные данные изображения' });
      }

      if (buffer.length === 0) {
        return reply.code(400).send({ error: 'Некорректные данные изображения' });
      }

      const boardResult = await pool.query(
        'SELECT owner_id, is_locked FROM boards WHERE id = $1',
        [boardId]
      );

      if (boardResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && boardResult.rows[0].owner_id !== req.user.id) {
        return reply.code(403).send({ error: 'Нет доступа' });
      }

      // Проверяем блокировку
      if (!isAdmin && boardResult.rows[0].is_locked) {
        const lockInfo = await getBoardLockInfo(req.user.id);
        if (lockInfo) {
          return reply.code(403).send({
            error: 'Доска заблокирована',
            message: `Эта доска заблокирована. Если в течение ${lockInfo.daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
            daysLeft: lockInfo.daysLeft,
            locked: true
          });
        }
      }

      // Получить personal_id пользователя-владельца доски
      const userResult = await pool.query(
        'SELECT personal_id FROM users WHERE id = $1',
        [boardResult.rows[0].owner_id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(500).send({ error: 'Владелец доски не найден' });
      }

      const personalId = userResult.rows[0].personal_id;

      if (!personalId) {
        return reply.code(400).send({
          error: 'Для загрузки превью необходимо указать компьютерный номер в профиле владельца доски'
        });
      }

      // Загрузка превью на Яндекс.Диск
      let thumbnailUrl;

      try {
        // Построить путь к файлу превью на ЯД
        const previewPath = getUserBoardPreviewPath(
          boardResult.rows[0].owner_id,
          personalId,
          boardId
        );

        // Создать папку board_previews если не существует
        const previewsFolderPath = `${process.env.YANDEX_DISK_BASE_DIR}/${boardResult.rows[0].owner_id}.${personalId}/board_previews`;
        await ensureFolderExists(previewsFolderPath);

        // Загрузить файл на Яндекс.Диск
        await uploadFile(previewPath, buffer, 'image/png');

        // Опубликовать файл и получить public_url
        const publishResult = await publishFile(previewPath);
        const previewUrl = publishResult.preview_url || publishResult.public_url;

        // Сформировать значение для БД: preview_url|yandexPath|timestamp
        const timestamp = Date.now();
        thumbnailUrl = `${previewUrl}|${previewPath}|${timestamp}`;

        console.log(`✅ Превью доски ${boardId} загружено на Яндекс.Диск: ${previewPath}`);

      } catch (ydError) {
        console.error(`❌ Ошибка загрузки превью доски ${boardId} на Яндекс.Диск:`, ydError);
        
        // Fallback: использовать локальный placeholder
        thumbnailUrl = '/uploads/boards/placeholder.png';
        
        console.log(`⚠️ Для доски ${boardId} установлен placeholder`);
      }

      const updateQuery = isAdmin
        ? 'UPDATE boards SET thumbnail_url = $1 WHERE id = $2'
        : 'UPDATE boards SET thumbnail_url = $1 WHERE id = $2 AND owner_id = $3';
      const updateParams = isAdmin
        ? [thumbnailUrl, boardId]
        : [thumbnailUrl, boardId, req.user.id];

      await pool.query(updateQuery, updateParams);

      return reply.send({ thumbnail_url: thumbnailUrl });
    } catch (err) {
      console.error('❌ Ошибка загрузки миниатюры доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

}
