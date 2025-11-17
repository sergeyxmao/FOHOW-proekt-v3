import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { randomBytes } from 'crypto';
import {
  getSharedFolderPath,
  ensureFolderExists,
  moveFile,
  publishFile,
  deleteFile,
  uploadFile
} from '../services/yandexDiskService.js';

/**
 * Регистрация маршрутов для админ-панели
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminRoutes(app) {
  // ============================================
  // УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
  // ============================================

  /**
   * Получить список всех пользователей с пагинацией
   * GET /api/admin/users?page=1&limit=50&search=email
   */
  app.get('/api/admin/users', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { page = 1, limit = 50, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
      const offset = (page - 1) * limit;

      // Базовый запрос
      let whereClause = '';
      const queryParams = [];

      // Поиск по email, username или id
      if (search) {
        whereClause = `WHERE (u.email ILIKE $1 OR u.username ILIKE $1 OR CAST(u.id AS TEXT) LIKE $1)`;
        queryParams.push(`%${search}%`);
      }

      // Подсчет общего количества пользователей
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Получение списка пользователей
      const allowedSortFields = ['id', 'email', 'username', 'created_at', 'role', 'plan_name'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      queryParams.push(limit, offset);
      const usersResult = await pool.query(
        `SELECT
          u.id, u.email, u.username, u.avatar_url, u.role,
          u.created_at, u.updated_at, u.subscription_expires_at,
          u.country, u.city, u.full_name, u.phone,
          sp.id as plan_id, sp.name as plan_name, sp.code_name as plan_code,
          (SELECT COUNT(*) FROM boards WHERE owner_id = u.id) as boards_count,
          (SELECT COUNT(*) FROM active_sessions WHERE user_id = u.id) as active_sessions
         FROM users u
         LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
         ${whereClause}
         ORDER BY ${sortField === 'plan_name' ? 'sp.name' : 'u.' + sortField} ${sortDirection}
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      return reply.send({
        success: true,
        data: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка пользователей:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Получить информацию о конкретном пользователе
   * GET /api/admin/users/:userId
   */
  app.get('/api/admin/users/:userId', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT
          u.id, u.email, u.username, u.avatar_url, u.role, u.created_at, u.updated_at,
          u.subscription_expires_at, u.subscription_started_at,
          u.country, u.city, u.office, u.personal_id, u.phone, u.full_name,
          u.telegram_user, u.telegram_channel, u.telegram_chat_id,
          u.vk_profile, u.ok_profile, u.instagram_profile, u.whatsapp_contact,
          u.visibility_settings, u.search_settings,
          sp.id as plan_id, sp.name as plan_name, sp.code_name as plan_code, sp.features,
          (SELECT COUNT(*) FROM boards WHERE owner_id = u.id) as boards_count,
          (SELECT COUNT(*) FROM notes n JOIN boards b ON n.board_id = b.id WHERE b.owner_id = u.id) as notes_count,
          (SELECT COUNT(*) FROM stickers s JOIN boards b ON s.board_id = b.id WHERE b.owner_id = u.id) as stickers_count,
          (SELECT COUNT(*) FROM user_comments WHERE user_id = u.id) as comments_count,
          (SELECT COUNT(*) FROM active_sessions WHERE user_id = u.id) as active_sessions_count
         FROM users u
         LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      // Получаем историю подписок
      const subscriptionHistory = await pool.query(
        `SELECT sh.*, sp.name as plan_name
         FROM subscription_history sh
         LEFT JOIN subscription_plans sp ON sh.plan_id = sp.id
         WHERE sh.user_id = $1
         ORDER BY sh.start_date DESC
         LIMIT 10`,
        [userId]
      );

      // Получаем активные сессии
      const activeSessions = await pool.query(
        `SELECT id, ip_address, user_agent, created_at, last_seen, expires_at
         FROM active_sessions
         WHERE user_id = $1
         ORDER BY last_seen DESC`,
        [userId]
      );

      return reply.send({
        success: true,
        user: result.rows[0],
        subscriptionHistory: subscriptionHistory.rows,
        activeSessions: activeSessions.rows
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения информации о пользователе:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Изменить роль пользователя
   * PATCH /api/admin/users/:userId/role
   */
  app.patch('/api/admin/users/:userId/role', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Валидация роли
      const allowedRoles = ['user', 'admin'];
      if (!role || !allowedRoles.includes(role)) {
        return reply.code(400).send({
          error: `Недопустимая роль. Разрешены: ${allowedRoles.join(', ')}`
        });
      }

      // Проверяем, что пользователь не меняет свою собственную роль
      if (parseInt(userId) === req.user.id) {
        return reply.code(403).send({
          error: 'Нельзя изменить собственную роль'
        });
      }

      const result = await pool.query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, username, role`,
        [role, userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`[ADMIN] Роль пользователя изменена: user_id=${userId}, new_role=${role}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        message: `Роль пользователя изменена на "${role}"`,
        user: result.rows[0]
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка изменения роли пользователя:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Изменить тарифный план пользователя
   * PATCH /api/admin/users/:userId/plan
   */
  app.patch('/api/admin/users/:userId/plan', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { userId } = req.params;
      const { planId, duration = 30, source = 'admin_manual' } = req.body;

      if (!planId) {
        return reply.code(400).send({ error: 'Не указан ID тарифного плана' });
      }

      // Проверяем существование плана
      const planCheck = await pool.query(
        'SELECT id, name, code_name FROM subscription_plans WHERE id = $1',
        [planId]
      );

      if (planCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Тарифный план не найден' });
      }

      const plan = planCheck.rows[0];

      // Получаем клиент для транзакции
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Обновляем план пользователя
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(duration));

        const updateResult = await client.query(
          `UPDATE users
           SET plan_id = $1,
               subscription_expires_at = $2,
               subscription_started_at = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING id, email, username`,
          [planId, endDate, startDate, userId]
        );

        if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Пользователь не найден' });
        }

        // ============================================
        // РАЗБЛОКИРОВКА ДОСОК ПРИ ПРОДЛЕНИИ ТАРИФА
        // ============================================
        // Проверяем, были ли доски заблокированы, и разблокируем их
        const userCheck = await client.query(
          'SELECT boards_locked FROM users WHERE id = $1',
          [userId]
        );

        let unlockedBoardsCount = 0;

        if (userCheck.rows.length > 0 && userCheck.rows[0].boards_locked) {
          console.log(`[ADMIN] Обнаружены заблокированные доски для пользователя ID=${userId}, разблокировка...`);

          // Разблокируем доски на уровне пользователя
          await client.query(
            `UPDATE users
             SET boards_locked = FALSE,
                 boards_locked_at = NULL
             WHERE id = $1`,
            [userId]
          );

          // Разблокируем все доски пользователя
          const unlockedBoardsResult = await client.query(
            `UPDATE boards
             SET is_locked = FALSE
             WHERE owner_id = $1`,
            [userId]
          );

          unlockedBoardsCount = unlockedBoardsResult.rowCount;

          console.log(`[ADMIN] ✅ Разблокировано досок для пользователя ID=${userId}: ${unlockedBoardsCount}`);
        }

        // Создаем запись в истории подписок
        await client.query(
          `INSERT INTO subscription_history
           (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
           VALUES ($1, $2, $3, $4, $5, 0.00, 'RUB')`,
          [userId, planId, startDate, endDate, source]
        );

        await client.query('COMMIT');

        console.log(`[ADMIN] Тарифный план изменен: user_id=${userId}, plan=${plan.name}, duration=${duration} дней, admin_id=${req.user.id}`);

        // Формируем ответ с информацией о разблокировке
        const response = {
          success: true,
          message: `Тарифный план изменен на "${plan.name}"`,
          user: updateResult.rows[0],
          plan: {
            id: plan.id,
            name: plan.name,
            code_name: plan.code_name
          },
          subscription: {
            startDate,
            endDate,
            duration
          }
        };

        // Добавляем информацию о разблокировке досок, если они были разблокированы
        if (unlockedBoardsCount > 0) {
          response.boardsUnlocked = {
            count: unlockedBoardsCount,
            message: `Разблокировано досок: ${unlockedBoardsCount}`
          };
        }

        return reply.send(response);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[ADMIN] Ошибка изменения тарифного плана:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Удалить пользователя (с подтверждением)
   * DELETE /api/admin/users/:userId
   */
  app.delete('/api/admin/users/:userId', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { userId } = req.params;
      const { confirm } = req.body;

      // Проверяем, что администратор не удаляет сам себя
      if (parseInt(userId) === req.user.id) {
        return reply.code(403).send({
          error: 'Нельзя удалить собственный аккаунт'
        });
      }

      // Требуем подтверждения
      if (confirm !== true) {
        return reply.code(400).send({
          error: 'Требуется подтверждение удаления (confirm: true)'
        });
      }

      // Получаем информацию о пользователе перед удалением
      const userInfo = await pool.query(
        'SELECT id, email, username FROM users WHERE id = $1',
        [userId]
      );

      if (userInfo.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const deletedUser = userInfo.rows[0];

      // Удаляем пользователя (каскадное удаление настроено в БД)
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      console.log(`[ADMIN] Пользователь удален: user_id=${userId}, email=${deletedUser.email}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        message: 'Пользователь успешно удален',
        deletedUser
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка удаления пользователя:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // ============================================
  // СТАТИСТИКА И МОНИТОРИНГ
  // ============================================

  /**
   * Получить общую статистику системы
   * GET /api/admin/stats
   */
  app.get('/api/admin/stats', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      // Общая статистика
      const stats = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_users,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_week,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_month,
          (SELECT COUNT(*) FROM boards) as total_boards,
          (SELECT COUNT(*) FROM notes) as total_notes,
          (SELECT COUNT(*) FROM stickers) as total_stickers,
          (SELECT COUNT(*) FROM user_comments) as total_comments,
          (SELECT COUNT(*) FROM active_sessions) as active_sessions_count,
          (SELECT COUNT(DISTINCT user_id) FROM active_sessions WHERE last_seen >= NOW() - INTERVAL '1 hour') as active_users_hour,
          (SELECT COUNT(DISTINCT user_id) FROM active_sessions WHERE last_seen >= NOW() - INTERVAL '24 hours') as active_users_day
      `);

      // Статистика по тарифным планам
      const planStats = await pool.query(`
        SELECT
          sp.id, sp.name, sp.code_name,
          COUNT(u.id) as users_count
        FROM subscription_plans sp
        LEFT JOIN users u ON sp.id = u.plan_id
        GROUP BY sp.id, sp.name, sp.code_name
        ORDER BY users_count DESC
      `);

      // Статистика регистраций по дням (последние 30 дней)
      const registrationStats = await pool.query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      return reply.send({
        success: true,
        stats: stats.rows[0],
        planStats: planStats.rows,
        registrationStats: registrationStats.rows
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения статистики:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Получить системные логи
   * GET /api/admin/logs?page=1&limit=100&level=error
   */
  app.get('/api/admin/logs', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { page = 1, limit = 100, level = null } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '';
      const queryParams = [];

      if (level) {
        whereClause = 'WHERE level = $1';
        queryParams.push(level);
      }

      // Подсчет логов
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM system_logs ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Получение логов
      queryParams.push(limit, offset);
      const logsResult = await pool.query(
        `SELECT id, level, message, context, created_at
         FROM system_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      return reply.send({
        success: true,
        logs: logsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения логов:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Завершить сессию пользователя
   * DELETE /api/admin/sessions/:sessionId
   */
  app.delete('/api/admin/sessions/:sessionId', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { sessionId } = req.params;

      const result = await pool.query(
        'DELETE FROM active_sessions WHERE id = $1 RETURNING id, user_id',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Сессия не найдена' });
      }

      console.log(`[ADMIN] Сессия завершена: session_id=${sessionId}, user_id=${result.rows[0].user_id}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        message: 'Сессия успешно завершена'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка завершения сессии:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Завершить все сессии пользователя
   * DELETE /api/admin/users/:userId/sessions
   */
  app.delete('/api/admin/users/:userId/sessions', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        'DELETE FROM active_sessions WHERE user_id = $1 RETURNING id',
        [userId]
      );

      console.log(`[ADMIN] Все сессии пользователя завершены: user_id=${userId}, sessions_count=${result.rowCount}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        message: `Завершено сессий: ${result.rowCount}`
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка завершения сессий пользователя:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // ============================================
  // МОДЕРАЦИЯ ИЗОБРАЖЕНИЙ
  // ============================================

  /**
   * Получить список папок для общей библиотеки
   * GET /api/admin/shared-folders
   */
  app.get('/api/admin/shared-folders', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос списка папок общей библиотеки, admin_id=' + req.user.id);

      const result = await pool.query(
        `SELECT
          sf.id,
          sf.name,
          sf.created_by,
          sf.created_at,
          (
            SELECT COUNT(*)
            FROM image_library il
            WHERE il.is_shared = TRUE
              AND il.shared_folder_id = sf.id
          ) AS images_count
         FROM shared_folders sf
         ORDER BY sf.name ASC`
      );

      console.log(`[ADMIN] Найдено папок: ${result.rows.length}`);

      return reply.send({
        success: true,
        folders: result.rows
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка папок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Создать новую папку в общей библиотеке
   * POST /api/admin/shared-folders
   */
  app.post('/api/admin/shared-folders', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const { name } = req.body;

      console.log(`[ADMIN] Запрос на создание папки: name="${name}", admin_id=${adminId}`);

      // Валидация: обрезаем пробелы
      const folderName = name ? name.trim() : '';

      // Проверка на пустое имя
      if (!folderName) {
        return reply.code(400).send({
          error: 'Название папки не может быть пустым'
        });
      }

      // Проверка на существование папки с таким именем
      const existingFolder = await pool.query(
        'SELECT id FROM shared_folders WHERE name = $1',
        [folderName]
      );

      if (existingFolder.rows.length > 0) {
        return reply.code(400).send({
          error: 'Папка с таким названием уже существует'
        });
      }

      // Создание папки
      const result = await pool.query(
        `INSERT INTO shared_folders (name, created_by, created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         RETURNING id, name, created_by, created_at`,
        [folderName, adminId]
      );

      const newFolder = result.rows[0];

      console.log(`[ADMIN] ✅ Папка успешно создана: id=${newFolder.id}, name="${newFolder.name}"`);

      // Возвращаем папку с images_count = 0
      return reply.code(201).send({
        id: newFolder.id,
        name: newFolder.name,
        images_count: 0,
        created_at: newFolder.created_at,
        created_by: newFolder.created_by
      });

    } catch (err) {
      console.error('[ADMIN] Ошибка создания папки:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Переименовать папку в общей библиотеке
   * PATCH /api/admin/shared-folders/:id
   */
  app.patch('/api/admin/shared-folders/:id', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    const client = await pool.connect();

    try {
      const adminId = req.user.id;
      const folderId = parseInt(req.params.id, 10);
      const { name } = req.body;

      console.log(`[ADMIN] Запрос на переименование папки: folder_id=${folderId}, new_name="${name}", admin_id=${adminId}`);

      // Валидация ID папки
      if (!Number.isInteger(folderId) || folderId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID папки'
        });
      }

      // Валидация: обрезаем пробелы
      const newFolderName = name ? name.trim() : '';

      // Проверка на пустое имя
      if (!newFolderName) {
        return reply.code(400).send({
          error: 'Название папки не может быть пустым'
        });
      }

      // Начинаем транзакцию
      await client.query('BEGIN');

      // Найти папку по id
      const folderResult = await client.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [folderId]
      );

      // Если папка не найдена
      if (folderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({
          error: 'Папка не найдена'
        });
      }

      const folder = folderResult.rows[0];
      const oldFolderName = folder.name;

      // Если имя не изменилось, просто возвращаем текущие данные
      if (oldFolderName === newFolderName) {
        await client.query('ROLLBACK');

        // Получаем количество картинок
        const countResult = await pool.query(
          `SELECT COUNT(*) as images_count
           FROM image_library
           WHERE is_shared = TRUE AND shared_folder_id = $1`,
          [folderId]
        );

        const imagesCount = parseInt(countResult.rows[0].images_count, 10);

        return reply.send({
          id: folder.id,
          name: folder.name,
          images_count: imagesCount,
          created_at: folder.created_at,
          created_by: folder.created_by
        });
      }

      // Проверка на существование папки с новым именем
      const duplicateFolder = await client.query(
        'SELECT id FROM shared_folders WHERE name = $1 AND id != $2',
        [newFolderName, folderId]
      );

      if (duplicateFolder.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'Папка с таким названием уже существует'
        });
      }

      // Обновить имя папки в БД
      await client.query(
        'UPDATE shared_folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newFolderName, folderId]
      );

      console.log(`[ADMIN] Имя папки обновлено в БД: "${oldFolderName}" -> "${newFolderName}"`);

      // Получить список всех файлов в этой папке
      const filesResult = await client.query(
        `SELECT id, filename, yandex_path
         FROM image_library
         WHERE is_shared = TRUE AND shared_folder_id = $1`,
        [folderId]
      );

      const files = filesResult.rows;
      console.log(`[ADMIN] Найдено файлов для перемещения: ${files.length}`);

      // Переместить каждый файл на Яндекс.Диске
      for (const file of files) {
        const oldPath = file.yandex_path;
        const oldFolderPath = getSharedFolderPath(oldFolderName);
        const newFolderPath = getSharedFolderPath(newFolderName);
        const newPath = `${newFolderPath}/${file.filename}`;

        console.log(`[ADMIN] Перемещение файла: ${oldPath} -> ${newPath}`);

        try {
          // Убедиться, что новая папка существует
          await ensureFolderExists(newFolderPath);

          // Переместить файл
          await moveFile(oldPath, newPath);

          // Опубликовать файл заново и получить новую публичную ссылку
          const { public_url: originalPublicUrl, preview_url } = await publishFile(newPath);
          const newPublicUrl = preview_url || originalPublicUrl;
          
          // Обновить запись в БД
          await client.query(
            `UPDATE image_library
             SET yandex_path = $1, public_url = $2
             WHERE id = $3`,
            [newPath, newPublicUrl, file.id]
          );

          console.log(`[ADMIN] ✅ Файл успешно перемещён: ${file.filename}`);

        } catch (moveError) {
          console.error(`[ADMIN] Ошибка перемещения файла ${file.filename}:`, moveError);
          await client.query('ROLLBACK');

          return reply.code(500).send({
            error: `Ошибка при перемещении файлов на Яндекс.Диске: ${moveError.message}`
          });
        }
      }

      // Коммитим транзакцию
      await client.query('COMMIT');

      console.log(`[ADMIN] ✅ Папка успешно переименована: "${oldFolderName}" -> "${newFolderName}"`);

      // Получаем обновленные данные папки
      const updatedFolderResult = await pool.query(
        `SELECT
          sf.id,
          sf.name,
          sf.created_by,
          sf.created_at,
          (
            SELECT COUNT(*)
            FROM image_library il
            WHERE il.is_shared = TRUE
              AND il.shared_folder_id = sf.id
          ) AS images_count
         FROM shared_folders sf
         WHERE sf.id = $1`,
        [folderId]
      );

      const updatedFolder = updatedFolderResult.rows[0];

      return reply.send({
        id: updatedFolder.id,
        name: updatedFolder.name,
        images_count: parseInt(updatedFolder.images_count, 10),
        created_at: updatedFolder.created_at,
        created_by: updatedFolder.created_by
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ADMIN] Ошибка переименования папки:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });

    } finally {
      client.release();
    }
  });

  /**
   * Получить список изображений на модерацию (pending)
   * GET /api/admin/images/pending
   */
  app.get('/api/admin/images/pending', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос списка изображений на модерацию, admin_id=' + req.user.id);

      // Получаем список изображений, ожидающих модерации
      const result = await pool.query(
        `SELECT
          il.id,
          il.original_name,
          il.public_url,
          il.yandex_path,
          il.user_id,
          u.full_name as user_full_name,
          u.personal_id as user_personal_id,
          il.share_requested_at,
          il.file_size,
          il.width,
          il.height
         FROM image_library il
         JOIN users u ON il.user_id = u.id
         WHERE il.share_requested_at IS NOT NULL
           AND il.is_shared = FALSE
           AND il.share_approved_at IS NULL
         ORDER BY il.share_requested_at DESC`
      );

      const total = result.rows.length;

      console.log(`[ADMIN] Найдено изображений на модерацию: ${total}`);

      return reply.send({
        success: true,
        items: result.rows,
        total
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка изображений на модерацию:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Одобрить изображение и переместить в общую библиотеку
   * POST /api/admin/images/:id/approve
   */
  app.post('/api/admin/images/:id/approve', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);
      const { shared_folder_id } = req.body;

      console.log(`[ADMIN] Запрос на одобрение изображения: image_id=${imageId}, shared_folder_id=${shared_folder_id}, admin_id=${adminId}`);

      // Валидация входных данных
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      if (!shared_folder_id || !Number.isInteger(shared_folder_id) || shared_folder_id <= 0) {
        return reply.code(400).send({
          error: 'Поле shared_folder_id обязательно и должно быть положительным целым числом'
        });
      }

      // Найти запись image_library по id
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.filename,
          il.yandex_path,
          il.share_requested_at,
          il.is_shared
         FROM image_library il
         WHERE il.id = $1
           AND il.share_requested_at IS NOT NULL
           AND il.is_shared = FALSE`,
        [imageId]
      );

      // Если изображение не найдено или не на модерации
      if (imageResult.rows.length === 0) {
        console.log(`[ADMIN] Изображение не найдено или не на модерации: image_id=${imageId}`);
        return reply.code(404).send({
          error: 'Изображение не найдено или не находится на модерации'
        });
      }

      const image = imageResult.rows[0];
      const { filename, yandex_path } = image;

      // Найти запись в shared_folders по shared_folder_id
      const folderResult = await pool.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [shared_folder_id]
      );

      // Если папка не найдена
      if (folderResult.rows.length === 0) {
        console.log(`[ADMIN] Папка общей библиотеки не найдена: folder_id=${shared_folder_id}`);
        return reply.code(400).send({
          error: 'Указанная папка общей библиотеки не найдена'
        });
      }

      const sharedFolder = folderResult.rows[0];
      const sharedFolderName = sharedFolder.name;

      console.log(`[ADMIN] Перемещение изображения в папку: ${sharedFolderName}`);

      // Определить текущий путь файла (должен быть в pending)
      const currentPath = yandex_path;

      if (!currentPath) {
        console.error(`[ADMIN] Отсутствует yandex_path для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить текущий путь файла'
        });
      }

      // Построить новый путь файла в общей библиотеке
      const sharedFolderPath = getSharedFolderPath(sharedFolderName);
      const newFilePath = `${sharedFolderPath}/${filename}`;

      console.log(`[ADMIN] Перемещение файла: ${currentPath} -> ${newFilePath}`);

      // Убедиться, что папка существует
      await ensureFolderExists(sharedFolderPath);

      // Переместить файл из pending в общую папку
      await moveFile(currentPath, newFilePath);

      console.log(`[ADMIN] Файл успешно перемещён в общую библиотеку`);

      // Опубликовать файл и получить новую публичную ссылку
      const { public_url: originalPublicUrl, preview_url } = await publishFile(newFilePath);
      const publicUrl = preview_url || originalPublicUrl;
      
      console.log(`[ADMIN] Файл опубликован, public_url: ${publicUrl}`);

      // Обновить запись в image_library
      const updateResult = await pool.query(
        `UPDATE image_library
         SET
           yandex_path = $1,
           public_url = $2,
           is_shared = TRUE,
           shared_folder_id = $3,
           share_approved_at = NOW(),
           share_approved_by = $4,
           moderation_status = 'approved'
         WHERE id = $5
         RETURNING
           id,
           is_shared,
           shared_folder_id,
           share_approved_at,
           share_approved_by,
           public_url,
           moderation_status`,
        [newFilePath, publicUrl, shared_folder_id, adminId, imageId]
      );

      const updatedImage = updateResult.rows[0];

      console.log(`[ADMIN] ✅ Изображение успешно одобрено: image_id=${imageId}, folder=${sharedFolderName}`);

      // Возвращаем успешный ответ
      return reply.code(200).send(updatedImage);

    } catch (err) {
      console.error('[ADMIN] Ошибка одобрения изображения:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Отклонить изображение и удалить из папки pending
   * POST /api/admin/images/:id/reject
   */
  app.post('/api/admin/images/:id/reject', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);

      console.log(`[ADMIN] Запрос на отклонение изображения: image_id=${imageId}, admin_id=${adminId}`);

      // Валидация входных данных
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Найти запись image_library по id
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.yandex_path,
          il.share_requested_at,
          il.is_shared
         FROM image_library il
         WHERE il.id = $1
           AND il.share_requested_at IS NOT NULL
           AND il.is_shared = FALSE`,
        [imageId]
      );

      // Если изображение не найдено или не на модерации
      if (imageResult.rows.length === 0) {
        console.log(`[ADMIN] Изображение не найдено или не на модерации: image_id=${imageId}`);
        return reply.code(404).send({
          error: 'Изображение не найдено или не находится на модерации'
        });
      }

      const image = imageResult.rows[0];
      const { yandex_path } = image;

      // Проверка наличия yandex_path
      if (!yandex_path) {
        console.error(`[ADMIN] Отсутствует yandex_path для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить путь к файлу на Яндекс.Диске'
        });
      }

      console.log(`[ADMIN] Удаление файла из pending: ${yandex_path}`);

      // Удалить файл с Яндекс.Диска (если он существует)
      try {
        await deleteFile(yandex_path);
        console.log(`[ADMIN] Файл успешно удалён: ${yandex_path}`);
      } catch (deleteError) {
        // Если файл не найден (404), это нормально - продолжаем
        if (deleteError.status === 404) {
          console.warn(`[ADMIN] Файл не найден на Яндекс.Диске (уже удалён): ${yandex_path}`);
        } else {
          // Другие ошибки логируем, но не прерываем выполнение
          console.error(`[ADMIN] Ошибка удаления файла (игнорируем): ${deleteError.message}`);
        }
      }

      // Обновить запись в image_library
      const updateResult = await pool.query(
        `UPDATE image_library
         SET
           moderation_status = 'rejected',
           share_requested_at = NULL,
           yandex_path = NULL,
           public_url = NULL
         WHERE id = $1
         RETURNING id, moderation_status`,
        [imageId]
      );

      const updatedImage = updateResult.rows[0];

      console.log(`[ADMIN] ✅ Изображение успешно отклонено: image_id=${imageId}`);

      // Возвращаем успешный ответ
      return reply.code(200).send(updatedImage);

    } catch (err) {
      console.error('[ADMIN] Ошибка отклонения изображения:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Загрузить изображение напрямую в общую библиотеку
   * POST /api/admin/images/upload-shared
   */
  app.post('/api/admin/images/upload-shared', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;

      console.log(`[ADMIN] Запрос на загрузку изображения в общую библиотеку, admin_id=${adminId}`);

      // Получаем multipart данные
      const data = await req.file();

      if (!data) {
        return reply.code(400).send({
          error: 'Файл не был передан. Поле "file" обязательно.'
        });
      }

      // Валидация MIME-типа
      const mimeType = data.mimetype;
      if (mimeType !== 'image/webp') {
        return reply.code(400).send({
          error: 'Недопустимый формат файла. Разрешен только image/webp.'
        });
      }

      // Получаем обязательное поле shared_folder_id
      const sharedFolderIdRaw = data.fields.shared_folder_id?.value;

      if (!sharedFolderIdRaw) {
        return reply.code(400).send({
          error: 'Поле shared_folder_id обязательно.'
        });
      }

      const sharedFolderId = parseInt(sharedFolderIdRaw, 10);

      // Валидация shared_folder_id
      if (!Number.isInteger(sharedFolderId) || sharedFolderId <= 0) {
        return reply.code(400).send({
          error: 'Поле shared_folder_id должно быть положительным целым числом.'
        });
      }

      // Получаем buffer файла
      const buffer = await data.toBuffer();
      const fileSize = buffer.length;

      // Получаем опциональные width и height
      const width = data.fields.width?.value ? parseInt(data.fields.width.value, 10) : null;
      const height = data.fields.height?.value ? parseInt(data.fields.height.value, 10) : null;

      // Получаем original_name
      const originalName = data.filename || 'image.webp';

      console.log(`[ADMIN] Загружаемый файл: ${originalName}, размер: ${fileSize} байт, shared_folder_id: ${sharedFolderId}`);

      // Проверяем существование папки
      const folderResult = await pool.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [sharedFolderId]
      );

      if (folderResult.rows.length === 0) {
        console.log(`[ADMIN] Папка общей библиотеки не найдена: folder_id=${sharedFolderId}`);
        return reply.code(400).send({
          error: 'Указанная папка общей библиотеки не найдена.'
        });
      }

      const sharedFolder = folderResult.rows[0];
      const sharedFolderName = sharedFolder.name;

      console.log(`[ADMIN] Загрузка изображения в папку: ${sharedFolderName}`);

      // Построить путь папки на Яндекс.Диске
      const folderPath = getSharedFolderPath(sharedFolderName);

      // Убедиться, что папка существует
      await ensureFolderExists(folderPath);

      // Сгенерировать уникальное имя файла (UUID + .webp)
      const uniqueFilename = `${randomBytes(16).toString('hex')}.webp`;

      // Построить полный путь к файлу
      const filePath = `${folderPath}/${uniqueFilename}`;

      console.log(`[ADMIN] Путь на Яндекс.Диске: ${filePath}`);

      // Загрузить файл на Яндекс.Диск
      await uploadFile(filePath, buffer, mimeType);

      // Опубликовать файл и получить публичную ссылку
      const { public_url: originalPublicUrl, preview_url } = await publishFile(filePath);
      const publicUrl = preview_url || originalPublicUrl;
      
      console.log(`[ADMIN] Файл опубликован, public_url: ${publicUrl}`);

      // Сохранить запись в БД
      const insertResult = await pool.query(
        `INSERT INTO image_library (
          user_id,
          original_name,
          filename,
          folder_name,
          yandex_path,
          public_url,
          width,
          height,
          file_size,
          moderation_status,
          is_shared,
          shared_folder_id,
          share_requested_at,
          share_approved_at,
          share_approved_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING
          id,
          original_name,
          public_url,
          shared_folder_id,
          is_shared`,
        [
          adminId,              // user_id - кто загрузил
          originalName,         // original_name
          uniqueFilename,       // filename
          null,                 // folder_name - NULL для общей библиотеки
          filePath,             // yandex_path
          publicUrl,            // public_url
          width,                // width
          height,               // height
          fileSize,             // file_size
          'approved',           // moderation_status
          true,                 // is_shared
          sharedFolderId,       // shared_folder_id
          null,                 // share_requested_at - NULL
          new Date(),           // share_approved_at - текущее время
          adminId               // share_approved_by - id админа
        ]
      );

      const newImage = insertResult.rows[0];

      console.log(`[ADMIN] ✅ Изображение успешно загружено в общую библиотеку: id=${newImage.id}, folder=${sharedFolderName}`);

      // Возвращаем успешный ответ
      return reply.code(201).send(newImage);

    } catch (err) {
      console.error('[ADMIN] Ошибка загрузки изображения в общую библиотеку:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Переместить общее изображение в другую папку
   * POST /api/admin/images/:id/move-to-folder
   */
  app.post('/api/admin/images/:id/move-to-folder', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);
      const { shared_folder_id } = req.body;

      console.log(`[ADMIN] Запрос на перемещение изображения: image_id=${imageId}, new_folder_id=${shared_folder_id}, admin_id=${adminId}`);

      // Валидация ID изображения
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Валидация shared_folder_id
      if (!shared_folder_id || !Number.isInteger(shared_folder_id) || shared_folder_id <= 0) {
        return reply.code(400).send({
          error: 'Поле shared_folder_id обязательно и должно быть положительным целым числом'
        });
      }

      // Найти изображение в image_library по id и is_shared = TRUE
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.filename,
          il.yandex_path,
          il.shared_folder_id,
          il.public_url
         FROM image_library il
         WHERE il.id = $1 AND il.is_shared = TRUE`,
        [imageId]
      );

      // Если изображение не найдено или не является общим
      if (imageResult.rows.length === 0) {
        console.log(`[ADMIN] Общее изображение не найдено: image_id=${imageId}`);
        return reply.code(404).send({
          error: 'Общее изображение не найдено'
        });
      }

      const image = imageResult.rows[0];
      const { filename, yandex_path, shared_folder_id: currentFolderId } = image;

      // Проверяем, что изображение не перемещается в ту же папку
      if (currentFolderId === shared_folder_id) {
        return reply.code(400).send({
          error: 'Изображение уже находится в этой папке'
        });
      }

      // Получить старое имя папки (по текущему shared_folder_id)
      const oldFolderResult = await pool.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [currentFolderId]
      );

      if (oldFolderResult.rows.length === 0) {
        console.error(`[ADMIN] Старая папка не найдена: folder_id=${currentFolderId}`);
        return reply.code(500).send({
          error: 'Текущая папка изображения не найдена в базе данных'
        });
      }

      const oldFolderName = oldFolderResult.rows[0].name;

      // Найти целевую папку по shared_folder_id
      const newFolderResult = await pool.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [shared_folder_id]
      );

      // Если целевая папка не найдена
      if (newFolderResult.rows.length === 0) {
        console.log(`[ADMIN] Целевая папка не найдена: folder_id=${shared_folder_id}`);
        return reply.code(400).send({
          error: 'Указанная папка не найдена'
        });
      }

      const newFolderName = newFolderResult.rows[0].name;

      console.log(`[ADMIN] Перемещение изображения из папки "${oldFolderName}" в "${newFolderName}"`);

      // Проверяем наличие yandex_path
      if (!yandex_path) {
        console.error(`[ADMIN] Отсутствует yandex_path для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить текущий путь файла'
        });
      }

      // Вычислить целевой путь файла в новой папке
      const newFolderPath = getSharedFolderPath(newFolderName);
      const newFilePath = `${newFolderPath}/${filename}`;

      console.log(`[ADMIN] Перемещение файла: ${yandex_path} -> ${newFilePath}`);

      // Убедиться, что новая папка существует
      await ensureFolderExists(newFolderPath);

      // Переместить файл на Яндекс.Диске
      await moveFile(yandex_path, newFilePath);

      console.log(`[ADMIN] Файл успешно перемещён на Яндекс.Диске`);

      // Обновить публичный URL (вызов publishFile для нового пути)
      const { public_url: originalPublicUrl, preview_url } = await publishFile(newFilePath);
      const newPublicUrl = preview_url || originalPublicUrl;
      
      console.log(`[ADMIN] Файл опубликован, новый public_url: ${newPublicUrl}`);

      // Обновить запись в image_library
      const updateResult = await pool.query(
        `UPDATE image_library
         SET
           yandex_path = $1,
           public_url = $2,
           shared_folder_id = $3,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING
           id,
           shared_folder_id,
           yandex_path,
           public_url`,
        [newFilePath, newPublicUrl, shared_folder_id, imageId]
      );

      const updatedImage = updateResult.rows[0];

      console.log(`[ADMIN] ✅ Изображение успешно перемещено: image_id=${imageId}, old_folder="${oldFolderName}", new_folder="${newFolderName}"`);

      // Возвращаем успешный ответ
      return reply.code(200).send(updatedImage);

    } catch (err) {
      console.error('[ADMIN] Ошибка перемещения изображения:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Удалить общее изображение из библиотеки
   * DELETE /api/admin/images/:id
   */
  app.delete('/api/admin/images/:id', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);

      console.log(`[ADMIN] Запрос на удаление общего изображения: image_id=${imageId}, admin_id=${adminId}`);

      // Валидация ID изображения
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Найти изображение в image_library по id и is_shared = TRUE
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.yandex_path,
          il.is_shared
         FROM image_library il
         WHERE il.id = $1 AND il.is_shared = TRUE`,
        [imageId]
      );

      // Если изображение не найдено
      if (imageResult.rows.length === 0) {
        console.log(`[ADMIN] Общее изображение не найдено: image_id=${imageId}`);
        return reply.code(404).send({
          error: 'Общее изображение не найдено'
        });
      }

      const image = imageResult.rows[0];
      const { yandex_path } = image;

      // Проверяем наличие yandex_path
      if (!yandex_path) {
        console.error(`[ADMIN] Отсутствует yandex_path для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить путь к файлу на Яндекс.Диске'
        });
      }

      console.log(`[ADMIN] Удаление файла с Яндекс.Диска: ${yandex_path}`);

      // Удалить файл с Яндекс.Диска
      try {
        await deleteFile(yandex_path);
        console.log(`[ADMIN] Файл успешно удалён с Яндекс.Диска`);
      } catch (deleteError) {
        console.error(`[ADMIN] Ошибка удаления файла с Яндекс.Диска:`, deleteError);

        // Если файл не найден (404), продолжаем удаление из БД
        // В других случаях - выбрасываем ошибку
        if (!deleteError.status || deleteError.status !== 404) {
          throw deleteError;
        }

        console.log(`[ADMIN] Файл не найден на Яндекс.Диске (возможно, уже удалён), продолжаем удаление из БД`);
      }

      // Удалить запись из image_library
      await pool.query(
        'DELETE FROM image_library WHERE id = $1',
        [imageId]
      );

      console.log(`[ADMIN] ✅ Общее изображение успешно удалено: image_id=${imageId}`);

      // Возвращаем успешный ответ 204 No Content
      return reply.code(204).send();

    } catch (err) {
      console.error('[ADMIN] Ошибка удаления общего изображения:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`[ADMIN] Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  console.log('✅ Маршруты админ-панели зарегистрированы');
}
