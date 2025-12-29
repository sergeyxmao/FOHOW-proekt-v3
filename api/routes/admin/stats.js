import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

/**
 * Регистрация маршрутов статистики и мониторинга
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminStatsRoutes(app) {

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
}
