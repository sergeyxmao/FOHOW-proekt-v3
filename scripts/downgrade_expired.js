#!/usr/bin/env node

/**
 * Скрипт автоматического понижения тарифа до Guest
 * для пользователей с истекшим grace-периодом
 *
 * Использование:
 *   node scripts/downgrade_expired.js
 *
 * Логика:
 *   1. Находит пользователей, у которых:
 *      - subscription_expires_at < NOW()
 *      - grace_period_until IS NULL OR grace_period_until < NOW()
 *      - plan_id != guest
 *   2. Переводит их на тариф Guest
 *   3. Логирует количество обработанных пользователей
 *
 * Для CRON (ежедневно в 3:00 утра):
 *   0 3 * * * cd /path/to/project && node scripts/downgrade_expired.js >> /var/log/downgrade_expired.log 2>&1
 */

// Загружаем переменные окружения из .env файла
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из папки api/
dotenv.config({ path: join(__dirname, '../api/.env') });

// Проверяем, что переменные окружения загружены
if (!process.env.DB_HOST || !process.env.DB_NAME) {
  console.error('\n❌ ОШИБКА: Переменные окружения не загружены!');
  console.error('Убедитесь, что файл api/.env существует и содержит:');
  console.error('  - DB_HOST');
  console.error('  - DB_NAME');
  console.error('  - DB_USER');
  console.error('  - DB_PASSWORD');
  console.error('  - DB_PORT\n');
  process.exit(1);
}

import { pool } from '../api/db.js';
import { recalcUserBoardLocks } from '../api/services/boardLockService.js';

/**
 * Основная функция скрипта
 */
async function downgradeExpiredUsers() {
  console.log('\n========================================');
  console.log('🔄 Скрипт: Понижение тарифа для истекших подписок');
  console.log(`⏰ Запуск: ${new Date().toISOString()}`);
  console.log('========================================\n');

  let client;

  try {
    // Подключаемся к БД
    client = await pool.connect();
    console.log('✅ Подключение к БД установлено');

    // Начинаем транзакцию
    await client.query('BEGIN');

    // 1. Получаем ID тарифа Guest
    console.log('\n📋 Поиск тарифа Guest...');
    const guestPlanResult = await client.query(
      `SELECT id, name FROM subscription_plans WHERE code_name = 'guest' LIMIT 1`
    );

    if (guestPlanResult.rows.length === 0) {
      throw new Error('❌ Тариф Guest не найден в таблице subscription_plans');
    }

    const guestPlan = guestPlanResult.rows[0];
    console.log(`✅ Найден тариф: "${guestPlan.name}" (ID: ${guestPlan.id})`);

    // 2. Находим пользователей для понижения тарифа
    console.log('\n🔍 Поиск пользователей с истекшим grace-периодом...');
    const findUsersQuery = `
      SELECT
        u.id,
        u.email,
        u.username,
        sp.name as current_plan_name,
        sp.code_name as current_plan_code,
        u.subscription_expires_at,
        u.grace_period_until
      FROM users u
      JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE u.plan_id != $1
        AND u.subscription_expires_at < NOW()
        AND (u.grace_period_until IS NULL OR u.grace_period_until < NOW())
      ORDER BY u.id ASC
    `;

    const usersToDowngrade = await client.query(findUsersQuery, [guestPlan.id]);
    const userCount = usersToDowngrade.rows.length;

    console.log(`📊 Найдено пользователей для понижения: ${userCount}`);

    if (userCount === 0) {
      console.log('✅ Нет пользователей для обработки');
      await client.query('COMMIT');
      return;
    }

    // 3. Показываем список пользователей
    console.log('\n👥 Список пользователей:');
    usersToDowngrade.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.username || 'без имени'})`);
      console.log(`     Текущий тариф: ${user.current_plan_name} (${user.current_plan_code})`);
      console.log(`     Подписка истекла: ${user.subscription_expires_at || 'N/A'}`);
      console.log(`     Grace-период до: ${user.grace_period_until || 'N/A'}`);
    });

    // 4. Обновляем тариф для всех найденных пользователей
    console.log('\n🔄 Обновление тарифов...');
    const updateQuery = `
      UPDATE users
      SET
        plan_id = $1,
        subscription_expires_at = NULL,
        subscription_started_at = NOW(),
        grace_period_until = NULL
      WHERE plan_id != $1
        AND subscription_expires_at < NOW()
        AND (grace_period_until IS NULL OR grace_period_until < NOW())
    `;

    const updateResult = await client.query(updateQuery, [guestPlan.id]);
    const updatedCount = updateResult.rowCount;

    console.log(`✅ Обновлено записей: ${updatedCount}`);

    // 5. Пересчитываем блокировки досок для каждого пользователя
    console.log('\n🔒 Пересчёт блокировок досок...');
    let lockStatsTotal = { unlocked: 0, softLocked: 0 };

    for (const user of usersToDowngrade.rows) {
      try {
        const lockStats = await recalcUserBoardLocks(user.id);
        lockStatsTotal.unlocked += lockStats.unlocked;
        lockStatsTotal.softLocked += lockStats.softLocked;
        console.log(`  ✅ ${user.email}: ${lockStats.softLocked} досок → soft_lock`);
      } catch (lockError) {
        console.error(`  ❌ Ошибка пересчёта блокировок для ${user.email}:`, lockError.message);
      }
    }

    console.log(`\n📊 Блокировки: ${lockStatsTotal.softLocked} досок в soft_lock, ${lockStatsTotal.unlocked} разблокировано`);

    // Подтверждаем транзакцию
    await client.query('COMMIT');

    // 6. Финальный отчет
    console.log('\n========================================');
    console.log('📊 ИТОГИ ВЫПОЛНЕНИЯ:');
    console.log(`   Найдено пользователей: ${userCount}`);
    console.log(`   Обновлено записей: ${updatedCount}`);
    console.log(`   Новый тариф: ${guestPlan.name} (ID: ${guestPlan.id})`);
    console.log(`   Досок в soft_lock: ${lockStatsTotal.softLocked}`);
    console.log(`   Досок разблокировано: ${lockStatsTotal.unlocked}`);
    console.log(`   Время завершения: ${new Date().toISOString()}`);
    console.log('========================================\n');

    console.log('✅ Скрипт успешно завершен');
    process.exit(0);

  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('\n========================================');
    console.error('❌ ОШИБКА ВЫПОЛНЕНИЯ СКРИПТА');
    console.error('========================================');
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
    console.error('========================================\n');

    process.exit(1);

  } finally {
    // Освобождаем клиент
    if (client) {
      client.release();
      console.log('🔌 Соединение с БД закрыто');
    }

    // Закрываем пул соединений
    await pool.end();
    console.log('🔌 Пул соединений закрыт');
  }
}

// Запускаем скрипт
downgradeExpiredUsers().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
