// api/routes/users.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export async function registerUserRoutes(app) {

  // GET /api/users/me - ЭТОГО НЕ ХВАТАЛО ДЛЯ СИНХРОНИЗАЦИИ
  app.get('/api/users/me', {
    schema: {
      tags: ['Users'],
      summary: 'Получить данные текущего пользователя',
      description: 'Возвращает полные данные авторизованного пользователя для синхронизации состояния на клиенте.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' }
          }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const result = await pool.query(`
        SELECT id, email, username, avatar_url, country, city, office, personal_id,
               phone, full_name, telegram_user, telegram_channel, vk_profile, ok_profile,
               instagram_profile, whatsapp_contact, visibility_settings, search_settings,
               subscription_expires_at, subscription_started_at, is_trial_used, payment_method,
               auto_renew, plan_id, telegram_chat_id, role, boards_locked, boards_locked_at,
               email_verified, is_verified, verified_at, ui_preferences, rank, fohow_role,
               blocked_users, bio, website, grace_period_until, created_at, updated_at
        FROM users WHERE id = $1
      `, [req.user.id]);

      if (result.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
      return reply.send({ success: true, user: result.rows[0] });
    } catch (err) {
      return reply.code(500).send({ error: 'Server error' });
    }
  });

  // POST /api/users/block - Заблокировать пользователя
  app.post('/api/users/block', {
    schema: {
      tags: ['Users'],
      summary: 'Заблокировать пользователя',
      description: 'Добавляет пользователя в список заблокированных (JSONB массив blocked_users).',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'integer', description: 'ID пользователя для блокировки' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            blocked_users: { type: 'array', items: { type: 'integer' } }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
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
    schema: {
      tags: ['Users'],
      summary: 'Разблокировать пользователя',
      description: 'Удаляет пользователя из списка заблокированных.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID пользователя для разблокировки' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
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
    schema: {
      tags: ['Users'],
      summary: 'Обновить настройки видимости',
      description: 'Обновляет JSONB visibility_settings. Допустимые поля: showPhone, showEmail, showTelegram, showVK, showInstagram, showWhatsApp, allowCrossLineMessages.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          showPhone: { type: 'boolean' },
          showEmail: { type: 'boolean' },
          showTelegram: { type: 'boolean' },
          showVK: { type: 'boolean' },
          showInstagram: { type: 'boolean' },
          showWhatsApp: { type: 'boolean' },
          allowCrossLineMessages: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            visibility_settings: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const settings = req.body; 

      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return reply.code(400).send({ error: 'Ожидается JSON объект настроек' });
      }

      const allowedFields = [
        'showPhone', 'showEmail', 'showTelegram', 'showVK', 
        'showInstagram', 'showWhatsApp', 'allowCrossLineMessages'
      ];

      for (const key of Object.keys(settings)) {
        if (!allowedFields.includes(key)) delete settings[key];
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET visibility_settings = COALESCE(visibility_settings, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING visibility_settings`,
        [JSON.stringify(settings), userId]
      );

      if (updateResult.rows.length === 0) return reply.code(404).send({ error: 'Пользователь не найден' });

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
    schema: {
      tags: ['Users'],
      summary: 'Обновить настройки поиска',
      description: 'Обновляет JSONB search_settings. Допустимые поля: searchByName, searchByCity, searchByCountry, searchByPersonalId, searchByOffice.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          searchByName: { type: 'boolean' },
          searchByCity: { type: 'boolean' },
          searchByCountry: { type: 'boolean' },
          searchByPersonalId: { type: 'boolean' },
          searchByOffice: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            search_settings: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const settings = req.body; 

      if (!settings || typeof settings !== 'object') {
        return reply.code(400).send({ error: 'Некорректный формат настроек' });
      }

      const allowedFields = [
        'searchByName', 'searchByCity', 'searchByCountry', 
        'searchByPersonalId', 'searchByOffice'
      ];

      for (const key of Object.keys(settings)) {
         if (!allowedFields.includes(key)) delete settings[key];
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET search_settings = COALESCE(search_settings, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING search_settings`,
        [JSON.stringify(settings), userId]
      );

      if (updateResult.rows.length === 0) return reply.code(404).send({ error: 'Пользователь не найден' });

      return reply.send({
        success: true,
        search_settings: updateResult.rows[0].search_settings
      });

    } catch (err) {
      console.error('[USERS] Ошибка обновления search settings:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // PUT /api/users/profile - Обновление данных профиля
  app.put('/api/users/profile', {
    schema: {
      tags: ['Users'],
      summary: 'Обновить данные профиля (FoGrup)',
      description: 'Обновляет контактные и личные данные пользователя. Обновляются только переданные поля.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          country: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          office: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          telegram_user: { type: 'string', nullable: true },
          whatsapp_contact: { type: 'string', nullable: true },
          vk_profile: { type: 'string', nullable: true },
          instagram_profile: { type: 'string', nullable: true },
          ok_profile: { type: 'string', nullable: true },
          telegram_channel: { type: 'string', nullable: true },
          website: { type: 'string', nullable: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const {
        full_name, city, country, phone, office, bio,
        telegram_user, whatsapp_contact, vk_profile,
        instagram_profile, ok_profile, telegram_channel, website
      } = req.body;
      
      const fields = [];
      const values = [];
      let paramIndex = 1;

      const addField = (key, value) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      };

      addField('full_name', full_name);
      addField('city', city);
      addField('country', country);
      addField('phone', phone);
      addField('office', office);
      addField('bio', bio);
      addField('telegram_user', telegram_user);
      addField('whatsapp_contact', whatsapp_contact);
      addField('vk_profile', vk_profile);
      addField('instagram_profile', instagram_profile);
      addField('ok_profile', ok_profile);
      addField('telegram_channel', telegram_channel);
      addField('website', website);

      if (fields.length === 0) return reply.code(400).send({ error: 'Нет данных для обновления' });

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, full_name, email, city, country, phone, office, bio,
                  telegram_user, whatsapp_contact, vk_profile, instagram_profile,
                  ok_profile, telegram_channel, avatar_url, website
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) return reply.code(404).send({ error: 'Пользователь не найден' });

      // Извлекаем публичную часть avatar_url с версионированием
      const user = {
        ...result.rows[0],
        avatar_url: getAvatarUrl(result.rows[0].id, result.rows[0].avatar_url)
      };

      return reply.send({ success: true, user });

    } catch (err) {
      console.error('[USERS] Ошибка обновления профиля:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
