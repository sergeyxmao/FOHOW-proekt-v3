import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация роутов для работы с партнёрами на досках
 * @param {FastifyInstance} app - экземпляр Fastify
 */
export function registerBoardPartnerRoutes(app) {
  // Партнёры с досок с Аватарами
  app.get('/api/boards/:boardId/avatar-partners', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { boardId } = req.params;
      const { search } = req.query;

      const boardCheck = await pool.query(
        'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
        [boardId, req.user.id]
      );

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Board not found' });
      }

      const board = boardCheck.rows[0];
      const content = board.content || {};
      const cardsArray = content?.cards || content?.objects || [];

      const avatarCards = cardsArray.filter(
        (card) => card.type === 'avatar' && card.userId !== null
      );

      if (avatarCards.length === 0) {
        return reply.send({ success: true, partners: [] });
      }

      const avatarsByUserId = avatarCards.reduce((acc, avatar) => {
        const userId = Number(avatar.userId);

        if (!Number.isFinite(userId)) {
          return acc;
        }

        if (!acc.has(userId)) {
          acc.set(userId, []);
        }

        acc.get(userId).push(avatar);
        return acc;
      }, new Map());

      const uniqueUserIds = [...avatarsByUserId.keys()];

      if (uniqueUserIds.length === 0) {
        return reply.send({ success: true, partners: [] });
      }

      const usersResult = await pool.query(
        `SELECT
           id,
           username,
           full_name,
           avatar_url,
           personal_id,
           phone,
           city,
           country,
           office,
           telegram_user,
           instagram_profile,
           vk_profile,
           website,
           search_settings,
           visibility_settings,
           is_verified
         FROM users
         WHERE id = ANY($1)`,
        [uniqueUserIds]
      );

      const isEnabled = (settings, key) => {
        if (!settings || typeof settings !== 'object') return true;
        const value = settings[key];
        return value === true || value === 'true' || value === 1 || value === undefined;
      };

      const isSearchable = (settings, key) => {
        if (!settings || typeof settings !== 'object') return false;
        const value = settings[key];
        return value === true || value === 'true' || value === 1;
      };

      const normalize = (value) => (value ?? '').toString().toLowerCase();
      const searchTerm = normalize(search).trim();

      const partners = [];

      usersResult.rows.forEach((userRow) => {
        const relatedAvatars = avatarsByUserId.get(userRow.id) || [];

        // Пропускаем неверифицированных пользователей
        if (!userRow.is_verified) {
          return;
        }

        relatedAvatars.forEach((avatar) => {
          const visibility = userRow.visibility_settings || {};
          const searchSettings = userRow.search_settings || {};

          const partner = {
            id: userRow.id,
            avatarObjectId: avatar.id,
            userId: userRow.id,
            username: isEnabled(visibility, 'username') ? userRow.username : null,
            full_name: isEnabled(visibility, 'full_name') ? userRow.full_name : null,
            avatar_url: isEnabled(visibility, 'avatar_url') ? (userRow.avatar_url?.split('|')[0] || userRow.avatar_url) : '/Avatar.png',
            personal_id: isEnabled(visibility, 'personal_id') ? userRow.personal_id : null,
            phone: isEnabled(visibility, 'phone') ? userRow.phone : null,
            city: isEnabled(visibility, 'city') ? userRow.city : null,
            country: isEnabled(visibility, 'country') ? userRow.country : null,
            office: isEnabled(visibility, 'office') ? userRow.office : null,
            telegram_user: isEnabled(visibility, 'telegram_user') ? userRow.telegram_user : null,
            instagram_profile: isEnabled(visibility, 'instagram_profile') ? userRow.instagram_profile : null,
            vk_profile: isEnabled(visibility, 'showVK') ? userRow.vk_profile : null,
            website: isEnabled(visibility, 'showWebsite') ? userRow.website : null,
            search_settings: searchSettings,
            x: avatar.x,
            y: avatar.y,
            diameter: avatar.diameter
          };

          if (searchTerm) {
            const searchableFields = [];

            if (isSearchable(searchSettings, 'username')) searchableFields.push(userRow.username);
            if (isSearchable(searchSettings, 'full_name')) searchableFields.push(userRow.full_name);
            if (isSearchable(searchSettings, 'phone')) searchableFields.push(userRow.phone);
            if (isSearchable(searchSettings, 'city')) searchableFields.push(userRow.city);
            if (isSearchable(searchSettings, 'country')) searchableFields.push(userRow.country);
            if (isSearchable(searchSettings, 'office')) searchableFields.push(userRow.office);
            if (isSearchable(searchSettings, 'personal_id')) searchableFields.push(userRow.personal_id);
            if (isSearchable(searchSettings, 'telegram_user')) searchableFields.push(userRow.telegram_user);
            if (isSearchable(searchSettings, 'instagram_profile')) searchableFields.push(userRow.instagram_profile);

            const matches = searchableFields
              .filter(Boolean)
              .some((field) => normalize(field).includes(searchTerm));

            if (!matches) {
              return;
            }
          }

          delete partner.search_settings;
          partners.push(partner);
        });
      });

      return reply.send({ success: true, partners });
    } catch (err) {
      console.error('❌ Ошибка получения партнёров для аватаров:', err);
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Получить список партнёров для доски
  app.get('/api/boards/:boardId/partners', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const { boardId } = req.params;
      const { search } = req.query;

      // Проверяем, что доска существует и принадлежит текущему пользователю
      const boardCheck = await pool.query(
        'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
        [boardId, req.user.id]
      );

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Board not found' });
      }

      const board = boardCheck.rows[0];
      const content = board.content || {};
      const cardsArray = content?.cards || content?.objects || []
      const normalizePersonalId = (value) =>
        (value ?? '')
          .toString()
          .replace(/\s+/g, '')
          .toUpperCase();
      // Фильтруем карточки типа large и gold
      const largeAndGoldCards = cardsArray.filter(
        (card) => card.type === 'large' || card.type === 'gold'
      );

      // Извлекаем номера лицензий (personal_id) из card.text
      const personalIds = largeAndGoldCards
        .map((card) => normalizePersonalId(card.text))
        .filter((text) => text && text !== 'RUY68123456789'); // Исключаем дефолтный номер
      // Получаем уникальные personal_id
      const uniquePersonalIds = [...new Set(personalIds)];

      // Если нет партнёров, возвращаем пустой массив
      if (uniquePersonalIds.length === 0) {
        return reply.send({ success: true, partners: [] });
      }

      // Формируем SQL-запрос с учётом поиска
      let query;
      let params;

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = `
          SELECT
            u.id,
            u.username,
            u.personal_id,
            u.avatar_url,
            u.plan_id,
            u.search_settings,
            CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
            CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
            CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
            CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
            CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
            CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
            CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile,
            CASE WHEN u.search_settings->>'vk_profile' = 'true' THEN u.vk_profile ELSE NULL END as vk_profile,
            CASE WHEN u.search_settings->>'website' = 'true' THEN u.website ELSE NULL END as website
          FROM users u
          WHERE u.personal_id = ANY($1)
            AND u.is_verified = true
            AND u.plan_id IN (6, 7)
            AND (
              (u.search_settings->>'username' = 'true' AND LOWER(u.username) LIKE LOWER($2)) OR
              (u.search_settings->>'full_name' = 'true' AND LOWER(u.full_name) LIKE LOWER($2)) OR
              (u.search_settings->>'phone' = 'true' AND u.phone LIKE $2) OR
              (u.search_settings->>'city' = 'true' AND LOWER(u.city) LIKE LOWER($2)) OR
              (u.search_settings->>'country' = 'true' AND LOWER(u.country) LIKE LOWER($2)) OR
              (u.search_settings->>'office' = 'true' AND LOWER(u.office) LIKE LOWER($2)) OR
              (u.search_settings->>'personal_id' = 'true' AND u.personal_id LIKE $2) OR
              (u.search_settings->>'telegram_user' = 'true' AND LOWER(u.telegram_user) LIKE LOWER($2)) OR
              (u.search_settings->>'instagram_profile' = 'true' AND LOWER(u.instagram_profile) LIKE LOWER($2)) OR
              (u.search_settings->>'vk_profile' = 'true' AND LOWER(u.vk_profile) LIKE LOWER($2)) OR
              (u.search_settings->>'website' = 'true' AND LOWER(u.website) LIKE LOWER($2))
            )
          ORDER BY u.username ASC
        `;
        params = [uniquePersonalIds, searchTerm];
      } else {
        query = `
          SELECT
            u.id,
            u.username,
            u.personal_id,
            u.avatar_url,
            u.plan_id,
            u.search_settings,
            CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
            CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
            CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
            CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
            CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
            CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
            CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile,
            CASE WHEN u.search_settings->>'vk_profile' = 'true' THEN u.vk_profile ELSE NULL END as vk_profile,
            CASE WHEN u.search_settings->>'website' = 'true' THEN u.website ELSE NULL END as website
          FROM users u
          WHERE u.personal_id = ANY($1)
            AND u.is_verified = true
            AND u.plan_id IN (6, 7)
          ORDER BY u.username ASC
        `;
        params = [uniquePersonalIds];
      }

      const result = await pool.query(query, params);
      const foundPersonalIds = result.rows.map((row) => normalizePersonalId(row.personal_id));
      const missingPersonalIds = uniquePersonalIds.filter(
        (personalId) => !foundPersonalIds.includes(personalId)
      );

      if (missingPersonalIds.length > 0) {
        req.log.warn(
          {
            boardId,
            missingPersonalIds
          },
          'На доске указаны personal_id без подходящих верифицированных партнёров'
        );
      }

      // Извлекаем только публичную часть avatar_url
      const partners = result.rows.map(row => ({
        ...row,
        avatar_url: row.avatar_url?.split('|')[0] || row.avatar_url
      }));

      return reply.send({
        success: true,
        partners
      });

    } catch (err) {
      console.error('❌ Ошибка получения партнёров:', err);
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
