import { pool } from '../db.js'

/**
 * Middleware для проверки прав администратора
 */
export async function checkAdmin(req, reply) {
  try {
    // Получаем пользователя из authenticateToken middleware
    const userId = req.user?.userId || req.user?.id

    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: 'Требуется авторизация'
      })
    }

    // Проверяем роль в БД
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return reply.code(401).send({
        success: false,
        error: 'Пользователь не найден'
      })
    }

    const userRole = result.rows[0].role

    if (userRole !== 'admin') {
      return reply.code(403).send({
        success: false,
        error: 'Доступ запрещён. Требуются права администратора.'
      })
    }

    // Добавляем роль в request для использования в route handlers
    req.user.role = userRole
  } catch (error) {
    console.error('Ошибка проверки прав администратора:', error)
    return reply.code(500).send({
      success: false,
      error: 'Ошибка сервера'
    })
  }
}
