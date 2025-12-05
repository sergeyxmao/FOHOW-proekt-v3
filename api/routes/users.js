// api/routes/users.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerUserRoutes(app) {

  // POST /api/users/block - Заблокировать пользователя
  app.post('/api/users/block', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { user_id } = req.body;
    if (!user_id) return reply.code(400).send({ error: 'user_id обязателен' });

    try {
      const result = await pool.query(
        `UPDATE users
         SET blocked_users = CASE
           WHEN blocked_users @> $1::jsonb THEN blocked_users
           ELSE blocked_users || $1::jsonb
         END
         WHERE id = $2
         RETURNING blocked_users`,
        [JSON.stringify([user_id]), req.user.id]
      );
      return reply.send({ success: true, blocked_users: result.rows[0].blocked_users });
    } catch (err) {
      console.error('[USERS] Ошибка блокировки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // DELETE /api/users/block/:id - Разблокировать пользователя
  app.delete('/api/users/block/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;
    try {
      await pool.query(
        `UPDATE users
         SET blocked_users = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM jsonb_array_elements(blocked_users) elem
           WHERE elem::text::int != $1
         )
         WHERE id = $2`,
        [parseInt(id), req.user.id]
      );
      return reply.send({ success: true });
    } catch (err) {
      console.error('[USERS] Ошибка разблокировки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/users/visibility - Обновление настроек видимости
  app.put('/api/users/visibility', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const settings = req.body; // Берем объект настроек напрямую

      // Валидация
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return reply.code(400).send({ error: 'Ожидается JSON объект настроек' });
      }

      const allowedFields = [
        'showPhone', 'showEmail', 'showTelegram', 'showVK', 
        'showInstagram', 'showWhatsApp', 'allowCrossLineMessages'
      ];

      // Проверка на лишние поля
      for (const key of Object.keys(settings)) {
        if (!allowedFields.includes(key)) {
             // Можно игнорировать, но лучше сообщить для отладки
             console.warn(`[Privacy] Игнорируется неизвестное поле: ${key}`);
             delete settings[key];
        }
      }

      // Используем оператор || для слияния (merge) jsonb
      const updateResult = await pool.query(
        `UPDATE users
         SET visibility_settings = COALESCE(visibility_settings, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING visibility_settings`,
        [JSON.stringify(settings), userId]
      );

      if (updateResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ [Privacy] Обновлено User ${userId}:`, settings);

      return reply.send({
        success: true,
        visibility_settings: updateResult.rows[0].visibility_settings
      });

    } catch (err) {
      console.error('[USERS] Ошибка обновления visibility:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/users/search - Обновление настроек поиска
  app.put('/api/users/search', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const settings = req.body; // Берем объект напрямую

      if (!settings || typeof settings !== 'object') {
        return reply.code(400).send({ error: 'Ожидается JSON объект настроек' });
      }

      const allowedFields = [
        'searchByName', 'searchByCity', 'searchByCountry', 
        'searchByPersonalId', 'searchByOffice'
      ];

      // Очистка от лишнего
      for (const key of Object.keys(settings)) {
         if (!allowedFields.includes(key)) {
             delete settings[key];
         }
      }

      // Обновляем настройки в базе данных
      const updateResult = await pool.query(
        `UPDATE users
         SET search_settings = COALESCE(search_settings, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING search_settings`,
        [JSON.stringify(settings), userId]
      );

      if (updateResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ [Search] Обновлено User ${userId}:`, settings);

      return reply.send({
        success: true,
        search_settings: updateResult.rows[0].search_settings
      });

    } catch (err) {
      console.error('[USERS] Ошибка обновления настроек поиска:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
