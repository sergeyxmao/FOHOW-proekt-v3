    import { pool } from '../db.js';

    /**
     * Middleware для Fastify для проверки доступа к функции по тарифному плану.
     * @param {string} featureName - Название фичи из JSON-объекта 'features' (например, 'can_export_pdf').
     * @param {*} requiredValue - Ожидаемое значение для доступа (например, true).
     */
    export function checkFeature(featureName, requiredValue = true) {
      return async (req, reply) => {
        console.log('--- [DEBUG] checkFeature ---');
        console.log('Содержимое req.user:', req.user);
        console.log('---------------------------');
        const userId = req.user.userId;

        try {
          // 1. Делаем ОДИН запрос, чтобы получить и план, и срок подписки
          const planResult = await pool.query(
            `SELECT
               sp.features,
               sp.name as plan_name,
               u.subscription_expires_at
             FROM users u
             JOIN subscription_plans sp ON u.plan_id = sp.id
             WHERE u.id = $1`,
            [userId]
          );

          if (planResult.rows.length === 0) {
            return reply.code(403).send({ error: 'Ваш тарифный план не найден.' });
          }

          const plan = planResult.rows[0];
          const features = plan.features;
          const featureValue = features[featureName];

          // 2. Проверяем, не истекла ли подписка
          if (plan.subscription_expires_at && new Date(plan.subscription_expires_at) < new Date()) {
            return reply.code(403).send({
              error: 'Срок вашей подписки истек.',
              code: 'SUBSCRIPTION_EXPIRED',
              upgradeRequired: true
            });
          }

          // 3. Проверяем, соответствует ли значение фичи требуемому
          if (featureValue !== requiredValue) {
            return reply.code(403).send({
              error: `Функция недоступна на вашем тарифе "${plan.plan_name}".`,
              code: 'FEATURE_DISABLED',
              upgradeRequired: true
            });
          }

          // Если все проверки пройдены, пропускаем запрос дальше
          // req.userPlan = plan; // Можно добавить для использования в основном обработчике
          
        } catch (error) {
          console.error('❌ Ошибка в middleware checkFeature:', error);
          return reply.code(500).send({ error: 'Ошибка сервера при проверке доступа.' });
        }
      };
    }
