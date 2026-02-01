    import { pool } from '../db.js';

    export function checkFeature(featureName, requiredValue = true) {
      return async (req, reply) => {
        const userId = req.user.id;

        if (!userId) {
          return reply.code(401).send({ error: 'Не удалось определить пользователя из токена.' });
        }

        try {
          // Администраторы имеют доступ ко всем функциям
          if (req.user.role === 'admin') {
            return; // Пропускаем проверку функций для админов
          }

          // Используем SQL для проверки истечения подписки и grace-периода, чтобы избежать проблем с timezone
          const planResult = await pool.query(
            `SELECT
               sp.features,
               sp.name as plan_name,
               u.subscription_expires_at,
               u.grace_period_until,
               CASE
                 WHEN u.subscription_expires_at IS NOT NULL THEN
                   u.subscription_expires_at < NOW()
                 ELSE FALSE
               END as subscription_expired,
               CASE
                 WHEN u.grace_period_until IS NOT NULL THEN
                   u.grace_period_until < NOW()
                 ELSE TRUE
               END as grace_period_expired
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

          // Проверка подписки с учётом grace-периода (результат вычислен в SQL)
          if (plan.subscription_expired) {
            // Подписка истекла — проверяем grace-период
            if (plan.grace_period_expired) {
              // Grace-период отсутствует или тоже истёк
              return reply.code(403).send({
                error: 'Срок вашей подписки истек.',
                code: 'SUBSCRIPTION_EXPIRED',
                upgradeRequired: true
              });
            }

            // Grace-период активен — разрешаем доступ, но добавляем метку
            req.user.inGracePeriod = true;
            const gracePeriodUntil = plan.grace_period_until ? new Date(plan.grace_period_until) : null;
            console.log(`[GRACE] Пользователь ${userId} в grace-периоде до ${gracePeriodUntil?.toISOString()}`);
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
