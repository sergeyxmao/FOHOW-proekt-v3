/**
 * Маршруты профиля пользователя
 * - GET /api/profile - Получить профиль
 * - PUT /api/profile - Обновить профиль
 * - PUT /api/profile/privacy - Обновить настройки конфиденциальности
 * - DELETE /api/profile - Удалить аккаунт
 * - POST /api/profile/avatar - Загрузить аватар
 * - DELETE /api/profile/avatar - Удалить аватар
 * - GET /api/users/search-by-personal-id/:personalId - Поиск пользователя
 * - GET /api/users/by-personal-id/:personalId - Проверка компьютерного номера
 */

import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateOffice, validatePersonalId } from './auth.js';
import { sendTelegramMessage } from '../utils/telegramService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Регистрация маршрутов профиля
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerProfileRoutes(app) {

  // === ПОЛУЧИТЬ ПРОФИЛЬ ===
  app.get('/api/profile', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.email, u.username, u.avatar_url, u.created_at, u.updated_at,
                u.country, u.city, u.office, u.personal_id, u.phone, u.full_name,
                u.telegram_user, u.telegram_channel, u.vk_profile, u.ok_profile,
                u.instagram_profile, u.whatsapp_contact, u.website,
                u.visibility_settings, u.search_settings, u.ui_preferences,
                u.subscription_started_at, u.subscription_expires_at, u.grace_period_until,
                u.is_verified, u.verified_at,
                sp.id as plan_id, sp.name as plan_name, sp.features
         FROM users u
         LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const userData = result.rows[0];

      const user = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        avatar_url: userData.avatar_url,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        country: userData.country,
        city: userData.city,
        office: userData.office,
        personal_id: userData.personal_id,
        phone: userData.phone,
        full_name: userData.full_name,
        telegram_user: userData.telegram_user,
        telegram_channel: userData.telegram_channel,
        vk_profile: userData.vk_profile,
        ok_profile: userData.ok_profile,
        instagram_profile: userData.instagram_profile,
        whatsapp_contact: userData.whatsapp_contact,
        website: userData.website,
        visibility_settings: userData.visibility_settings,
        search_settings: userData.search_settings,
        ui_preferences: userData.ui_preferences,
        subscription_started_at: userData.subscription_started_at,
        subscription_expires_at: userData.subscription_expires_at,
        grace_period_until: userData.grace_period_until,
        is_verified: userData.is_verified || false,
        verified_at: userData.verified_at || null,
        plan: userData.plan_id ? {
          id: userData.plan_id,
          name: userData.plan_name,
          features: userData.features
        } : null
      };

      return reply.send({ user });
    } catch (err) {
      console.error('❌ Ошибка получения профиля:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ОБНОВЛЕНИЕ ПРОФИЛЯ ===
  app.put('/api/profile', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      const {
        username, email, currentPassword, newPassword,
        country, city, office, personal_id, phone, full_name,
        telegram_user, telegram_channel, vk_profile, ok_profile,
        instagram_profile, whatsapp_contact, website,
        ui_preferences
      } = req.body;

      const normalizedOffice = typeof office === 'string' ? office.trim().toUpperCase() : null;
      const normalizedPersonalId = typeof personal_id === 'string' ? personal_id.trim().toUpperCase() : null;

      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }
      const user = userResult.rows[0];
      const existingUiPreferences = user.ui_preferences || {};
      const currentOffice = user.office ? user.office.toUpperCase() : '';
      const currentPersonalId = user.personal_id ? user.personal_id.toUpperCase() : null;

      // Обработка ui_preferences
      const allowedUiPreferenceFields = [
        'animationColor',
        'isAnimationEnabled',
        'lineColor',
        'lineThickness',
        'backgroundGradient'
      ];
      let normalizedUiPreferences = null;

      if (ui_preferences && typeof ui_preferences === 'object') {
        normalizedUiPreferences = { ...existingUiPreferences };

        for (const key of allowedUiPreferenceFields) {
          if (!Object.prototype.hasOwnProperty.call(ui_preferences, key)) {
            continue;
          }

          if (key === 'animationColor' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
            normalizedUiPreferences[key] = ui_preferences[key];
          }

          if (key === 'isAnimationEnabled' && typeof ui_preferences[key] === 'boolean') {
            normalizedUiPreferences[key] = ui_preferences[key];
          }

          if (key === 'lineColor' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
            normalizedUiPreferences[key] = ui_preferences[key];
          }

          if (key === 'lineThickness') {
            const numericValue = Number(ui_preferences[key]);
            if (Number.isFinite(numericValue)) {
              const clamped = Math.min(Math.max(Math.round(numericValue), 1), 20);
              normalizedUiPreferences[key] = clamped;
            }
          }

          if (key === 'backgroundGradient' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
            normalizedUiPreferences[key] = ui_preferences[key];
          }
        }

        const hasUpdates = Object.keys(normalizedUiPreferences).length > 0;
        if (!hasUpdates) {
          normalizedUiPreferences = null;
        }
      }

      const targetOffice = normalizedOffice ?? currentOffice;
      const targetPersonalId = normalizedPersonalId ?? currentPersonalId;

      // Валидация office
      if (normalizedOffice !== null && normalizedOffice !== '' && !validateOffice(normalizedOffice)) {
        return reply.code(400).send({
          error: 'Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)',
          field: 'office'
        });
      }

      // Проверки уникальности email и username
      if (email && email !== user.email) {
        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
        if (emailCheck.rows.length > 0) return reply.code(409).send({ error: 'Этот email уже используется' });
      }
      if (username && username !== user.username) {
        const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
        if (usernameCheck.rows.length > 0) return reply.code(409).send({ error: 'Это имя пользователя уже занято' });
      }

      // Валидация personal_id
      if (targetPersonalId) {
        if (!validatePersonalId(targetPersonalId, targetOffice)) {
          return reply.code(400).send({
            error: 'Компьютерный номер должен начинаться с представительства и содержать 9 цифр (например: RUY68000000000)',
            field: 'personal_id'
          });
        }
      }

      // Проверяем изменение критических полей
      const personalIdChanged = normalizedPersonalId && normalizedPersonalId !== currentPersonalId;
      const officeChanged = normalizedOffice && normalizedOffice !== currentOffice;
      let verificationRevoked = false;

      // Если пользователь верифицирован и изменяются критические поля - снимаем верификацию
      if (user.is_verified && (personalIdChanged || officeChanged)) {
        await pool.query(
          'UPDATE users SET is_verified = FALSE, verified_at = NULL WHERE id = $1',
          [userId]
        );
        verificationRevoked = true;
        console.log(`⚠️ Верификация отменена для пользователя ${userId}`);

        // Отправить Telegram-уведомление
        if (user.telegram_chat_id) {
          try {
            const message = '⚠️ Ваш статус верификации был снят из-за изменения компьютерного номера или представительства.';
            await sendTelegramMessage(user.telegram_chat_id, message);
          } catch (telegramError) {
            console.error('[PROFILE] Ошибка отправки Telegram-уведомления:', telegramError.message);
          }
        }
      }

      if (personalIdChanged) {
        // Проверяем уникальность
        const personalIdCheck = await pool.query(
          'SELECT id FROM users WHERE personal_id = $1 AND id != $2',
          [normalizedPersonalId, userId]
        );
        if (personalIdCheck.rows.length > 0) {
          return reply.code(400).send({
            error: 'Этот компьютерный номер уже используется другим пользователем',
            field: 'personal_id'
          });
        }

        console.log(`✅ Пользователь ${userId} изменил personal_id на: ${normalizedPersonalId}`);
      }

      // Логика смены пароля
      let passwordHash = user.password;
      if (newPassword && newPassword.trim().length > 0) {
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) return reply.code(400).send({ error: 'Неверный текущий пароль' });
        passwordHash = await bcrypt.hash(newPassword, 10);
      }

      const queryText = `UPDATE users SET
           username = COALESCE($1, username), email = COALESCE($2, email), password = $3,
           country = COALESCE($4, country), city = COALESCE($5, city), office = COALESCE($6, office),
           personal_id = COALESCE($7, personal_id), phone = COALESCE($8, phone), full_name = COALESCE($9, full_name),
           telegram_user = COALESCE($10, telegram_user), telegram_channel = COALESCE($11, telegram_channel),
           vk_profile = COALESCE($12, vk_profile), ok_profile = COALESCE($13, ok_profile),
           instagram_profile = COALESCE($14, instagram_profile), whatsapp_contact = COALESCE($15, whatsapp_contact),
           ui_preferences = COALESCE($16, ui_preferences),
           website = COALESCE($17, website),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $18
         RETURNING *`;

      const queryParams = [
        username || null, email || null, passwordHash,
        country || null, city || null, normalizedOffice || null, normalizedPersonalId || null, phone || null, full_name || null,
        telegram_user || null, telegram_channel || null, vk_profile || null, ok_profile || null,
        instagram_profile || null, whatsapp_contact || null,
        normalizedUiPreferences ? JSON.stringify(normalizedUiPreferences) : null,
        website || null,
        userId
      ];

      const updateResult = await pool.query(queryText, queryParams);

      return reply.send({
        success: true,
        user: updateResult.rows[0],
        verificationRevoked: verificationRevoked
      });

    } catch (err) {
      console.error('❌ Ошибка обновления профиля:', err);
      return reply.code(500).send({ error: 'Ошибка сервера', details: err.message });
    }
  });

  // === ОБНОВЛЕНИЕ НАСТРОЕК КОНФИДЕНЦИАЛЬНОСТИ ===
  app.put('/api/profile/privacy', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const { search_settings } = req.body;

      if (!search_settings || typeof search_settings !== 'object') {
        return reply.code(400).send({ error: 'Некорректный формат настроек конфиденциальности' });
      }

      const allowedFields = [
        'username', 'full_name', 'phone', 'city', 'country', 'office',
        'personal_id', 'telegram_user', 'instagram_profile', 'vk_profile', 'website'
      ];

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

      console.log(`✅ Обновлены настройки конфиденциальности для пользователя ${userId}`);

      return reply.send({
        success: true,
        search_settings: updateResult.rows[0].search_settings
      });

    } catch (err) {
      console.error('❌ Ошибка обновления настроек конфиденциальности:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === УДАЛЕНИЕ АККАУНТА ===
  app.delete('/api/profile', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { password } = req.body;

      if (!password) {
        return reply.code(400).send({ error: 'Введите пароль для подтверждения' });
      }

      const userResult = await pool.query(
        'SELECT password FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const validPassword = await bcrypt.compare(password, userResult.rows[0].password);
      if (!validPassword) {
        return reply.code(400).send({ error: 'Неверный пароль' });
      }

      await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

      return reply.send({ success: true, message: 'Аккаунт удалён' });
    } catch (err) {
      console.error('❌ Ошибка delete-profile:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ЗАГРУЗКА АВАТАРА ===
  app.post('/api/profile/avatar', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const data = await req.file();

      if (!data) {
        return reply.code(400).send({ error: 'Файл не предоставлен' });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Разрешены только изображения (JPEG, PNG, GIF, WEBP)' });
      }

      const ext = path.extname(data.filename);
      const filename = `${req.user.id}-${randomBytes(8).toString('hex')}${ext}`;
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
      const filepath = path.join(uploadsDir, filename);

      await pipeline(data.file, createWriteStream(filepath));

      const avatarUrl = `/uploads/avatars/${filename}`;
      await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2',
        [avatarUrl, req.user.id]
      );

      return reply.send({
        success: true,
        avatarUrl
      });
    } catch (err) {
      console.error('❌ Ошибка загрузки аватара:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === УДАЛЕНИЕ АВАТАРА ===
  app.delete('/api/profile/avatar', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      await pool.query(
        'UPDATE users SET avatar_url = NULL WHERE id = $1',
        [req.user.id]
      );

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Ошибка удаления аватара:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПОИСК ПОЛЬЗОВАТЕЛЯ ПО КОМПЬЮТЕРНОМУ НОМЕРУ ===
  app.get('/api/users/search-by-personal-id/:personalId', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { personalId } = req.params;

      if (!personalId || !personalId.trim()) {
        return reply.send({ found: false });
      }

      const normalizedPersonalId = personalId.trim().toUpperCase();

      const result = await pool.query(
        `SELECT
          u.id,
          u.avatar_url,
          u.username,
          u.full_name
         FROM users u
         WHERE u.personal_id = $1
           AND u.is_verified = true
           AND (u.search_settings->>'personal_id')::boolean = true
         LIMIT 1`,
        [normalizedPersonalId]
      );

      if (result.rows.length === 0) {
        return reply.send({ found: false });
      }

      const user = result.rows[0];

      return reply.send({
        found: true,
        user: {
          id: user.id,
          avatar_url: user.avatar_url,
          username: user.username,
          full_name: user.full_name
        }
      });

    } catch (err) {
      console.error('❌ Ошибка поиска пользователя по personal_id:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПРОВЕРКА КОМПЬЮТЕРНОГО НОМЕРА ДЛЯ АВАТАРА ===
  app.get('/api/users/by-personal-id/:personalId', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { personalId } = req.params;

      if (!personalId || !personalId.trim()) {
        return reply.send({ success: false, error: 'NOT_FOUND' });
      }

      const normalizedPersonalId = personalId.trim().toUpperCase();

      const result = await pool.query(
        `SELECT
          id,
          username,
          avatar_url,
          is_verified,
          search_settings
         FROM users
         WHERE personal_id = $1
         LIMIT 1`,
        [normalizedPersonalId]
      );

      if (result.rows.length === 0) {
        return reply.send({ success: false, error: 'NOT_FOUND' });
      }

      const user = result.rows[0];

      if (!user.is_verified) {
        return reply.send({ success: false, error: 'NOT_VERIFIED' });
      }

      const searchSettings = user.search_settings || {};
      if (searchSettings.personal_id === false) {
        return reply.send({ success: false, error: 'SEARCH_DISABLED' });
      }

      return reply.send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatar_url
        }
      });

    } catch (err) {
      console.error('❌ Ошибка проверки компьютерного номера:', err);
      return reply.code(500).send({ success: false, error: 'SERVER_ERROR' });
    }
  });
}
