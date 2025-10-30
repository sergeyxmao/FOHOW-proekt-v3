import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { authenticateToken } from './middleware/auth.js';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = Fastify({ logger: true });

// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB максимум
  }
});

// === РЕГИСТРАЦИЯ ===
app.post('/api/register', async (req, reply) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return reply.code(400).send({ error: 'Пользователь с таким email уже существует' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hash]);
    
    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка регистрации:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === АВТОРИЗАЦИЯ ===
app.post('/api/login', async (req, reply) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
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
      'SELECT id, email, username, avatar_url, created_at, updated_at FROM users WHERE id = $1',
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

// === ЗАГРУЗКА АВАТАРА ===
app.post('/api/profile/avatar', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Получаем файл из multipart
    const data = await req.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'Файл не предоставлен' });
    }

    // Проверяем тип файла
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Разрешены только изображения (JPEG, PNG, GIF, WEBP)' });
    }

    // Генерируем уникальное имя файла
    const ext = path.extname(data.filename);
    const filename = `${decoded.userId}-${randomBytes(8).toString('hex')}${ext}`;
    const filepath = path.join(__dirname, 'uploads', 'avatars', filename);

    // Сохраняем файл
    await pipeline(data.file, createWriteStream(filepath));

    // Обновляем URL аватара в БД
    const avatarUrl = `/uploads/avatars/${filename}`;
    await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, decoded.userId]
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
app.delete('/api/profile/avatar', async (req, reply) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Удаляем URL аватара из БД
    await pool.query(
      'UPDATE users SET avatar_url = NULL WHERE id = $1',
      [decoded.userId]
    );

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления аватара:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// === ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ (аватары) ===
app.get('/uploads/avatars/:filename', async (req, reply) => {
  const { filename } = req.params;
  const filepath = path.join(__dirname, 'uploads', 'avatars', filename);
  
  return reply.sendFile(filepath);
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
