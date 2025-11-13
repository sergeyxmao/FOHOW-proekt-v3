/**
 * Система крон-задач для автоматизации управления подписками, сессиями и демо-периодами
 *
 * Задачи:
 * 1. Уведомления о истечении подписок (ежедневно 09:00)
 * 2. Блокировка истекших подписок (ежедневно 01:00)
 * 3. Очистка старых сессий (каждый час)
 * 4. Закрытие демо-периодов (ежедневно 02:00)
 * 5. Автоматическая смена тарифа с Демо на Гостевой (ежедневно 02:30)
 * 6. Блокировка досок при окончании платной подписки (ежедневно 01:00)
 * 7. Удаление заблокированных досок через 14 дней (ежедневно 03:00)
 */

import cron from 'node-cron';
import { pool } from '../db.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import { getSubscriptionExpiringMessage, getSubscriptionExpiredMessage } from '../templates/telegramTemplates.js';

// ============================================
// Вспомогательные функции для логирования
// ============================================

/**
 * Записывает логи в system_logs (если таблица существует) или в консоль
 * @param {string} level - Уровень логирования (info, warning, error)
 * @param {string} action - Действие, которое было выполнено
 * @param {Object} details - Дополнительные данные
 */
async function logToSystem(level, action, details = {}) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${action}]`;

  console.log(logMessage, details);

  // Пытаемся записать в system_logs, если таблица существует
  try {
    await pool.query(
      `INSERT INTO system_logs (level, action, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [level, action, JSON.stringify(details)]
    );
  } catch (error) {
    // Если таблица не существует, просто логируем в консоль
    if (error.code !== '42P01') { // 42P01 = undefined_table
      console.error('Ошибка записи в system_logs:', error.message);
    }
  }
}

/**
 * Форматирует дату в формат DD.MM.YYYY
 */
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// ============================================
// 1. Уведомления о истечении подписок
// ============================================

/**
 * Отправляет уведомления пользователям о скором истечении подписки
 * Запускается ежедневно в 09:00
 */
