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
import { getBoardPreviewUrl } from '../utils/boardPreviewUtils.js';
import boardLockService from '../services/boardLockService.js';

/**
 * Вычислить информацию о блокировке доски (days until block/delete)
 * @param {string} lockStatus - Статус блокировки ('active', 'soft_lock', 'hard_lock')
 * @param {Date|string|null} lockTimerStartedAt - Дата начала таймера
 * @returns {{daysUntilBlock: number|null, daysUntilDelete: number|null}}
 */
function calculateBoardLockDays(lockStatus, lockTimerStartedAt) {
  let daysUntilBlock = null;
  let daysUntilDelete = null;

  if (lockTimerStartedAt) {
    const timerStart = new Date(lockTimerStartedAt);
    const now = new Date();
    const daysPassed = Math.floor((now - timerStart) / (1000 * 60 * 60 * 24));

    if (lockStatus === 'soft_lock') {
      daysUntilBlock = Math.max(0, 14 - daysPassed);
    } else if (lockStatus === 'hard_lock') {
      daysUntilDelete = Math.max(0, 14 - daysPassed);
    }
  }

  return { daysUntilBlock, daysUntilDelete };
}

/**
 * Регистрация маршрутов для работы с досками
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerBoardRoutes(app) {

  // === ПОЛУЧИТЬ ВСЕ ДОСКИ ПОЛЬЗОВАТЕЛЯ ===
  app.get('/api/boards', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Boards'],
      summary: 'Получить все доски пользователя',
      description: 'Возвращает список всех досок текущего авторизованного пользователя с информацией о папках и блокировках',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            boards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  thumbnail_url: { type: 'string', nullable: true },
                  is_public: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  object_count: { type: 'integer' },
                  lock_status: { type: 'string' },
                  lock_timer_started_at: { type: 'string', format: 'date-time', nullable: true },
                  daysUntilBlock: { type: 'integer', nullable: true },
                  daysUntilDelete: { type: 'integer', nullable: true },
                  folders: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' }
                      }
                    }
                  }
                }
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
          b.lock_status,
          b.lock_timer_started_at,
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

      // Преобразовать thumbnail_url в proxy URL и добавить информацию о блокировках
      const boards = result.rows.map(board => {
        const lockDays = calculateBoardLockDays(board.lock_status, board.lock_timer_started_at);
        return {
          ...board,
          thumbnail_url: getBoardPreviewUrl(board.id, board.thumbnail_url),
          lock_status: board.lock_status || 'active',
          daysUntilBlock: lockDays.daysUntilBlock,
          daysUntilDelete: lockDays.daysUntilDelete
        };
      });

      return reply.send({ boards });
    } catch (err) {
      console.error('❌ Ошибка получения досок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПОЛУЧИТЬ ОДНУ ДОСКУ ===
  app.get('/api/boards/:id', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Boards'],
      summary: 'Получить одну доску',
      description: 'Возвращает данные конкретной доски по её ID, включая содержимое и информацию о блокировке',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            board: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                owner_id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                content: { type: 'object', nullable: true, additionalProperties: true },
                thumbnail_url: { type: 'string', nullable: true },
                is_public: { type: 'boolean' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                object_count: { type: 'integer' },
                is_locked: { type: 'boolean' },
                archived: { type: 'boolean' },
                lock_status: { type: 'string' },
                lock_timer_started_at: { type: 'string', format: 'date-time', nullable: true },
                daysUntilBlock: { type: 'integer', nullable: true },
                daysUntilDelete: { type: 'integer', nullable: true },
                readOnly: { type: 'boolean' }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            daysUntilDelete: { type: 'integer', nullable: true },
            lockStatus: { type: 'string' },
            locked: { type: 'boolean' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      const boardFields = `id, owner_id, name, description, content, thumbnail_url, is_public,
             created_at, updated_at, object_count, is_locked, archived,
             lock_status, lock_timer_started_at`;
      const query = isAdmin
        ? `SELECT ${boardFields} FROM boards WHERE id = $1`
        : `SELECT ${boardFields} FROM boards WHERE id = $1 AND owner_id = $2`;
      const params = isAdmin ? [id] : [id, req.user.id];

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const board = result.rows[0];
      const lockStatus = board.lock_status || 'active';
      const lockDays = calculateBoardLockDays(lockStatus, board.lock_timer_started_at);

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin) {
        // Hard Lock - доска полностью недоступна
        if (lockStatus === 'hard_lock') {
          return reply.code(403).send({
            error: 'Доска заблокирована',
            message: `Эта доска заблокирована. Если в течение ${lockDays.daysUntilDelete || 0} дней не произойдёт продление тарифа, доска будет автоматически удалена.`,
            daysUntilDelete: lockDays.daysUntilDelete,
            lockStatus: 'hard_lock',
            locked: true
          });
        }
      }

      // Преобразовать thumbnail_url в proxy URL
      board.thumbnail_url = getBoardPreviewUrl(board.id, board.thumbnail_url);

      // Добавляем информацию о блокировке и readOnly флаг
      board.lock_status = lockStatus;
      board.daysUntilBlock = lockDays.daysUntilBlock;
      board.daysUntilDelete = lockDays.daysUntilDelete;
      board.readOnly = !isAdmin && lockStatus === 'soft_lock';

      return reply.send({ board });
    } catch (err) {
      console.error('❌ Ошибка получения доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === СОЗДАТЬ НОВУЮ ДОСКУ ===
  app.post('/api/boards', {
    preHandler: [authenticateToken, checkUsageLimit('boards', 'max_boards')],
    schema: {
      tags: ['Boards'],
      summary: 'Создать новую доску',
      description: 'Создаёт новую доску для текущего пользователя. Проверяет лимит по тарифу',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            board: { type: 'object', additionalProperties: true }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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

      // Пересчитываем блокировки после создания (новая доска может быть "тяжелой" или сместить другие)
      try {
        await boardLockService.recalcUserBoardLocks(req.user.id);
      } catch (calcError) {
        console.error('⚠️ Ошибка пересчета блокировок при создании доски:', calcError);
        // Не блокируем ответ
      }

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка создания доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ОБНОВИТЬ ДОСКУ (АВТОСОХРАНЕНИЕ) ===
  app.put('/api/boards/:id', {
    preHandler: [authenticateToken, checkUsageLimit('cards', 'max_licenses')],
    schema: {
      tags: ['Boards'],
      summary: 'Обновить доску (автосохранение)',
      description: 'Обновляет данные доски. Проверяет блокировку — для soft_lock и hard_lock редактирование запрещено',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            board: { type: 'object', additionalProperties: true }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            lockStatus: { type: 'string' },
            daysUntilBlock: { type: 'integer', nullable: true },
            daysUntilDelete: { type: 'integer', nullable: true },
            locked: { type: 'boolean' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description, content } = req.body;
      const isAdmin = req.user.role === 'admin';

      // Проверяем блокировку (только для не-администраторов)
      if (!isAdmin) {
        const boardCheck = await pool.query(
          'SELECT lock_status, lock_timer_started_at FROM boards WHERE id = $1 AND owner_id = $2',
          [id, userId]
        );

        if (boardCheck.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        const lockStatus = boardCheck.rows[0].lock_status || 'active';

        // Soft Lock или Hard Lock - редактирование запрещено
        if (lockStatus === 'soft_lock' || lockStatus === 'hard_lock') {
          const lockDays = calculateBoardLockDays(lockStatus, boardCheck.rows[0].lock_timer_started_at);
          const daysInfo = lockStatus === 'soft_lock' ? lockDays.daysUntilBlock : lockDays.daysUntilDelete;

          return reply.code(403).send({
            error: 'Редактирование запрещено',
            message: lockStatus === 'soft_lock'
              ? `Эта доска в режиме только для чтения. До полной блокировки осталось ${daysInfo || 0} дней. Продлите подписку для сохранения доступа.`
              : `Эта доска заблокирована. До удаления осталось ${daysInfo || 0} дней. Продлите подписку для сохранения.`,
            lockStatus,
            daysUntilBlock: lockDays.daysUntilBlock,
            daysUntilDelete: lockDays.daysUntilDelete,
            locked: true
          });
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

      // Пересчет блокировок (если изменилось кол-во объектов, доска может стать "тяжелой")
      if (!isAdmin) {
          try {
            await boardLockService.recalcUserBoardLocks(userId);
          } catch (calcError) {
            console.error('⚠️ Ошибка пересчета блокировок при обновлении доски:', calcError);
          }
      }

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка обновления доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === УДАЛИТЬ ДОСКУ ===
  // ВАЖНО: Удаление разрешено даже для заблокированных досок,
  // чтобы пользователь мог освободить место и разблокировать другие доски
  app.delete('/api/boards/:id', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Boards'],
      summary: 'Удалить доску',
      description: 'Удаляет доску по ID. Удаление разрешено даже для заблокированных досок, чтобы пользователь мог освободить место',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      // Проверяем, что доска существует и принадлежит пользователю
      if (!isAdmin) {
        const boardCheck = await pool.query(
          'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
          [id, req.user.id]
        );

        if (boardCheck.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }
        // Удаление разрешено для всех статусов блокировки
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

      // Пересчет блокировок (освободилось место или объектный лимит)
      if (!isAdmin) {
        try {
            await boardLockService.recalcUserBoardLocks(req.user.id);
        } catch (calcError) {
            console.error('⚠️ Ошибка пересчета блокировок при удалении доски:', calcError);
        }
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Ошибка удаления доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ДУБЛИРОВАТЬ ДОСКУ ===
  app.post('/api/boards/:id/duplicate', {
    preHandler: [authenticateToken, checkFeature('can_duplicate_boards', true)],
    schema: {
      tags: ['Boards'],
      summary: 'Дублировать доску',
      description: 'Создаёт копию доски. Требуется фича can_duplicate_boards. Запрещено для заблокированных досок',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            board: { type: 'object', additionalProperties: true }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            lockStatus: { type: 'string' },
            daysUntilBlock: { type: 'integer', nullable: true },
            daysUntilDelete: { type: 'integer', nullable: true },
            locked: { type: 'boolean' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';

      const boardFields = `id, owner_id, name, description, content, thumbnail_url, is_public,
             created_at, updated_at, object_count, is_locked, archived,
             lock_status, lock_timer_started_at`;
      const query = isAdmin
        ? `SELECT ${boardFields} FROM boards WHERE id = $1`
        : `SELECT ${boardFields} FROM boards WHERE id = $1 AND owner_id = $2`;
      const params = isAdmin ? [id] : [id, req.user.id];

      const original = await pool.query(query, params);

      if (original.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const board = original.rows[0];
      const lockStatus = board.lock_status || 'active';

      // Проверяем блокировку (только для не-администраторов)
      // Дублирование запрещено для soft_lock и hard_lock
      if (!isAdmin && (lockStatus === 'soft_lock' || lockStatus === 'hard_lock')) {
        const lockDays = calculateBoardLockDays(lockStatus, board.lock_timer_started_at);
        return reply.code(403).send({
          error: 'Дублирование запрещено',
          message: 'Эта доска заблокирована. Дублирование недоступно. Продлите подписку для полного доступа.',
          lockStatus,
          daysUntilBlock: lockDays.daysUntilBlock,
          daysUntilDelete: lockDays.daysUntilDelete,
          locked: true
        });
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

      // Пересчет блокировок (новая доска может превысить лимит)
      try {
        await boardLockService.recalcUserBoardLocks(req.user.id);
      } catch (calcError) {
        console.error('⚠️ Ошибка пересчета блокировок при дублировании доски:', calcError);
      }

      return reply.send({ board: result.rows[0] });
    } catch (err) {
      console.error('❌ Ошибка дублирования доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ЗАГРУЗИТЬ МИНИАТЮРУ ДОСКИ ===
  app.post('/api/boards/:id/thumbnail', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Boards'],
      summary: 'Загрузить миниатюру доски',
      description: 'Загружает изображение превью доски в формате base64 на Яндекс.Диск',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      body: {
        type: 'object',
        properties: {
          image: { type: 'string', description: 'Изображение в формате base64' }
        },
        required: ['image']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            thumbnail_url: { type: 'string' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            lockStatus: { type: 'string' },
            locked: { type: 'boolean' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
        'SELECT owner_id, lock_status FROM boards WHERE id = $1',
        [boardId]
      );

      if (boardResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && boardResult.rows[0].owner_id !== req.user.id) {
        return reply.code(403).send({ error: 'Нет доступа' });
      }

      // Проверяем блокировку - загрузка превью запрещена для заблокированных досок
      const lockStatus = boardResult.rows[0].lock_status || 'active';
      if (!isAdmin && (lockStatus === 'soft_lock' || lockStatus === 'hard_lock')) {
        return reply.code(403).send({
          error: 'Загрузка превью запрещена',
          message: 'Эта доска заблокирована. Редактирование недоступно.',
          lockStatus,
          locked: true
        });
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

  // === ПОЛУЧИТЬ ПРЕВЬЮ ДОСКИ (PROXY) ===
  app.get('/api/boards/:boardId/preview', {
    schema: {
      tags: ['Boards'],
      summary: 'Получить превью доски',
      description: 'Возвращает изображение превью доски. Публичный эндпоинт, авторизация не требуется',
      params: {
        type: 'object',
        properties: {
          boardId: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'Изображение превью доски'
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { boardId } = req.params;
      // Параметр ?v=timestamp игнорируется - он используется только для cache busting на клиенте

      // Получить thumbnail_url из БД
      const result = await pool.query(
        'SELECT thumbnail_url FROM boards WHERE id = $1',
        [boardId]
      );

      if (!result.rows[0]?.thumbnail_url) {
        return reply.code(404).send({ error: 'Превью не найдено' });
      }

      const thumbnailUrl = result.rows[0].thumbnail_url;

      // Если это локальный placeholder, вернуть ошибку (файлы должны обслуживаться статически)
      if (thumbnailUrl.startsWith('/uploads/')) {
        return reply.code(404).send({ error: 'Превью не найдено' });
      }

      // Извлечь yandexPath из формата: preview_url|yandexPath|timestamp
      const parts = thumbnailUrl.split('|');
      const yandexPath = parts[1];

      if (!yandexPath) {
        return reply.code(404).send({ error: 'Путь к превью не найден' });
      }

      // Получить ссылку для скачивания с Яндекс.Диска
      const response = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(yandexPath)}`,
        {
          headers: {
            'Authorization': `OAuth ${process.env.YANDEX_DISK_TOKEN}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.href) {
        console.error('Ошибка получения ссылки на превью доски:', data);
        return reply.code(404).send({ error: 'Не удалось получить превью' });
      }

      // Скачать файл по прямой ссылке
      const imageResponse = await fetch(data.href);
      const imageBuffer = await imageResponse.arrayBuffer();

      // Определить MIME-type из расширения файла
      const ext = yandexPath.split('.').pop().toLowerCase();
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const contentType = mimeTypes[ext] || 'image/png';

      // Вернуть изображение с кэшированием
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400') // 24 часа
        .send(Buffer.from(imageBuffer));

    } catch (err) {
      console.error('❌ Ошибка получения превью доски:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

}
