import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { authenticateToken } from './middleware/auth.js';
import { createWriteStream, promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import Redis from 'ioredis';
import { checkFeature } from './middleware/checkFeature.js';
import { checkUsageLimit } from './middleware/checkUsageLimit.js';

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

  if (session.lockedUntil && now >= session.lockedUntil) {
    session.lockedUntil = null;
    session.attempts = 0;
    const ttl = await redis.ttl(redisKey);
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

    if (ttl <= 0) {
       return { ok: false, status: 400, message: 'Проверочный код истек. Обновите код.' };
    }

    if (session.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      session.lockedUntil = now + (VERIFICATION_LOCK_DURATION_SECONDS * 1000);
      await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
      return { ok: false, status: 429, message: 'Превышено количество попыток. Форма заблокирована на 5 минут.' };
    }
    
    await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
    return { ok: false, status: 400, message: 'Неверный проверочный код' };
  }

  await redis.del(redisKey);

  return { ok: true, status: 200 };
}
// <--- КОНЕЦ НОВОГО БЛОКА С REDIS

// Плагины
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/'
});

// ============================================
// НЕЗАЩИЩЕННЫЕ МАРШРУТЫ (АУТЕНТИФИКАЦИЯ)
// ============================================

app.post('/api/verification-code', async (req, reply) => {
  try {
    const { token, code } = await createVerificationSession();
    return reply.send({ token, code });
  } catch (err) {
    req.log.error('❌ Ошибка генерации проверочного кода:', err);
    return reply.code(500).send({ error: 'Не удалось создать проверочный код' });
  }
});

app.post('/api/register', async (req, reply) => {
   const { email, password, verificationToken, verificationCode } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }
  
  const verificationResult = await validateVerificationCode(verificationToken, verificationCode);

  if (!verificationResult.ok) {
    return reply.code(verificationResult.status).send({ error: verificationResult.message });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return reply.code(400).send({ error: 'Пользователь с таким email уже существует' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const insertResult = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );

    const newUser = insertResult.rows[0];

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email }, // ИСПРАВЛЕНО: userId -> id
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return reply.send({
      success: true,
      token,
      user: { id: newUser.id, email: newUser.email }
    });
  } catch (err) {
    console.error('❌ Ошибка регистрации:', err);
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return reply.code(500).send({ error: 'Ошибка подключения к базе данных' });
    }
    if (err.name === 'JsonWebTokenError') {
      return reply.code(500).send({ error: 'Ошибка создания токена авторизации' });
    }
    if (err.code === '23505') { 
      return reply.code(400).send({ error: 'Пользователь с таким email уже существует' });
    }
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Ошибка сервера: ${err.message}`
      : 'Ошибка сервера. Попробуйте позже';
    return reply.code(500).send({ error: errorMessage });
  }
});

app.post('/api/login', async (req, reply) => {
  const { email, password, verificationToken, verificationCode } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }
  
  const verificationResult = await validateVerificationCode(verificationToken, verificationCode);

  if (!verificationResult.ok) {
    return reply.code(verificationResult.status).send({ error: verificationResult.message });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }
    
    delete user.password; 

    const token = jwt.sign(
      { id: user.id, email: user.email }, // ИСПРАВЛЕНО: userId -> id
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return reply.send({
      success: true,
      token,
      user: user
    });
  } catch (err) {
    console.error('❌ Ошибка авторизации:', err);
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

// ============================================
// ЗАЩИЩЕННЫЕ МАРШРУТЫ (ПРОФИЛЬ)
// ============================================

app.get('/api/profile', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, avatar_url, created_at, updated_at, 
              country, city, office, personal_id, phone, full_name, 
              telegram_user, telegram_channel, vk_profile, ok_profile, 
              instagram_profile, whatsapp_contact, 
              visibility_settings, search_settings 
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }
    
    return reply.send({ user: result.rows[0] });
  } catch (err) {
    console.error('❌ Ошибка получения профиля:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.put('/api/profile', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const {
      username, email, currentPassword, newPassword,
      country, city, office, personal_id, phone, full_name,
      telegram_user, telegram_channel, vk_profile, ok_profile,
      instagram_profile, whatsapp_contact
    } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }
    const user = userResult.rows[0];

    if (email && email !== user.email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) return reply.code(409).send({ error: 'Этот email уже используется' });
    }
    if (username && username !== user.username) {
      const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
      if (usernameCheck.rows.length > 0) return reply.code(409).send({ error: 'Это имя пользователя уже занято' });
    }
    if (personal_id && personal_id !== user.personal_id) {
      const personalIdCheck = await pool.query('SELECT id FROM users WHERE personal_id = $1 AND id != $2', [personal_id, userId]);
      if (personalIdCheck.rows.length > 0) return reply.code(409).send({ error: 'Этот личный номер уже используется' });
    }
    
    let passwordHash = user.password;
    if (newPassword && newPassword.trim().length > 0) {
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
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $16
       RETURNING *`;
    
    const queryParams = [
        username || null, email || null, passwordHash,
        country || null, city || null, office || null, personal_id || null, phone || null, full_name || null,
        telegram_user || null, telegram_channel || null, vk_profile || null, ok_profile || null,
        instagram_profile || null, whatsapp_contact || null,
        userId
    ];
    
    const updateResult = await pool.query(queryText, queryParams);
    
    return reply.send({
      success: true,
      user: updateResult.rows[0]
    });

  } catch (err) {
    console.error('❌ Ошибка обновления профиля:', err);
    return reply.code(500).send({ error: 'Ошибка сервера', details: err.message });
  }
});

