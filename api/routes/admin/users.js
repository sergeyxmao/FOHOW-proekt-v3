import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';
import boardLockService from '../../services/boardLockService.js';
import bcrypt from 'bcryptjs';

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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Список пользователей с пагинацией',
      description: 'Получить список всех пользователей с поиском, сортировкой и пагинацией',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['id', 'email', 'username', 'created_at', 'role', 'plan_name'] },
          sortOrder: { type: 'string', enum: ['ASC', 'DESC'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Детали пользователя',
      description: 'Получить подробную информацию о конкретном пользователе, включая историю подписок и активные сессии',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object', additionalProperties: true },
            subscriptionHistory: { type: 'array', items: { type: 'object', additionalProperties: true } },
            activeSessions: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT
          u.id, u.email, u.username, u.avatar_url, u.role, u.created_at, u.updated_at,
          u.subscription_expires_at, u.subscription_started_at,
          u.country, u.city, u.office, u.personal_id, u.phone, u.full_name,
          u.telegram_user, u.telegram_channel, u.telegram_chat_id,
          u.vk_profile, u.ok_profile, u.instagram_profile, u.whatsapp_contact,
          u.visibility_settings, u.search_settings,
          u.is_blocked, u.block_code, u.blocked_at, u.blocked_reason, u.admin_temp_password,
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Изменить роль пользователя',
      description: 'Изменить роль пользователя (user/admin). Нельзя изменить собственную роль',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        required: ['role']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' }
              }
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Изменить тарифный план пользователя',
      description: 'Изменить тарифный план пользователя с указанием длительности. Автоматически пересчитывает блокировки досок',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'integer' },
          duration: { type: 'integer', default: 30 },
          source: { type: 'string', default: 'admin_manual' }
        },
        required: ['planId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user: { type: 'object', additionalProperties: true },
            plan: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                code_name: { type: 'string' }
              }
            },
            subscription: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time', nullable: true },
                duration: {},
                isPermanent: { type: 'boolean' }
              }
            },
            boardsStatus: {
              type: 'object',
              properties: {
                unlocked: { type: 'integer' },
                softLocked: { type: 'integer' }
              }
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

        // Для тарифа "Гостевой" устанавливаем бесрочную подписку (NULL)
        // Для остальных тарифов вычисляем срок действия
        let endDate = null;
        if (plan.code_name === 'guest') {
          endDate = null;
          console.log(`[ADMIN] Тариф "Гостевой" - устанавливаем бесрочную подписку (subscription_expires_at = NULL)`);
        } else {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + parseInt(duration));
          console.log(`[ADMIN] Тариф "${plan.name}" - устанавливаем срок действия: ${duration} дней`);
        }

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

        // Создаем запись в истории подписок
        await client.query(
          `INSERT INTO subscription_history
           (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
           VALUES ($1, $2, $3, $4, $5, 0.00, 'RUB')`,
          [userId, planId, startDate, endDate, source]
        );

        await client.query('COMMIT');

        const durationInfo = plan.code_name === 'guest' ? 'бесрочно' : `${duration} дней`;
        console.log(`[ADMIN] Тарифный план изменен: user_id=${userId}, plan=${plan.name}, duration=${durationInfo}, admin_id=${req.user.id}`);

        // ============================================
        // ОБНОВЛЕНИЕ БЛОКИРОВОК ДОСОК (BoardLockService)
        // ============================================
        let boardsStatus = { unlocked: 0, softLocked: 0 };
        try {
          boardsStatus = await boardLockService.recalcUserBoardLocks(userId);
          console.log(`[ADMIN] Блокировки обновлены: unlocked=${boardsStatus.unlocked}, softLocked=${boardsStatus.softLocked}`);
        } catch (lockError) {
          console.error('[ADMIN] Ошибка при пересчете блокировок досок:', lockError);
        }

        // Формируем ответ
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
            endDate: endDate || null,
            duration: plan.code_name === 'guest' ? 'unlimited' : duration,
            isPermanent: plan.code_name === 'guest'
          },
          boardsStatus
        };

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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Удалить пользователя',
      description: 'Удалить пользователя с подтверждением. Нельзя удалить собственный аккаунт. Каскадное удаление всех связанных данных',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      body: {
        type: 'object',
        properties: {
          confirm: { type: 'boolean' }
        },
        required: ['confirm']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            deletedUser: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                username: { type: 'string' }
              }
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
      const deletionLog = {};

      // Каскадное удаление в транзакции
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Безопасный DELETE с логированием (игнорирует отсутствующие таблицы)
        const safeDelete = async (table, where, params) => {
          try {
            const result = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
            deletionLog[table] = result.rowCount;
          } catch (e) {
            if (e.code === '42P01') { // undefined_table
              deletionLog[table] = 'таблица не существует';
            } else {
              throw e;
            }
          }
        };

        // 1. Данные, зависящие от досок пользователя
        await safeDelete('notes', 'board_id IN (SELECT id FROM boards WHERE owner_id = $1)', [userId]);
        await safeDelete('stickers', 'board_id IN (SELECT id FROM boards WHERE owner_id = $1)', [userId]);
        await safeDelete('board_anchors', 'board_id IN (SELECT id FROM boards WHERE owner_id = $1)', [userId]);
        await safeDelete('user_comments', 'board_id IN (SELECT id FROM boards WHERE owner_id = $1)', [userId]);

        // 2. Доски и папки
        await safeDelete('boards', 'owner_id = $1', [userId]);
        await safeDelete('board_folders', 'owner_id = $1', [userId]);

        // 3. Пользовательские данные
        await safeDelete('favorites', 'user_id = $1', [userId]);
        await safeDelete('image_favorites', 'user_id = $1', [userId]);
        await safeDelete('image_library', 'user_id = $1', [userId]);
        await safeDelete('subscription_history', 'user_id = $1', [userId]);
        await safeDelete('promo_code_usages', 'user_id = $1', [userId]);
        await safeDelete('active_sessions', 'user_id = $1', [userId]);
        await safeDelete('telegram_link_codes', 'user_id = $1', [userId]);
        await safeDelete('demo_trials', 'user_id = $1', [userId]);
        await safeDelete('user_verifications', 'user_id = $1', [userId]);
        await safeDelete('image_rename_audit', 'user_id = $1', [userId]);

        // 4. По email
        const userEmail = deletedUser.email;
        await safeDelete('verified_emails', 'email = $1', [userEmail]);
        await safeDelete('email_verification_codes', 'email = $1', [userEmail]);
        await safeDelete('password_resets', 'email = $1', [userEmail]);

        // 5. Чаты/уведомления
        await safeDelete('fogrup_notifications', 'user_id = $1 OR from_user_id = $1', [userId]);
        await safeDelete('fogrup_chat_participants', 'user_id = $1', [userId]);

        // 6. Удаляем самого пользователя
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        deletionLog['users'] = 1;

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      console.log(`[ADMIN] Пользователь удален: user_id=${userId}, email=${deletedUser.email}, admin_id=${req.user.id}, deletionLog:`, deletionLog);

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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Завершить сессию',
      description: 'Завершить конкретную активную сессию пользователя по ID сессии',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'integer' }
        },
        required: ['sessionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Завершить все сессии пользователя',
      description: 'Завершить все активные сессии указанного пользователя',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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

  /**
   * Заблокировать пользователя
   * POST /api/admin/users/:userId/block
   */
  app.post('/api/admin/users/:userId/block', {
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Заблокировать пользователя',
      description: 'Временная блокировка пользователя с генерацией 6-значного кода разблокировки. Завершает все активные сессии.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Причина блокировки' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            block_code: { type: 'string' },
            message: { type: 'string' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body || {};

      if (parseInt(userId) === req.user.id) {
        return reply.code(403).send({ error: 'Нельзя заблокировать собственный аккаунт' });
      }

      const userCheck = await pool.query(
        'SELECT id, email, is_blocked FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      if (userCheck.rows[0].is_blocked) {
        return reply.code(400).send({ error: 'Пользователь уже заблокирован' });
      }

      const blockCode = Math.floor(100000 + Math.random() * 900000).toString();

      await pool.query(
        `UPDATE users SET is_blocked = true, block_code = $1, blocked_at = NOW(), blocked_reason = $2
         WHERE id = $3`,
        [blockCode, reason || null, userId]
      );

      // Завершаем все активные сессии
      await pool.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

      console.log(`[ADMIN] Пользователь заблокирован: user_id=${userId}, email=${userCheck.rows[0].email}, admin_id=${req.user.id}, reason=${reason || 'не указана'}`);

      return reply.send({
        success: true,
        block_code: blockCode,
        message: 'Пользователь заблокирован'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка блокировки пользователя:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Разблокировать пользователя (admin)
   * POST /api/admin/users/:userId/unblock
   */
  app.post('/api/admin/users/:userId/unblock', {
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Разблокировать пользователя',
      description: 'Ручная разблокировка пользователя администратором',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `UPDATE users SET is_blocked = false, block_code = NULL, blocked_at = NULL, blocked_reason = NULL
         WHERE id = $1 RETURNING id, email`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`[ADMIN] Пользователь разблокирован: user_id=${userId}, email=${result.rows[0].email}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        message: 'Пользователь разблокирован'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка разблокировки пользователя:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  /**
   * Сброс пароля пользователя (admin)
   * POST /api/admin/users/:userId/reset-password
   */
  app.post('/api/admin/users/:userId/reset-password', {
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Сбросить пароль пользователя',
      description: 'Генерирует случайный временный пароль. Завершает все активные сессии пользователя.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tempPassword: { type: 'string' },
            message: { type: 'string' }
          }
        },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { userId } = req.params;

      if (parseInt(userId) === req.user.id) {
        return reply.code(403).send({ error: 'Нельзя сбросить собственный пароль через админ-панель' });
      }

      const userCheck = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      // Генерация временного пароля (без спутывающих символов)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let tempPassword = '';
      for (let i = 0; i < 10; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const hash = await bcrypt.hash(tempPassword, 10);

      await pool.query(
        'UPDATE users SET password = $1, admin_temp_password = $2 WHERE id = $3',
        [hash, tempPassword, userId]
      );

      // Завершаем все сессии
      await pool.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

      console.log(`[ADMIN] Пароль сброшен: user_id=${userId}, email=${userCheck.rows[0].email}, admin_id=${req.user.id}`);

      return reply.send({
        success: true,
        tempPassword,
        message: 'Пароль сброшен'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка сброса пароля:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
