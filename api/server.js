import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { authenticateToken } from './middleware/auth.js';
import { checkAdmin } from './middleware/checkAdmin.js';
import { createWriteStream, promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import Redis from 'ioredis'; // <-- Добавлен импорт Redis
import { checkFeature } from './middleware/checkFeature.js';
import { checkUsageLimit } from './middleware/checkUsageLimit.js';
import { registerPromoRoutes } from './routes/promo.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerImageRoutes } from './routes/images.js';
import { registerAnchorRoutes } from './routes/anchors.js';
import { registerBoardFolderRoutes } from './routes/boardFolders.js';
import { registerDiscussionRoutes } from './routes/discussion.js';
import verificationRoutes from './routes/verification.js';
import { registerPartnerRoutes } from './routes/partners.js';
import { registerRelationshipRoutes } from './routes/relationships.js';
import { registerUserRoutes } from './routes/users.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerChatRoutes } from './routes/chats.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { initializeCronTasks } from './cron/tasks.js';
import { initializeTelegramBot } from './bot/telegramBot.js';
import { setupWebSocket, notifyNewMessage, notifyChatsUpdate } from './socket.js';
import {
  ensureFolderExists,
  getSharedRootPath,
  getSharedPendingFolderPath,
  YANDEX_DISK_BASE_DIR
} from './services/yandexDiskService.js';
import { sendTelegramMessage } from './utils/telegramService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = Fastify({ logger: true });

// Проверяем наличие необходимых переменных окружения
if (!process.env.JWT_SECRET) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET не определен в переменных окружения!');
  console.error('Создайте файл .env и добавьте: JWT_SECRET=ваш_секретный_ключ');
  process.exit(1);
}

// ---> НАЧАЛО НОВОГО БЛОКА С REDIS
// Подключаемся к Redis. Если ваш Redis на том же сервере и на стандартном порту,
// этого достаточно. Иначе укажите параметры: new Redis('redis://:password@hostname:port/0')
const redis = new Redis();

redis.on('connect', () => {
  console.log('✅ Успешное подключение к Redis');
});
redis.on('error', (err) => {
  console.error('❌ Ошибка подключения к Redis:', err);
});

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60; // 5 минут в секундах
const VERIFICATION_MAX_ATTEMPTS = 5;
const VERIFICATION_LOCK_DURATION_SECONDS = 5 * 60; // 5 минут в секундах

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
    const ttl = await redis.ttl(redisKey); // Получаем оставшееся время жизни
    if (ttl > 0) {
      await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
    }
  }

  return session;
}

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

    if (ttl <= 0) { // Если ключ успел истечь между get и этой проверкой
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
// <--- КОНЕЦ НОВОГО БЛОКА С REDIS


// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB максимум
  }
});
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/'
});

app.post('/api/verification-code', async (req, reply) => {
  try {
    // Вызов асинхронной функции
    const { token, code } = await createVerificationSession();

    return reply.send({ token, code });
  } catch (err) {
    req.log.error('❌ Ошибка генерации проверочного кода:', err);
    return reply.code(500).send({ message: 'Не удалось создать проверочный код' });
  }
});

// === ФУНКЦИЯ ГЕНЕРАЦИИ УНИКАЛЬНОГО PERSONAL_ID ===
async function generateUniquePersonalId(client) {
  let attempts = 0;
  const maxAttempts = 1000; // Защита от бесконечного цикла

  while (attempts < maxAttempts) {
    // 1. Получить текущий счётчик с блокировкой
    const counterResult = await client.query(
      'SELECT last_issued_number FROM personal_id_counter WHERE id = 1 FOR UPDATE'
    );

    if (counterResult.rows.length === 0) {
      throw new Error('Счётчик personal_id не инициализирован в базе данных');
    }

    let nextNumber = counterResult.rows[0].last_issued_number + 1;

    // 2. Сгенерировать номер в формате RUY00XXXXXXXXX
    const personalId = `RUY00${String(nextNumber).padStart(9, '0')}`;

    // 3. Проверить, свободен ли этот номер
    const existingUser = await client.query(
      'SELECT id FROM users WHERE personal_id = $1',
      [personalId]
    );

    if (existingUser.rows.length === 0) {
      // Номер свободен! Обновить счётчик и вернуть номер
      await client.query(
        'UPDATE personal_id_counter SET last_issued_number = $1, updated_at = NOW() WHERE id = 1',
        [nextNumber]
      );

      console.log(`✅ Выдан свободный номер: ${personalId}`);
      return personalId;
    }

    // Номер занят, пробуем следующий
    console.log(`⚠️ Номер ${personalId} занят, пропускаем...`);

    // Обновить счётчик, чтобы в следующий раз начать со следующего номера
    await client.query(
      'UPDATE personal_id_counter SET last_issued_number = $1, updated_at = NOW() WHERE id = 1',
      [nextNumber]
    );

    attempts++;
  }

  throw new Error('Не удалось сгенерировать уникальный personal_id после ' + maxAttempts + ' попыток');
}

// === РЕГИСТРАЦИЯ ===
app.post('/api/register', async (req, reply) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Проверить, есть ли email в verified_emails (постоянное хранилище)
    const verifiedEmailCheck = await client.query(
      'SELECT email FROM verified_emails WHERE email = $1',
      [email]
    );

    if (verifiedEmailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return reply.code(400).send({
        error: 'Данный аккаунт уже есть в системе. Войдите в него или, если вы забыли пароль, нажмите "Восстановить пароль".',
        field: 'email',
        accountExists: true
      });
    }

    // 2. Проверить, есть ли уже пользователь с таким email (на случай незавершённой регистрации)
    const existingUser = await client.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];

      if (user.email_verified) {
        // Email уже верифицирован - значит аккаунт активен
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'Данный аккаунт уже есть в системе. Войдите в него или, если вы забыли пароль, нажмите "Восстановить пароль".',
          field: 'email',
          accountExists: true
        });
      } else {
        // Email НЕ верифицирован - разрешить повторную регистрацию (перезаписать данные)
        const hash = await bcrypt.hash(password, 10);

        await client.query(
          'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2',
          [hash, email]
        );

        await client.query('COMMIT');

        return reply.send({
          success: true,
          message: 'Вы зарегистрировались. Войдите под своими данными.',
          requiresLogin: true
        });
      }
    }

    // 3. Создать нового пользователя БЕЗ тарифа
    const hash = await bcrypt.hash(password, 10);

    // Настройки конфиденциальности по умолчанию (все поля закрыты)
    const defaultSearchSettings = {
      username: false,
      phone: false,
      city: false,
      country: false,
      office: false,
      personal_id: false,
      telegram_user: false,
      instagram_profile: false
    };

    const insertResult = await client.query(
      `INSERT INTO users (email, password, email_verified, created_at, search_settings)
       VALUES ($1, $2, FALSE, NOW(), $3)
       RETURNING id, email`,
      [email, hash, JSON.stringify(defaultSearchSettings)]
    );

    const newUser = insertResult.rows[0];

    console.log(`✅ Пользователь создан (email не верифицирован): ${newUser.email}`);

    await client.query('COMMIT');

    return reply.send({
      success: true,
      message: 'Вы зарегистрировались. Войдите под своими данными.',
      requiresLogin: true
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка регистрации:', error);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === АВТОРИЗАЦИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ===
app.post('/api/login', async (req, reply) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }

  try {
    // 1. Найти пользователя
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];

    // 2. Проверить пароль
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }

    // 3. Проверить, верифицирован ли email
    if (!user.email_verified) {
      // Email НЕ верифицирован - отправить код подтверждения

      // Генерировать 6-значный код
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Сохранить код в БД (действителен 10 минут)
      await pool.query(
        `INSERT INTO email_verification_codes (email, code, expires_at, ip_address)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)`,
        [email, code, req.ip]
      );

      // Отправить код на email
      const { sendVerificationEmail } = await import('./utils/email.js');
      await sendVerificationEmail(email, code);

      console.log(`📧 Код подтверждения отправлен на ${email}: ${code}`);

      return reply.send({
        requiresVerification: true,
        email: email,
        message: 'На ваш email отправлен код подтверждения. Введите его для завершения входа.'
      });
    }

    // 4. Email верифицирован - продолжить с выдачей токена

    console.log(`[LOGIN] Успешная аутентификация для пользователя ID: ${user.id}. Начинаем управление сессиями.`);

    // === УПРАВЛЕНИЕ СЕССИЯМИ ===
    // Получаем тарифный план пользователя и лимит сессий
    const planResult = await pool.query(
      `SELECT sp.session_limit
       FROM users u
       JOIN subscription_plans sp ON u.plan_id = sp.id
       WHERE u.id = $1`,
      [user.id]
    );

    if (!planResult.rows.length || planResult.rows[0].session_limit == null) {
      console.error(`[LOGIN] Не удалось определить лимит сессий для пользователя ID: ${user.id}. Возможно, у пользователя нет тарифа или в тарифе не указан session_limit.`);
      // Отправляем ответ без создания сессии, но логин считаем успешным
      return reply.send({ token });
    }
    const sessionLimit = planResult.rows[0].session_limit;
    console.log(`[LOGIN] Тариф получен. Лимит сессий: ${sessionLimit}`);

    // Администраторы имеют неограниченное количество сессий
    const isAdmin = user.role === 'admin';

    // Если установлен лимит сессий и пользователь не админ, управляем ими
    if (!isAdmin && sessionLimit && !isNaN(sessionLimit) && sessionLimit > 0) {
      // Подсчитываем активные сессии
      const sessionsCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM active_sessions WHERE user_id = $1',
        [user.id]
      );

      const activeSessionsCount = parseInt(sessionsCountResult.rows[0].count, 10);

      console.log(`[LOGIN] Найдено активных сессий: ${activeSessionsCount}`);

      // Если количество сессий >= лимита, удаляем самую старую
      if (activeSessionsCount >= sessionLimit) {
        console.log(`[LOGIN] Лимит сессий превышен. Удаляем самую старую сессию.`);
        await pool.query(
          `DELETE FROM active_sessions
           WHERE id IN (
             SELECT id FROM active_sessions
             WHERE user_id = $1
             ORDER BY created_at ASC
             LIMIT 1
           )`,
          [user.id]
        );
      }
    } else if (isAdmin) {
      console.log(`[LOGIN] Администратор - лимит сессий не применяется`);
    }

    // Удаляем хэш пароля перед отправкой на клиент
    delete user.password;

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Декодируем токен, чтобы получить дату истечения
    const decodedToken = jwt.decode(token);
    const expiresAt = new Date(decodedToken.exp * 1000);

    console.log(`[LOGIN] Подготовка к созданию новой сессии. Токен: ${token}`);

    // Извлекаем signature из токена (последняя часть после второй точки)
    const tokenParts = token.split('.');
    const tokenSignature = tokenParts.length === 3 ? tokenParts[2] : token;

    // Создаем новую сессию в базе данных
    await pool.query(
      `INSERT INTO active_sessions (user_id, token_signature, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenSignature, req.ip, req.headers['user-agent'] || null, expiresAt]
    );

    console.log(`[LOGIN] Новая сессия успешно создана в базе данных.`);

    // ВОЗВРАЩАЕМ ПОЛНЫЙ ОБЪЕКТ ПОЛЬЗОВАТЕЛЯ
    return reply.send({
      success: true,
      token,
      user: user // Отправляем весь объект user
    });
  } catch (err) {
    console.error('❌ Ошибка авторизации:', err);
    console.error('[LOGIN] Ошибка при управлении сессией:', err);
    // ... (остальная часть обработки ошибок остается без изменений)
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return reply.code(500).send({ error: 'Ошибка подключения к базе данных' });
    }
    if (err.name === 'JsonWebTokenError') {
      return reply.code(500).send({ error: 'Ошибка создания токена авторизации' });
    }
    
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Ошибка сервера: ${err.message}`
      : 'Ошибка сервера. Попробуйте позже';

    return reply.code(500).send({ error: errorMessage });
  }
});

