import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const app = Fastify({ logger: true });

// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });

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
      { id: user.id, email: user.email },
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
      'SELECT id, email, created_at FROM users WHERE id = $1',
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
} // Тест автообновления