app.delete('/api/profile', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return reply.code(400).send({ error: 'Введите пароль для подтверждения' });
    }

    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password);
    if (!validPassword) {
      return reply.code(400).send({ error: 'Неверный пароль' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    return reply.send({ success: true, message: 'Аккаунт удалён' });
  } catch (err) {
    console.error('❌ Ошибка delete-profile:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.post('/api/profile/avatar', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const data = await req.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'Файл не предоставлен' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Разрешены только изображения (JPEG, PNG, GIF, WEBP)' });
    }

    const ext = path.extname(data.filename);
    const filename = `${userId}-${randomBytes(8).toString('hex')}${ext}`;
    const filepath = path.join(__dirname, 'uploads', 'avatars', filename);

    await pipeline(data.file, createWriteStream(filepath));

    const avatarUrl = `/uploads/avatars/${filename}`;
    await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, userId]
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

app.delete('/api/profile/avatar', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    await pool.query(
      'UPDATE users SET avatar_url = NULL WHERE id = $1',
      [userId]
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

app.get('/api/boards', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, thumbnail_url, is_public, 
              created_at, updated_at, object_count
       FROM boards 
       WHERE owner_id = $1 
       ORDER BY updated_at DESC`,
      [req.user.id]
    );

    return reply.send({ boards: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения досок:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.get('/api/boards/:id', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM boards 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    return reply.send({ board: result.rows[0] });
  } catch (err) {
    console.error('❌ Ошибка получения доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.post('/api/boards', {
  preHandler: [authenticateToken, checkUsageLimit('boards', 'max_boards')]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { name, description, content } = req.body;

    const result = await pool.query(
      `INSERT INTO boards (owner_id, name, description, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        userId,
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

app.put('/api/boards/:id', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, content } = req.body;

    if (content && content.objects) {
      const newObjectCount = content.objects.length;
      const planResult = await pool.query(
        `SELECT sp.features->>'max_cards_per_board' as limit, sp.name as plan_name
         FROM users u
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [userId]
      );

      if (planResult.rows.length > 0) {
        const limit = parseInt(planResult.rows[0].limit, 10);
        const planName = planResult.rows[0].plan_name;

        if (!isNaN(limit) && limit !== -1 && newObjectCount > limit) {
          return reply.code(403).send({
            error: `Достигнут лимит карточек (${limit}) на вашем тарифе "${planName}".`,
            code: 'USAGE_LIMIT_REACHED',
            upgradeRequired: true
          });
        }
      }
    }

    let objectCount = 0;
    if (content && content.objects) {
      objectCount = content.objects.length;
    }

    const result = await pool.query(
      `UPDATE boards 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           content = COALESCE($3, content),
           object_count = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND owner_id = $6
       RETURNING *`,
      [
        name || null,
        description || null,
        content ? JSON.stringify(content) : null,
        objectCount,
        id,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    return reply.send({ board: result.rows[0] });
  } catch (err) {
    console.error('❌ Ошибка обновления доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/boards/:id', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM boards WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.post('/api/boards/:id/duplicate', {
  preHandler: [authenticateToken, checkFeature('can_duplicate_boards', true)]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const original = await pool.query(
      'SELECT * FROM boards WHERE id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (original.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    const board = original.rows[0];
    const result = await pool.query(
      `INSERT INTO boards (owner_id, name, description, content, object_count)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
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

app.post('/api/boards/:id/thumbnail', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
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
      'SELECT owner_id FROM boards WHERE id = $1',
      [boardId]
    );

    if (boardResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена' });
    }

    if (boardResult.rows[0].owner_id !== userId) {
      return reply.code(403).send({ error: 'Нет доступа' });
    }

    const boardsDir = path.join(__dirname, 'uploads', 'boards');
    await fsPromises.mkdir(boardsDir, { recursive: true });

    const filePath = path.join(boardsDir, `${boardId}.png`);
    await fsPromises.writeFile(filePath, buffer);

    const thumbnailUrl = `/uploads/boards/${boardId}.png`;

    await pool.query(
      'UPDATE boards SET thumbnail_url = $1 WHERE id = $2 AND owner_id = $3',
      [thumbnailUrl, boardId, userId]
    );

    return reply.send({ thumbnail_url: thumbnailUrl });
  } catch (err) {
    console.error('❌ Ошибка загрузки миниатюры доски:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// СТИКЕРЫ (STICKERS)
// ============================================

app.get('/api/boards/:boardId/stickers', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { boardId } = req.params;

    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    const result = await pool.query(
      `SELECT
        s.id, s.board_id, s.user_id, s.content, s.color, s.pos_x, s.pos_y, s.created_at, s.updated_at,
        u.username AS author_username, u.avatar_url AS author_avatar
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

app.post('/api/boards/:boardId/stickers', {
  preHandler: [authenticateToken, checkUsageLimit('stickers', 'max_stickers_per_board')]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { boardId } = req.params;
    const { pos_x, pos_y, color } = req.body;

    if (pos_x === undefined || pos_y === undefined) {
      return reply.code(400).send({ error: 'Обязательные поля: pos_x, pos_y' });
    }

    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    const result = await pool.query(
      `INSERT INTO stickers (board_id, user_id, content, color, pos_x, pos_y)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [boardId, userId, '', color || '#FFFF88', pos_x, pos_y]
    );

    const stickerWithAuthor = await pool.query(
      `SELECT s.*, u.username AS author_username, u.avatar_url AS author_avatar
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

app.put('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { stickerId } = req.params;
    const { content, pos_x, pos_y, color } = req.body;

    const ownerCheck = await pool.query(
      'SELECT user_id FROM stickers WHERE id = $1',
      [stickerId]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Стикер не найден' });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого стикера' });
    }

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
      `UPDATE stickers SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );

    const stickerWithAuthor = await pool.query(
      `SELECT s.*, u.username AS author_username, u.avatar_url AS author_avatar
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

app.delete('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { stickerId } = req.params;
    const userId = req.user.id;

    const stickerIdNum = parseInt(stickerId, 10);
    if (isNaN(stickerIdNum) || stickerIdNum <= 0) {
      return reply.code(400).send({ error: 'Некорректный ID стикера' });
    }

    const result = await pool.query(
      'DELETE FROM stickers WHERE id = $1 AND user_id = $2',
      [stickerIdNum, userId]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Стикер не найден или у вас нет прав на его удаление' });
    }

    return reply.code(204).send();

  } catch (err) {
    console.error('❌ Ошибка удаления стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ЗАМЕТКИ (NOTES)
// ============================================

app.get('/api/boards/:boardId/notes', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { boardId } = req.params;

    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

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

app.post('/api/notes', {
  preHandler: [authenticateToken, checkUsageLimit('notes', 'max_notes_per_board')]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { boardId, cardUid, noteDate, content, color } = req.body;

    if (!boardId || !cardUid || !noteDate) {
      return reply.code(400).send({ error: 'Обязательные поля: boardId, cardUid, noteDate' });
    }

    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    const shouldDelete = !content || content.trim() === '';

    if (shouldDelete) {
      const deleteResult = await pool.query(
        `DELETE FROM notes WHERE board_id = $1 AND card_uid = $2 AND note_date = $3 RETURNING id`,
        [boardId, cardUid, noteDate]
      );

      if (deleteResult.rows.length > 0) {
        return reply.send({ success: true, deleted: true, message: 'Заметка удалена' });
      } else {
        return reply.send({ success: true, deleted: false, message: 'Заметка не найдена' });
      }
    }

    const result = await pool.query(
      `INSERT INTO notes (board_id, card_uid, note_date, content, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (board_id, card_uid, note_date)
       DO UPDATE SET content = EXCLUDED.content, color = EXCLUDED.color, updated_at = CURRENT_TIMESTAMP
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

app.get('/api/comments', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
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

app.post('/api/comments', {
  preHandler: [authenticateToken, checkUsageLimit('comments', 'max_comments')]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { content, color } = req.body;

    if (!content || content.trim() === '') {
      return reply.code(400).send({ error: 'Содержимое комментария обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO user_comments (user_id, content, color)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, color, created_at, updated_at`,
      [userId, content.trim(), color || null]
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

app.put('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;
    const { content, color } = req.body;

    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    if (!content || content.trim() === '') {
      return reply.code(400).send({ error: 'Содержимое комментария обязательно' });
    }

    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого комментария' });
    }

    const result = await pool.query(
      `UPDATE user_comments
       SET content = $1, color = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, content, color, created_at, updated_at`,
      [content.trim(), color || null, commentIdNum, userId]
    );

    return reply.send({
      success: true,
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return reply.code(403).send({ error: 'Нет доступа к удалению этого комментария' });
    }

    await pool.query(
      'DELETE FROM user_comments WHERE id = $1 AND user_id = $2',
      [commentIdNum, userId]
    );

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Проверка живости API
app.get('/api/health', async () => ({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