// === ПОВТОРНАЯ ОТПРАВКА КОДА ПОДТВЕРЖДЕНИЯ ===
app.post('/api/resend-verification-code', async (req, reply) => {
  const { email } = req.body;

  try {
    // Валидация входных данных
    if (!email) {
      return reply.code(400).send({ error: 'Email обязателен' });
    }

    // 1. Проверить, прошло ли 30 секунд с последней отправки
    const lastCode = await pool.query(
      `SELECT created_at FROM email_verification_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (lastCode.rows.length > 0) {
      const lastSent = new Date(lastCode.rows[0].created_at);
      const now = new Date();
      const secondsSinceLastSent = (now - lastSent) / 1000;

      if (secondsSinceLastSent < 30) {
        const waitTime = Math.ceil(30 - secondsSinceLastSent);
        return reply.code(429).send({
          error: `Пожалуйста, подождите ${waitTime} секунд перед повторной отправкой кода`,
          waitTime: waitTime
        });
      }
    }

    // 2. Генерировать новый 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Сохранить код в БД (действителен 10 минут)
    await pool.query(
      `INSERT INTO email_verification_codes (email, code, expires_at, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)`,
      [email, code, req.ip]
    );

    // 4. Отправить код на email
    const { sendVerificationEmail } = await import('./utils/email.js');
    await sendVerificationEmail(email, code);

    console.log(`📧 Повторная отправка кода на ${email}: ${code}`);

    return reply.send({
      success: true,
      message: 'Новый код подтверждения отправлен на ваш email'
    });

  } catch (error) {
    console.error('❌ Ошибка повторной отправки кода:', error);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});
function validateOffice(office) {
  const pattern = /^[A-Z]{3}\d{2,3}$/;
  return pattern.test(office);
}

function validatePersonalId(personalId, office) {
  if (!personalId || !office) return false;

  const normalizedOffice = office.trim().toUpperCase();
  if (!validateOffice(normalizedOffice)) return false;

  if (!personalId.startsWith(normalizedOffice)) return false;
  const suffix = personalId.substring(normalizedOffice.length);
  return /^\d{9}$/.test(suffix);
}
// === ПРОВЕРКА КОДА И АКТИВАЦИЯ АККАУНТА ===
app.post('/api/verify-email', async (req, reply) => {
  const { email, code } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Проверить код
    const codeResult = await client.query(
      `SELECT * FROM email_verification_codes
       WHERE email = $1
         AND code = $2
         AND expires_at > NOW()
         AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, code]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.code(400).send({
        error: 'Неверный или истёкший код подтверждения',
        field: 'code'
      });
    }

    // 2. Отметить код как использованный
    await client.query(
      'UPDATE email_verification_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
      [codeResult.rows[0].id]
    );

    // 3. Получить пользователя
    const userResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    // 4. Получить Демо-тариф
    const demoPlanResult = await client.query(
      "SELECT id FROM subscription_plans WHERE code_name = 'demo'"
    );

    if (demoPlanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: 'Демо-тариф не найден в системе' });
    }

    const demoPlanId = demoPlanResult.rows[0].id;

    // 5. Генерировать personal_id
    const personalId = await generateUniquePersonalId(client);

    // 6. Активировать аккаунт
    await client.query(`
      UPDATE users
      SET email_verified = TRUE,
          plan_id = $1,
          subscription_started_at = NOW(),
          subscription_expires_at = NOW() + INTERVAL '7 days',
          personal_id = $2
      WHERE id = $3
    `, [demoPlanId, personalId, user.id]);

    // 7. Создать запись в demo_trials
    await client.query(
      `INSERT INTO demo_trials (user_id, started_at, converted_to_paid)
       VALUES ($1, NOW(), false)`,
      [user.id]
    );

    // 8. Создать запись в subscription_history
    await client.query(
      `INSERT INTO subscription_history (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days', 'email_verification', 0.00, 'RUB')`,
      [user.id, demoPlanId]
    );

    // 9. Добавить email в постоянное хранилище
    await client.query(
      `INSERT INTO verified_emails (email, user_id, notes)
       VALUES ($1, $2, 'Verified via email confirmation')
       ON CONFLICT (email) DO NOTHING`,
      [email, user.id]
    );

    console.log(`✅ Email подтверждён для ${email}, присвоен Демо-тариф и номер ${personalId}`);

    // 10. Создать JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await client.query('COMMIT');

    return reply.send({
      success: true,
      token: token,
      message: 'Email успешно подтверждён! Добро пожаловать!',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        personal_id: personalId
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка верификации email:', error);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === ВЫХОД (LOGOUT) ===
app.post('/api/logout', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    // Получаем JWT-токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({ error: 'Токен не предоставлен' });
    }

    // Удаляем сессию из базы данных по token_signature
    await pool.query(
      'DELETE FROM active_sessions WHERE token_signature = $1',
      [token]
    );

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка выхода:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ЗАЩИЩЕННЫЙ МАРШРУТ - ПРОФИЛЬ ===
app.get('/api/profile', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const result = await pool.query(
    `SELECT u.id, u.email, u.username, u.avatar_url, u.created_at, u.updated_at,
            u.country, u.city, u.office, u.personal_id, u.phone, u.full_name,
            u.telegram_user, u.telegram_channel, u.vk_profile, u.ok_profile,
            u.instagram_profile, u.whatsapp_contact,
            u.visibility_settings, u.search_settings, u.ui_preferences,
            u.subscription_started_at, u.subscription_expires_at,
            u.is_verified, u.verified_at,
            sp.id as plan_id, sp.name as plan_name, sp.features
     FROM users u
     LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
     WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const userData = result.rows[0];

    // Формируем объект пользователя с информацией о плане и верификации
    const user = {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      avatar_url: userData.avatar_url,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      country: userData.country,
      city: userData.city,
      office: userData.office,
      personal_id: userData.personal_id,
      phone: userData.phone,
      full_name: userData.full_name,
      telegram_user: userData.telegram_user,
      telegram_channel: userData.telegram_channel,
      vk_profile: userData.vk_profile,
      ok_profile: userData.ok_profile,
      instagram_profile: userData.instagram_profile,
      whatsapp_contact: userData.whatsapp_contact,
      visibility_settings: userData.visibility_settings,
      search_settings: userData.search_settings,
      ui_preferences: userData.ui_preferences,      
      subscription_started_at: userData.subscription_started_at,
      subscription_expires_at: userData.subscription_expires_at,
      is_verified: userData.is_verified || false,
      verified_at: userData.verified_at || null,
      plan: userData.plan_id ? {
        id: userData.plan_id,
        name: userData.plan_name,
        features: userData.features
      } : null
    };

    return reply.send({ user });
  } catch (err) {
    console.error('❌ Ошибка получения профиля:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ЗАБЫЛИ ПАРОЛЬ ===
app.post('/api/forgot-password', async (req, reply) => {
  const { email } = req.body;
  
  if (!email) {
    return reply.code(400).send({ error: 'Email обязателен' });
  }
  
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return reply.send({ success: true, message: 'Если email существует, письмо будет отправлено' });
    }
    
    const userId = result.rows[0].id;
    const token = jwt.sign({ userId, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
    
    const { sendPasswordResetEmail } = await import('./utils/email.js');
    await sendPasswordResetEmail(email, token);
    
    return reply.send({ success: true, message: 'Инструкции отправлены на email' });
  } catch (err) {
    console.error('❌ Ошибка forgot-password:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === СБРОС ПАРОЛЯ ===
app.post('/api/reset-password', async (req, reply) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return reply.code(400).send({ error: 'Токен и новый пароль обязательны' });
  }
  
  if (newPassword.length < 6) {
    return reply.code(400).send({ error: 'Пароль должен быть минимум 6 символов' });
  }
  
  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return reply.code(400).send({ error: 'Недействительный или истекший токен' });
    }
    
    const resetResult = await pool.query(
      'SELECT user_id, expires_at FROM password_resets WHERE token = $1',
      [token]
    );
    
    if (resetResult.rows.length === 0) {
      return reply.code(400).send({ error: 'Токен не найден' });
    }
    
    const { user_id, expires_at } = resetResult.rows[0];
    
    if (new Date() > new Date(expires_at)) {
      await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
      return reply.code(400).send({ error: 'Токен истек' });
    }
    
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user_id]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
    
    return reply.send({ success: true, message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('❌ Ошибка reset-password:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

    // === ОБНОВЛЕНИЕ ПРОФИЛЯ (ОТЛАДОЧНАЯ ВЕРСЯ 3.0) ===
    app.put('/api/profile', {
      preHandler: [authenticateToken]
    }, async (req, reply) => {
      // --- ОТЛАДКА: Логируем входящие данные ---
      console.log('--- [DEBUG] PUT /api/profile ---');
      console.log('Тело запроса (req.body):', req.body);
      console.log('---------------------------------');

      try {
        const userId = req.user.id;

        const {
          username, email, currentPassword, newPassword,
          country, city, office, personal_id, phone, full_name,
          telegram_user, telegram_channel, vk_profile, ok_profile,
          instagram_profile, whatsapp_contact, website
          , ui_preferences
        } = req.body;
        const normalizedOffice = typeof office === 'string' ? office.trim().toUpperCase() : null;
        const normalizedPersonalId = typeof personal_id === 'string' ? personal_id.trim().toUpperCase() : null;

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Пользователь не найден' });
        }
        const user = userResult.rows[0];
        const existingUiPreferences = user.ui_preferences || {};        
        const currentOffice = user.office ? user.office.toUpperCase() : '';
        const currentPersonalId = user.personal_id ? user.personal_id.toUpperCase() : null;
        const allowedUiPreferenceFields = [
          'animationColor',
          'isAnimationEnabled',
          'lineColor',
          'lineThickness',
          'backgroundGradient'
        ];
        let normalizedUiPreferences = null;

        if (ui_preferences && typeof ui_preferences === 'object') {
          normalizedUiPreferences = { ...existingUiPreferences };

          for (const key of allowedUiPreferenceFields) {
            if (!Object.prototype.hasOwnProperty.call(ui_preferences, key)) {
              continue;
            }

            if (key === 'animationColor' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
              normalizedUiPreferences[key] = ui_preferences[key];
            }

            if (key === 'isAnimationEnabled' && typeof ui_preferences[key] === 'boolean') {
              normalizedUiPreferences[key] = ui_preferences[key];
            }

            if (key === 'lineColor' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
              normalizedUiPreferences[key] = ui_preferences[key];
            }

            if (key === 'lineThickness') {
              const numericValue = Number(ui_preferences[key]);
              if (Number.isFinite(numericValue)) {
                const clamped = Math.min(Math.max(Math.round(numericValue), 1), 20);
                normalizedUiPreferences[key] = clamped;
              }
            }

            if (key === 'backgroundGradient' && typeof ui_preferences[key] === 'string' && ui_preferences[key].length > 0) {
              normalizedUiPreferences[key] = ui_preferences[key];
            }
          }

          const hasUpdates = Object.keys(normalizedUiPreferences).length > 0;
          if (!hasUpdates) {
            normalizedUiPreferences = null;
          }
        }

        const targetOffice = normalizedOffice ?? currentOffice;
        const targetPersonalId = normalizedPersonalId ?? currentPersonalId;

        if (normalizedOffice !== null && normalizedOffice !== '' && !validateOffice(normalizedOffice)) {
          return reply.code(400).send({
            error: 'Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)',
            field: 'office'
          });
        }

        // Проверки уникальности email и username
        if (email && email !== user.email) {
          const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
          if (emailCheck.rows.length > 0) return reply.code(409).send({ error: 'Этот email уже используется' });
        }
        if (username && username !== user.username) {
          const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
          if (usernameCheck.rows.length > 0) return reply.code(409).send({ error: 'Это имя пользователя уже занято' });
        }

        // Проверки personal_id (формат и уникальность)
        if (targetPersonalId) {
          if (!validatePersonalId(targetPersonalId, targetOffice)) {
            return reply.code(400).send({
              error: 'Компьютерный номер должен начинаться с представительства и содержать 9 цифр (например: RUY68000000000)',
              field: 'personal_id'
            });
          }
        }

        // Проверяем, изменились ли критические поля (personal_id или office)
        const personalIdChanged = normalizedPersonalId && normalizedPersonalId !== currentPersonalId;
        const officeChanged = normalizedOffice && normalizedOffice !== currentOffice;
        let verificationRevoked = false;

        // Если пользователь верифицирован и изменяются критические поля - снимаем верификацию
        if (user.is_verified && (personalIdChanged || officeChanged)) {
          await pool.query(
            'UPDATE users SET is_verified = FALSE, verified_at = NULL WHERE id = $1',
            [userId]
          );
          verificationRevoked = true;
          console.log(`⚠️ Верификация отменена для пользователя ${userId} из-за смены ${personalIdChanged ? 'personal_id' : ''}${personalIdChanged && officeChanged ? ' и ' : ''}${officeChanged ? 'office' : ''}`);

          // Отправить Telegram-уведомление о снятии верификации
          if (user.telegram_chat_id) {
            try {
              const message = '⚠️ Ваш статус верификации был снят из-за изменения компьютерного номера или представительства.';
              await sendTelegramMessage(user.telegram_chat_id, message);
              console.log(`[VERIFICATION] Telegram-уведомление о снятии верификации отправлено пользователю ${userId}`);
            } catch (telegramError) {
              console.error('[VERIFICATION] Ошибка отправки Telegram-уведомления:', telegramError.message);
            }
          }
        }

        if (personalIdChanged) {
          // Проверяем уникальность
          const personalIdCheck = await pool.query(
            'SELECT id FROM users WHERE personal_id = $1 AND id != $2',
            [normalizedPersonalId, userId]
          );
          if (personalIdCheck.rows.length > 0) {
            return reply.code(400).send({
              error: 'Этот компьютерный номер уже используется другим пользователем',
              field: 'personal_id'
            });
          }

          console.log(`✅ Пользователь ${userId} изменил personal_id на: ${normalizedPersonalId}`);
        }
        
        // Логика смены пароля... (оставляем без изменений)
        let passwordHash = user.password;
        if (newPassword && newPassword.trim().length > 0) {
          // ... (код смены пароля)
          const validPassword = await bcrypt.compare(currentPassword, user.password);
          if (!validPassword) return reply.code(400).send({ error: 'Неверный текущий пароль' });
          passwordHash = await bcrypt.hash(newPassword, 10);
        }

        const queryText = `UPDATE users SET
             username = COALESCE($1, username), email = COALESCE($2, email), password = $3,
             country = COALESCE($4, country), city = COALESCE($5, city), office = COALESCE($6, office),
             personal_id = COALESCE($7, personal_id), phone = COALESCE($8, phone), full_name = COALESCE($9, full_name),
             telegram_user = COALESCE($10, telegram_user), telegram_channel = COALESCE($11, telegram_channel),
             vk_profile = COALESCE($12, vk_profile), ok_profile = COALESCE($13, ok_profile),
             instagram_profile = COALESCE($14, instagram_profile), whatsapp_contact = COALESCE($15, whatsapp_contact),
             ui_preferences = COALESCE($16, ui_preferences),
             website = COALESCE($17, website),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $18
           RETURNING *`;
        
        const queryParams = [
            username || null, email || null, passwordHash,
            country || null, city || null, normalizedOffice || null, normalizedPersonalId || null, phone || null, full_name || null,
            telegram_user || null, telegram_channel || null, vk_profile || null, ok_profile || null,
            instagram_profile || null, whatsapp_contact || null,
            normalizedUiPreferences ? JSON.stringify(normalizedUiPreferences) : null,
            website || null,
            userId
        ];
        
        // --- ОТЛАДКА: Логируем сам запрос и его параметры ---
        console.log('--- [DEBUG] SQL Query ---');
        console.log('Запрос:', queryText);
        console.log('Параметры:', queryParams);
        console.log('-------------------------');

        const updateResult = await pool.query(queryText, queryParams);
        
        // --- ОТЛАДКА: Логируем результат выполнения запроса ---
        console.log('--- [DEBUG] SQL Result ---');
        console.log('Количество измененных строк:', updateResult.rowCount);
        console.log('Возвращенные данные:', updateResult.rows[0]);
        console.log('--------------------------');


        return reply.send({
          success: true,
          user: updateResult.rows[0],
          verificationRevoked: verificationRevoked
        });

      } catch (err) {
        // ... (обработка ошибок)
        console.error('❌ Ошибка обновления профиля:', err);
        return reply.code(500).send({ error: 'Ошибка сервера', details: err.message });
      }
    });

// === ОБНОВЛЕНИЕ НАСТРОЕК КОНФИДЕНЦИАЛЬНОСТИ ===
app.put('/api/profile/privacy', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { search_settings } = req.body;

    // Валидация: проверяем, что search_settings - это объект
    if (!search_settings || typeof search_settings !== 'object') {
      return reply.code(400).send({ error: 'Некорректный формат настроек конфиденциальности' });
    }

    // Список допустимых полей
    const allowedFields = [
      'username', 'full_name', 'phone', 'city', 'country', 'office',
      'personal_id', 'telegram_user', 'instagram_profile', 'vk_profile', 'website'
    ];

    // Валидация: проверяем, что все ключи допустимы и значения boolean
    for (const [key, value] of Object.entries(search_settings)) {
      if (!allowedFields.includes(key)) {
        return reply.code(400).send({
          error: `Недопустимое поле: ${key}`,
          field: key
        });
      }
      if (typeof value !== 'boolean') {
        return reply.code(400).send({
          error: `Значение для поля ${key} должно быть true или false`,
          field: key
        });
      }
    }

    // Обновляем настройки в базе данных
    const updateResult = await pool.query(
      `UPDATE users
       SET search_settings = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING search_settings`,
      [JSON.stringify(search_settings), userId]
    );

    if (updateResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    console.log(`✅ Обновлены настройки конфиденциальности для пользователя ${userId}`);

    return reply.send({
      success: true,
      search_settings: updateResult.rows[0].search_settings
    });

  } catch (err) {
    console.error('❌ Ошибка обновления настроек конфиденциальности:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПОИСК ПОЛЬЗОВАТЕЛЯ ПО КОМПЬЮТЕРНОМУ НОМЕРУ ===
app.get('/api/users/search-by-personal-id/:personalId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { personalId } = req.params;

    if (!personalId || !personalId.trim()) {
      return reply.send({ found: false });
    }

    const normalizedPersonalId = personalId.trim().toUpperCase();

    // Ищем пользователя с учетом настроек конфиденциальности
    const result = await pool.query(
      `SELECT
        u.id,
        u.avatar_url,
        u.username,
        u.full_name
       FROM users u
       WHERE u.personal_id = $1
         AND u.is_verified = true
         AND (u.search_settings->>'personal_id')::boolean = true
       LIMIT 1`,
      [normalizedPersonalId]
    );

    if (result.rows.length === 0) {
      return reply.send({ found: false });
    }

    const user = result.rows[0];

    return reply.send({
      found: true,
      user: {
        id: user.id,
        avatar_url: user.avatar_url,
        username: user.username,
        full_name: user.full_name
      }
    });

  } catch (err) {
    console.error('❌ Ошибка поиска пользователя по personal_id:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПРОВЕРКА КОМПЬЮТЕРНОГО НОМЕРА ДЛЯ АВАТАРА ===
app.get('/api/users/by-personal-id/:personalId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { personalId } = req.params;

    if (!personalId || !personalId.trim()) {
      return reply.send({ success: false, error: 'NOT_FOUND' });
    }

    const normalizedPersonalId = personalId.trim().toUpperCase();

    // Ищем пользователя
    const result = await pool.query(
      `SELECT
        id,
        username,
        avatar_url,
        is_verified,
        search_settings
       FROM users
       WHERE personal_id = $1
       LIMIT 1`,
      [normalizedPersonalId]
    );

    // Пользователь не найден
    if (result.rows.length === 0) {
      return reply.send({ success: false, error: 'NOT_FOUND' });
    }

    const user = result.rows[0];

    // Пользователь не верифицирован
    if (!user.is_verified) {
      return reply.send({ success: false, error: 'NOT_VERIFIED' });
    }

    // Проверяем настройки поиска
    const searchSettings = user.search_settings || {};
    if (searchSettings.personal_id === false) {
      return reply.send({ success: false, error: 'SEARCH_DISABLED' });
    }

    // Успешный результат
    return reply.send({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url
      }
    });

  } catch (err) {
    console.error('❌ Ошибка проверки компьютерного номера:', err);
    return reply.code(500).send({ success: false, error: 'SERVER_ERROR' });
  }
});

// === УДАЛЕНИЕ АККАУНТА ===
app.delete('/api/profile', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { password } = req.body;

    if (!password) {
      return reply.code(400).send({ error: 'Введите пароль для подтверждения' });
    }

    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password);
    if (!validPassword) {
      return reply.code(400).send({ error: 'Неверный пароль' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    return reply.send({ success: true, message: 'Аккаунт удалён' });
  } catch (err) {
    console.error('❌ Ошибка delete-profile:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ЗАГРУЗКА АВАТАРА ===
app.post('/api/profile/avatar', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const data = await req.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'Файл не предоставлен' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Разрешены только изображения (JPEG, PNG, GIF, WEBP)' });
    }

    const ext = path.extname(data.filename);
    const filename = `${req.user.id}-${randomBytes(8).toString('hex')}${ext}`;
    const filepath = path.join(__dirname, 'uploads', 'avatars', filename);

    await pipeline(data.file, createWriteStream(filepath));

    const avatarUrl = `/uploads/avatars/${filename}`;
    await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, req.user.id]
    );
    
    return reply.send({
      success: true,
      avatarUrl
    });
  } catch (err) {
    console.error('❌ Ошибка загрузки аватара:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === УДАЛЕНИЕ АВАТАРА ===
app.delete('/api/profile/avatar', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    await pool.query(
      'UPDATE users SET avatar_url = NULL WHERE id = $1',
      [req.user.id]
    );

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления аватара:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ДОСКИ (BOARDS)
// ============================================

// Получить все доски пользователя
app.get('/api/boards', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const result = await pool.query(
      `SELECT
        b.id,
        b.name,
        b.description,
        b.thumbnail_url,
        b.is_public,
        b.created_at,
        b.updated_at,
        b.object_count,
        COALESCE(
          json_agg(
            json_build_object('id', bf.id, 'name', bf.name)
          ) FILTER (WHERE bf.id IS NOT NULL),
          '[]'::json
        ) as folders
       FROM boards b
       LEFT JOIN board_folder_items bfi ON b.id = bfi.board_id
       LEFT JOIN board_folders bf ON bfi.folder_id = bf.id
       WHERE b.owner_id = $1
       GROUP BY b.id
       ORDER BY b.updated_at DESC`,
      [req.user.id]
    );

    return reply.send({ boards: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения досок:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Получить одну доску
app.get('/api/boards/:id', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { id } = req.params;

    // Администраторы могут получить любую доску
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT * FROM boards WHERE id = $1'
      : 'SELECT * FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [id] : [id, req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    const board = result.rows[0];

    // Проверяем, заблокирована ли доска (только для не-администраторов)
    if (!isAdmin && board.is_locked) {
      // Получаем дату блокировки из таблицы users
      const userResult = await pool.query(
        'SELECT boards_locked_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
        const lockedAt = new Date(userResult.rows[0].boards_locked_at);
        const now = new Date();
        const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 14 - daysPassed);

        return reply.code(403).send({
          error: 'Доска заблокирована',
          message: `Эта доска заблокирована. Если в течение ${daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
          daysLeft: daysLeft,
          locked: true
        });
      }
    }

    return reply.send({ board: board });
  } catch (err) {
    console.error('❌ Ошибка получения доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать новую доску
    app.post('/api/boards', {
      preHandler: [authenticateToken, checkUsageLimit('boards', 'max_boards')]
    }, async (req, reply) => {
  try {
    const { name, description, content } = req.body;

    const result = await pool.query(
      `INSERT INTO boards (owner_id, name, description, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.user.id,
        name || 'Без названия',
        description || null,
        content ? JSON.stringify(content) : null
      ]
    );

    return reply.send({ board: result.rows[0] });
  } catch (err) {
    console.error('❌ Ошибка создания доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

    // Обновить доску (автосохранение) - С ПРОВЕРКОЙ ЛИМИТА КАРТОЧЕК
    app.put('/api/boards/:id', {
      preHandler: [authenticateToken, checkUsageLimit('cards', 'max_licenses')]
    }, async (req, reply) => {
      try {
        const userId = req.user.id; // <-- ИСПРАВЛЕНО: берем ID из req.user
        const { id } = req.params;
        const { name, description, content } = req.body;

        // Администраторы могут обновить любую доску
        const isAdmin = req.user.role === 'admin';

        // Проверяем, не заблокирована ли доска (только для не-администраторов)
        if (!isAdmin) {
          const boardCheck = await pool.query(
            'SELECT is_locked FROM boards WHERE id = $1 AND owner_id = $2',
            [id, userId]
          );

          if (boardCheck.rows.length === 0) {
            return reply.code(404).send({ error: 'Доска не найдена' });
          }

          if (boardCheck.rows[0].is_locked) {
            // Получаем дату блокировки из таблицы users
            const userResult = await pool.query(
              'SELECT boards_locked_at FROM users WHERE id = $1',
              [userId]
            );

            if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
              const lockedAt = new Date(userResult.rows[0].boards_locked_at);
              const now = new Date();
              const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
              const daysLeft = Math.max(0, 14 - daysPassed);

              return reply.code(403).send({
                error: 'Доска заблокирована',
                message: `Эта доска заблокирована. Если в течение ${daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
                daysLeft: daysLeft,
                locked: true
              });
            }
          }
        }

        // Основная логика обновления доски
        let objectCount = 0;
        if (content && content.objects) {
          objectCount = content.objects.length;
        }

        const query = isAdmin
          ? `UPDATE boards
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 content = COALESCE($3, content),
                 object_count = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`
          : `UPDATE boards
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 content = COALESCE($3, content),
                 object_count = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND owner_id = $6
             RETURNING *`;
        const params = isAdmin
          ? [name || null, description || null, content ? JSON.stringify(content) : null, objectCount, id]
          : [name || null, description || null, content ? JSON.stringify(content) : null, objectCount, id, userId];

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
          return reply.code(404).send({ error: 'Доска не найдена' });
        }

        return reply.send({ board: result.rows[0] });
      } catch (err) {
        console.error('❌ Ошибка обновления доски:', err);
        return reply.code(500).send({ error: 'Ошибка сервера' });
      }
    });

