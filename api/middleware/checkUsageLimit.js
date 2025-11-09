    import { pool } from '../db.js';

    /**
     * Middleware для проверки лимитов использования.
     * @param {'boards' | 'notes' | 'comments' | 'stickers' | 'cards'} resourceType - Тип ресурса, который мы проверяем.
     * @param {string} limitFeatureName - Название фичи в JSON, где хранится лимит (например, 'max_boards').
     */
    export function checkUsageLimit(resourceType, limitFeatureName) {
      return async (req, reply) => {
        const userId = req.user.id;
        const boardId = req.params.boardId || req.body.boardId;

        try {
          // 1. Получаем лимит из тарифного плана пользователя
          const planResult = await pool.query(
            `SELECT sp.features->>'${limitFeatureName}' as limit, sp.name as plan_name
             FROM users u
             JOIN subscription_plans sp ON u.plan_id = sp.id
             WHERE u.id = $1`,
            [userId]
          );

          if (planResult.rows.length === 0) {
            return reply.code(403).send({ error: 'Тариф не найден' });
          }

          const limit = parseInt(planResult.rows[0].limit, 10);
          const planName = planResult.rows[0].plan_name;

          // -1 или NaN (если поле не найдено) означает безлимит
          if (isNaN(limit) || limit === -1) {
            return; // Пропускаем дальше
          }

          // 2. Считаем текущее количество ресурсов
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
              // Это сложнее, так как карточки в JSON.
              // Для простоты пока предположим, что у нас есть поле object_count в `boards`.
              const board = await pool.query('SELECT object_count FROM boards WHERE id = $1', [boardId]);
              currentUsage = board.rows[0]?.object_count || 0;
              break;
            default:
              return reply.code(500).send({ error: 'Неизвестный тип ресурса' });
          }
          
          if (query) {
            const countResult = await pool.query(query);
            currentUsage = parseInt(countResult.rows[0].count, 10);
          }

          // 3. Сравниваем лимит и текущее использование
          if (currentUsage >= limit) {
            return reply.code(403).send({
              error: `Достигнут лимит (${limit}) для ресурса "${resourceType}" на вашем тарифе "${planName}".`, // <--- УЛУЧШЕНО
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
