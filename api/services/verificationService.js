/**
 * Сервис для работы с верификацией пользователей
 * Управляет заявками на верификацию компьютерных номеров
 */

import { pool } from '../db.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import { sendEmail } from '../utils/emailService.js';
import { getVerificationApprovedMessage } from '../templates/telegramTemplates.js';
import { getVerificationApprovedTemplate } from '../templates/emailTemplates.js';

const VERIFICATION_COOLDOWN_HOURS = 24; // 1 раз в сутки

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
 * @param {string} referralLink - Персональная реферальная ссылка FOHOW
 * @returns {Promise<{success: boolean, verificationId: number}>} Результат отправки
 */
async function submitVerification(userId, fullName, referralLink) {
  // Проверка возможности подачи заявки
  const canSubmit = await canSubmitVerification(userId);
  if (!canSubmit.canSubmit) {
    throw new Error(canSubmit.reason);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Создание записи в таблице user_verifications
    const insertResult = await client.query(
      `INSERT INTO user_verifications
        (user_id, full_name, referral_link, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [userId, fullName, referralLink]
    );

    // Обновление времени последней попытки
    await client.query(
      'UPDATE users SET last_verification_attempt = NOW() WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    console.log(`[VERIFICATION] Заявка создана: user_id=${userId}, verification_id=${insertResult.rows[0].id}`);

    // ========================================
    // Уведомить всех админов о новой заявке
    // ========================================
    try {
      // Получить список всех админов с подключенным Telegram
      const adminsResult = await pool.query(
        `SELECT telegram_chat_id, username, email
         FROM users
         WHERE role = 'admin' AND telegram_chat_id IS NOT NULL`
      );

      if (adminsResult.rows.length > 0) {
        // Получить информацию о пользователе, подавшем заявку
        const userResult = await pool.query(
          `SELECT personal_id, email, username FROM users WHERE id = $1`,
          [userId]
        );

        const user = userResult.rows[0];

        const message = `🔔 Новая заявка на верификацию!\n\n` +
          `👤 ФИО: ${fullName}\n` +
          `🔢 Номер: ${user.personal_id || 'не указан'}\n` +
          `📧 Email: ${user.email}\n` +
          `👥 Username: ${user.username || 'не указан'}\n` +
          `🔗 Реферальная ссылка: ${referralLink}\n\n` +
          `⚡ Перейдите в админ-панель для проверки заявки.`;

        // Отправить уведомление каждому админу
        for (const admin of adminsResult.rows) {
          try {
            await sendTelegramMessage(admin.telegram_chat_id, message);
            console.log(`[VERIFICATION] Уведомление отправлено админу: ${admin.email}`);
          } catch (telegramError) {
            console.error(`[VERIFICATION] Ошибка отправки уведомления админу ${admin.email}:`, telegramError.message);
          }
        }
      } else {
        console.log('[VERIFICATION] Нет админов с подключенным Telegram для уведомления');
      }
    } catch (notifyError) {
      console.error('[VERIFICATION] Ошибка отправки уведомлений админам:', notifyError.message);
      // Не прерываем выполнение, заявка уже создана
    }
    // ========================================

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
      v.referral_link,
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

    // Получить информацию о заявке И данные пользователя для уведомлений
    const verificationResult = await client.query(
      `SELECT v.user_id, v.status, u.telegram_chat_id, u.personal_id, u.email, u.full_name
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

    const profileUrl = 'https://interactive.marketingfohow.ru/';

    // Отправить Telegram-уведомление с кнопкой
    if (verification.telegram_chat_id) {
      try {
        const tgMessage = getVerificationApprovedMessage(verification.personal_id, profileUrl);
        await sendTelegramMessage(verification.telegram_chat_id, tgMessage.text, {
          parse_mode: tgMessage.parse_mode,
          reply_markup: tgMessage.reply_markup
        });
        console.log(`[VERIFICATION] Telegram-уведомление об одобрении отправлено пользователю ${verification.user_id}`);
      } catch (telegramError) {
        console.error('[VERIFICATION] Ошибка отправки Telegram-уведомления:', telegramError.message);
      }
    }

    // Отправить Email-уведомление
    if (verification.email) {
      try {
        const emailHtml = getVerificationApprovedTemplate({
          userName: verification.full_name || 'Пользователь',
          personalId: verification.personal_id,
          profileUrl
        });
        await sendEmail(verification.email, '✅ Верификация одобрена — FOHOW Interactive', emailHtml);
        console.log(`[VERIFICATION] Email-уведомление об одобрении отправлено на ${verification.email}`);
      } catch (emailError) {
        console.error('[VERIFICATION] Ошибка отправки Email-уведомления:', emailError.message);
      }
    }

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
      `SELECT v.user_id, v.status, u.telegram_chat_id
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

/**
 * Отмена заявки на верификацию пользователем
 * @param {number} userId - ID пользователя
 * @returns {Promise<{success: boolean}>} Результат отмены
 */
async function cancelVerificationByUser(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Найти pending заявку
    const verificationResult = await client.query(
      `SELECT v.id, u.email, u.telegram_chat_id
       FROM user_verifications v
       JOIN users u ON v.user_id = u.id
       WHERE v.user_id = $1 AND v.status = 'pending'`,
      [userId]
    );

    if (verificationResult.rows.length === 0) {
      throw new Error('Активная заявка на верификацию не найдена');
    }

    const verification = verificationResult.rows[0];

    // Удалить заявку из БД
    await client.query(
      'DELETE FROM user_verifications WHERE id = $1',
      [verification.id]
    );

    // Обновить last_verification_attempt для кулдауна
    await client.query(
      'UPDATE users SET last_verification_attempt = NOW() WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    console.log(`[VERIFICATION] Заявка отменена пользователем: user_id=${userId}, verification_id=${verification.id}`);

    // Отправить Telegram-уведомление пользователю
    if (verification.telegram_chat_id) {
      try {
        const userMessage = '❌ Вы отменили заявку на верификацию.';
        await sendTelegramMessage(verification.telegram_chat_id, userMessage);
      } catch (telegramError) {
        console.error('[VERIFICATION] Ошибка отправки Telegram-уведомления пользователю:', telegramError.message);
      }
    }

    // Отправить Telegram-уведомление всем админам
    try {
      const adminsResult = await pool.query(
        `SELECT telegram_chat_id, email
         FROM users
         WHERE role = 'admin' AND telegram_chat_id IS NOT NULL`
      );

      if (adminsResult.rows.length > 0) {
        const adminMessage = `ℹ️ Пользователь ${verification.email} отменил заявку на верификацию.`;

        for (const admin of adminsResult.rows) {
          try {
            await sendTelegramMessage(admin.telegram_chat_id, adminMessage);
          } catch (telegramError) {
            console.error(`[VERIFICATION] Ошибка отправки уведомления админу ${admin.email}:`, telegramError.message);
          }
        }
      }
    } catch (notifyError) {
      console.error('[VERIFICATION] Ошибка отправки уведомлений админам:', notifyError.message);
    }

    return { success: true };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VERIFICATION] Ошибка отмены заявки:', error);
    throw error;
  } finally {
    client.release();
  }
}

export {
  canSubmitVerification,
  submitVerification,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  getUserVerificationStatus,
  revokeVerification,
  cancelVerificationByUser
};
