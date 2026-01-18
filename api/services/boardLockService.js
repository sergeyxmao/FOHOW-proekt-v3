/**
 * Сервис управления блокировками досок (Soft Lock / Hard Lock)
 *
 * Логика блокировок:
 * - При понижении тарифа до Guest (лимит 3 доски):
 *   - 3 самые свежие доски (по updated_at) остаются active
 *   - Остальные переходят в soft_lock с таймером 14 дней
 * - Через 14 дней soft_lock → hard_lock (доступ запрещён)
 * - Ещё через 14 дней hard_lock → удаление
 *
 * Статусы досок:
 * - active: доска доступна полностью
 * - soft_lock: только чтение, таймер до hard_lock
 * - hard_lock: доска недоступна, таймер до удаления
 */

import { pool } from '../db.js';

/**
 * Пересчитывает статусы блокировок досок для пользователя
 * Вызывается при изменении тарифа (downgrade)
 *
 * @param {number} userId - ID пользователя
 * @returns {Promise<{unlocked: number, softLocked: number}>} Количество разблокированных и заблокированных досок
 */
export async function recalcUserBoardLocks(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Получаем лимит досок для текущего тарифа пользователя
    const planResult = await client.query(
      `SELECT sp.features->>'max_boards' as max_boards, sp.code_name as plan_code
       FROM users u
       JOIN subscription_plans sp ON u.plan_id = sp.id
       WHERE u.id = $1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      throw new Error(`Пользователь ${userId} не найден или не имеет тарифа`);
    }

    const maxBoards = parseInt(planResult.rows[0].max_boards, 10);
    const planCode = planResult.rows[0].plan_code;

    // Если лимит -1 (безлимит) или NaN, разблокируем все доски
    if (isNaN(maxBoards) || maxBoards === -1) {
      const unlockResult = await client.query(
        `UPDATE boards
         SET lock_status = 'active', lock_timer_started_at = NULL
         WHERE owner_id = $1 AND lock_status != 'active'
         RETURNING id`,
        [userId]
      );

      await client.query('COMMIT');

      console.log(`[BoardLockService] Пользователь ${userId}: безлимитный тариф (${planCode}), разблокировано ${unlockResult.rowCount} досок`);

      return { unlocked: unlockResult.rowCount, softLocked: 0 };
    }

    // 2. Получаем все доски пользователя, отсортированные по updated_at DESC
    const boardsResult = await client.query(
      `SELECT id, lock_status, lock_timer_started_at
       FROM boards
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    const boards = boardsResult.rows;
    const totalBoards = boards.length;

    console.log(`[BoardLockService] Пользователь ${userId}: тариф ${planCode}, лимит ${maxBoards}, всего досок ${totalBoards}`);

    let unlockedCount = 0;
    let softLockedCount = 0;

    for (let i = 0; i < boards.length; i++) {
      const board = boards[i];
      const shouldBeActive = i < maxBoards;

      if (shouldBeActive) {
        // Доска в пределах лимита - должна быть active
        if (board.lock_status !== 'active') {
          await client.query(
            `UPDATE boards
             SET lock_status = 'active', lock_timer_started_at = NULL
             WHERE id = $1`,
            [board.id]
          );
          unlockedCount++;
          console.log(`  [+] Доска ${board.id}: разблокирована (позиция ${i + 1})`);
        }
      } else {
        // Доска за пределами лимита
        if (board.lock_status === 'active') {
          // Была active - переводим в soft_lock с новым таймером
          await client.query(
            `UPDATE boards
             SET lock_status = 'soft_lock', lock_timer_started_at = NOW()
             WHERE id = $1`,
            [board.id]
          );
          softLockedCount++;
          console.log(`  [!] Доска ${board.id}: soft_lock (позиция ${i + 1}, превышает лимит)`);
        }
        // Если уже soft_lock или hard_lock - не трогаем таймер
      }
    }

    await client.query('COMMIT');

    console.log(`[BoardLockService] Итого: разблокировано ${unlockedCount}, в soft_lock ${softLockedCount}`);

    return { unlocked: unlockedCount, softLocked: softLockedCount };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[BoardLockService] Ошибка recalcUserBoardLocks для ${userId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ежедневная обработка таймеров блокировок
 * Должна вызываться из cron-задачи раз в сутки
 *
 * - soft_lock > 14 дней → hard_lock
 * - hard_lock > 14 дней → удаление доски
 *
 * @returns {Promise<{toHardLock: number, deleted: number}>} Статистика обработки
 */
export async function processDailyLocks() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n========================================');
    console.log('🔒 Обработка блокировок досок');
    console.log(`⏰ Время: ${new Date().toISOString()}`);
    console.log('========================================\n');

    // 1. soft_lock → hard_lock (если таймер > 14 дней)
    const softToHardResult = await client.query(
      `UPDATE boards
       SET lock_status = 'hard_lock', lock_timer_started_at = NOW()
       WHERE lock_status = 'soft_lock'
         AND lock_timer_started_at < NOW() - INTERVAL '14 days'
       RETURNING id, owner_id, name`
    );

    const toHardLockCount = softToHardResult.rowCount;

    if (toHardLockCount > 0) {
      console.log(`📋 Переведено в hard_lock: ${toHardLockCount} досок`);
      for (const board of softToHardResult.rows) {
        console.log(`  - Доска "${board.name}" (ID: ${board.id}, владелец: ${board.owner_id})`);
      }
    } else {
      console.log('📋 Нет досок для перевода в hard_lock');
    }

    // 2. hard_lock → удаление (если таймер > 14 дней)
    // Сначала получаем список для логирования
    const toDeleteResult = await client.query(
      `SELECT id, owner_id, name, thumbnail_url
       FROM boards
       WHERE lock_status = 'hard_lock'
         AND lock_timer_started_at < NOW() - INTERVAL '14 days'`
    );

    const deletedCount = toDeleteResult.rows.length;

    if (deletedCount > 0) {
      console.log(`\n🗑️  Удаление досок hard_lock > 14 дней: ${deletedCount}`);

      for (const board of toDeleteResult.rows) {
        console.log(`  - Удаление доски "${board.name}" (ID: ${board.id}, владелец: ${board.owner_id})`);

        // Удаляем доску
        await client.query('DELETE FROM boards WHERE id = $1', [board.id]);

        // TODO: Если нужно, здесь можно добавить удаление thumbnail с Яндекс.Диска
        // Для этого можно импортировать deleteFile из yandexDiskService
      }
    } else {
      console.log('\n🗑️  Нет досок для удаления');
    }

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('📊 ИТОГИ:');
    console.log(`   soft_lock → hard_lock: ${toHardLockCount}`);
    console.log(`   hard_lock → удалено: ${deletedCount}`);
    console.log('========================================\n');

    return { toHardLock: toHardLockCount, deleted: deletedCount };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка processDailyLocks:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получить информацию о блокировке доски
 *
 * @param {number} boardId - ID доски
 * @returns {Promise<{lockStatus: string, daysUntilBlock: number|null, daysUntilDelete: number|null}>}
 */
export async function getBoardLockInfo(boardId) {
  const result = await pool.query(
    `SELECT lock_status, lock_timer_started_at
     FROM boards
     WHERE id = $1`,
    [boardId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const { lock_status, lock_timer_started_at } = result.rows[0];

  let daysUntilBlock = null;
  let daysUntilDelete = null;

  if (lock_timer_started_at) {
    const timerStart = new Date(lock_timer_started_at);
    const now = new Date();
    const daysPassed = Math.floor((now - timerStart) / (1000 * 60 * 60 * 24));

    if (lock_status === 'soft_lock') {
      daysUntilBlock = Math.max(0, 14 - daysPassed);
    } else if (lock_status === 'hard_lock') {
      daysUntilDelete = Math.max(0, 14 - daysPassed);
    }
  }

  return {
    lockStatus: lock_status || 'active',
    daysUntilBlock,
    daysUntilDelete
  };
}

/**
 * Разблокировать все доски пользователя
 * Вызывается при апгрейде тарифа
 *
 * @param {number} userId - ID пользователя
 * @returns {Promise<number>} Количество разблокированных досок
 */
export async function unlockAllUserBoards(userId) {
  const result = await pool.query(
    `UPDATE boards
     SET lock_status = 'active', lock_timer_started_at = NULL
     WHERE owner_id = $1 AND lock_status != 'active'
     RETURNING id`,
    [userId]
  );

  console.log(`[BoardLockService] Пользователь ${userId}: разблокировано ${result.rowCount} досок (апгрейд тарифа)`);

  return result.rowCount;
}

export default {
  recalcUserBoardLocks,
  processDailyLocks,
  getBoardLockInfo,
  unlockAllUserBoards
};
