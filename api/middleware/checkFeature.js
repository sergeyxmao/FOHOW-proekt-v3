    import { pool } from '../db.js';

    export function checkFeature(featureName, requiredValue = true) {
      return async (req, reply) => {
        const userId = req.user.id; // ИСПРАВЛЕНО

        if (!userId) {
          return reply.code(401).send({ error: 'Не удалось определить пользователя из токена.' });
        }

        try {
          // Администраторы имеют доступ ко всем функциям
          if (req.user.role === 'admin') {
            return; // Пропускаем проверку функций для админов
          }

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

          if (plan.subscription_expires_at && new Date(plan.subscription_expires_at) < new Date()) {
            return reply.code(403).send({
              error: 'Срок вашей подписки истек.',
              code: 'SUBSCRIPTION_EXPIRED',
              upgradeRequired: true
            });
          }

          if (featureValue !== requiredValue) {
            return reply.code(403).send({
              error: `Функция недоступна на вашем тарифе "${plan.plan_name}".`,
              code: 'FEATURE_DISABLED',
              upgradeRequired: true
            });
          }

        } catch (error) {
          console.error('❌ Ошибка в middleware checkFeature:', error);
          return reply.code(500).send({ error: 'Ошибка сервера при проверке доступа.' });
        }
      };
    }
