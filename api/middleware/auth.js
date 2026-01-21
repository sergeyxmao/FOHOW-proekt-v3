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

    // Получаем роль пользователя из БД
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return reply.code(401).send({ error: 'Пользователь не найден' });
    }

    // Извлекаем signature из токена (последняя часть после второй точки)
    const tokenParts = token.split('.');
    const tokenSignature = tokenParts.length === 3 ? tokenParts[2] : null;

    // ПРОВЕРКА СУЩЕСТВОВАНИЯ СЕССИИ В active_sessions
    // Если сессия была удалена (например, при логине на другом устройстве),
    // возвращаем 401 с reason: 'forced_logout' для автоматического выхода на клиенте
    if (tokenSignature) {
      const sessionResult = await pool.query(
        'SELECT id FROM active_sessions WHERE token_signature = $1',
        [tokenSignature]
      );

      if (sessionResult.rows.length === 0) {
        console.log(`[AUTH] Сессия не найдена для токена: ${token.substring(0, 10)}... — forced logout`);
        return reply.code(401).send({
          error: 'Сессия завершена',
          reason: 'forced_logout'
        });
      }

      // Асинхронное обновление last_seen для отслеживания активности пользователя
      // Обновляем last_seen без await, чтобы не замедлять основной запрос
      (async () => {
        try {
          await pool.query(
            'UPDATE active_sessions SET last_seen = NOW() WHERE token_signature = $1',
            [tokenSignature]
          );
        } catch (err) {
          // Логируем ошибку, но не прерываем выполнение основного запроса
          console.error(`[AUTH] ОШИБКА при выполнении UPDATE last_seen:`, err);
        }
      })();
    }

    // Используем userId из токена и роль из БД
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: userResult.rows[0].role || 'user'
    };

  } catch (err) {
    return reply.code(403).send({ error: 'Недействительный токен' });
  }
}
