import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

export async function authenticateToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Используем userId из токена
    request.user = {
      id: decoded.userId,
      email: decoded.email
    };

    // Асинхронное обновление last_seen для отслеживания активности пользователя
    // Извлекаем signature из токена (последняя часть после второй точки)
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      const tokenSignature = tokenParts[2];

      // Обновляем last_seen без await, чтобы не замедлять основной запрос
      console.log(`[AUTH] Пытаюсь выполнить UPDATE last_seen для токена: ${token.substring(0, 10)}...`);

      (async () => {
        try {
          await pool.query(
            'UPDATE active_sessions SET last_seen = NOW() WHERE token_signature = $1',
            [tokenSignature]
          );
          console.log(`[AUTH] UPDATE last_seen успешно выполнен для токена: ${token.substring(0, 10)}...`);
        } catch (err) {
          // Логируем ошибку, но не прерываем выполнение основного запроса
          console.error(`[AUTH] ОШИБКА при выполнении UPDATE last_seen для токена ${token.substring(0, 10)}...:`, err);
        }
      })();
    }
  } catch (err) {
    return reply.code(403).send({ error: 'Недействительный токен' });
  }
}
