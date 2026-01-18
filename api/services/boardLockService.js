/**
 * Сервис управления блокировками досок (Soft Lock / Hard Lock)
 *
 * Логика блокировок:
 * 1. Получаем лимиты тарифа (max_boards, max_objects).
 * 2. Доски с object_count > max_objects ("тяжелые") блокируются в первую очередь (soft_lock).
 * 3. Из оставшихся "нормальных" досок активными остаются max_boards штук (самые свежие по updated_at).
 * 4. Остальные "нормальные" тоже блокируются.
 *
 * Статусы досок:
 * - active: доска доступна полностью
 * - soft_lock: только чтение, таймер до hard_lock
 * - hard_lock: доска недоступна, таймер до удаления
 */

import { pool } from '../db.js';

/**
 * Пересчитывает статусы блокировок досок для пользователя
 * Вызывается при изменении тарифа, создании/удалении досок, изменении объектов
 *
 * @param {number} userId - ID пользователя
 * @returns {Promise<{unlocked: number, softLocked: number}>} Количество разблокированных и заблокированных досок
 */
export async function recalcUserBoardLocks(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Получаем лимиты тарифа
    const planResult = await client.query(
      `SELECT
         sp.features->>'max_boards' as max_boards,
         sp.features->>'max_objects' as max_objects,
         sp.code_name as plan_code
       FROM users u
       JOIN subscription_plans sp ON u.plan_id = sp.id
       WHERE u.id = $1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      throw new Error(`Пользователь ${userId} не найден или не имеет тарифа`);
    }

    const planCode = planResult.rows[0].plan_code;
    const maxBoardsRaw = parseInt(planResult.rows[0].max_boards, 10);
    const maxObjectsRaw = parseInt(planResult.rows[0].max_objects, 10);

    // Обработка безлимитов (-1 или NULL или NaN считаем как Infinity)
    const boardLimit = (maxBoardsRaw === -1 || isNaN(maxBoardsRaw)) ? Infinity : maxBoardsRaw;
    const objectLimit = (maxObjectsRaw === -1 || isNaN(maxObjectsRaw)) ? Infinity : maxObjectsRaw;

    // 2. Получаем все доски пользователя (кроме архивных, если есть такая логика)
    // Сортируем по updated_at DESC (самые свежие в начале)
    const boardsResult = await client.query(
      `SELECT id, object_count, lock_status, updated_at
       FROM boards
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    const allBoards = boardsResult.rows;
    console.log(`[BoardLockService] User ${userId} (${planCode}): boards=${boardLimit}, objects=${objectLimit}, total=${allBoards.length}`);

    // Если безлимит на всё, разблокируем всё и выходим
    if (boardLimit === Infinity && objectLimit === Infinity) {
        const unlockResult = await client.query(
            `UPDATE boards
             SET lock_status = 'active', lock_timer_started_at = NULL
             WHERE owner_id = $1 AND lock_status != 'active'`,
            [userId]
        );
        await client.query('COMMIT');
        return { unlocked: unlockResult.rowCount, softLocked: 0 };
    }

    // 3. Разделение на группы
    const heavyBoards = [];   // Превышают лимит объектов
    const normalBoards = [];  // Вписываются в лимит объектов

    for (const board of allBoards) {
        const count = parseInt(board.object_count || 0, 10);
        if (count > objectLimit) {
            heavyBoards.push(board);
        } else {
            normalBoards.push(board);
        }
    }

    // 4. Определение списка активных ID
    const activeBoardIds = new Set();

    // "Тяжелые" доски всегда блокируются (не попадают в activeBoardIds)

    // "Нормальные" доски: берем первые N штук, где N = boardLimit
    // Так как normalBoards уже отсортированы по updated_at DESC (из SQL), просто берем slice
    const allowedNormalCount = boardLimit === Infinity ? normalBoards.length : boardLimit;
    const boardsToKeepActive = normalBoards.slice(0, allowedNormalCount);

    boardsToKeepActive.forEach(b => activeBoardIds.add(b.id));

    console.log(`[BoardLockService] Heavy (block): ${heavyBoards.length}, Normal (active): ${activeBoardIds.size}, Normal (block): ${Math.max(0, normalBoards.length - allowedNormalCount)}`);

    let unlockedCount = 0;
    let softLockedCount = 0;

    // 5. Применяем изменения в БД
    for (const board of allBoards) {
        const shouldBeActive = activeBoardIds.has(board.id);

        if (shouldBeActive) {
            // Должна быть активна
            if (board.lock_status !== 'active') {
                await client.query(
                    `UPDATE boards
                     SET lock_status = 'active', lock_timer_started_at = NULL
                     WHERE id = $1`,
                    [board.id]
                );
                unlockedCount++;
            }
        } else {
            // Должна быть заблокирована
            if (board.lock_status === 'active') {
                // Если была активна -> ставим soft_lock и запускаем таймер
                await client.query(
                    `UPDATE boards
                     SET lock_status = 'soft_lock', lock_timer_started_at = NOW()
                     WHERE id = $1`,
                    [board.id]
                );
                softLockedCount++;
            }
            // Если уже soft_lock или hard_lock -> не трогаем (таймер тикает дальше)
        }
    }

    await client.query('COMMIT');
    console.log(`[BoardLockService] Updated: unlocked=${unlockedCount}, softLocked=${softLockedCount}`);

    return { unlocked: unlockedCount, softLocked: softLockedCount };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[BoardLockService] Error recalcUserBoardLocks for ${userId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ежедневная обработка таймеров блокировок
 * - soft_lock > 14 дней → hard_lock
 * - hard_lock > 14 дней → удаление доски
 */
export async function processDailyLocks() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n========================================');
    console.log('🔒 Обработка блокировок досок');
    console.log(`⏰ Время: ${new Date().toISOString()}`);

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
      console.log(`📋 Переведено в hard_lock: ${toHardLockCount}`);
    }

    // 2. hard_lock → удаление (если таймер > 14 дней)
    const toDeleteResult = await client.query(
      `SELECT id, owner_id, name
       FROM boards
       WHERE lock_status = 'hard_lock'
         AND lock_timer_started_at < NOW() - INTERVAL '14 days'`
    );

    const deletedCount = toDeleteResult.rows.length;

    if (deletedCount > 0) {
      console.log(`🗑️  Удаление досок hard_lock > 14 дней: ${deletedCount}`);
      for (const board of toDeleteResult.rows) {
         await client.query('DELETE FROM boards WHERE id = $1', [board.id]);
      }
    }

    await client.query('COMMIT');
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
 */
export async function getBoardLockInfo(boardId) {
  const result = await pool.query(
    `SELECT lock_status, lock_timer_started_at
     FROM boards
     WHERE id = $1`,
    [boardId]
  );

  if (result.rows.length === 0) return null;

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
 * Разблокировать все доски пользователя (при апгрейде)
 */
export async function unlockAllUserBoards(userId) {
  // Просто вызываем пересчет - он сам поймет, что лимиты позволяют разблокировать
  const result = await recalcUserBoardLocks(userId);
  return result.unlocked;
}

export default {
  recalcUserBoardLocks,
  processDailyLocks,
  getBoardLockInfo,
  unlockAllUserBoards
};