// Удалить доску
app.delete('/api/boards/:id', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { id } = req.params;

    // Администраторы могут удалить любую доску
    const isAdmin = req.user.role === 'admin';

    // Проверяем, не заблокирована ли доска (только для не-администраторов)
    if (!isAdmin) {
      const boardCheck = await pool.query(
        'SELECT is_locked FROM boards WHERE id = $1 AND owner_id = $2',
        [id, req.user.id]
      );

      if (boardCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Доска не найдена' });
      }

      if (boardCheck.rows[0].is_locked) {
        // Получаем дату блокировки из таблицы users
        const userResult = await pool.query(
          'SELECT boards_locked_at FROM users WHERE id = $1',
          [req.user.id]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
          const lockedAt = new Date(userResult.rows[0].boards_locked_at);
          const now = new Date();
          const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
          const daysLeft = Math.max(0, 14 - daysPassed);

          return reply.code(403).send({
            error: 'Доска заблокирована',
            message: `Эта доска заблокирована. Если в течение ${daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
            daysLeft: daysLeft,
            locked: true
          });
        }
      }
    }

    const query = isAdmin
      ? 'DELETE FROM boards WHERE id = $1 RETURNING id'
      : 'DELETE FROM boards WHERE id = $1 AND owner_id = $2 RETURNING id';
    const params = isAdmin ? [id] : [id, req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Дублировать доску
app.post('/api/boards/:id/duplicate', {
      preHandler: [authenticateToken, checkFeature('can_duplicate_boards', true)]
    }, async (req, reply) => {
  try {
    const { id } = req.params;

    // Администраторы могут дублировать любую доску
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT * FROM boards WHERE id = $1'
      : 'SELECT * FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [id] : [id, req.user.id];

    const original = await pool.query(query, params);

    if (original.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    const board = original.rows[0];

    // Проверяем, не заблокирована ли доска (только для не-администраторов)
    if (!isAdmin && board.is_locked) {
      // Получаем дату блокировки из таблицы users
      const userResult = await pool.query(
        'SELECT boards_locked_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
        const lockedAt = new Date(userResult.rows[0].boards_locked_at);
        const now = new Date();
        const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 14 - daysPassed);

        return reply.code(403).send({
          error: 'Доска заблокирована',
          message: `Эта доска заблокирована. Если в течение ${daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
          daysLeft: daysLeft,
          locked: true
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO boards (owner_id, name, description, content, object_count)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.id,
        `${board.name} (копия)`,
        board.description,
        board.content,
        board.object_count
      ]
    );

    return reply.send({ board: result.rows[0] });
  } catch (err) {
    console.error('❌ Ошибка дублирования доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Загрузить миниатюру доски
app.post('/api/boards/:id/thumbnail', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { id: boardId } = req.params;
    const { image } = req.body || {};

    if (typeof image !== 'string' || image.length === 0) {
      return reply.code(400).send({ error: 'Отсутствует изображение' });
    }

    const prefix = 'data:image/png;base64,';
    const base64Data = image.startsWith(prefix) ? image.slice(prefix.length) : image;

    let buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return reply.code(400).send({ error: 'Некорректные данные изображения' });
    }

    if (buffer.length === 0) {
      return reply.code(400).send({ error: 'Некорректные данные изображения' });
    }

    const boardResult = await pool.query(
      'SELECT owner_id, is_locked FROM boards WHERE id = $1',
      [boardId]
    );

    if (boardResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    // Администраторы могут обновить миниатюру любой доски
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && boardResult.rows[0].owner_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа' });
    }

    // Проверяем, не заблокирована ли доска (только для не-администраторов)
    if (!isAdmin && boardResult.rows[0].is_locked) {
      // Получаем дату блокировки из таблицы users
      const userResult = await pool.query(
        'SELECT boards_locked_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].boards_locked_at) {
        const lockedAt = new Date(userResult.rows[0].boards_locked_at);
        const now = new Date();
        const daysPassed = Math.floor((now - lockedAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 14 - daysPassed);

        return reply.code(403).send({
          error: 'Доска заблокирована',
          message: `Эта доска заблокирована. Если в течение ${daysLeft} дней не произойдёт продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`,
          daysLeft: daysLeft,
          locked: true
        });
      }
    }

    const boardsDir = path.join(__dirname, 'uploads', 'boards');
    await fsPromises.mkdir(boardsDir, { recursive: true });

    const filePath = path.join(boardsDir, `${boardId}.png`);
    await fsPromises.writeFile(filePath, buffer);

    const thumbnailUrl = `/uploads/boards/${boardId}.png`;

    // Администраторы могут обновить миниатюру любой доски
    const query = isAdmin
      ? 'UPDATE boards SET thumbnail_url = $1 WHERE id = $2'
      : 'UPDATE boards SET thumbnail_url = $1 WHERE id = $2 AND owner_id = $3';
    const params = isAdmin
      ? [thumbnailUrl, boardId]
      : [thumbnailUrl, boardId, req.user.id];

    await pool.query(query, params);

    return reply.send({ thumbnail_url: thumbnailUrl });
  } catch (err) {
    console.error('❌ Ошибка загрузки миниатюры доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПОЛУЧИТЬ ИНФОРМАЦИЮ О ТАРИФНОМ ПЛАНЕ ПОЛЬЗОВАТЕЛЯ ===
app.get('/api/user/plan', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;

    // Выполняем ОДИН SQL-запрос для получения всех данных
    const result = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.subscription_started_at,
        u.subscription_expires_at,
        sp.id as plan_id,
        sp.name as plan_name,
        sp.code_name as plan_code_name,
        sp.price_monthly as plan_price_monthly,
        sp.features as plan_features,
        (SELECT COUNT(*) FROM boards WHERE owner_id = u.id) as boards_count,
        (SELECT COUNT(*) FROM notes n JOIN boards b ON n.board_id = b.id WHERE b.owner_id = u.id) as notes_count,
        (SELECT COUNT(*) FROM stickers s JOIN boards b ON s.board_id = b.id WHERE b.owner_id = u.id) as stickers_count,
        (SELECT COUNT(*) FROM user_comments WHERE user_id = u.id) as comments_count
      FROM users u
      LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const data = result.rows[0];

    // Проверяем наличие тарифного плана
    if (!data.plan_id) {
      return reply.code(404).send({ error: 'Тарифный план не найден' });
    }

    const features = data.plan_features || {};

    // Формируем ответ в строгом соответствии с требованиями
    const response = {
      user: {
        id: data.id,
        username: data.username,
        email: data.email,
        subscriptionStartedAt: data.subscription_started_at,
        subscriptionExpiresAt: data.subscription_expires_at
      },
      plan: {
        id: data.plan_id,
        name: data.plan_name,
        code_name: data.plan_code_name,
        priceMonthly: data.plan_price_monthly
      },
      features: features,
      usage: {
        boards: {
          current: parseInt(data.boards_count, 10),
          limit: parseInt(features.max_boards, 10) || -1
        },
        notes: {
          current: parseInt(data.notes_count, 10),
          limit: parseInt(features.max_notes, 10) || -1
        },
        stickers: {
          current: parseInt(data.stickers_count, 10),
          limit: parseInt(features.max_stickers, 10) || -1
        },
        userComments: {
          current: parseInt(data.comments_count, 10),
          limit: parseInt(features.max_comments, 10) || -1
        }
      }
    };

    return reply.send(response);
  } catch (err) {
    console.error('❌ Ошибка получения информации о тарифном плане:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПОЛУЧИТЬ СПИСОК ПУБЛИЧНЫХ ТАРИФНЫХ ПЛАНОВ ===
app.get('/api/plans', async (req, reply) => {
  try {
    const result = await pool.query(
      `SELECT id, name, code_name, description, price_monthly, price_yearly,
              features, display_order, is_public, created_at, updated_at
       FROM subscription_plans
       WHERE is_public = true
       ORDER BY display_order ASC`
    );

    return reply.send({ plans: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения списка тарифных планов:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// TELEGRAM ИНТЕГРАЦИЯ
// ============================================

// === ГЕНЕРАЦИЯ КОДА ДЛЯ ПРИВЯЗКИ TELEGRAM ===
app.post('/api/user/telegram/generate-code', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;

    // Генерируем уникальный код (6 символов, буквы и цифры)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Код действителен 15 минут
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Удаляем старые неиспользованные коды этого пользователя
    await pool.query(
      'DELETE FROM telegram_link_codes WHERE user_id = $1 AND used = false',
      [userId]
    );

    // Создаем новый код
    await pool.query(
      `INSERT INTO telegram_link_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, code, expiresAt]
    );

    console.log(`✅ Код для привязки Telegram сгенерирован: пользователь ID=${userId}, код=${code}`);

    return reply.send({
      success: true,
      code: code,
      expiresAt: expiresAt,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'fohow_bot'
    });
  } catch (err) {
    console.error('❌ Ошибка генерации кода привязки Telegram:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПРОВЕРКА СТАТУСА ПРИВЯЗКИ TELEGRAM (POLLING) ===
app.get('/api/user/telegram/check-link-status', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;

    // Получаем информацию о пользователе
    const result = await pool.query(
      'SELECT telegram_chat_id, telegram_user FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    const isLinked = !!user.telegram_chat_id;

    return reply.send({
      success: true,
      linked: isLinked,
      telegram: isLinked ? {
        chat_id: user.telegram_chat_id,
        username: user.telegram_user
      } : null
    });
  } catch (err) {
    console.error('❌ Ошибка проверки статуса привязки Telegram:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПРИВЯЗКА TELEGRAM К АККАУНТУ (используется ботом) ===
app.post('/api/user/connect-telegram', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { telegram_chat_id, telegram_username } = req.body;

    // Валидация входных данных
    if (!telegram_chat_id) {
      return reply.code(400).send({
        error: 'Обязательное поле: telegram_chat_id'
      });
    }

    // Проверяем, что chat_id является числом или строкой с числом
    const chatId = String(telegram_chat_id).trim();
    if (chatId.length === 0) {
      return reply.code(400).send({
        error: 'telegram_chat_id не может быть пустым'
      });
    }

    // Проверяем, не привязан ли уже этот Telegram к другому пользователю
    const existingConnection = await pool.query(
      'SELECT id, email FROM users WHERE telegram_chat_id = $1 AND id != $2',
      [chatId, userId]
    );

    if (existingConnection.rows.length > 0) {
      return reply.code(409).send({
        error: 'Этот Telegram аккаунт уже привязан к другому пользователю'
      });
    }

    // Обновляем данные пользователя
    const result = await pool.query(
      `UPDATE users
       SET telegram_chat_id = $1,
           telegram_user = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, telegram_chat_id, telegram_user`,
      [chatId, telegram_username || null, userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    console.log(`✅ Telegram привязан к пользователю ID=${userId}, chat_id=${chatId}`);

    return reply.send({
      success: true,
      message: 'Telegram успешно привязан к аккаунту',
      telegram: {
        chat_id: result.rows[0].telegram_chat_id,
        username: result.rows[0].telegram_user
      }
    });
  } catch (err) {
    console.error('❌ Ошибка привязки Telegram:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ПРОВЕРКА СТАТУСА ПРИВЯЗКИ TELEGRAM ===
app.get('/api/user/telegram-status', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;

    // Получаем информацию о Telegram-привязке пользователя
    const result = await pool.query(
      `SELECT id, email, telegram_chat_id, telegram_user, telegram_channel
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    const isConnected = !!user.telegram_chat_id;

    return reply.send({
      connected: isConnected,
      telegram: isConnected ? {
        chat_id: user.telegram_chat_id,
        username: user.telegram_user,
        channel: user.telegram_channel
      } : null
    });
  } catch (err) {
    console.error('❌ Ошибка получения статуса Telegram:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Проверка живости API
app.get('/api/health', async () => ({ ok: true }));

// ============================================
// ПРОМОКОДЫ (PROMO CODES)
// ============================================
registerPromoRoutes(app);

// ============================================
// АДМИН-ПАНЕЛЬ (ADMIN PANEL)
// ============================================
registerAdminRoutes(app);

// ============================================
// БИБЛИОТЕКА ИЗОБРАЖЕНИЙ (IMAGE LIBRARY)
// ============================================
registerImageRoutes(app);

// ============================================
// ТОЧКИ (ANCHORS)
// ============================================
registerAnchorRoutes(app);

// ============================================
// ПАПКИ ДОСОК (BOARD FOLDERS)
// ============================================
registerBoardFolderRoutes(app);

// ============================================
// ОБСУЖДЕНИЯ (DISCUSSIONS)
// ============================================
registerDiscussionRoutes(app);

// ============================================
// ВЕРИФИКАЦИЯ (VERIFICATION)
// ============================================
app.register(verificationRoutes);

// ============================================
// ПАРТНЁРЫ FOGRUP (FOGRUP PARTNERS)
// ============================================
registerPartnerRoutes(app, pool, authenticateToken);

// ============================================
// СВЯЗИ FOGRUP (FOGRUP RELATIONSHIPS)
// ============================================
registerRelationshipRoutes(app, pool, authenticateToken);

// ============================================
// ПОЛЬЗОВАТЕЛИ FOGRUP (FOGRUP USERS)
// ============================================
registerUserRoutes(app, pool, authenticateToken);

// ============================================
// УВЕДОМЛЕНИЯ FOGRUP (ДОБАВЛЕНО)
// ============================================
registerNotificationRoutes(app); // <--- ДОБАВИТЬ ЭТУ СТРОКУ

// ============================================
// ЧАТЫ FOGRUP (ДОБАВИТЬ ЭТОТ БЛОК)
// ============================================
registerChatRoutes(app); // <--- ВОТ ЭТУ СТРОКУ ВСТАВИТЬ СЮДА

// ============================================
// ИЗБРАННОЕ FOGRUP
// ============================================
registerFavoriteRoutes(app, pool, authenticateToken);

// ============================================
// СТИКЕРЫ (STICKERS)
// ============================================

// Получить все стикеры для доски
app.get('/api/boards/:boardId/stickers', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;

    // Проверяем, что пользователь является владельцем доски
    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Получаем все стикеры для этой доски с информацией об авторе
    const result = await pool.query(
      `SELECT
        s.id,
        s.board_id,
        s.user_id,
        s.content,
        s.color,
        s.pos_x,
        s.pos_y,
        s.created_at,
        s.updated_at,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.board_id = $1
       ORDER BY s.created_at ASC`,
      [boardId]
    );

    return reply.send({ stickers: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения стикеров:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать новый стикер
    app.post('/api/boards/:boardId/stickers', {
      preHandler: [authenticateToken, checkUsageLimit('stickers', 'max_stickers')]
    }, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { pos_x, pos_y, color } = req.body;

    // Валидация входных данных
    if (pos_x === undefined || pos_y === undefined) {
      return reply.code(400).send({
        error: 'Обязательные поля: pos_x, pos_y'
      });
    }

    // Проверяем, что пользователь является владельцем доски
    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Создаём новый стикер
    const result = await pool.query(
      `INSERT INTO stickers (board_id, user_id, content, color, pos_x, pos_y)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [boardId, req.user.id, '', color || '#FFFF88', pos_x, pos_y]
    );

    // Получаем информацию об авторе
    const stickerWithAuthor = await pool.query(
      `SELECT
        s.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [result.rows[0].id]
    );

    return reply.send({
      success: true,
      sticker: stickerWithAuthor.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка создания стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Обновить стикер
app.put('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { stickerId } = req.params;
    const { content, pos_x, pos_y, color } = req.body;

    // Проверяем, что стикер существует и принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM stickers WHERE id = $1',
      [stickerId]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Стикер не найден' });
    }

    // Администраторы могут редактировать любые стикеры
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого стикера' });
    }

    // Обновляем стикер
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex++}`);
      updateValues.push(content);
    }
    if (pos_x !== undefined) {
      updateFields.push(`pos_x = $${paramIndex++}`);
      updateValues.push(pos_x);
    }
    if (pos_y !== undefined) {
      updateFields.push(`pos_y = $${paramIndex++}`);
      updateValues.push(pos_y);
    }
    if (color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      updateValues.push(color);
    }

    if (updateFields.length === 0) {
      return reply.code(400).send({ error: 'Нет полей для обновления' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(stickerId);

    const result = await pool.query(
      `UPDATE stickers
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    // Получаем информацию об авторе
    const stickerWithAuthor = await pool.query(
      `SELECT
        s.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [result.rows[0].id]
    );

    return reply.send({
      success: true,
      sticker: stickerWithAuthor.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Удалить стикер (ИСПРАВЛЕННАЯ ВЕРСИЯ)
app.delete('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { stickerId } = req.params;
    const userId = req.user.id;

    // Валидация ID стикера
    const stickerIdNum = parseInt(stickerId, 10);
    if (isNaN(stickerIdNum) || stickerIdNum <= 0) {
      // Это единственная валидная причина для 400 Bad Request
      return reply.code(400).send({ error: 'Некорректный ID стикера' });
    }

    // Выполняем ОДИН безопасный запрос на удаление
    // Администраторы могут удалить любой стикер
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'DELETE FROM stickers WHERE id = $1'
      : 'DELETE FROM stickers WHERE id = $1 AND user_id = $2';
    const params = isAdmin ? [stickerIdNum] : [stickerIdNum, userId];

    const result = await pool.query(query, params);

    // Проверяем, была ли удалена строка.
    // Если rowCount === 0, значит стикер либо не найден, либо не принадлежит пользователю.
    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Стикер не найден или у вас нет прав на его удаление' });
    }

    // Отправляем успешный ответ. Стандарт для DELETE - это 204 No Content.
    // Фронтенд увидит, что response.ok === true и не будет пытаться парсить тело ответа.
    return reply.code(204).send();

  } catch (err) {
    console.error('❌ Ошибка удаления стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ЗАМЕТКИ (NOTES)
// ============================================

// Получить все заметки для доски
app.get('/api/boards/:boardId/notes', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;

    // Проверяем, что пользователь является владельцем доски
    // Администраторы могут получить заметки любой доски
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT id FROM boards WHERE id = $1'
      : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [boardId] : [boardId, req.user.id];

    const boardCheck = await pool.query(query, params);

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Получаем все заметки для этой доски
    const result = await pool.query(
      `SELECT id, card_uid, note_date, content, color, created_at, updated_at
       FROM notes
       WHERE board_id = $1
       ORDER BY note_date ASC`,
      [boardId]
    );

    return reply.send({ notes: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения заметок:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать/обновить/удалить заметку (UPSERT + DELETE)
    app.post('/api/notes', {
      preHandler: [authenticateToken, checkUsageLimit('notes', 'max_notes')]
    }, async (req, reply) => {
  try {
    const { boardId, cardUid, noteDate, content, color } = req.body;

    // Валидация входных данных
    if (!boardId || !cardUid || !noteDate) {
      return reply.code(400).send({
        error: 'Обязательные поля: boardId, cardUid, noteDate'
      });
    }

    // Проверяем, что пользователь является владельцем доски
    // Администраторы могут создать/обновить заметку для любой доски
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT id FROM boards WHERE id = $1'
      : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [boardId] : [boardId, req.user.id];

    const boardCheck = await pool.query(query, params);

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Проверяем, нужно ли удалить заметку (пустой текст = удаление, независимо от цвета)
    const shouldDelete = !content || content.trim() === '';

    if (shouldDelete) {
      // Удаляем заметку
      const deleteResult = await pool.query(
        `DELETE FROM notes
         WHERE board_id = $1 AND card_uid = $2 AND note_date = $3
         RETURNING id`,
        [boardId, cardUid, noteDate]
      );

      if (deleteResult.rows.length > 0) {
        return reply.send({
          success: true,
          deleted: true,
          message: 'Заметка удалена'
        });
      } else {
        return reply.send({
          success: true,
          deleted: false,
          message: 'Заметка не найдена'
        });
      }
    }

    // UPSERT: создаём или обновляем заметку
    const result = await pool.query(
      `INSERT INTO notes (board_id, card_uid, note_date, content, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (board_id, card_uid, note_date)
       DO UPDATE SET
         content = EXCLUDED.content,
         color = EXCLUDED.color,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [boardId, cardUid, noteDate, content || null, color || null]
    );

    return reply.send({
      success: true,
      note: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка сохранения заметки:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ЛИЧНЫЕ КОММЕНТАРИИ ПОЛЬЗОВАТЕЛЯ (USER_COMMENTS)
// ============================================

// Получить все личные комментарии пользователя
app.get('/api/comments', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    // Получаем все комментарии пользователя, отсортированные по дате создания (новые вверху)
    const result = await pool.query(
      `SELECT id, user_id, content, color, created_at, updated_at
       FROM user_comments
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return reply.send({ comments: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения комментариев:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать новый личный комментарий
    app.post('/api/comments', {
      preHandler: [authenticateToken, checkUsageLimit('comments', 'max_comments')]
    }, async (req, reply) => {
  try {
    const { content, color } = req.body;

    // Валидация входных данных
    if (!content || content.trim() === '') {
      return reply.code(400).send({
        error: 'Содержимое комментария обязательно'
      });
    }

    // Создаём новый комментарий
    const result = await pool.query(
      `INSERT INTO user_comments (user_id, content, color)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, color, created_at, updated_at`,
      [req.user.id, content.trim(), color || null]
    );

    return reply.send({
      success: true,
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка создания комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Обновить личный комментарий
app.put('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { commentId } = req.params;
    const { content, color } = req.body;

    // Валидация commentId
    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      console.error('❌ Некорректный commentId:', commentId);
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    // Проверяем, что commentId является числом
    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      console.error('❌ commentId не является положительным числом:', commentId);
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    // Валидация входных данных
    if (!content || content.trim() === '') {
      return reply.code(400).send({
        error: 'Содержимое комментария обязательно'
      });
    }

    // Проверяем, что комментарий принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    // Администраторы могут редактировать любые комментарии
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого комментария' });
    }

    // Обновляем комментарий
    const query = isAdmin
      ? `UPDATE user_comments
         SET content = $1,
             color = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, user_id, content, color, created_at, updated_at`
      : `UPDATE user_comments
         SET content = $1,
             color = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING id, user_id, content, color, created_at, updated_at`;
    const params = isAdmin
      ? [content.trim(), color || null, commentIdNum]
      : [content.trim(), color || null, commentIdNum, req.user.id];

    const result = await pool.query(query, params);

    return reply.send({
      success: true,
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Удалить личный комментарий
app.delete('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { commentId } = req.params;

    // Валидация commentId
    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      console.error('❌ Некорректный commentId:', commentId);
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    // Проверяем, что commentId является числом
    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      console.error('❌ commentId не является положительным числом:', commentId);
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    // Проверяем, что комментарий принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    // Администраторы могут удалить любой комментарий
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к удалению этого комментария' });
    }

    // Удаляем комментарий
    const query = isAdmin
      ? 'DELETE FROM user_comments WHERE id = $1'
      : 'DELETE FROM user_comments WHERE id = $1 AND user_id = $2';
    const params = isAdmin ? [commentIdNum] : [commentIdNum, req.user.id];

    await pool.query(query, params);

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ПАРТНЕРЫ (PARTNERS)
// ============================================
// Партнёры с досок с Аватарами
app.get('/api/boards/:boardId/avatar-partners', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { search } = req.query;

    const boardCheck = await pool.query(
      'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ success: false, error: 'Board not found' });
    }

    const board = boardCheck.rows[0];
    const content = board.content || {};
    const cardsArray = content?.cards || content?.objects || [];

    const avatarCards = cardsArray.filter(
      (card) => card.type === 'avatar' && card.userId !== null
    );

    if (avatarCards.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    const avatarsByUserId = avatarCards.reduce((acc, avatar) => {
      const userId = Number(avatar.userId);

      if (!Number.isFinite(userId)) {
        return acc;
      }

      if (!acc.has(userId)) {
        acc.set(userId, []);
      }

      acc.get(userId).push(avatar);
      return acc;
    }, new Map());

    const uniqueUserIds = [...avatarsByUserId.keys()];

    if (uniqueUserIds.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    const usersResult = await pool.query(
      `SELECT
         id,
         username,
         full_name,
         avatar_url,
         personal_id,
         phone,
         city,
         country,
         office,
         telegram_user,
         instagram_profile,
         search_settings,
         visibility_settings,
         is_verified
       FROM users
       WHERE id = ANY($1)`,
      [uniqueUserIds]
    );

    const isEnabled = (settings, key) => {
      if (!settings || typeof settings !== 'object') return true;
      const value = settings[key];
      return value === true || value === 'true' || value === 1 || value === undefined;
    };

    const isSearchable = (settings, key) => {
      if (!settings || typeof settings !== 'object') return false;
      const value = settings[key];
      return value === true || value === 'true' || value === 1;
    };

    const normalize = (value) => (value ?? '').toString().toLowerCase();
    const searchTerm = normalize(search).trim();

    const partners = [];

    usersResult.rows.forEach((userRow) => {
      const relatedAvatars = avatarsByUserId.get(userRow.id) || [];

      // Пропускаем неверифицированных пользователей
      if (!userRow.is_verified) {
        return;
      }

      relatedAvatars.forEach((avatar) => {
        const visibility = userRow.visibility_settings || {};
        const searchSettings = userRow.search_settings || {};

        const partner = {
          id: userRow.id,
          avatarObjectId: avatar.id,
          userId: userRow.id,
          username: isEnabled(visibility, 'username') ? userRow.username : null,
          full_name: isEnabled(visibility, 'full_name') ? userRow.full_name : null,
          avatar_url: isEnabled(visibility, 'avatar_url') ? userRow.avatar_url : '/Avatar.png',
          personal_id: isEnabled(visibility, 'personal_id') ? userRow.personal_id : null,
          phone: isEnabled(visibility, 'phone') ? userRow.phone : null,
          city: isEnabled(visibility, 'city') ? userRow.city : null,
          country: isEnabled(visibility, 'country') ? userRow.country : null,
          office: isEnabled(visibility, 'office') ? userRow.office : null,
          telegram_user: isEnabled(visibility, 'telegram_user') ? userRow.telegram_user : null,
          instagram_profile: isEnabled(visibility, 'instagram_profile') ? userRow.instagram_profile : null,
          search_settings: searchSettings,
          x: avatar.x,
          y: avatar.y,
          diameter: avatar.diameter
        };

        if (searchTerm) {
          const searchableFields = [];

          if (isSearchable(searchSettings, 'username')) searchableFields.push(userRow.username);
          if (isSearchable(searchSettings, 'full_name')) searchableFields.push(userRow.full_name);
          if (isSearchable(searchSettings, 'phone')) searchableFields.push(userRow.phone);
          if (isSearchable(searchSettings, 'city')) searchableFields.push(userRow.city);
          if (isSearchable(searchSettings, 'country')) searchableFields.push(userRow.country);
          if (isSearchable(searchSettings, 'office')) searchableFields.push(userRow.office);
          if (isSearchable(searchSettings, 'personal_id')) searchableFields.push(userRow.personal_id);
          if (isSearchable(searchSettings, 'telegram_user')) searchableFields.push(userRow.telegram_user);
          if (isSearchable(searchSettings, 'instagram_profile')) searchableFields.push(userRow.instagram_profile);

          const matches = searchableFields
            .filter(Boolean)
            .some((field) => normalize(field).includes(searchTerm));

          if (!matches) {
            return;
          }
        }

        delete partner.search_settings;
        partners.push(partner);
      });
    });

    return reply.send({ success: true, partners });
  } catch (err) {
    console.error('❌ Ошибка получения партнёров для аватаров:', err);
    return reply.code(500).send({ success: false, error: 'Internal server error' });
  }
});

// Получить список партнёров для доски
app.get('/api/boards/:boardId/partners', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { search } = req.query;

    // Проверяем, что доска существует и принадлежит текущему пользователю
    const boardCheck = await pool.query(
      'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ success: false, error: 'Board not found' });
    }

    const board = boardCheck.rows[0];
    const content = board.content || {};
    const cardsArray = content?.cards || content?.objects || []
    const normalizePersonalId = (value) =>
      (value ?? '')
        .toString()
        .replace(/\s+/g, '')
        .toUpperCase();
    // Фильтруем карточки типа large и gold
    const largeAndGoldCards = cardsArray.filter(
      (card) => card.type === 'large' || card.type === 'gold'
    );

    // Извлекаем номера лицензий (personal_id) из card.text
    const personalIds = largeAndGoldCards
      .map((card) => normalizePersonalId(card.text))
      .filter((text) => text && text !== 'RUY68123456789'); // Исключаем дефолтный номер
    // Получаем уникальные personal_id
    const uniquePersonalIds = [...new Set(personalIds)];

    // Если нет партнёров, возвращаем пустой массив
    if (uniquePersonalIds.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    // Формируем SQL-запрос с учётом поиска
    let query;
    let params;

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = `
        SELECT
          u.id,
          u.username,
          u.personal_id,
          u.avatar_url,
          u.plan_id,
          u.search_settings,
          CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
          CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
          CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
          CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
          CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
          CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
          CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile
        FROM users u
        WHERE u.personal_id = ANY($1)
          AND u.is_verified = true
          AND u.plan_id IN (6, 7)
          AND u.avatar_url IS NOT NULL
          AND u.avatar_url != '/Avatar.png'
          AND (
            (u.search_settings->>'username' = 'true' AND LOWER(u.username) LIKE LOWER($2)) OR
            (u.search_settings->>'full_name' = 'true' AND LOWER(u.full_name) LIKE LOWER($2)) OR
            (u.search_settings->>'phone' = 'true' AND u.phone LIKE $2) OR
            (u.search_settings->>'city' = 'true' AND LOWER(u.city) LIKE LOWER($2)) OR
            (u.search_settings->>'country' = 'true' AND LOWER(u.country) LIKE LOWER($2)) OR
            (u.search_settings->>'office' = 'true' AND LOWER(u.office) LIKE LOWER($2)) OR
            (u.search_settings->>'personal_id' = 'true' AND u.personal_id LIKE $2) OR
            (u.search_settings->>'telegram_user' = 'true' AND LOWER(u.telegram_user) LIKE LOWER($2)) OR
            (u.search_settings->>'instagram_profile' = 'true' AND LOWER(u.instagram_profile) LIKE LOWER($2))
          )
        ORDER BY u.username ASC
      `;
      params = [uniquePersonalIds, searchTerm];
    } else {
      query = `
        SELECT
          u.id,
          u.username,
          u.personal_id,
          u.avatar_url,
          u.plan_id,
          u.search_settings,
          CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
          CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
          CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
          CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
          CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
          CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
          CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile
        FROM users u
        WHERE u.personal_id = ANY($1)
          AND u.is_verified = true
          AND u.plan_id IN (6, 7)
          AND u.avatar_url IS NOT NULL
          AND u.avatar_url != '/Avatar.png'
        ORDER BY u.username ASC
      `;
      params = [uniquePersonalIds];
    }

    const result = await pool.query(query, params);
    const foundPersonalIds = result.rows.map((row) => normalizePersonalId(row.personal_id));
    const missingPersonalIds = uniquePersonalIds.filter(
      (personalId) => !foundPersonalIds.includes(personalId)
    );

    if (missingPersonalIds.length > 0) {
      req.log.warn(
        {
          boardId,
          missingPersonalIds
        },
        'На доске указаны personal_id без подходящих верифицированных партнёров'
      );
    }
    return reply.send({
      success: true,
      partners: result.rows
    });

  } catch (err) {
    console.error('❌ Ошибка получения партнёров:', err);
    return reply.code(500).send({ success: false, error: 'Internal server error' });
  }
});

const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';
/**
 * Инициализация структуры папок на Яндекс.Диске
 * Создаёт все необходимые служебные папки при старте сервера
 */
async function initializeYandexDiskFolders() {
  try {
    console.log('[Yandex Disk] 🚀 Инициализация структуры папок...');

    // Создать базовую директорию
    await ensureFolderExists(YANDEX_DISK_BASE_DIR);
    console.log(`[Yandex Disk] ✅ Базовая директория: ${YANDEX_DISK_BASE_DIR}`);

    // Создать папку SHARED
    const sharedRoot = getSharedRootPath();
    await ensureFolderExists(sharedRoot);
    console.log(`[Yandex Disk] ✅ Папка для общих изображений: ${sharedRoot}`);

    // Создать папку для модерации (pending)
    const pendingFolder = getSharedPendingFolderPath();
    await ensureFolderExists(pendingFolder);
    console.log(`[Yandex Disk] ✅ Папка для модерации: ${pendingFolder}`);

    console.log('[Yandex Disk] ✅ Инициализация структуры папок завершена');
  } catch (error) {
    console.error('[Yandex Disk] ❌ Ошибка инициализации папок:', error.message);
    console.warn('[Yandex Disk] ⚠️ Сервер продолжит работу, но могут быть проблемы с загрузкой файлов');
    // Не останавливаем сервер при ошибке инициализации
  }
}

// Инициализация папок на Яндекс.Диске
await initializeYandexDiskFolders();

try {
  // Инициализация WebSocket ДО запуска сервера
  const io = setupWebSocket(app.server);
  app.decorate('io', io);
  console.log(`🔌 WebSocket server initialized`);
  
  await app.listen({ port: PORT, host: HOST });


  console.log(`🔌 WebSocket server initialized`); 
  app.log.info(`API listening on http://${HOST}:${PORT}`);

  // Инициализируем крон-задачи после успешного запуска сервера
  initializeCronTasks();
  console.log('✅ Cron jobs initialized');

  // Инициализируем Telegram бота
  initializeTelegramBot();
  console.log('✅ Telegram bot initialized');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
