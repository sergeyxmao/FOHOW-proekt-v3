import { pool } from '../db.js';

/**
 * Middleware для проверки роли администратора
 * Должен использоваться после authenticateToken
 */
export async function requireAdmin(request, reply) {
  try {
    // Проверяем, что пользователь аутентифицирован
    if (!request.user || !request.user.id) {
      return reply.code(401).send({ error: 'Требуется аутентификация' });
    }

    // Получаем информацию о пользователе из базы данных
    const result = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];

    // Проверяем роль пользователя
    if (user.role !== 'admin') {
      console.log(`[ADMIN] Попытка доступа без прав администратора: user_id=${request.user.id}, role=${user.role}`);
      return reply.code(403).send({
        error: 'Доступ запрещен. Требуются права администратора'
      });
    }

    // Добавляем информацию о роли в request.user
    request.user.role = user.role;

    console.log(`[ADMIN] Успешная проверка прав администратора: user_id=${request.user.id}`);
  } catch (err) {
    console.error('[ADMIN] Ошибка проверки прав администратора:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
}
