import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';

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
