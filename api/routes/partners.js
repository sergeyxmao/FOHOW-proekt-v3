// api/routes/partners.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export function registerPartnerRoutes(app) {
  // GET /api/partners - Список верифицированных партнёров
  app.get('/api/partners', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { city, country, rank, search, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT
          u.id, u.personal_id, u.full_name, u.city, u.country,
          u.rank, u.fohow_role, u.avatar_url, u.is_verified,
          u.visibility_settings, u.phone, u.email, u.blocked_users
        FROM users u
        WHERE u.is_verified = TRUE
          AND u.fohow_role = 'partner'
      `;

      const params = [];
      let paramIndex = 1;

      if (city) {
        query += ` AND u.city ILIKE $${paramIndex++}`;
        params.push(`%${city}%`);
      }
      if (country) {
        query += ` AND u.country ILIKE $${paramIndex++}`;
        params.push(`%${country}%`);
      }
      if (rank) {
        query += ` AND u.rank = $${paramIndex++}`;
        params.push(rank);
      }
      if (search) {
        query += ` AND (u.full_name ILIKE $${paramIndex} OR u.personal_id ILIKE $${paramIndex++})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY u.full_name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Фильтруем по приватности
      const partners = result.rows
        .map(p => filterByVisibility(p, req.user.id))
        .filter(p => p !== null);

      return reply.send({ success: true, data: partners });
    } catch (err) {
      console.error('[PARTNERS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // GET /api/partners/:id - Профиль партнёра
  app.get('/api/partners/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT
          u.id, u.personal_id, u.full_name, u.city, u.country,
          u.rank, u.fohow_role, u.avatar_url, u.is_verified,
          u.visibility_settings, u.phone, u.email, u.blocked_users
        FROM users u
        WHERE u.id = $1 AND u.is_verified = TRUE AND u.fohow_role = 'partner'`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Партнёр не найден' });
      }

      const partner = filterByVisibility(result.rows[0], req.user.id);

      if (!partner) {
        return reply.code(404).send({ error: 'Партнёр не найден' });
      }

      return reply.send({ success: true, data: partner });
    } catch (err) {
      console.error('[PARTNERS] Ошибка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}

function filterByVisibility(partner, requesterId) {
  // Проверка чёрного списка
  const blockedUsers = partner.blocked_users || [];
  if (blockedUsers.includes(requesterId)) {
    return null;
  }

  const vis = partner.visibility_settings || {};
  const result = {
    id: partner.id,
    personal_id: partner.personal_id,
    full_name: partner.full_name,
    city: partner.city,
    country: partner.country,
    rank: partner.rank,
    avatar_url: partner.avatar_url,
    is_verified: partner.is_verified
  };

  // Показываем контакты только если разрешено
  if (vis.showPhone !== false) result.phone = partner.phone;
  if (vis.showEmail !== false) result.email = partner.email;

  return result;
}
