import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация маршрутов для работы с папками досок
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerBoardFolderRoutes(app) {
  // 1.1 GET /api/board-folders - Получить все папки текущего пользователя
  app.get(
    '/api/board-folders',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Получить все папки пользователя',
        description: 'Возвращает список всех папок досок текущего авторизованного пользователя с количеством досок в каждой',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                board_count: { type: 'integer' }
              }
            }
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;

        const result = await pool.query(
          `SELECT
            bf.id,
            bf.name,
            bf.created_at,
            bf.updated_at,
            COUNT(bfi.board_id) as board_count
          FROM board_folders bf
          LEFT JOIN board_folder_items bfi ON bf.id = bfi.folder_id
          WHERE bf.owner_id = $1
          GROUP BY bf.id
          ORDER BY bf.created_at DESC`,
          [userId]
        );

        return reply.send(result.rows);
      } catch (err) {
        console.error('❌ Ошибка получения папок:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.2 POST /api/board-folders - Создать новую папку
  app.post(
    '/api/board-folders',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Создать новую папку',
        description: 'Создаёт новую папку для досок. Проверяет лимит папок по тарифу пользователя',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const { name } = req.body || {};

        // Валидация name
        if (!name || typeof name !== 'string') {
          return reply.code(400).send({ error: 'Поле name обязательно' });
        }

        const trimmedName = name.trim();
        if (trimmedName.length === 0 || trimmedName.length > 255) {
          return reply.code(400).send({ error: 'Название папки должно быть от 1 до 255 символов' });
        }

        // Проверяем лимит папок
        const userResult = await pool.query(
          `SELECT u.plan_id, sp.features->>'max_folders' as max_folders
           FROM users u
           JOIN subscription_plans sp ON u.plan_id = sp.id
           WHERE u.id = $1`,
          [userId]
        );

        if (userResult.rows.length === 0) {
          return reply.code(500).send({ error: 'Не удалось получить информацию о пользователе' });
        }

        const maxFolders = parseInt(userResult.rows[0].max_folders, 10) || 0;

        // Подсчитываем текущее количество папок
        const countResult = await pool.query(
          'SELECT COUNT(*) as count FROM board_folders WHERE owner_id = $1',
          [userId]
        );

        const currentCount = parseInt(countResult.rows[0].count, 10);

        if (currentCount >= maxFolders) {
          return reply.code(403).send({ error: 'Достигнут лимит папок для вашего тарифа' });
        }

        // Вставляем новую папку
        const insertResult = await pool.query(
          `INSERT INTO board_folders (owner_id, name, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING id, name, created_at, updated_at`,
          [userId, trimmedName]
        );

        return reply.code(201).send(insertResult.rows[0]);
      } catch (err) {
        // Проверка на уникальность (duplicate key)
        if (err.code === '23505') {
          return reply.code(409).send({ error: 'Папка с таким именем уже существует' });
        }
        console.error('❌ Ошибка создания папки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.3 PUT /api/board-folders/:folderId - Переименовать папку
  app.put(
    '/api/board-folders/:folderId',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Переименовать папку',
        description: 'Переименовывает папку досок. Проверяет владельца и уникальность имени',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            folderId: { type: 'integer' }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const { folderId } = req.params;
        const { name } = req.body || {};

        // Валидация folderId
        const folderIdInt = parseInt(folderId, 10);
        if (isNaN(folderIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID папки' });
        }

        // Валидация name
        if (!name || typeof name !== 'string') {
          return reply.code(400).send({ error: 'Поле name обязательно' });
        }

        const trimmedName = name.trim();
        if (trimmedName.length === 0 || trimmedName.length > 255) {
          return reply.code(400).send({ error: 'Название папки должно быть от 1 до 255 символов' });
        }

        // Проверяем владельца папки
        const folderResult = await pool.query(
          'SELECT owner_id FROM board_folders WHERE id = $1',
          [folderIdInt]
        );

        if (folderResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Папка не найдена' });
        }

        if (folderResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Папка не принадлежит пользователю' });
        }

        // Обновляем папку
        const updateResult = await pool.query(
          `UPDATE board_folders
           SET name = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, created_at, updated_at`,
          [trimmedName, folderIdInt]
        );

        return reply.send(updateResult.rows[0]);
      } catch (err) {
        // Проверка на уникальность (duplicate key)
        if (err.code === '23505') {
          return reply.code(409).send({ error: 'Папка с таким именем уже существует' });
        }
        console.error('❌ Ошибка переименования папки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.4 DELETE /api/board-folders/:folderId - Удалить папку со всеми досками
  app.delete(
    '/api/board-folders/:folderId',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Удалить папку со всеми досками',
        description: 'Удаляет папку и все доски внутри неё. Требуется параметр confirm=true для подтверждения',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            folderId: { type: 'integer' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            confirm: { type: 'string', description: 'Подтверждение удаления: "true" или "1"' }
          },
          required: ['confirm']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              deleted_boards_count: { type: 'integer' }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      let client;
      
      try {
        const userId = req.user.id;
        const { folderId } = req.params;
        const { confirm } = req.query;

        // Проверяем параметр подтверждения (принимаем true/"true"/"1")
        const confirmFlag = String(confirm ?? '').toLowerCase();
        if (!['true', '1'].includes(confirmFlag)) {
          return reply.code(400).send({ error: 'Требуется подтверждение удаления' });
        }

        // Валидация folderId
        const folderIdInt = parseInt(folderId, 10);
        if (isNaN(folderIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID папки' });
        }
        client = await pool.connect();
        await client.query('BEGIN');

        // Проверяем владельца папки
        const folderResult = await client.query(
          'SELECT owner_id FROM board_folders WHERE id = $1 FOR UPDATE',
          [folderIdInt]
        );

        if (folderResult.rows.length === 0) {
          await client.query('ROLLBACK');          
          return reply.code(404).send({ error: 'Папка не найдена' });
        }

        if (folderResult.rows[0].owner_id !== userId) {
          await client.query('ROLLBACK');          
          return reply.code(403).send({ error: 'Папка не принадлежит пользователю' });
        }

        // Получаем все board_id в папке
        const boardsResult = await client.query(
          'SELECT board_id FROM board_folder_items WHERE folder_id = $1',
          [folderIdInt]
        );

        const boardIds = boardsResult.rows.map(row => row.board_id);

        // Удаляем связи
        await client.query(
          'DELETE FROM board_folder_items WHERE folder_id = $1',
          [folderIdInt]
        );

        // Удаляем доски (только если есть что удалять)
        let deletedBoardsCount = 0;
        if (boardIds.length > 0) {
          const deleteResult = await client.query(
            'DELETE FROM boards WHERE id = ANY($1::int[]) AND owner_id = $2',
            [boardIds, userId]
          );
          deletedBoardsCount = deleteResult.rowCount;
        }

        // Удаляем папку
        await client.query(
          'DELETE FROM board_folders WHERE id = $1',
          [folderIdInt]
        );
        await client.query('COMMIT');

        return reply.send({ deleted_boards_count: deletedBoardsCount });
      } catch (err) {
        console.error('❌ Ошибка удаления папки:', err);
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            console.error('❌ Ошибка отката транзакции при удалении папки:', rollbackErr);
          }
        }        
        return reply.code(500).send({ error: 'Ошибка сервера' });
      } finally {
        if (client) {
          client.release();
        }        
      }
    }
  );

  // 1.5 GET /api/board-folders/:folderId/boards - Получить все доски в папке
  app.get(
    '/api/board-folders/:folderId/boards',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Получить доски в папке',
        description: 'Возвращает список всех досок, находящихся в указанной папке',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            folderId: { type: 'integer' }
          }
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                thumbnail_url: { type: 'string', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                object_count: { type: 'integer' },
                is_locked: { type: 'boolean' },
                is_public: { type: 'boolean' }
              }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const { folderId } = req.params;

        // Валидация folderId
        const folderIdInt = parseInt(folderId, 10);
        if (isNaN(folderIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID папки' });
        }

        // Проверяем владельца папки
        const folderResult = await pool.query(
          'SELECT owner_id FROM board_folders WHERE id = $1',
          [folderIdInt]
        );

        if (folderResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Папка не найдена' });
        }

        if (folderResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Папка не принадлежит пользователю' });
        }

        // Получаем доски в папке
        const result = await pool.query(
          `SELECT
            b.id,
            b.name,
            b.description,
            b.thumbnail_url,
            b.created_at,
            b.updated_at,
            b.object_count,
            b.is_locked,
            b.is_public
          FROM boards b
          INNER JOIN board_folder_items bfi ON b.id = bfi.board_id
          WHERE bfi.folder_id = $1 AND b.owner_id = $2
          ORDER BY bfi.added_at DESC`,
          [folderIdInt, userId]
        );

        return reply.send(result.rows);
      } catch (err) {
        console.error('❌ Ошибка получения досок в папке:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.6 POST /api/board-folders/:folderId/boards - Добавить доску в папку
  app.post(
    '/api/board-folders/:folderId/boards',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Добавить доску в папку',
        description: 'Добавляет существующую доску в указанную папку. Проверяет владельца папки и доски',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            folderId: { type: 'integer' }
          }
        },
        body: {
          type: 'object',
          properties: {
            boardId: { type: 'integer' }
          },
          required: ['boardId']
        },
        response: {
          201: {
            type: 'object',
            properties: {
              folderId: { type: 'integer' },
              boardId: { type: 'integer' }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const { folderId } = req.params;
        const { boardId } = req.body || {};

        // Валидация folderId
        const folderIdInt = parseInt(folderId, 10);
        if (isNaN(folderIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID папки' });
        }

        // Валидация boardId
        if (!boardId || typeof boardId !== 'number') {
          return reply.code(400).send({ error: 'Поле boardId обязательно и должно быть числом' });
        }

        const boardIdInt = parseInt(boardId, 10);
        if (isNaN(boardIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID доски' });
        }

        // Проверяем владельца папки
        const folderResult = await pool.query(
          'SELECT owner_id FROM board_folders WHERE id = $1',
          [folderIdInt]
        );

        if (folderResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Папка не найдена' });
        }

        if (folderResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Папка не принадлежит пользователю' });
        }

        // Проверяем владельца доски
        const boardResult = await pool.query(
          'SELECT owner_id FROM boards WHERE id = $1',
          [boardIdInt]
        );

        if (boardResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        if (boardResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Доска не принадлежит пользователю' });
        }

        // Вставляем связь
        await pool.query(
          `INSERT INTO board_folder_items (folder_id, board_id, added_at)
           VALUES ($1, $2, NOW())`,
          [folderIdInt, boardIdInt]
        );

        return reply.code(201).send({ folderId: folderIdInt, boardId: boardIdInt });
      } catch (err) {
        // Проверка на уникальность (duplicate key)
        if (err.code === '23505') {
          return reply.code(409).send({ error: 'Доска уже в этой папке' });
        }
        console.error('❌ Ошибка добавления доски в папку:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.7 DELETE /api/board-folders/:folderId/boards/:boardId - Убрать доску из папки
  app.delete(
    '/api/board-folders/:folderId/boards/:boardId',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Убрать доску из папки',
        description: 'Удаляет связь между доской и папкой. Сама доска не удаляется',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            folderId: { type: 'integer' },
            boardId: { type: 'integer' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              removed: { type: 'boolean' }
            }
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const { folderId, boardId } = req.params;

        // Валидация folderId
        const folderIdInt = parseInt(folderId, 10);
        if (isNaN(folderIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID папки' });
        }

        // Валидация boardId
        const boardIdInt = parseInt(boardId, 10);
        if (isNaN(boardIdInt)) {
          return reply.code(400).send({ error: 'Некорректный ID доски' });
        }

        // Проверяем владельца папки
        const folderResult = await pool.query(
          'SELECT owner_id FROM board_folders WHERE id = $1',
          [folderIdInt]
        );

        if (folderResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Папка не найдена' });
        }

        if (folderResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Папка не принадлежит пользователю' });
        }

        // Проверяем владельца доски
        const boardResult = await pool.query(
          'SELECT owner_id FROM boards WHERE id = $1',
          [boardIdInt]
        );

        if (boardResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        if (boardResult.rows[0].owner_id !== userId) {
          return reply.code(403).send({ error: 'Доска не принадлежит пользователю' });
        }

        // Удаляем связь
        const deleteResult = await pool.query(
          'DELETE FROM board_folder_items WHERE folder_id = $1 AND board_id = $2',
          [folderIdInt, boardIdInt]
        );

        if (deleteResult.rowCount === 0) {
          return reply.code(404).send({ error: 'Связь не найдена' });
        }

        return reply.send({ removed: true });
      } catch (err) {
        console.error('❌ Ошибка удаления доски из папки:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );

  // 1.8 GET /api/boards/uncategorized - Получить доски вне папок
  app.get(
    '/api/boards/uncategorized',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Board Folders'],
        summary: 'Получить доски вне папок',
        description: 'Возвращает список досок пользователя, которые не добавлены ни в одну папку',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                thumbnail_url: { type: 'string', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                object_count: { type: 'integer' },
                is_locked: { type: 'boolean' },
                is_public: { type: 'boolean' }
              }
            }
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;

        const result = await pool.query(
          `SELECT
            b.id,
            b.name,
            b.description,
            b.thumbnail_url,
            b.created_at,
            b.updated_at,
            b.object_count,
            b.is_locked,
            b.is_public
          FROM boards b
          WHERE b.owner_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM board_folder_items bfi WHERE bfi.board_id = b.id
            )
          ORDER BY b.created_at DESC`,
          [userId]
        );

        return reply.send(result.rows);
      } catch (err) {
        console.error('❌ Ошибка получения некатегоризированных досок:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    }
  );
}
