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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = Fastify({ logger: true });
const VERIFICATION_CODE_TTL = 5 * 60 * 1000; // 5 минут
const VERIFICATION_MAX_ATTEMPTS = 5;
const VERIFICATION_LOCK_DURATION = 5 * 60 * 1000; // 5 минут

const verificationSessions = new Map();

function createVerificationSession(previousToken) {
  if (previousToken) {
    verificationSessions.delete(previousToken);
  }

  const now = Date.now();

  for (const [storedToken, session] of verificationSessions.entries()) {
    if (session.expiresAt <= now) {
      verificationSessions.delete(storedToken);
    }
  }

  const token = randomBytes(16).toString('hex');
  const code = Math.floor(1000 + Math.random() * 9000).toString();

  verificationSessions.set(token, {
    code,
    attempts: 0,
    lockedUntil: null,
    expiresAt: now + VERIFICATION_CODE_TTL
  });

  return { token, code };
}

function getVerificationSession(token) {
  if (!token) {
    return null;
  }

  const session = verificationSessions.get(token);

  if (!session) {
    return null;
  }

  const now = Date.now();

  if (session.expiresAt <= now) {
    verificationSessions.delete(token);
    return null;
  }

  if (session.lockedUntil && now >= session.lockedUntil) {
    session.lockedUntil = null;
    session.attempts = 0;
  }

  return session;
}

