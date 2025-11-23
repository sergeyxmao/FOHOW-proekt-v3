/**
 * Сервис для работы с верификацией пользователей
 * Управляет заявками на верификацию компьютерных номеров
 */

import { pool } from '../db.js';
import {
  uploadFile,
  publishFile,
  deleteFile,
  ensureFolderExists
} from './yandexDiskService.js';
import { sendTelegramMessage } from '../utils/telegramService.js';

const VERIFICATION_COOLDOWN_HOURS = 24; // 1 раз в сутки
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Получить путь к папке верификации пользователя на Яндекс.Диске
 * @param {number} userId - ID пользователя
 * @returns {string} Путь вида "/verifications/{userId}"
 */
function getUserVerificationPath(userId) {
  return `/verifications/${userId}`;
}

/**
 * Проверка возможности подачи заявки на верификацию
 * @param {number} userId - ID пользователя
 * @returns {Promise<{canSubmit: boolean, reason?: string}>} Результат проверки
 */
async function canSubmitVerification(userId) {
  // Получить время последней попытки
  const result = await pool.query(
    'SELECT last_verification_attempt, is_verified FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Пользователь не найден');
  }

  const user = result.rows[0];

  // Если уже верифицирован, нельзя подавать новую заявку
  if (user.is_verified) {
    return {
      canSubmit: false,
      reason: 'Вы уже верифицированы'
    };
  }

  // Проверить, есть ли заявка на модерации
  const pendingResult = await pool.query(
    'SELECT id FROM user_verifications WHERE user_id = $1 AND status = $2',
    [userId, 'pending']
  );

  if (pendingResult.rows.length > 0) {
    return {
      canSubmit: false,
      reason: 'У вас уже есть заявка на модерации'
    };
  }

  // Проверить, прошли ли сутки с последней попытки
  if (user.last_verification_attempt) {
    const lastAttempt = new Date(user.last_verification_attempt);
    const now = new Date();
    const hoursSinceLastAttempt = (now - lastAttempt) / (1000 * 60 * 60);

    if (hoursSinceLastAttempt < VERIFICATION_COOLDOWN_HOURS) {
      // Рассчитать время окончания кулдауна
      const cooldownEndTime = new Date(lastAttempt.getTime() + (VERIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000));
      const hoursRemaining = Math.ceil(VERIFICATION_COOLDOWN_HOURS - hoursSinceLastAttempt);

      return {
        canSubmit: false,
        reason: `Вы сможете подать новую заявку через ${hoursRemaining} ч.`,
        cooldownEndTime: cooldownEndTime.toISOString(),
        lastAttempt: lastAttempt.toISOString()
      };
    }
  }

  return {
    canSubmit: true,
    cooldownEndTime: null,
    lastAttempt: user.last_verification_attempt ? new Date(user.last_verification_attempt).toISOString() : null
  };
}

/**
 * Отправка заявки на верификацию
 * @param {number} userId - ID пользователя
 * @param {string} fullName - Полное ФИО пользователя
 * @param {Buffer} screenshot1Buffer - Буфер первого скриншота
 * @param {Buffer} screenshot2Buffer - Буфер второго скриншота
 * @returns {Promise<{success: boolean, verificationId: number}>} Результат отправки
 */
