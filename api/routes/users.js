// api/routes/users.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export function registerUserRoutes(app) {
  // POST /api/users/block - Заблокировать пользователя
  app.post('/api/users/block', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { user_id } = req.body;

    if (!user_id) {
      return reply.code(400).send({ error: 'user_id обязателен' });
    }

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
      const { visibility_settings } = req.body;

      // Валидация: проверяем, что visibility_settings - это объект
      if (!visibility_settings || typeof visibility_settings !== 'object') {
        return reply.code(400).send({ error: 'Некорректный формат настроек видимости' });
      }

      // Список допустимых полей для видимости
      const allowedFields = [
        'username', 'full_name', 'avatar_url', 'personal_id', 'phone',
        'city', 'country', 'office', 'telegram_user', 'instagram_profile'
      ];

      // Валидация: проверяем, что все ключи допустимы и значения boolean
      for (const [key, value] of Object.entries(visibility_settings)) {
        if (!allowedFields.includes(key)) {
          return reply.code(400).send({
            error: `Недопустимое поле: ${key}`,
            field: key
          });
        }
        if (typeof value !== 'boolean') {
          return reply.code(400).send({
            error: `Значение для поля ${key} должно быть true или false`,
            field: key
          });
        }
      }

      // Обновляем настройки в базе данных
      const updateResult = await pool.query(
        `UPDATE users
         SET visibility_settings = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING visibility_settings`,
        [JSON.stringify(visibility_settings), userId]
      );

      if (updateResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ Обновлены настройки видимости для пользователя ${userId}`);

      return reply.send({
        success: true,
        visibility_settings: updateResult.rows[0].visibility_settings
      });

    } catch (err) {
      console.error('[USERS] Ошибка обновления настроек видимости:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/users/search - Обновление настроек поиска
  app.put('/api/users/search', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { search_settings } = req.body;

      // Валидация: проверяем, что search_settings - это объект
      if (!search_settings || typeof search_settings !== 'object') {
        return reply.code(400).send({ error: 'Некорректный формат настроек поиска' });
      }

      // Список допустимых полей для поиска
      const allowedFields = [
        'username', 'full_name', 'phone', 'city', 'country', 'office',
        'personal_id', 'telegram_user', 'instagram_profile'
      ];

      // Валидация: проверяем, что все ключи допустимы и значения boolean
      for (const [key, value] of Object.entries(search_settings)) {
        if (!allowedFields.includes(key)) {
          return reply.code(400).send({
            error: `Недопустимое поле: ${key}`,
            field: key
          });
        }
        if (typeof value !== 'boolean') {
          return reply.code(400).send({
            error: `Значение для поля ${key} должно быть true или false`,
            field: key
          });
        }
      }

      // Обновляем настройки в базе данных
      const updateResult = await pool.query(
        `UPDATE users
         SET search_settings = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING search_settings`,
        [JSON.stringify(search_settings), userId]
      );

      if (updateResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      console.log(`✅ Обновлены настройки поиска для пользователя ${userId}`);

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
