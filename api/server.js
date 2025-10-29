import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import bcrypt from 'bcrypt';
import { pool } from './db.js'; // 👈 Добавляем импорт подключения к PostgreSQL

const app = Fastify({ logger: true });

// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });

// === РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ ===
app.post('/api/register', async (req, reply) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email и пароль обязательны' });
  }

  try {
    // Проверяем, существует ли пользователь
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return reply.code(400).send({ error: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль
    const hash = await bcrypt.hash(password, 10);

    // Сохраняем нового пользователя
    await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2)',
      [email, hash]
    );

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка регистрации:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Проверка живости API
app.get('/health', async () => ({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
