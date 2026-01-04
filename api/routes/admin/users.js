import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';

/**
 * Регистрация маршрутов управления пользователями
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminUsersRoutes(app) {

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

      // Преобразуем avatar_url для всех пользователей
      const users = usersResult.rows.map(user => ({
        ...user,
        avatar_url: getAvatarUrl(user.id, user.avatar_url)
      }));

      return reply.send({
        success: true,
        data: users,
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

      // Преобразуем avatar_url для пользователя
      const user = {
        ...result.rows[0],
        avatar_url: getAvatarUrl(result.rows[0].id, result.rows[0].avatar_url)
      };

      return reply.send({
        success: true,
        user,
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
}
