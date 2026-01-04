import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';

/**
 * Регистрация маршрутов истории транзакций
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminTransactionsRoutes(app) {

  /**
   * Получить историю всех транзакций с пагинацией и фильтрами
   * GET /api/admin/transactions?page=1&limit=20&search=email&dateFrom=2024-01-01&dateTo=2024-12-31
   */
  app.get('/api/admin/transactions', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const { page = 1, limit = 20, search = '', dateFrom = null, dateTo = null } = req.query;
      const offset = (page - 1) * limit;

      // Построение WHERE clause для фильтров
      const queryParams = [];
      const whereConditions = [];

      // Поиск по email пользователя
      if (search) {
        queryParams.push(`%${search}%`);
        whereConditions.push(`u.email ILIKE $${queryParams.length}`);
      }

      // Фильтр по дате (от)
      if (dateFrom) {
        queryParams.push(dateFrom);
        whereConditions.push(`sh.created_at >= $${queryParams.length}`);
      }

      // Фильтр по дате (до)
      if (dateTo) {
        queryParams.push(dateTo);
        whereConditions.push(`sh.created_at <= $${queryParams.length}`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Подсчет общего количества транзакций
      const countResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM subscription_history sh
         LEFT JOIN users u ON sh.user_id = u.id
         ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Получение транзакций с данными пользователя и плана
      queryParams.push(limit, offset);
      const transactionsResult = await pool.query(
        `SELECT
          sh.id,
          sh.user_id,
          sh.plan_id,
          sh.start_date,
          sh.end_date,
          sh.source,
          sh.payment_method,
          sh.amount_paid,
          sh.currency,
          sh.created_at,
          u.email as user_email,
          u.username as user_username,
          u.avatar_url as user_avatar,
          u.full_name as user_full_name,
          sp.name as plan_name,
          sp.code_name as plan_code
         FROM subscription_history sh
         LEFT JOIN users u ON sh.user_id = u.id
         LEFT JOIN subscription_plans sp ON sh.plan_id = sp.id
         ${whereClause}
         ORDER BY sh.created_at DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      console.log(`[ADMIN] История транзакций загружена: page=${page}, total=${total}, admin_id=${req.user.id}`);

      // Подменяем avatar_url на внутренний proxy URL с версионированием
      const transactions = transactionsResult.rows.map(transaction => ({
        ...transaction,
        user_avatar: getAvatarUrl(transaction.user_id, transaction.user_avatar)
      }));

      return reply.send({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения истории транзакций:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
