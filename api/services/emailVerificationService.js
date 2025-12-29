/**
 * Сервис для работы с проверочными кодами (антибот капча)
 * Использует Redis для хранения сессий верификации
 */

import Redis from 'ioredis';
import { randomBytes } from 'crypto';

// Подключаемся к Redis
const redis = new Redis();

redis.on('connect', () => {
  console.log('✅ [EmailVerificationService] Успешное подключение к Redis');
});

redis.on('error', (err) => {
  console.error('❌ [EmailVerificationService] Ошибка подключения к Redis:', err);
});

// Константы
const VERIFICATION_CODE_TTL_SECONDS = 5 * 60; // 5 минут
const VERIFICATION_MAX_ATTEMPTS = 5;
const VERIFICATION_LOCK_DURATION_SECONDS = 5 * 60; // 5 минут

/**
 * Создать новую сессию верификации
 * @returns {Promise<{token: string, code: string}>} Токен и код верификации
 */
async function createVerificationSession() {
  const token = randomBytes(16).toString('hex');
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const redisKey = `verification:${token}`;

  const session = {
    code,
    attempts: 0,
    lockedUntil: null,
  };

  // Сохраняем сессию в Redis на 5 минут
  await redis.set(redisKey, JSON.stringify(session), 'EX', VERIFICATION_CODE_TTL_SECONDS);

  return { token, code };
}

/**
 * Получить сессию верификации по токену
 * @param {string} token - Токен сессии
 * @returns {Promise<Object|null>} Данные сессии или null
 */
async function getVerificationSession(token) {
  if (!token) {
    return null;
  }

  const redisKey = `verification:${token}`;
  const sessionData = await redis.get(redisKey);

  if (!sessionData) {
    return null;
  }

  const session = JSON.parse(sessionData);
  const now = Date.now();

  // Проверяем, не снялась ли блокировка
  if (session.lockedUntil && now >= session.lockedUntil) {
    session.lockedUntil = null;
    session.attempts = 0;
    // Обновляем сессию в Redis, чтобы снять блокировку
    const ttl = await redis.ttl(redisKey);
    if (ttl > 0) {
      await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
    }
  }

  return session;
}

/**
 * Проверить код верификации
 * @param {string} verificationToken - Токен сессии
 * @param {string} verificationCode - Код для проверки
 * @returns {Promise<{ok: boolean, status: number, message?: string}>} Результат проверки
 */
async function validateVerificationCode(verificationToken, verificationCode) {
  const sanitizedCode = String(verificationCode || '').trim();

  if (!verificationToken || sanitizedCode.length === 0) {
    return { ok: false, status: 400, message: 'Проверочный код обязателен' };
  }

  const redisKey = `verification:${verificationToken}`;
  const session = await getVerificationSession(verificationToken);

  if (!session) {
    return { ok: false, status: 400, message: 'Проверочный код недействителен или истек. Обновите код.' };
  }

  const now = Date.now();

  if (session.lockedUntil && now < session.lockedUntil) {
    const retrySeconds = Math.ceil((session.lockedUntil - now) / 1000);
    return { ok: false, status: 429, message: `Превышено количество попыток. Попробуйте снова через ${retrySeconds} секунд.` };
  }

  if (session.code !== sanitizedCode) {
    session.attempts += 1;
    const ttl = await redis.ttl(redisKey);

    if (ttl <= 0) {
      return { ok: false, status: 400, message: 'Проверочный код истек. Обновите код.' };
    }

    if (session.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      session.lockedUntil = now + (VERIFICATION_LOCK_DURATION_SECONDS * 1000);
      await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
      return { ok: false, status: 429, message: 'Превышено количество попыток. Форма заблокирована на 5 минут.' };
    }

    // Просто обновляем количество попыток
    await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
    return { ok: false, status: 400, message: 'Неверный проверочный код' };
  }

  // Если код верный, удаляем сессию
  await redis.del(redisKey);

  return { ok: true, status: 200 };
}

export {
  redis,
  createVerificationSession,
  getVerificationSession,
  validateVerificationCode,
  VERIFICATION_CODE_TTL_SECONDS,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_LOCK_DURATION_SECONDS
};
