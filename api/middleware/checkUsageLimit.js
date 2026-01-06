    import { pool } from '../db.js';

    /**
     * Middleware для проверки лимитов использования.
     * @param {'boards' | 'notes' | 'comments' | 'stickers' | 'cards' | 'licenses'} resourceType - Тип ресурса, который мы проверяем.
     * @param {string} limitFeatureName - Название фичи в JSON, где хранится лимит (например, 'max_boards').
     */
    export function checkUsageLimit(resourceType, limitFeatureName) {
      return async (req, reply) => {
        const userId = req.user.id;
        const boardId = req.params.boardId || req.params.id || req.body.boardId;

        try {
          // Администраторы имеют неограниченный доступ
          if (req.user.role === 'admin') {
            return; // Пропускаем проверку лимитов для админов
          }

          // 1. Получаем лимит, дату истечения подписки и grace_period_until
          const planResult = await pool.query(
            `SELECT sp.features->'${limitFeatureName}' as limit, 
                    sp.name as plan_name,
                    u.subscription_expires_at,
                    u.grace_period_until
             FROM users u
             JOIN subscription_plans sp ON u.plan_id = sp.id
             WHERE u.id = $1`,
            [userId]
          );

          if (planResult.rows.length === 0 || planResult.rows[0].limit === null) {
            return reply.code(403).send({
              error: `Не удалось определить лимит "${limitFeatureName}" для вашего тарифа.`,
              code: 'LIMIT_NOT_FOUND'
            });
          }

          const limit = parseInt(planResult.rows[0].limit, 10);
          const planName = planResult.rows[0].plan_name;
          const subscriptionExpiresAt = planResult.rows[0].subscription_expires_at;
          const gracePeriodUntil = planResult.rows[0].grace_period_until;

          // 2. Проверка подписки с учётом grace-периода
          if (subscriptionExpiresAt && new Date(subscriptionExpiresAt) < new Date()) {
            // Подписка истекла — проверяем grace-период
            const now = new Date();
            const graceDate = gracePeriodUntil ? new Date(gracePeriodUntil) : null;

            if (!graceDate || now > graceDate) {
              // Grace-период отсутствует или истёк
              return reply.code(403).send({
                error: 'Срок вашей подписки истек.',
                code: 'SUBSCRIPTION_EXPIRED',
                upgradeRequired: true
              });
            }

            // Grace-период активен — разрешаем доступ, но добавляем метку
            req.user.inGracePeriod = true;
            console.log(`[GRACE] Пользователь ${userId} в grace-периоде до ${graceDate.toISOString()}`);
          }

          // 3. Проверка лимитов (если подписка активна или grace-период действует)
          // -1 или NaN (если поле не найдено) означает безлимит
          if (isNaN(limit) || limit === -1) {
            return; // Пропускаем дальше
          }

          // 4. Считаем текущее количество ресурсов
          let currentUsage = 0;
          let query;

          switch (resourceType) {
            case 'boards':
              query = {
                text: 'SELECT COUNT(*) FROM boards WHERE owner_id = $1',
                values: [userId]
              };
              break;
            case 'notes':
              // Считаем заметки ТОЛЬКО для текущей доски
              query = {
                text: 'SELECT COUNT(*) FROM notes WHERE board_id = $1',
                values: [boardId]
              };
              break;
            case 'comments':
              query = {
                text: 'SELECT COUNT(*) FROM user_comments WHERE user_id = $1',
                values: [userId]
              };
              break;
            case 'stickers':
              query = {
                text: 'SELECT COUNT(*) FROM stickers WHERE board_id = $1',
                values: [boardId]
              };
              break;
            case 'cards':
              // Для карточек проверяем НОВОЕ количество из req.body.content.objects
              // (а не текущее), чтобы не блокировать обновление/удаление карточек
              if (req.body.content && req.body.content.objects) {
                currentUsage = req.body.content.objects.length;
              } else {
                // Если content не передан, считаем что это обновление без изменения карточек
                currentUsage = 0;
              }
              break;
            case 'licenses':
              // Лицензии - это карточки типа "Малая" (small), "Большая" (large), "Gold" (gold)
              // Считаем количество таких карточек во всех досках пользователя
              query = {
                text: `
                  SELECT COUNT(*)
                  FROM boards b,
                       jsonb_array_elements(COALESCE(b.content->'objects', '[]'::jsonb)) obj
                  WHERE b.owner_id = $1
                    AND obj->>'type' IN ('small', 'large', 'gold')
                `,
                values: [userId]
              };
              break;
            default:
              return reply.code(500).send({ error: 'Неизвестный тип ресурса' });
          }

          if (query) {
            const countResult = await pool.query(query);
            currentUsage = parseInt(countResult.rows[0].count, 10);
          }

          // 5. Сравниваем лимит и текущее использование
          if (currentUsage >= limit) {
            // Специальное подробное сообщение для заметок
            if (resourceType === 'notes') {
              return reply.code(403).send({
                error: `Достигнут лимит заметок для этой доски (${currentUsage}/${limit}). Удалите старые заметки или обновите тариф.`,
                code: 'USAGE_LIMIT_REACHED',
                upgradeRequired: true,
                resourceType: 'notes',
                limit: limit,
                current: currentUsage
              });
            }

            // Общее сообщение для других ресурсов
            return reply.code(403).send({
              error: `Достигнут лимит (${limit}) для ресурса "${resourceType}" на вашем тарифе "${planName}".`,
              code: 'USAGE_LIMIT_REACHED',
              upgradeRequired: true
            });
          }

        } catch (error) {
          console.error(`❌ Ошибка в middleware checkUsageLimit для ${resourceType}:`, error);
          return reply.code(500).send({ error: 'Ошибка сервера при проверке лимитов.' });
        }
      };
    }
