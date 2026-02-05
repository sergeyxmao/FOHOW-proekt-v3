import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import boardLockService from '../services/boardLockService.js';
import { sendSubscriptionEmail } from '../utils/emailService.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import { getPromoCodeAppliedMessage } from '../templates/telegramTemplates.js';

/**
 * Регистрация маршрутов для работы с промокодами
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerPromoRoutes(app) {
  /**
   * POST /api/promo/apply - Применить промокод
   *
   * Эндпоинт для активации промокода и обновления подписки пользователя.
   * Вся логика выполняется в транзакции PostgreSQL для обеспечения целостности данных.
   */
  app.post('/api/promo/apply', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const client = await pool.connect();

    try {
      const { code } = req.body;
      const userId = req.user.id;

      // Валидация входных данных
      if (!code || typeof code !== 'string' || code.trim() === '') {
        return reply.code(400).send({
          error: 'Промокод обязателен'
        });
      }

      const promoCode = code.trim();

      // ============================================
      // НАЧАЛО ТРАНЗАКЦИИ
      // ============================================
      await client.query('BEGIN');

      try {
        // ============================================
        // 1. Поиск промокода с блокировкой строки
        // Проверяем срок действия в SQL для корректной работы с timezone
        // ============================================
        const promoResult = await client.query(
          `SELECT *,
             NOW() < start_date as not_started,
             NOW() > end_date as already_ended
           FROM promo_codes
           WHERE code = $1
           FOR UPDATE`,
          [promoCode]
        );

        // ============================================
        // 2. ПРОВЕРКИ
        // ============================================

        // Проверка 1: Промокод существует
        if (promoResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({
            error: 'Промокод не найден'
          });
        }

        const promo = promoResult.rows[0];

        // Проверка 2: Промокод активен
        if (!promo.is_active) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: 'Промокод деактивирован'
          });
        }

        // Проверка 3: Промокод в пределах срока действия (результат вычислен в SQL)
        if (promo.not_started || promo.already_ended) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: 'Срок действия промокода истек'
          });
        }

        // Проверка 4: Лимит использований не исчерпан
        if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: 'Лимит использований промокода исчерпан'
          });
        }

        // Проверка 5: Пользователь еще не использовал этот промокод
        const usageResult = await client.query(
          `SELECT COUNT(*) as count
           FROM promo_code_usages
           WHERE promo_code_id = $1 AND user_id = $2`,
          [promo.id, userId]
        );

        const usageCount = parseInt(usageResult.rows[0].count, 10);

        if (usageCount > 0) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: 'Вы уже использовали этот промокод'
          });
        }

        // ============================================
        // 3. ПРИМЕНЕНИЕ ПРОМОКОДА
        // ============================================

        // Получаем текущую подписку пользователя
        const userResult = await client.query(
          `SELECT subscription_expires_at, plan_id, email, full_name, telegram_chat_id
           FROM users
           WHERE id = $1`,
          [userId]
        );

        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({
            error: 'Пользователь не найден'
          });
        }

        const user = userResult.rows[0];
        const currentExpiration = user.subscription_expires_at
          ? new Date(user.subscription_expires_at)
          : null;

        // Рассчитываем новую дату истечения подписки
        let newExpiration;

        if (currentExpiration && currentExpiration > now) {
          // Подписка активна - добавляем дни к текущей дате истечения
          newExpiration = new Date(currentExpiration);
          newExpiration.setDate(newExpiration.getDate() + promo.duration_days);
        } else {
          // Подписка истекла или отсутствует - добавляем дни к текущей дате
          newExpiration = new Date(now);
          newExpiration.setDate(newExpiration.getDate() + promo.duration_days);
        }

        // Обновляем подписку пользователя
        await client.query(
          `UPDATE users
           SET plan_id = $1,
               subscription_expires_at = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [promo.target_plan_id, newExpiration, userId]
        );

        // Увеличиваем счетчик использований промокода
        await client.query(
          `UPDATE promo_codes
           SET current_uses = current_uses + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [promo.id]
        );

        // Записываем использование промокода пользователем
        await client.query(
          `INSERT INTO promo_code_usages (promo_code_id, user_id)
           VALUES ($1, $2)`,
          [promo.id, userId]
        );

        // Записываем в историю подписок
        await client.query(
          `INSERT INTO subscription_history
           (user_id, plan_id, start_date, end_date, source, promo_code_id)
           VALUES ($1, $2, $3, $4, 'промокод', $5)`,
          [
            userId,
            promo.target_plan_id, // ID нового плана
            user.subscription_expires_at || new Date(), // Дата начала - старая дата окончания или сейчас
            newExpiration, // Новая дата окончания
            promo.id // ID использованного промокода
          ]
        );

        // Получаем информацию о новом тарифном плане
        const planResult = await client.query(
          `SELECT id, name, features, price_monthly
           FROM subscription_plans
           WHERE id = $1`,
          [promo.target_plan_id]
        );

        const newPlan = planResult.rows[0];

        // ============================================
        // ЗАВЕРШЕНИЕ ТРАНЗАКЦИИ
        // ============================================
        await client.query('COMMIT');

        // ============================================
        // ОБНОВЛЕНИЕ БЛОКИРОВОК ДОСОК (BoardLockService)
        // ============================================
        try {
          const boardsStatus = await boardLockService.recalcUserBoardLocks(userId);
          console.log(`[PROMO] Блокировки обновлены для user_id=${userId}: unlocked=${boardsStatus.unlocked}, softLocked=${boardsStatus.softLocked}`);
        } catch (lockError) {
          console.error('[PROMO] Ошибка при пересчете блокировок досок:', lockError);
        }

        // ============================================
        // ОТПРАВКА УВЕДОМЛЕНИЙ (Email & Telegram)
        // ============================================
        try {
          const expiresDateFormatted = newExpiration.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // 1. Email уведомление
          if (user.email) {
            await sendSubscriptionEmail(user.email, 'promo', {
              userName: user.full_name || 'Пользователь',
              planName: newPlan.name,
              amount: 0,
              currency: 'RUB',
              startDate: new Date().toISOString(),
              expiresDate: newExpiration.toISOString(),
              promoCode
            });
            console.log(`[PROMO] Email уведомление отправлено пользователю ${user.email}`);
          }

          // 2. Telegram уведомление
          if (user.telegram_chat_id) {
            try {
              const telegramMessage = getPromoCodeAppliedMessage(
                user.full_name || 'Пользователь',
                promoCode,
                newPlan.name,
                expiresDateFormatted,
                process.env.FRONTEND_URL + '/boards'
              );

              await sendTelegramMessage(user.telegram_chat_id, telegramMessage.text, {
                parse_mode: telegramMessage.parse_mode,
                reply_markup: telegramMessage.reply_markup,
                disable_web_page_preview: telegramMessage.disable_web_page_preview
              });

              console.log(`[PROMO] Telegram уведомление отправлено пользователю ${user.telegram_chat_id}`);
            } catch (tgError) {
              console.error('[PROMO] Ошибка отправки Telegram уведомления:', tgError);
            }
          }
        } catch (notifyError) {
          // Не прерываем ответ клиенту, если уведомления упали
          console.error('[PROMO] Ошибка системы уведомлений:', notifyError);
        }

        // Возвращаем успешный ответ
        return reply.code(200).send({
          success: true,
          message: 'Промокод успешно применен',
          subscription: {
            planId: newPlan.id,
            planName: newPlan.name,
            features: newPlan.features,
            expiresAt: newExpiration.toISOString(),
            durationDays: promo.duration_days
          }
        });

      } catch (error) {
        // Откат транзакции при любой ошибке
        await client.query('ROLLBACK');
        throw error;
      }

    } catch (err) {
      console.error('❌ Ошибка применения промокода:', err);

      // Специфичная обработка ошибок БД
      if (err.code === '23505') { // Дублирование уникального ключа
        return reply.code(400).send({
          error: 'Этот промокод уже был использован'
        });
      }

      if (err.code === '23503') { // Нарушение внешнего ключа
        return reply.code(400).send({
          error: 'Неверный тарифный план в промокоде'
        });
      }

      // Общая ошибка сервера
      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });

    } finally {
      // Всегда освобождаем клиента обратно в пул
      client.release();
    }
  });
}