async function submitVerification(userId, fullName, screenshot1Buffer, screenshot2Buffer) {
  // Проверка возможности подачи заявки
  const canSubmit = await canSubmitVerification(userId);
  if (!canSubmit.canSubmit) {
    throw new Error(canSubmit.reason);
  }

  // Валидация размера файлов
  if (screenshot1Buffer.length > MAX_SCREENSHOT_SIZE) {
    throw new Error('Первый скриншот превышает максимальный размер 5MB');
  }
  if (screenshot2Buffer.length > MAX_SCREENSHOT_SIZE) {
    throw new Error('Второй скриншот превышает максимальный размер 5MB');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Создать папку для верификации пользователя
    const verificationPath = getUserVerificationPath(userId);
    await ensureFolderExists(verificationPath);

    // Генерация уникальных имен файлов с временной меткой
    const timestamp = Date.now();
    const screenshot1Path = `${verificationPath}/screenshot_1_${timestamp}.jpg`;
    const screenshot2Path = `${verificationPath}/screenshot_2_${timestamp}.jpg`;

    // Загрузка скриншотов на Yandex.Disk
    await uploadFile(screenshot1Path, screenshot1Buffer, 'image/jpeg');
    await uploadFile(screenshot2Path, screenshot2Buffer, 'image/jpeg');

    // Публикация файлов (для доступа админом)
    await publishFile(screenshot1Path);
    await publishFile(screenshot2Path);

    // Создание записи в таблице user_verifications
    const insertResult = await client.query(
      `INSERT INTO user_verifications
        (user_id, full_name, screenshot_1_path, screenshot_2_path, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [userId, fullName, screenshot1Path, screenshot2Path]
    );

    // Обновление времени последней попытки
    await client.query(
      'UPDATE users SET last_verification_attempt = NOW() WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    console.log(`[VERIFICATION] Заявка создана: user_id=${userId}, verification_id=${insertResult.rows[0].id}`);

    return {
      success: true,
      verificationId: insertResult.rows[0].id
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VERIFICATION] Ошибка создания заявки:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получение списка заявок на модерацию (для администратора)
 * @returns {Promise<Array>} Список заявок со статусом 'pending'
 */
async function getPendingVerifications() {
  const result = await pool.query(
    `SELECT
      v.id,
      v.user_id,
      v.full_name,
      v.screenshot_1_path,
      v.screenshot_2_path,
      v.submitted_at,
      u.personal_id,
      u.email,
      u.username
     FROM user_verifications v
     JOIN users u ON v.user_id = u.id
     WHERE v.status = 'pending'
     ORDER BY v.submitted_at ASC`
  );

  return result.rows;
}

/**
 * Одобрение заявки на верификацию
 * @param {number} verificationId - ID заявки
 * @param {number} adminId - ID администратора
 * @returns {Promise<{success: boolean}>} Результат одобрения
 */
async function approveVerification(verificationId, adminId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Получить информацию о заявке
    const verificationResult = await client.query(
      'SELECT user_id, status FROM user_verifications WHERE id = $1',
      [verificationId]
    );

    if (verificationResult.rows.length === 0) {
      throw new Error('Заявка на верификацию не найдена');
    }

    const verification = verificationResult.rows[0];

    if (verification.status !== 'pending') {
      throw new Error('Заявка уже обработана');
    }

    // Обновить статус заявки
    await client.query(
      `UPDATE user_verifications
       SET status = 'approved', processed_at = NOW(), processed_by = $1
       WHERE id = $2`,
      [adminId, verificationId]
    );

    // Обновить статус верификации пользователя
    await client.query(
      'UPDATE users SET is_verified = TRUE, verified_at = NOW() WHERE id = $1',
      [verification.user_id]
    );

    await client.query('COMMIT');

    console.log(`[VERIFICATION] Заявка одобрена: verification_id=${verificationId}, user_id=${verification.user_id}, admin_id=${adminId}`);

    return { success: true };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VERIFICATION] Ошибка одобрения заявки:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Отклонение заявки на верификацию
 * @param {number} verificationId - ID заявки
 * @param {number} adminId - ID администратора
 * @param {string} rejectionReason - Причина отклонения
 * @returns {Promise<{success: boolean}>} Результат отклонения
 */
async function rejectVerification(verificationId, adminId, rejectionReason) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Получить информацию о заявке
    const verificationResult = await client.query(
      `SELECT v.user_id, v.status, v.screenshot_1_path, v.screenshot_2_path, u.telegram_chat_id
       FROM user_verifications v
       JOIN users u ON v.user_id = u.id
       WHERE v.id = $1`,
      [verificationId]
    );

    if (verificationResult.rows.length === 0) {
      throw new Error('Заявка на верификацию не найдена');
    }

    const verification = verificationResult.rows[0];

    if (verification.status !== 'pending') {
      throw new Error('Заявка уже обработана');
    }

    // Обновить статус заявки
    await client.query(
      `UPDATE user_verifications
       SET status = 'rejected', rejection_reason = $1, processed_at = NOW(), processed_by = $2
       WHERE id = $3`,
      [rejectionReason, adminId, verificationId]
    );

    // Удалить скриншоты с Yandex.Disk
    try {
      await deleteFile(verification.screenshot_1_path);
      await deleteFile(verification.screenshot_2_path);
    } catch (deleteError) {
      console.error('[VERIFICATION] Ошибка удаления скриншотов (игнорируем):', deleteError.message);
    }

    await client.query('COMMIT');

    console.log(`[VERIFICATION] Заявка отклонена: verification_id=${verificationId}, user_id=${verification.user_id}, admin_id=${adminId}`);

    // Отправить Telegram-уведомление, если подключен
    if (verification.telegram_chat_id) {
      const message = `❌ Ваша заявка на верификацию отклонена\n\nПричина: ${rejectionReason}\n\nВы можете подать новую заявку через 24 часа.`;
      try {
        await sendTelegramMessage(verification.telegram_chat_id, message);
      } catch (telegramError) {
        console.error('[VERIFICATION] Ошибка отправки Telegram-уведомления:', telegramError.message);
      }
    }

    return { success: true };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VERIFICATION] Ошибка отклонения заявки:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получение статуса верификации пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Статус верификации
 */
async function getUserVerificationStatus(userId) {
  const result = await pool.query(
    `SELECT
      u.is_verified,
      u.verified_at,
      u.last_verification_attempt,
      v.id as pending_verification_id,
      v.status as pending_status,
      v.rejection_reason,
      v.submitted_at as pending_submitted_at
     FROM users u
     LEFT JOIN user_verifications v ON u.id = v.user_id AND v.status = 'pending'
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Пользователь не найден');
  }

  const data = result.rows[0];

  // Получить последнюю отклоненную заявку (если есть)
  const rejectedResult = await pool.query(
    `SELECT rejection_reason, processed_at
     FROM user_verifications
     WHERE user_id = $1 AND status = 'rejected'
     ORDER BY processed_at DESC
     LIMIT 1`,
    [userId]
  );

  const lastRejection = rejectedResult.rows[0] || null;

  // Рассчитать время окончания кулдауна
  let cooldownUntil = null;
  if (data.last_verification_attempt && !data.is_verified) {
    const lastAttempt = new Date(data.last_verification_attempt);
    const cooldownEndTime = new Date(lastAttempt.getTime() + (VERIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000));
    const now = new Date();

    // Если кулдаун ещё действует
    if (now < cooldownEndTime) {
      cooldownUntil = cooldownEndTime.toISOString();
    }
  }

  return {
    isVerified: data.is_verified,
    verifiedAt: data.verified_at,
    lastAttempt: data.last_verification_attempt,
    hasPendingRequest: !!data.pending_verification_id,
    lastRejection: lastRejection,
    cooldownUntil: cooldownUntil
  };
}

/**
 * Отмена верификации при смене компьютерного номера
 * @param {number} userId - ID пользователя
 * @returns {Promise<void>}
 */
async function revokeVerification(userId) {
  await pool.query(
    'UPDATE users SET is_verified = FALSE, verified_at = NULL WHERE id = $1',
    [userId]
  );

  console.log(`[VERIFICATION] Верификация отменена для user_id=${userId}`);
}

export {
  canSubmitVerification,
  submitVerification,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  getUserVerificationStatus,
  revokeVerification,
  MAX_SCREENSHOT_SIZE
};
