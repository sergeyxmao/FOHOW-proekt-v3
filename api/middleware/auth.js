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

    // Получаем роль и статус блокировки пользователя из БД
    const userResult = await pool.query(
      'SELECT id, email, role, is_blocked FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return reply.code(401).send({ error: 'Пользователь не найден' });
    }

    // Проверка блокировки аккаунта
    if (userResult.rows[0].is_blocked) {
      return reply.code(403).send({
        error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.',
        blocked: true
      });
    }

    // Извлекаем signature из токена (последняя часть после второй точки)
    const tokenParts = token.split('.');
    const tokenSignature = tokenParts.length === 3 ? tokenParts[2] : null;

    // ПРОВЕРКА СУЩЕСТВОВАНИЯ СЕССИИ В active_sessions
    // Если сессия была удалена, определяем причину:
    // - forced_logout: вход с другого устройства (есть другая активная сессия)
    // - session_expired: неактивность более 1 часа (нет других активных сессий)
    if (tokenSignature) {
      const sessionResult = await pool.query(
        'SELECT id FROM active_sessions WHERE token_signature = $1',
        [tokenSignature]
      );

      if (sessionResult.rows.length === 0) {
        // Проверяем, есть ли у пользователя другие активные сессии
        const otherSessionsResult = await pool.query(
          'SELECT id FROM active_sessions WHERE user_id = $1 LIMIT 1',
          [decoded.userId]
        );

        const hasOtherSessions = otherSessionsResult.rows.length > 0;
        const reason = hasOtherSessions ? 'forced_logout' : 'session_expired';
        const errorMessage = hasOtherSessions
          ? 'Сессия завершена (вход с другого устройства)'
          : 'Сессия истекла по неактивности';

        console.log(`[AUTH] Сессия не найдена для токена: ${token.substring(0, 10)}... — ${reason}`);
        return reply.code(401).send({
          error: errorMessage,
          reason: reason
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
