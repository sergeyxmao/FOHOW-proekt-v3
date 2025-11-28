import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { randomBytes } from 'crypto';
import {
  getSharedFolderPath,
  ensureFolderExists,
  moveFile,
  copyFile,
  publishFile,
  deleteFile,
  uploadFile
} from '../services/yandexDiskService.js';
import { syncSharedFoldersWithYandexDisk } from '../services/sharedFoldersSync.js';
import { generateImagePlaceholders } from '../utils/imagePlaceholders.js';
import {
  getPendingVerifications,
  approveVerification,
  rejectVerification
} from '../services/verificationService.js';

/**
 * Рекурсивная функция для замены URL в JSON-структурах
 * @param {*} obj - Объект для обработки
 * @param {string} oldUrl - Старый URL для замены
 * @param {string} newUrl - Новый URL
 * @returns {*} - Обработанный объект
 */
function replaceUrls(obj, oldUrl, newUrl) {
  if (typeof obj === 'string') {
    return obj.includes(oldUrl) ? obj.replace(new RegExp(oldUrl, 'g'), newUrl) : obj;
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceUrls(item, oldUrl, newUrl));
  } else if (obj && typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = replaceUrls(obj[key], oldUrl, newUrl);
    }
    return result;
  }
  return obj;
}

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
          u.country, u.city, u.full_name, u.phone, u.is_verified,
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
          (SELECT COUNT(*) FROM users WHERE is_verified = TRUE) as verified_users,
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
        `SELECT
           id,
           level,
           action AS message,
           details AS context,
           created_at
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
      await syncSharedFoldersWithYandexDisk();

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
        // Пропускаем записи без пути на Яндекс.Диске, чтобы не падать с 500
        if (!file.yandex_path) {
          console.warn(`[ADMIN] Пропуск файла без yandex_path: id=${file.id}, filename=${file.filename}`);
          continue;
        }
        
        const oldPath = file.yandex_path;
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

          // Если файл не найден на Яндекс.Диске, логируем и продолжаем обработку остальных,
          // чтобы не прерывать переименование всей папки
          if (moveError.status === 404) {
            console.warn(`[ADMIN] Файл не найден на Яндекс.Диске, пропускаем: ${oldPath}`);
            continue;
          }
          
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
   * Удалить папку общей библиотеки вместе с содержимым
   * DELETE /api/admin/shared-folders/:id
   */
  app.delete('/api/admin/shared-folders/:id', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    const client = await pool.connect();

    try {
      const adminId = req.user.id;
      const folderId = parseInt(req.params.id, 10);

      console.log(`[ADMIN] Запрос на удаление папки: folder_id=${folderId}, admin_id=${adminId}`);

      if (!Number.isInteger(folderId) || folderId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID папки'
        });
      }

      await client.query('BEGIN');

      const folderResult = await client.query(
        'SELECT id, name FROM shared_folders WHERE id = $1',
        [folderId]
      );

      if (folderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Папка не найдена' });
      }

      const folderName = folderResult.rows[0].name;
      const folderPath = getSharedFolderPath(folderName);

      const filesResult = await client.query(
        `SELECT id, yandex_path
         FROM image_library
         WHERE is_shared = TRUE AND shared_folder_id = $1`,
        [folderId]
      );

      for (const file of filesResult.rows) {
        if (!file.yandex_path) {
          console.warn(`[ADMIN] Пропуск удаления файла без yandex_path: id=${file.id}`);
          continue;
        }

        try {
          await deleteFile(file.yandex_path);
        } catch (deleteError) {
          console.error(`[ADMIN] Ошибка удаления файла ${file.yandex_path}:`, deleteError);

          if (!deleteError.status || deleteError.status !== 404) {
            await client.query('ROLLBACK');

            return reply.code(500).send({
              error: `Ошибка при удалении файлов папки: ${deleteError.message}`
            });
          }

          console.warn(`[ADMIN] Файл не найден на Яндекс.Диске, продолжаем: ${file.yandex_path}`);
        }
      }

      await client.query(
        'DELETE FROM image_library WHERE is_shared = TRUE AND shared_folder_id = $1',
        [folderId]
      );

      await client.query(
        'DELETE FROM shared_folders WHERE id = $1',
        [folderId]
      );

      await client.query('COMMIT');

      // Пытаемся удалить папку на Яндекс.Диске после успешной транзакции
      try {
        await deleteFile(folderPath);
      } catch (folderDeleteError) {
        if (!folderDeleteError.status || folderDeleteError.status !== 404) {
          console.error(`[ADMIN] Не удалось удалить папку на Яндекс.Диске: ${folderPath}`, folderDeleteError);
        }
      }

      console.log(`[ADMIN] ✅ Папка успешно удалена: id=${folderId}, name="${folderName}"`);

      return reply.code(204).send();
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ADMIN] Ошибка удаления папки:', err);

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
          il.preview_url,
          il.yandex_path,
          il.pending_yandex_path,          
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
   * Одобрить изображение и скопировать в общую библиотеку
   * POST /api/admin/images/:id/approve
   */
  app.post('/api/admin/images/:id/approve', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);
      const { folder_name: requested_folder_name } = req.body;

      console.log(
        `[ADMIN] Запрос на одобрение изображения: image_id=${imageId}, folder_name="${requested_folder_name}", admin_id=${adminId}`
      );

      // Валидация входных данных
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Валидация имени папки
      if (!requested_folder_name || requested_folder_name.trim() === '') {
        return reply.code(400).send({
          error: 'Не указано имя папки'
        });
      }

      const folderNameClean = requested_folder_name.trim();


      // Проверка длины имени папки
      if (folderNameClean.length > 50) {
        return reply.code(400).send({
          error: 'Имя папки не должно превышать 50 символов'
        });
      }

      // Найти запись image_library по id
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.user_id,
          il.original_name,
          il.filename,
          il.folder_name,
          il.yandex_path,
          il.public_url,
          il.pending_yandex_path,
          il.preview_url,
          il.preview_placeholder,
          il.blurhash,          
          il.width,
          il.height,
          il.file_size,
          il.share_requested_at,
          il.is_shared,
          u.personal_id as user_personal_id
          FROM image_library il
         JOIN users u ON il.user_id = u.id         
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
    const {
      filename,
      yandex_path,
      pending_yandex_path,
      user_id: ownerId,
      original_name,
      folder_name,
      width,
      height,
        file_size,
        share_requested_at,
        user_personal_id: personalId
      } = image;
      // Найти или создать папку в базе данных
      let folderResult = await pool.query(
        'SELECT id, name FROM shared_folders WHERE name = $1',
        [folderNameClean]
      );

      let sharedFolder;
      let shared_folder_id;

      // Если папка не существует в БД, создаем её
      if (folderResult.rows.length === 0) {
        console.log(`[ADMIN] Папка "${folderNameClean}" не найдена в БД, создаём новую...`);

        const createFolderResult = await pool.query(
          `INSERT INTO shared_folders (name, created_by, created_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           RETURNING id, name, created_by, created_at`,
          [folderNameClean, adminId]
        );

        sharedFolder = createFolderResult.rows[0];
        shared_folder_id = sharedFolder.id;

        console.log(`[ADMIN] ✅ Папка создана в БД: id=${sharedFolder.id}, name="${sharedFolder.name}"`);
      } else {
        sharedFolder = folderResult.rows[0];
        shared_folder_id = sharedFolder.id;
        console.log(`[ADMIN] Папка найдена в БД: id=${sharedFolder.id}, name="${sharedFolder.name}"`);
      }

    console.log(`[ADMIN] Копирование изображения в папку: ${folderNameClean}`);

    const sourceFilePath = pending_yandex_path || yandex_path;

    if (!sourceFilePath) {
      console.error(
        `[ADMIN] Отсутствует путь к файлу для изображения: image_id=${imageId}`
      );
      return reply.code(500).send({
        error: 'Не удалось определить путь к файлу на Яндекс.Диске'
      });
    }

      // Построить путь к целевой папке
      const sharedFolderPath = getSharedFolderPath(folderNameClean);
      const newFilePath = `${sharedFolderPath}/${filename}`;

      console.log(`[ADMIN] Копирование файла: ${sourceFilePath} -> ${newFilePath}`);

      // Создать папку на Яндекс.Диске, если она не существует
      await ensureFolderExists(sharedFolderPath);
      console.log(`[ADMIN] Папка проверена/создана на Яндекс.Диске: ${sharedFolderPath}`);

      // Скопировать файл из личной библиотеки в общую
      await copyFile(sourceFilePath, newFilePath);

      console.log(`[ADMIN] Файл успешно скопирован в общую библиотеку`);

      // Удалить файл из pending после успешного копирования
      if (pending_yandex_path) {
        try {
          await deleteFile(pending_yandex_path);
          console.log(`[ADMIN] Файл удален из pending: ${pending_yandex_path}`);
        } catch (deleteError) {
          // Логируем, но не прерываем процесс
          console.warn(`[ADMIN] Не удалось удалить файл из pending:`, deleteError);
        }
      }

      // Опубликовать файл и получить новую публичную ссылку
      const publishResult = await publishFile(newFilePath);
      const publicUrl = publishResult.public_url;
      const previewUrl = publishResult.preview_url || publishResult.public_url;

      const { preview_placeholder, blurhash } = await generateImagePlaceholders({
        previewUrl,
        buffer: null,
        mimeType: 'image/webp'
      });

      const placeholderToStore = preview_placeholder || image.preview_placeholder;
         
      console.log(`[ADMIN] Файл опубликован, public_url: ${publicUrl}`);

      // Создать новую запись для общей библиотеки
      const insertResult = await pool.query(
        `INSERT INTO image_library (
          user_id,
          original_name,
          filename,
          folder_name,
          yandex_path,
          public_url,
          preview_url,
          preview_placeholder,
          blurhash,          
          width,
          height,
          file_size,
          moderation_status,
          is_shared,
          shared_folder_id,
          share_requested_at,
          share_approved_at,
          share_approved_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id, user_id, original_name, public_url, preview_url, preview_placeholder, blurhash, shared_folder_id, is_shared`,
        [
          ownerId,
          original_name,
          filename,
          null,
          newFilePath,
          publicUrl,
          previewUrl,
          placeholderToStore,
          blurhashToStore,          
          width,
          height,
          file_size,
          'approved',
          true,
          shared_folder_id,
          null,
          new Date(),          
          adminId
        ]
      );

    const sharedImage = insertResult.rows[0];

// Обновить оригинальную запись: сбросить флаги модерации
// Оригинальные пути оставляем без изменений, чтобы изображения на досках продолжали работать
// Оставляем is_shared = FALSE, чтобы избежать дублирования в shared библиотеке
await pool.query(
  `UPDATE image_library
     SET share_requested_at = NULL,
         pending_yandex_path = NULL,
         moderation_status = 'approved'
     WHERE id = $1`,
  [imageId]
);

      // ============================================
      // АВТООБНОВЛЕНИЕ ССЫЛОК НА ИЗОБРАЖЕНИЯ В ДОСКАХ
      // ============================================

      // Шаг 1: Получить старый и новый URL изображения
      const oldPreviewUrl = image.preview_url;
      const oldFileName = image.filename;
      const newPreviewUrl = sharedImage.preview_url;

      console.log(`[ADMIN] Начало обновления ссылок в досках для изображения ${imageId}`);
      console.log(`[ADMIN] Старый URL: ${oldPreviewUrl}`);
      console.log(`[ADMIN] Новый URL: ${newPreviewUrl}`);

      try {
        // Шаг 2: Найти все доски с устаревшими ссылками
        const boardsResult = await pool.query(
          `SELECT id, content
           FROM boards
           WHERE content::text ILIKE '%' || $1 || '%'
              OR content::text ILIKE '%' || $2 || '%'`,
          [oldPreviewUrl, oldFileName]
        );

        const boardsToUpdate = boardsResult.rows;

        if (boardsToUpdate.length === 0) {
          console.log(`[ADMIN] Досок с изображением ${imageId} не найдено`);
        } else {
          console.log(`[ADMIN] Найдено досок для обновления: ${boardsToUpdate.length}`);

          let updatedCount = 0;

          // Шаг 3: Обновить JSON-контент каждой найденной доски
          for (const board of boardsToUpdate) {
            try {
              const boardId = board.id;
              let content = board.content;

              // Распарсить JSONB в объект
              if (typeof content === 'string') {
                content = JSON.parse(content);
              }

              // Применить рекурсивную функцию замены ссылок
              const updatedContent = replaceUrls(content, oldPreviewUrl, newPreviewUrl);

              // Обновить доску в БД
              await pool.query(
                `UPDATE boards
                 SET content = $1
                 WHERE id = $2`,
                [JSON.stringify(updatedContent), boardId]
              );

              updatedCount++;
              console.log(`[ADMIN] Обновлена доска id=${boardId}: заменена ссылка на изображение ${imageId}`);

            } catch (boardError) {
              // Логировать ошибку, но продолжить обработку оставшихся досок
              console.error(`[ADMIN] Ошибка при обновлении доски id=${board.id} для изображения ${imageId}:`, boardError);
            }
          }

          // Шаг 4: Логирование итогов
          console.log(`[ADMIN] Всего обновлено досок: ${updatedCount} для изображения ${imageId}`);
        }
      } catch (boardsUpdateError) {
        // Логировать ошибку, но не прерывать основной процесс модерации
        console.error(`[ADMIN] Ошибка при обновлении досок для изображения ${imageId}:`, boardsUpdateError);
      }

      console.log(`[ADMIN] ✅ Изображение успешно одобрено и скопировано: image_id=${imageId}, folder=${folderNameClean}`);

      // Возвращаем данные о новой записи в общей библиотеке
      return reply.code(200).send(sharedImage);

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
          il.pending_yandex_path,          
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
      const { yandex_path, pending_yandex_path } = image;

      // Проверка наличия пути к файлу
      const filePath = pending_yandex_path || yandex_path;

      if (!filePath) {
        console.error(`[ADMIN] Отсутствует путь к файлу для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить путь к файлу на Яндекс.Диске'
        });
      }

      console.log(`[ADMIN] Удаление файла из pending: ${filePath}`);

      // Удалить файл с Яндекс.Диска (если он существует)
      try {
        await deleteFile(filePath);
        console.log(`[ADMIN] Файл успешно удалён: ${filePath}`);
      } catch (deleteError) {
        // Если файл не найден (404), это нормально - продолжаем
        if (deleteError.status === 404) {
          console.warn(`[ADMIN] Файл не найден на Яндекс.Диске (уже удалён): ${filePath}`);
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
           pending_yandex_path = NULL
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

      const { preview_placeholder, blurhash } = await generateImagePlaceholders({
        previewUrl: publicUrl,
        buffer,
        mimeType
      });
      
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
          preview_placeholder,
          blurhash,          
          width,
          height,
          file_size,
          moderation_status,
          is_shared,
          shared_folder_id,
          share_requested_at,
          share_approved_at,
          share_approved_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)        RETURNING
          id,
          original_name,
          public_url,
          preview_placeholder,
          blurhash,          
          shared_folder_id,
          is_shared`,
        [
          adminId,              // user_id - кто загрузил
          originalName,         // original_name
          uniqueFilename,       // filename
          null,                 // folder_name - NULL для общей библиотеки
          filePath,             // yandex_path
          publicUrl,            // public_url
          preview_placeholder,  // preview_placeholder
          blurhash,             // blurhash          
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
   * Переименовать изображение в общей библиотеке
   * PATCH /api/admin/images/:id/rename
   */
  app.patch('/api/admin/images/:id/rename', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const imageId = parseInt(req.params.id, 10);
      const { new_name } = req.body;

      console.log(`[ADMIN] Запрос на переименование изображения: image_id=${imageId}, new_name="${new_name}", admin_id=${adminId}`);

      // Валидация ID изображения
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Валидация нового имени
      if (!new_name || typeof new_name !== 'string' || new_name.trim() === '') {
        return reply.code(400).send({
          error: 'Поле new_name обязательно и должно быть непустой строкой'
        });
      }

      const newNameClean = new_name.trim();

      // Проверка длины имени
      if (newNameClean.length > 200) {
        return reply.code(400).send({
          error: 'Имя файла не должно превышать 200 символов'
        });
      }

      // Найти изображение в image_library по id и is_shared = TRUE
      const imageResult = await pool.query(
        `SELECT
          il.id,
          il.original_name,
          il.filename,
          il.yandex_path,
          il.public_url,
          il.shared_folder_id,
          sf.name as folder_name
         FROM image_library il
         JOIN shared_folders sf ON il.shared_folder_id = sf.id
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
      const { filename, yandex_path, public_url, folder_name, original_name: oldOriginalName } = image;

      // Если имя не изменилось, возвращаем текущее изображение
      if (newNameClean === oldOriginalName) {
        console.log(`[ADMIN] Имя не изменилось: "${newNameClean}"`);
        return reply.code(200).send({
          image: image,
          boards_updated: 0
        });
      }

      // Проверяем наличие yandex_path
      if (!yandex_path) {
        console.error(`[ADMIN] Отсутствует yandex_path для изображения: image_id=${imageId}`);
        return reply.code(500).send({
          error: 'Не удалось определить текущий путь файла'
        });
      }

      // Извлечь расширение из старого имени файла
      const fileExtension = filename.substring(filename.lastIndexOf('.'));

      // Создать новое имя файла: удалить расширение из нового имени (если есть) и добавить оригинальное расширение
      let newFileName = newNameClean;
      if (newFileName.includes('.')) {
        newFileName = newFileName.substring(0, newFileName.lastIndexOf('.'));
      }
      newFileName = newFileName + fileExtension;

      console.log(`[ADMIN] Переименование: "${filename}" -> "${newFileName}"`);

      // Вычислить новый путь файла в той же папке
      const folderPath = getSharedFolderPath(folder_name);
      const newFilePath = `${folderPath}/${newFileName}`;

      console.log(`[ADMIN] Перемещение файла: ${yandex_path} -> ${newFilePath}`);

      // Переместить (переименовать) файл на Яндекс.Диске
      await moveFile(yandex_path, newFilePath);

      console.log(`[ADMIN] Файл успешно переименован на Яндекс.Диске`);

      // Получить новые публичные ссылки
      const { public_url: originalPublicUrl, preview_url } = await publishFile(newFilePath);
      const newPublicUrl = preview_url || originalPublicUrl;

      console.log(`[ADMIN] Файл опубликован, новый public_url: ${newPublicUrl}`);

      // Обновить запись в image_library
      const updateResult = await pool.query(
        `UPDATE image_library
         SET
           original_name = $1,
           filename = $2,
           yandex_path = $3,
           public_url = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING
           id,
           original_name,
           filename,
           yandex_path,
           public_url,
           shared_folder_id,
           width,
           height,
           file_size`,
        [newNameClean, newFileName, newFilePath, newPublicUrl, imageId]
      );

      const updatedImage = updateResult.rows[0];

      // ============================================
      // АВТООБНОВЛЕНИЕ ССЫЛОК НА ИЗОБРАЖЕНИЯ В ДОСКАХ
      // ============================================

      console.log(`[ADMIN] Начало обновления ссылок в досках для изображения ${imageId}`);
      console.log(`[ADMIN] Старый URL: ${public_url}`);
      console.log(`[ADMIN] Новый URL: ${newPublicUrl}`);

      let boardsUpdatedCount = 0;

      try {
        // Экранируем специальные символы в URL для безопасного использования в регулярных выражениях
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const oldUrlEscaped = escapeRegex(public_url);

        // Найти все доски с устаревшими ссылками
        const boardsResult = await pool.query(
          `SELECT id, content
           FROM boards
           WHERE content::text ~ $1`,
          [oldUrlEscaped]
        );

        const boardsToUpdate = boardsResult.rows;

        if (boardsToUpdate.length === 0) {
          console.log(`[ADMIN] Досок с изображением ${imageId} не найдено`);
        } else {
          console.log(`[ADMIN] Найдено досок для обновления: ${boardsToUpdate.length}`);

          // Обновить JSON-контент каждой найденной доски
          for (const board of boardsToUpdate) {
            try {
              const boardId = board.id;
              let content = board.content;

              // Распарсить JSONB в объект
              if (typeof content === 'string') {
                content = JSON.parse(content);
              }

              // Применить рекурсивную функцию замены ссылок
              const updatedContent = replaceUrls(content, public_url, newPublicUrl);

              // Обновить доску в БД
              await pool.query(
                `UPDATE boards
                 SET content = $1
                 WHERE id = $2`,
                [JSON.stringify(updatedContent), boardId]
              );

              boardsUpdatedCount++;
              console.log(`[ADMIN] Обновлена доска id=${boardId}: заменена ссылка на изображение ${imageId}`);

            } catch (boardError) {
              // Логировать ошибку, но продолжить обработку оставшихся досок
              console.error(`[ADMIN] Ошибка при обновлении доски id=${board.id} для изображения ${imageId}:`, boardError);
            }
          }

          console.log(`[ADMIN] Всего обновлено досок: ${boardsUpdatedCount} для изображения ${imageId}`);
        }
      } catch (boardsUpdateError) {
        // Логировать ошибку, но не прерывать основной процесс
        console.error(`[ADMIN] Ошибка при обновлении досок для изображения ${imageId}:`, boardsUpdateError);
      }

      console.log(`[ADMIN] ✅ Изображение успешно переименовано: image_id=${imageId}, old_name="${oldOriginalName}", new_name="${newNameClean}"`);

      // Возвращаем успешный ответ с информацией об обновленных досках
      return reply.code(200).send({
        image: updatedImage,
        boards_updated: boardsUpdatedCount
      });

    } catch (err) {
      console.error('[ADMIN] Ошибка переименования изображения:', err);

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

  // ============================================
  // МОДЕРАЦИЯ ВЕРИФИКАЦИИ
  // ============================================

  /**
   * Прокси для скриншотов верификации
   * GET /api/admin/screenshot-proxy
   *
   * Позволяет админу получить скриншот верификации по пути на Yandex.Disk.
   * Скриншоты хранятся в /verifications/{userId}/ и недоступны напрямую.
   */
  app.get('/api/admin/screenshot-proxy', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { path } = req.query;

      if (!path) {
        return reply.code(400).send({ error: 'Параметр path обязателен' });
      }

      console.log(`[ADMIN] Запрос прокси скриншота: path=${path}`);

      // Проверка, что путь начинается с /verifications/ (безопасность)
      if (!path.startsWith('/verifications/')) {
        return reply.code(403).send({ error: 'Доступ к данному пути запрещён' });
      }

      // Получить ссылку для скачивания через Yandex API
      const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`;

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `OAuth ${process.env.YANDEX_DISK_TOKEN}`
        }
      });

      if (!response.ok) {
        console.error(`[ADMIN] Yandex API вернул статус ${response.status} для path=${path}`);

        if (response.status === 404) {
          return reply.code(404).send({ error: 'Файл не найден' });
        }

        return reply.code(500).send({ error: 'Не удалось получить файл' });
      }

      const data = await response.json();

      if (!data.href) {
        console.error(`[ADMIN] Yandex API не вернул href для path=${path}`);
        return reply.code(500).send({ error: 'Не удалось получить ссылку на файл' });
      }

      // Загрузить файл с временной ссылки Yandex
      const fileResponse = await fetch(data.href);

      if (!fileResponse.ok) {
        console.error(`[ADMIN] Ошибка загрузки с Yandex: ${fileResponse.status}`);
        return reply.code(500).send({ error: 'Ошибка загрузки файла' });
      }

      // Получить тело как буфер
      const fileBuffer = await fileResponse.arrayBuffer();

      console.log(`[ADMIN] Скриншот загружен, размер: ${fileBuffer.byteLength} байт`);

      // Определить Content-Type по расширению
      let contentType = 'image/jpeg';
      if (path.endsWith('.png')) {
        contentType = 'image/png';
      } else if (path.endsWith('.webp')) {
        contentType = 'image/webp';
      }

      // Отдать клиенту с правильными заголовками
      return reply
        .header('Content-Type', contentType)
        .header('Content-Length', fileBuffer.byteLength)
        .header('Cache-Control', 'private, max-age=3600')
        .send(Buffer.from(fileBuffer));

    } catch (err) {
      console.error('[ADMIN] Ошибка прокси скриншота:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Получить список заявок на верификацию
   * GET /api/admin/verifications/pending
   */
  app.get('/api/admin/verifications/pending', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос списка заявок на верификацию, admin_id=' + req.user.id);

      const verifications = await getPendingVerifications();

      console.log(`[ADMIN] Найдено заявок на верификацию: ${verifications.length}`);

      return reply.send({
        success: true,
        items: verifications,
        total: verifications.length
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка заявок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Одобрить заявку на верификацию
   * POST /api/admin/verifications/:id/approve
   */
  app.post('/api/admin/verifications/:id/approve', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const verificationId = parseInt(req.params.id, 10);

      console.log(`[ADMIN] Запрос на одобрение верификации: verification_id=${verificationId}, admin_id=${adminId}`);

      // Валидация ID
      if (!Number.isInteger(verificationId) || verificationId <= 0) {
        return reply.code(400).send({ error: 'Некорректный ID заявки' });
      }

      await approveVerification(verificationId, adminId);

      console.log(`[ADMIN] ✅ Верификация одобрена: verification_id=${verificationId}`);

      return reply.send({
        success: true,
        message: 'Заявка одобрена. Пользователь верифицирован.'
      });

    } catch (err) {
      console.error('[ADMIN] Ошибка одобрения верификации:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка: ${err.message}`
        : 'Не удалось одобрить заявку. Попробуйте позже.';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Отклонить заявку на верификацию
   * POST /api/admin/verifications/:id/reject
   */
  app.post('/api/admin/verifications/:id/reject', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const verificationId = parseInt(req.params.id, 10);
      const { rejection_reason } = req.body;

      console.log(`[ADMIN] Запрос на отклонение верификации: verification_id=${verificationId}, admin_id=${adminId}`);

      // Валидация ID
      if (!Number.isInteger(verificationId) || verificationId <= 0) {
        return reply.code(400).send({ error: 'Некорректный ID заявки' });
      }

      // Валидация причины отклонения
      if (!rejection_reason || !rejection_reason.trim()) {
        return reply.code(400).send({ error: 'Необходимо указать причину отклонения' });
      }

      await rejectVerification(verificationId, adminId, rejection_reason.trim());

      console.log(`[ADMIN] ✅ Верификация отклонена: verification_id=${verificationId}`);

      return reply.send({
        success: true,
        message: 'Заявка отклонена. Пользователю отправлено уведомление.'
      });

    } catch (err) {
      console.error('[ADMIN] Ошибка отклонения верификации:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка: ${err.message}`
        : 'Не удалось отклонить заявку. Попробуйте позже.';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * Получить архив верификации (одобренные и отклонённые)
   * GET /api/admin/verifications/archive
   */
  app.get('/api/admin/verifications/archive', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос архива верификации, admin_id=' + req.user.id);

      const result = await pool.query(
        `SELECT
          v.id,
          v.user_id,
          v.full_name,
          v.screenshot_1_path,
          v.screenshot_2_path,
          v.status,
          v.rejection_reason,
          v.submitted_at,
          v.processed_at,
          u.personal_id,
          u.email,
          u.username,
          (SELECT username FROM users WHERE id = v.processed_by) as processed_by_username
         FROM user_verifications v
         JOIN users u ON v.user_id = u.id
         WHERE v.status IN ('approved', 'rejected')
         ORDER BY v.processed_at DESC
         LIMIT 100`,
        []
      );

      console.log(`[ADMIN] Найдено записей в архиве: ${result.rows.length}`);

      return reply.send({
        success: true,
        items: result.rows,
        total: result.rows.length
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения архива верификации:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // ============================================
  // ЭКСПОРТ ПОЛЬЗОВАТЕЛЕЙ В CSV
  // ============================================

  /**
   * Вспомогательная функция генерации CSV
   */
  function generateUserCSV(rows, title, includeVerificationDate = true, includeVerificationStatus = false) {
    // Заголовки колонок
    const headers = [
      'ID',
      'Компьютерный номер',
      'ФИО',
      'Email',
      'Username',
      'Телефон',
      'Город',
      'Страна',
      'Представительство'
    ];

    if (includeVerificationStatus) {
      headers.push('Статус верификации');
    }

    if (includeVerificationDate) {
      headers.push('Дата верификации');
    }

    headers.push('Дата регистрации', 'Тарифный план');

    // BOM для корректного отображения кириллицы в Excel
    let csv = '\uFEFF';

    // Только заголовки таблицы
    csv += headers.join(',') + '\n';

    // Данные
    rows.forEach(row => {
      const values = [
        row.id,
        row.personal_id || '',
        `"${(row.full_name || '').replace(/"/g, '""')}"`,
        row.email || '',
        row.username || '',
        row.phone || '',
        `"${(row.city || '').replace(/"/g, '""')}"`,
        `"${(row.country || '').replace(/"/g, '""')}"`,
        `"${(row.office || '').replace(/"/g, '""')}"`
      ];

      if (includeVerificationStatus) {
        values.push(row.is_verified ? 'Да' : 'Нет');
      }

      if (includeVerificationDate) {
        values.push(row.verified_at ? new Date(row.verified_at).toISOString().split('T')[0] : '');
      }

      values.push(
        row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
        `"${(row.plan_name || '').replace(/"/g, '""')}"`
      );

      csv += values.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Экспорт списка верифицированных пользователей в CSV
   * GET /api/admin/export/verified-users
   */
  app.get('/api/admin/export/verified-users', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Экспорт верифицированных пользователей, admin_id=' + req.user.id);

      const result = await pool.query(
        `SELECT
          u.id,
          u.personal_id,
          u.full_name,
          u.email,
          u.username,
          u.phone,
          u.city,
          u.country,
          u.office,
          u.verified_at,
          u.created_at,
          sp.name as plan_name
         FROM users u
         LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.is_verified = TRUE
         ORDER BY u.verified_at DESC`
      );

      const csv = generateUserCSV(result.rows, 'Верифицированные пользователи');

      console.log(`[ADMIN] Экспортировано верифицированных пользователей: ${result.rows.length}`);

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="verified_users_${new Date().toISOString().split('T')[0]}.csv"`)
        .send(csv);

    } catch (err) {
      console.error('[ADMIN] Ошибка экспорта верифицированных пользователей:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Экспорт списка НЕ верифицированных пользователей в CSV
   * GET /api/admin/export/non-verified-users
   */
  app.get('/api/admin/export/non-verified-users', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Экспорт НЕ верифицированных пользователей, admin_id=' + req.user.id);

      const result = await pool.query(
        `SELECT
          u.id,
          u.personal_id,
          u.full_name,
          u.email,
          u.username,
          u.phone,
          u.city,
          u.country,
          u.office,
          u.created_at,
          sp.name as plan_name
         FROM users u
         LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.is_verified = FALSE OR u.is_verified IS NULL
         ORDER BY u.created_at DESC`
      );

      const csv = generateUserCSV(result.rows, 'Не верифицированные пользователи', false);

      console.log(`[ADMIN] Экспортировано НЕ верифицированных пользователей: ${result.rows.length}`);

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="non_verified_users_${new Date().toISOString().split('T')[0]}.csv"`)
        .send(csv);

    } catch (err) {
      console.error('[ADMIN] Ошибка экспорта НЕ верифицированных пользователей:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Экспорт пользователей по тарифному плану в CSV
   * GET /api/admin/export/users-by-plan/:planId
   * Параметры: planId - ID плана или "null" для пользователей без плана
   */
  app.get('/api/admin/export/users-by-plan/:planId', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { planId } = req.params;

      console.log(`[ADMIN] Экспорт пользователей по плану ID="${planId}", admin_id=${req.user.id}`);

      let result;
      let planName = '';

      if (planId === 'null' || planId === 'NULL') {
        // Пользователи без плана
        console.log('[ADMIN] Экспорт пользователей без плана');

        result = await pool.query(
          `SELECT
            u.id,
            u.personal_id,
            u.full_name,
            u.email,
            u.username,
            u.phone,
            u.city,
            u.country,
            u.office,
            u.is_verified,
            u.verified_at,
            u.created_at,
            'Без плана' as plan_name
           FROM users u
           WHERE u.plan_id IS NULL
           ORDER BY u.created_at DESC`
        );

        planName = 'Без плана';
      } else {
        // Пользователи конкретного плана по ID
        console.log(`[ADMIN] Поиск плана с ID: ${planId}`);

        // Получить название плана по ID
        const planCheck = await pool.query(
          'SELECT id, name FROM subscription_plans WHERE id = $1',
          [parseInt(planId)]
        );

        if (planCheck.rows.length === 0) {
          console.error(`[ADMIN] План с ID ${planId} не найден в БД`);
          return reply.code(404).send({
            error: `План с ID ${planId} не найден`
          });
        }

        planName = planCheck.rows[0].name;
        console.log(`[ADMIN] План найден: "${planName}"`);

        result = await pool.query(
          `SELECT
            u.id,
            u.personal_id,
            u.full_name,
            u.email,
            u.username,
            u.phone,
            u.city,
            u.country,
            u.office,
            u.is_verified,
            u.verified_at,
            u.created_at,
            sp.name as plan_name
           FROM users u
           JOIN subscription_plans sp ON u.plan_id = sp.id
           WHERE sp.id = $1
           ORDER BY u.created_at DESC`,
          [parseInt(planId)]
        );
      }

      console.log(`[ADMIN] Найдено пользователей: ${result.rows.length}`);

      const csv = generateUserCSV(result.rows, `Пользователи плана: ${planName}`, true, true);

      console.log(`[ADMIN] CSV сгенерирован, размер: ${csv.length} символов`);

      // Использовать ID плана вместо названия, чтобы избежать кириллицы в HTTP-заголовках
      const safeFileName = planId === 'null' || planId === 'NULL' ? 'no_plan' : `plan_${planId}`;
      const fileName = `users_${safeFileName}_${new Date().toISOString().split('T')[0]}.csv`;

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(csv);

    } catch (err) {
      console.error(`[ADMIN] Ошибка экспорта пользователей по плану:`, err);
      console.error(`[ADMIN] Stack trace:`, err.stack);
      return reply.code(500).send({
        error: 'Ошибка сервера',
        message: err.message
      });
    }
  });

  /**
   * Получить список всех тарифных планов для фильтра
   * GET /api/admin/subscription-plans
   */
  app.get('/api/admin/subscription-plans', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT id, name,
          (SELECT COUNT(*) FROM users WHERE plan_id = sp.id) as user_count
         FROM subscription_plans sp
         ORDER BY id`
      );

      // Добавить "Без плана"
      const nullPlanCount = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE plan_id IS NULL'
      );

      return reply.send({
        success: true,
        plans: [
          ...result.rows,
          { id: null, name: 'Без плана', user_count: parseInt(nullPlanCount.rows[0].count) }
        ]
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка планов:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  console.log('✅ Маршруты админ-панели зарегистрированы');
}
