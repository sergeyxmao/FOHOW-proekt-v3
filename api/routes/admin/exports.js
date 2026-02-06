import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

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
 * Регистрация маршрутов экспорта пользователей
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminExportsRoutes(app) {

  /**
   * Экспорт списка верифицированных пользователей в CSV
   * GET /api/admin/export/verified-users
   */
  app.get('/api/admin/export/verified-users', {
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Экспорт верифицированных пользователей в CSV',
      description: 'Скачать CSV файл со списком верифицированных пользователей',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'string', description: 'CSV файл с данными пользователей' },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Экспорт неверифицированных пользователей в CSV',
      description: 'Скачать CSV файл со списком неверифицированных пользователей',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'string', description: 'CSV файл с данными пользователей' },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
    preHandler: [authenticateToken, requireAdmin],
    schema: {
      tags: ['Admin'],
      summary: 'Экспорт пользователей по тарифу в CSV',
      description: 'Скачать CSV файл со списком пользователей определённого тарифного плана. planId может быть числовым ID плана или "null" для пользователей без плана.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'ID тарифного плана или "null" для пользователей без плана' }
        },
        required: ['planId']
      },
      response: {
        200: { type: 'string', description: 'CSV файл с данными пользователей' },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
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
}