async function notifyExpiringSubscriptions() {
  console.log('\n📱 Крон-задача: Уведомления о истечении подписок');

  try {
    // Находим пользователей, у которых подписка истекает через 7, 3 или 1 день
    const query = `
      SELECT
        u.id,
        u.email,
        u.telegram_chat_id,
        u.subscription_expires_at,
        EXTRACT(DAY FROM (u.subscription_expires_at - NOW())) AS days_left,
        sp.name as plan_name
      FROM users u
      LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE
        u.subscription_expires_at IS NOT NULL
        AND u.telegram_chat_id IS NOT NULL
        AND (
          u.subscription_expires_at BETWEEN NOW() + INTERVAL '6 days 23 hours' AND NOW() + INTERVAL '7 days 1 hour'
          OR u.subscription_expires_at BETWEEN NOW() + INTERVAL '2 days 23 hours' AND NOW() + INTERVAL '3 days 1 hour'
          OR u.subscription_expires_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
        )
        AND u.subscription_expires_at > NOW()
      ORDER BY u.subscription_expires_at ASC
    `;

    const result = await pool.query(query);
    const users = result.rows;

    console.log(`✅ Найдено пользователей с истекающими подписками: ${users.length}`);

    let successCount = 0;
    let errorCount = 0;

    // Отправляем Telegram сообщение каждому пользователю
    for (const user of users) {
      try {
        const daysLeft = Math.ceil(user.days_left);
        const expirationDate = formatDate(user.subscription_expires_at);

        // Формируем Telegram сообщение из шаблона
        const telegramMessage = getSubscriptionExpiringMessage(
          user.email.split('@')[0], // Используем имя из email
          daysLeft,
          expirationDate,
          process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/pricing` : 'https://fohow.ru/subscription'
        );

        // Отправляем Telegram сообщение
        await sendTelegramMessage(
          user.telegram_chat_id,
          telegramMessage.text,
          {
            parse_mode: telegramMessage.parse_mode,
            reply_markup: telegramMessage.reply_markup
          }
        );

        console.log(`  ✅ Telegram уведомление отправлено: ${user.email} (осталось ${daysLeft} дней)`);
        successCount++;

        // Логируем успешную отправку
        await logToSystem('info', 'subscription_expiry_warning', {
          userId: user.id,
          email: user.email,
          telegramChatId: user.telegram_chat_id,
          daysLeft: daysLeft,
          expirationDate: expirationDate
        });

      } catch (error) {
        console.error(`  ❌ Ошибка отправки Telegram уведомления для ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Результаты: успешно отправлено ${successCount}, ошибок ${errorCount}`);

  } catch (error) {
    console.error('❌ Ошибка в задаче notifyExpiringSubscriptions:', error);
    await logToSystem('error', 'subscription_expiry_warning_failed', { error: error.message });
  }
}

// ============================================
// 2. Блокировка истекших подписок
// ============================================

/**
 * Блокирует пользователей с истекшими подписками
 * Переводит их на бесплатный план (demo)
 * Запускается ежедневно в 01:00
 */
async function blockExpiredSubscriptions() {
  console.log('\n🔒 Крон-задача: Блокировка истекших подписок');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Получаем ID демо-плана (бесплатный план)
    const demoPlanResult = await client.query(
      `SELECT id FROM subscription_plans WHERE code_name IN ('demo', 'free') LIMIT 1`
    );

    if (demoPlanResult.rows.length === 0) {
      throw new Error('Демо-план не найден в базе данных');
    }

    const demoPlanId = demoPlanResult.rows[0].id;

    // Находим пользователей с истекшими подписками (где auto_renew = false или NULL)
    const expiredUsersQuery = `
      SELECT
        u.id,
        u.email,
        u.telegram_chat_id,
        u.plan_id,
        u.subscription_expires_at,
        sp.name as current_plan_name
      FROM users u
      LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE
        u.subscription_expires_at < NOW()
        AND (u.auto_renew = false OR u.auto_renew IS NULL)
        AND u.plan_id != $1
    `;

    const expiredUsers = await client.query(expiredUsersQuery, [demoPlanId]);

    console.log(`✅ Найдено пользователей с истекшими подписками: ${expiredUsers.rows.length}`);

    let successCount = 0;

    // Обрабатываем каждого пользователя
    for (const user of expiredUsers.rows) {
      try {
        // Обновляем план пользователя на демо
        await client.query(
          `UPDATE users
           SET plan_id = $1,
               subscription_started_at = NOW()
           WHERE id = $2`,
          [demoPlanId, user.id]
        );

        // Создаем запись в subscription_history
        await client.query(
          `INSERT INTO subscription_history (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
           VALUES ($1, $2, NOW(), NULL, 'expiration', 0.00, 'RUB')`,
          [user.id, demoPlanId]
        );

        // Отправляем Telegram уведомление о истечении подписки (только если есть telegram_chat_id)
        if (user.telegram_chat_id) {
          const telegramMessage = getSubscriptionExpiredMessage(
            user.email.split('@')[0],
            process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/pricing` : 'https://fohow.ru/pricing'
          );

          await sendTelegramMessage(
            user.telegram_chat_id,
            telegramMessage.text,
            {
              parse_mode: telegramMessage.parse_mode,
              reply_markup: telegramMessage.reply_markup
            }
          );
        }

        console.log(`  ✅ Пользователь ${user.email} переведен на демо-план`);
        successCount++;

        // Логируем блокировку
        await logToSystem('warning', 'subscription_expired', {
          userId: user.id,
          email: user.email,
          telegramChatId: user.telegram_chat_id,
          oldPlanId: user.plan_id,
          newPlanId: demoPlanId,
          expiredAt: user.subscription_expires_at
        });

      } catch (error) {
        console.error(`  ❌ Ошибка обработки пользователя ${user.email}:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`\n📊 Результаты: успешно обработано ${successCount} пользователей`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка в задаче blockExpiredSubscriptions:', error);
    await logToSystem('error', 'block_expired_subscriptions_failed', { error: error.message });
  } finally {
    client.release();
  }
}

// ============================================
// 3. Очистка старых сессий
// ============================================

/**
 * Удаляет старые и истекшие сессии
 * Запускается каждый час
 */
async function cleanupOldSessions() {
  console.log('\n🧹 Крон-задача: Очистка старых сессий');

  try {
    // Удаляем сессии, которые истекли или неактивны более 30 дней
    const deleteQuery = `
      DELETE FROM active_sessions
      WHERE
        expires_at < NOW()
        OR last_seen < NOW() - INTERVAL '30 days'
    `;

    const result = await pool.query(deleteQuery);
    const deletedCount = result.rowCount;

    console.log(`✅ Удалено сессий: ${deletedCount}`);

    // Логируем результат
    await logToSystem('info', 'cleanup_old_sessions', {
      deletedCount: deletedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ошибка в задаче cleanupOldSessions:', error);
    await logToSystem('error', 'cleanup_old_sessions_failed', { error: error.message });
  }
}

// ============================================
// 4. Закрытие демо-периодов
// ============================================

/**
 * Закрывает завершившиеся демо-периоды
 * Запускается ежедневно в 02:00
 */
async function closeDemoPeriods() {
  console.log('\n🎯 Крон-задача: Закрытие демо-периодов');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Находим незавершенные демо-периоды, которые истекли (3 дня прошло)
    const expiredDemosQuery = `
      SELECT
        dt.id,
        dt.user_id,
        dt.started_at,
        u.email
      FROM demo_trials dt
      JOIN users u ON dt.user_id = u.id
      WHERE
        dt.started_at + INTERVAL '3 days' < NOW()
        AND dt.ended_at IS NULL
        AND dt.converted_to_paid = false
    `;

    const expiredDemos = await client.query(expiredDemosQuery);

    console.log(`✅ Найдено истекших демо-периодов: ${expiredDemos.rows.length}`);

    let successCount = 0;

    // Закрываем каждый демо-период
    for (const demo of expiredDemos.rows) {
      try {
        // Обновляем запись в demo_trials
        await client.query(
          `UPDATE demo_trials
           SET ended_at = NOW()
           WHERE id = $1`,
          [demo.id]
        );

        console.log(`  ✅ Демо-период закрыт для пользователя ${demo.email}`);
        successCount++;

        // Логируем закрытие
        await logToSystem('info', 'demo_period_closed', {
          demoTrialId: demo.id,
          userId: demo.user_id,
          email: demo.email,
          startedAt: demo.started_at,
          closedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error(`  ❌ Ошибка закрытия демо-периода для ${demo.email}:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`\n📊 Результаты: успешно закрыто ${successCount} демо-периодов`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка в задаче closeDemoPeriods:', error);
    await logToSystem('error', 'close_demo_periods_failed', { error: error.message });
  } finally {
    client.release();
  }
}

// ============================================
// 5. Автоматическая смена тарифа с Демо на Гостевой
// ============================================

/**
 * Автоматически переводит пользователей с истекшего демо-тарифа на гостевой тариф
 * Запускается ежедневно в 02:30
 */
async function switchDemoToGuest() {
  console.log('\n🔄 Крон-задача: Смена тарифа с Демо на Гостевой');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Находим тариф "guest"
    const guestPlanResult = await client.query(
      `SELECT id, name FROM subscription_plans WHERE code_name = 'guest' LIMIT 1`
    );

    if (guestPlanResult.rows.length === 0) {
      throw new Error('Гостевой тариф не найден в базе данных');
    }

    const guestPlan = guestPlanResult.rows[0];
    console.log(`✅ Найден гостевой тариф: ${guestPlan.name} (ID: ${guestPlan.id})`);

    // 2. Находим всех пользователей с истекшим демо-тарифом
    const expiredDemoUsersQuery = `
      SELECT
        u.id,
        u.email,
        u.plan_id,
        u.subscription_expires_at,
        u.telegram_chat_id,
        sp.name as current_plan_name,
        sp.code_name as current_plan_code
      FROM users u
      JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE
        sp.code_name = 'demo'
        AND u.subscription_expires_at IS NOT NULL
        AND u.subscription_expires_at < NOW()
    `;

    const expiredDemoUsers = await client.query(expiredDemoUsersQuery);

    console.log(`✅ Найдено пользователей с истекшим демо-тарифом: ${expiredDemoUsers.rows.length}`);

    let successCount = 0;

    // 3. Переводим каждого пользователя на гостевой тариф
    for (const user of expiredDemoUsers.rows) {
      try {
        // Обновляем план пользователя на guest
        await client.query(
          `UPDATE users
           SET plan_id = $1,
               subscription_expires_at = NULL,
               subscription_started_at = NOW()
           WHERE id = $2`,
          [guestPlan.id, user.id]
        );

        // Записываем в историю подписок
        await client.query(
          `INSERT INTO subscription_history
             (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
           VALUES ($1, $2, NOW(), NULL, 'auto_demo_expired', 0.00, 'RUB')`,
          [user.id, guestPlan.id]
        );

        console.log(`  ✅ Пользователь ${user.email} переведен на гостевой тариф`);
        successCount++;

        // Логируем смену тарифа
        await logToSystem('info', 'demo_to_guest_switch', {
          userId: user.id,
          email: user.email,
          oldPlanId: user.plan_id,
          oldPlanName: user.current_plan_name,
          newPlanId: guestPlan.id,
          newPlanName: guestPlan.name,
          expiredAt: user.subscription_expires_at
        });

      } catch (error) {
        console.error(`  ❌ Ошибка обработки пользователя ${user.email}:`, error.message);
        await logToSystem('error', 'demo_to_guest_switch_failed', {
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');
    console.log(`\n📊 Результаты: успешно переведено ${successCount} пользователей на гостевой тариф`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка в задаче switchDemoToGuest:', error);
    await logToSystem('error', 'switch_demo_to_guest_failed', { error: error.message });
  } finally {
    client.release();
  }
}

// ============================================
// 6. Блокировка досок при окончании платной подписки
// ============================================

/**
 * Блокирует доски пользователей с истекшей платной подпиской
 * Переводит их на тариф "guest" и устанавливает флаг boards_locked
 * Запускается ежедневно в 01:00 (вместе с блокировкой подписок)
 */
async function lockBoardsAfterExpiry() {
  console.log('\n🔒 Крон-задача: Блокировка досок при окончании платной подписки');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Находим тариф "guest"
    const guestPlanResult = await client.query(
      `SELECT id, name FROM subscription_plans WHERE code_name = 'guest' LIMIT 1`
    );

    if (guestPlanResult.rows.length === 0) {
      throw new Error('Гостевой тариф не найден в базе данных');
    }

    const guestPlan = guestPlanResult.rows[0];
    console.log(`✅ Найден гостевой тариф: ${guestPlan.name} (ID: ${guestPlan.id})`);

    // 2. Находим пользователей с истекшей платной подпиской (individual или premium)
    const expiredUsersQuery = `
      SELECT
        u.id,
        u.email,
        u.plan_id,
        u.subscription_expires_at,
        u.telegram_chat_id,
        sp.name as current_plan_name,
        sp.code_name as current_plan_code
      FROM users u
      JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE
        sp.code_name IN ('individual', 'premium')
        AND u.subscription_expires_at < NOW()
        AND u.boards_locked = FALSE
    `;

    const expiredUsers = await client.query(expiredUsersQuery);

    console.log(`✅ Найдено пользователей с истекшей платной подпиской: ${expiredUsers.rows.length}`);

    let successCount = 0;

    // 3. Для каждого пользователя заблокировать доски
    for (const user of expiredUsers.rows) {
      try {
        // Обновляем план пользователя на guest и устанавливаем флаги блокировки
        await client.query(
          `UPDATE users
           SET plan_id = $1,
               boards_locked = TRUE,
               boards_locked_at = NOW(),
               subscription_expires_at = NULL,
               subscription_started_at = NOW()
           WHERE id = $2`,
          [guestPlan.id, user.id]
        );

        // Блокируем все доски пользователя
        const boardsResult = await client.query(
          `UPDATE boards
           SET is_locked = TRUE
           WHERE owner_id = $1`,
          [user.id]
        );

        const lockedBoardsCount = boardsResult.rowCount;

        // Записываем в историю подписок
        await client.query(
          `INSERT INTO subscription_history
             (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
           VALUES ($1, $2, NOW(), NULL, 'auto_subscription_expired', 0.00, 'RUB')`,
          [user.id, guestPlan.id]
        );

        console.log(`  ✅ Пользователь ${user.email}: переведен на гостевой тариф, заблокировано досок: ${lockedBoardsCount}`);
        successCount++;

        // Логируем блокировку досок
        await logToSystem('warning', 'boards_locked_after_subscription_expiry', {
          userId: user.id,
          email: user.email,
          oldPlanId: user.plan_id,
          oldPlanName: user.current_plan_name,
          newPlanId: guestPlan.id,
          newPlanName: guestPlan.name,
          lockedBoardsCount: lockedBoardsCount,
          expiredAt: user.subscription_expires_at
        });

      } catch (error) {
        console.error(`  ❌ Ошибка обработки пользователя ${user.email}:`, error.message);
        await logToSystem('error', 'boards_lock_failed', {
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');
    console.log(`\n📊 Результаты: успешно заблокировано досок для ${successCount} пользователей`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка в задаче lockBoardsAfterExpiry:', error);
    await logToSystem('error', 'lock_boards_after_expiry_failed', { error: error.message });
  } finally {
    client.release();
  }
}

// ============================================
// 7. Удаление заблокированных досок через 14 дней
// ============================================

/**
 * Удаляет заблокированные доски через 14 дней после блокировки
 * Сбрасывает флаги boards_locked и boards_locked_at
 * Запускается ежедневно в 03:00
 */
async function deleteLockedBoardsAfter14Days() {
  console.log('\n🗑️  Крон-задача: Удаление заблокированных досок через 14 дней');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Находим пользователей, у которых доски заблокированы более 14 дней
    const usersToDeleteQuery = `
      SELECT
        u.id,
        u.email,
        u.boards_locked_at,
        u.telegram_chat_id
      FROM users u
      WHERE
        u.boards_locked = TRUE
        AND u.boards_locked_at < NOW() - INTERVAL '14 days'
    `;

    const usersToDelete = await client.query(usersToDeleteQuery);

    console.log(`✅ Найдено пользователей с досками, заблокированными более 14 дней: ${usersToDelete.rows.length}`);

    let successCount = 0;
    let totalDeletedBoards = 0;

    // 2. Для каждого пользователя удалить заблокированные доски
    for (const user of usersToDelete.rows) {
      try {
        // Удаляем заблокированные доски пользователя
        const deleteBoardsResult = await client.query(
          `DELETE FROM boards
           WHERE owner_id = $1 AND is_locked = TRUE
           RETURNING id`,
          [user.id]
        );

        const deletedCount = deleteBoardsResult.rowCount;
        totalDeletedBoards += deletedCount;

        // Обновляем статус пользователя - сбрасываем флаги блокировки
        await client.query(
          `UPDATE users
           SET boards_locked = FALSE,
               boards_locked_at = NULL
           WHERE id = $1`,
          [user.id]
        );

        console.log(`  ✅ Пользователь ${user.email}: удалено досок ${deletedCount}, флаги блокировки сброшены`);
        successCount++;

        // Логируем удаление досок
        await logToSystem('info', 'locked_boards_deleted_after_14_days', {
          userId: user.id,
          email: user.email,
          deletedBoardsCount: deletedCount,
          lockedAt: user.boards_locked_at,
          deletedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error(`  ❌ Ошибка обработки пользователя ${user.email}:`, error.message);
        await logToSystem('error', 'locked_boards_deletion_failed', {
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');
    console.log(`\n📊 Результаты: обработано пользователей ${successCount}, удалено досок ${totalDeletedBoards}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка в задаче deleteLockedBoardsAfter14Days:', error);
    await logToSystem('error', 'delete_locked_boards_after_14_days_failed', { error: error.message });
  } finally {
    client.release();
  }
}

// ============================================
// Вспомогательные функции
// ============================================

/**
 * Склонение слова "день"
 */
function getDaysWord(days) {
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }

  return 'дней';
}

// ============================================
// Инициализация крон-задач
// ============================================

/**
 * Запускает все крон-задачи
 */
export function initializeCronTasks() {
  console.log('\n🚀 Инициализация системы крон-задач...\n');

  // 1. Уведомления о истечении подписок - каждый день в 09:00
  cron.schedule('0 9 * * *', () => {
    notifyExpiringSubscriptions();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 1: Уведомления о истечении подписок (ежедневно 09:00 МСК)');

  // 2. Блокировка истекших подписок - каждый день в 01:00
  cron.schedule('0 1 * * *', () => {
    blockExpiredSubscriptions();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 2: Блокировка истекших подписок (ежедневно 01:00 МСК)');

  // 3. Очистка старых сессий - каждый час
  cron.schedule('0 * * * *', () => {
    cleanupOldSessions();
  });
  console.log('✅ Задача 3: Очистка старых сессий (каждый час)');

  // 4. Закрытие демо-периодов - каждый день в 02:00
  cron.schedule('0 2 * * *', () => {
    closeDemoPeriods();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 4: Закрытие демо-периодов (ежедневно 02:00 МСК)');

  // 5. Автоматическая смена тарифа с Демо на Гостевой - каждый день в 02:30
  cron.schedule('30 2 * * *', () => {
    switchDemoToGuest();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 5: Смена тарифа с Демо на Гостевой (ежедневно 02:30 МСК)');

  // 6. Блокировка досок при окончании платной подписки - каждый день в 01:00
  cron.schedule('0 1 * * *', () => {
    lockBoardsAfterExpiry();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 6: Блокировка досок при окончании платной подписки (ежедневно 01:00 МСК)');

  // 7. Удаление заблокированных досок через 14 дней - каждый день в 03:00
  cron.schedule('0 3 * * *', () => {
    deleteLockedBoardsAfter14Days();
  }, {
    timezone: 'Europe/Moscow'
  });
  console.log('✅ Задача 7: Удаление заблокированных досок через 14 дней (ежедневно 03:00 МСК)');

  console.log('\n✅ Все крон-задачи успешно инициализированы!\n');
}

// Экспорт функций для возможности ручного запуска
export {
  notifyExpiringSubscriptions,
  blockExpiredSubscriptions,
  cleanupOldSessions,
  closeDemoPeriods,
  switchDemoToGuest,
  lockBoardsAfterExpiry,
  deleteLockedBoardsAfter14Days
};