function validateVerificationCode(verificationToken, verificationCode) {
  const sanitizedCode = typeof verificationCode === 'string'
    ? verificationCode.trim()
    : String(verificationCode || '').trim();

  if (!verificationToken || sanitizedCode.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Проверочный код обязателен'
    };
  }

  const session = getVerificationSession(verificationToken);

  if (!session) {
    return {
      ok: false,
      status: 400,
      message: 'Проверочный код недействителен или истек. Обновите код.'
    };
  }

  const now = Date.now();

  if (session.lockedUntil && now < session.lockedUntil) {
    const retrySeconds = Math.ceil((session.lockedUntil - now) / 1000);

    return {
      ok: false,
      status: 429,
      message: `Превышено количество попыток. Попробуйте снова через ${retrySeconds} секунд.`
    };
  }

  if (session.code !== sanitizedCode) {
    session.attempts += 1;

    if (session.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      session.lockedUntil = now + VERIFICATION_LOCK_DURATION;

      return {
        ok: false,
        status: 429,
        message: 'Превышено количество попыток. Форма заблокирована на 5 минут.'
      };
    }

    return {
      ok: false,
      status: 400,
      message: 'Неверный проверочный код'
    };
  }

  verificationSessions.delete(verificationToken);

  return {
    ok: true,
    status: 200
  };
}
// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB максимум для аватаров
  }
});
await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'api/uploads'),
  prefix: '/uploads/',
  immutable: true,
  maxAge: '365d',
  cacheControl: true,
  setHeaders: (res, path) => {
    // Immutable кэш для всех файлов с хешем в имени
    if (path.includes('/avatars/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
});
app.post('/api/verification-code', async (req, reply) => {
  try {
    const body = req.body || {};
    const { token, code } = createVerificationSession(body.previousToken);

    return reply.send({ token, code });
  } catch (err) {
    req.log.error('❌ Ошибка генерации проверочного кода:', err);
    return reply.code(500).send({ error: 'Не удалось создать проверочный код' });
  }
});
// === РЕГИСТРАЦІЯ ===
app.post('/api/register', async (req, reply) => {
   const { email, password, verificationToken, verificationCode } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }
  
  const verificationResult = validateVerificationCode(verificationToken, verificationCode);

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
      { userId: newUser.id, email: newUser.email },
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
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === АВТОРИЗАЦІЯ ===
app.post('/api/login', async (req, reply) => {
  const { email, password, verificationToken, verificationCode } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }
  
  const verificationResult = validateVerificationCode(verificationToken, verificationCode);

  if (!verificationResult.ok) {
    return reply.code(verificationResult.status).send({ error: verificationResult.message });
  }

  try {
    const result = await pool.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }
    
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    }
    
    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return reply.send({
      success: true,
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('❌ Ошибка авторизации:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ЗАЩИЩЕННЫЙ МАРШРУТ - ПРОФИЛЬ ===
app.get('/api/profile', {
  preHandler: authenticateToken
}, async (req, reply) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, avatar_url, avatar_meta, avatar_updated_at, created_at, updated_at FROM users WHERE id = $1',
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

// === ЗАБЫЛИ ПАРОЛЬ ===
app.post('/api/forgot-password', async (req, reply) => {
  const { email } = req.body;
  
  if (!email) {
    return reply.code(400).send({ error: 'Email обязателен' });
  }
  
  try {
    // Проверяем, существует ли пользователь
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      // Не раскрываем, существует ли email (безопасность)
      return reply.send({ success: true, message: 'Если email существует, письмо будет отправлено' });
    }
    
    const userId = result.rows[0].id;
    
    // Генерируем токен
    const token = jwt.sign({ userId, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Сохраняем токен в БД
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
    
    // Отправляем email
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
    // Проверяем токен
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return reply.code(400).send({ error: 'Недействительный или истекший токен' });
    }
    
    // Проверяем токен в БД
    const resetResult = await pool.query(
      'SELECT user_id, expires_at FROM password_resets WHERE token = $1',
      [token]
    );
    
    if (resetResult.rows.length === 0) {
      return reply.code(400).send({ error: 'Токен не найден' });
    }
    
    const { user_id, expires_at } = resetResult.rows[0];
    
    // Проверяем, не истек ли токен
    if (new Date() > new Date(expires_at)) {
      await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
      return reply.code(400).send({ error: 'Токен истек' });
    }
    
    // Хешируем новый пароль
    const hash = await bcrypt.hash(newPassword, 10);
    
    // Обновляем пароль
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user_id]);
    
    // Удаляем использованный токен
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
    
    return reply.send({ success: true, message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('❌ Ошибка reset-password:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ОБНОВЛЕНИЕ ПРОФИЛЯ ===
app.put('/api/profile', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { username, email, currentPassword, newPassword } = req.body

    // Проверяем текущего пользователя
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' })
    }

    const user = userResult.rows[0]

    // Если меняем email, проверяем уникальность
    if (email && email !== user.email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, decoded.userId]
      )
      if (emailCheck.rows.length > 0) {
        return reply.code(400).send({ error: 'Email уже используется' })
      }
    }

    // Если меняем username, проверяем уникальность
    if (username && username !== user.username) {
      const usernameCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, decoded.userId]
      )
      if (usernameCheck.rows.length > 0) {
        return reply.code(400).send({ error: 'Имя пользователя занято' })
      }
    }

    // Определяем, нужно ли менять пароль
    let passwordHash = user.password
    const shouldChangePassword = newPassword && newPassword.trim().length > 0

    if (shouldChangePassword) {
      // Проверяем, указан ли текущий пароль
      if (!currentPassword || currentPassword.trim().length === 0) {
        return reply.code(400).send({ error: 'Укажите текущий пароль для смены пароля' })
      }

      // Проверяем правильность текущего пароля
      const validPassword = await bcrypt.compare(currentPassword, user.password)
      if (!validPassword) {
        return reply.code(400).send({ error: 'Неверный текущий пароль' })
      }

      // Проверяем длину нового пароля
      if (newPassword.length < 6) {
        return reply.code(400).send({ error: 'Новый пароль должен быть минимум 6 символов' })
      }

      // Хешируем новый пароль
      passwordHash = await bcrypt.hash(newPassword, 10)
    }

    // Обновляем профиль
    const updateResult = await pool.query(
      `UPDATE users 
       SET username = COALESCE($1, username), 
           email = COALESCE($2, email), 
           password = $3, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, email, avatar_url, created_at, updated_at`,
      [
        username || null,
        email || null,
        passwordHash,
        decoded.userId
      ]
    )

    return reply.send({
      success: true,
      user: updateResult.rows[0]
    })
  } catch (err) {
    console.error('❌ Ошибка update-profile:', err)
    return reply.code(500).send({ error: 'Ошибка сервера', details: err.message })
  }
})

// === УДАЛЕНИЕ АККАУНТА ===
app.delete('/api/profile', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { password } = req.body

    if (!password) {
      return reply.code(400).send({ error: 'Введите пароль для подтверждения' })
    }

    // Проверяем пароль
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' })
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password)
    if (!validPassword) {
      return reply.code(400).send({ error: 'Неверный пароль' })
    }

    // Удаляем пользователя (CASCADE удалит связанные записи)
    await pool.query('DELETE FROM users WHERE id = $1', [decoded.userId])

    return reply.send({ success: true, message: 'Аккаунт удалён' })
  } catch (err) {
    console.error('❌ Ошибка delete-profile:', err)
    return reply.code(500).send({ error: 'Ошибка сервера' })
  }
})

// === ЗАГРУЗКА АВАТАРА (ОПТИМИЗИРОВАННАЯ) ===
app.post('/api/me/avatar', async (req, reply) => {
  const startTime = Date.now();
  console.log('📤 Avatar upload request received');

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('❌ No authorization token');
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ User authenticated:', decoded.userId);

    // Получаем файл из multipart
    const data = await req.file();

    if (!data) {
      console.log('❌ No file in request');
      return reply.code(400).send({ error: 'Файл не предоставлен' });
    }

    console.log('📎 File received:', {
      filename: data.filename,
      mimetype: data.mimetype,
      encoding: data.encoding
    });

    // Читаем весь файл в буфер
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    console.log('📊 File size:', buffer.length, 'bytes');

    // Проверяем размер файла (максимум 10 МБ)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
    if (buffer.length > MAX_FILE_SIZE) {
      console.log('❌ File too large:', buffer.length);
      return reply.code(400).send({ error: 'Файл слишком большой. Максимум 10 МБ' });
    }

    // Импортируем утилиты для обработки аватаров
    const { processAvatar, deleteOldAvatarVersion } = await import('./utils/avatar.js');

    // Получаем старые метаданные для удаления старых файлов
    const userResult = await pool.query(
      'SELECT avatar_meta FROM users WHERE id = $1',
      [decoded.userId]
    );
    const oldMeta = userResult.rows[0]?.avatar_meta;
    const oldHash = oldMeta?.rev;

    console.log('🔄 Processing avatar...');
    // Обрабатываем аватар
    const { meta } = await processAvatar(buffer, decoded.userId);

    console.log('💾 Updating database...');
    // Обновляем метаданные в БД
    await pool.query(
      'UPDATE users SET avatar_meta = $1, avatar_updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(meta), decoded.userId]
    );

    // Удаляем старую версию аватара
    if (oldHash && oldHash !== meta.rev) {
      console.log('🗑️ Deleting old avatar version:', oldHash);
      await deleteOldAvatarVersion(decoded.userId, oldHash);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Avatar uploaded successfully in ${duration}ms`);

    return reply.send({
      success: true,
      avatarMeta: meta
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Ошибка загрузки аватара (${duration}ms):`, err);
    console.error('Error stack:', err.stack);

    if (err.message.includes('Unsupported image format')) {
      return reply.code(400).send({ error: 'Неподдерживаемый формат. Разрешены только JPEG, PNG, WebP и AVIF' });
    }

    // Возвращаем более детальную информацию об ошибке в development
    const isDev = process.env.NODE_ENV === 'development';
    return reply.code(500).send({
      error: 'Ошибка сервера',
      ...(isDev && { details: err.message, stack: err.stack })
    });
  }
});

// === УДАЛЕНИЕ АВАТАРА ===
app.delete('/api/me/avatar', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Импортируем утилиту для удаления файлов
    const { deleteAvatarFiles } = await import('./utils/avatar.js');

    // Удаляем все файлы аватара
    await deleteAvatarFiles(decoded.userId);

    // Очищаем метаданные в БД
    await pool.query(
      'UPDATE users SET avatar_meta = NULL, avatar_updated_at = NULL WHERE id = $1',
      [decoded.userId]
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
app.get('/api/boards', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT id, name, description, thumbnail_url, is_public, 
              created_at, updated_at, object_count
       FROM boards 
       WHERE owner_id = $1 
       ORDER BY updated_at DESC`,
      [decoded.userId]
    );

    return reply.send({ boards: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения досок:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Получить одну доску
app.get('/api/boards/:id', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM boards 
       WHERE id = $1 AND owner_id = $2`,
      [id, decoded.userId]
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

// Создать новую доску
app.post('/api/boards', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { name, description, content } = req.body;

    const result = await pool.query(
      `INSERT INTO boards (owner_id, name, description, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        decoded.userId,
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

// Обновить доску (автосохранение)
app.put('/api/boards/:id', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;
    const { name, description, content } = req.body;

    // Подсчитываем количество объектов
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
        decoded.userId
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

// Удалить доску
app.delete('/api/boards/:id', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM boards WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, decoded.userId]
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

// Дублировать доску
app.post('/api/boards/:id/duplicate', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;

    const original = await pool.query(
      'SELECT * FROM boards WHERE id = $1 AND owner_id = $2',
      [id, decoded.userId]
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
        decoded.userId,
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
app.post('/api/boards/:id/thumbnail', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

    if (boardResult.rows[0].owner_id !== decoded.userId) {
      return reply.code(403).send({ error: 'Нет доступа' });
    }

    const boardsDir = path.join(__dirname, 'uploads', 'boards');
    await fsPromises.mkdir(boardsDir, { recursive: true });

    const filePath = path.join(boardsDir, `${boardId}.png`);
    await fsPromises.writeFile(filePath, buffer);

    const thumbnailUrl = `/uploads/boards/${boardId}.png`;

    await pool.query(
      'UPDATE boards SET thumbnail_url = $1 WHERE id = $2 AND owner_id = $3',
      [thumbnailUrl, boardId, decoded.userId]
    );

    return reply.send({ thumbnail_url: thumbnailUrl });
  } catch (err) {
    console.error('❌ Ошибка загрузки миниатюры доски:', err);
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
