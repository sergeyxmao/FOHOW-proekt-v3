import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Регистрация маршрутов для работы с библиотекой изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerImageRoutes(app) {
  /**
   * GET /api/images/my - Получить список личных изображений
   *
   * Эндпоинт для получения списка изображений текущего пользователя с пагинацией.
   * Позволяет фильтровать изображения по папкам.
   */
  app.get('/api/images/my', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Валидация и парсинг параметров запроса
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const folder = req.query.folder || null;

      // Валидация параметров
      if (page < 1) {
        return reply.code(400).send({
          error: 'Параметр page должен быть >= 1'
        });
      }

      if (limit < 1 || limit > 100) {
        return reply.code(400).send({
          error: 'Параметр limit должен быть в диапазоне 1-100'
        });
      }

      // Рассчитываем offset для пагинации
      const offset = (page - 1) * limit;

      // Получаем общее количество изображений пользователя (без учёта фильтра по папке)
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM image_library WHERE user_id = $1',
        [userId]
      );

      const total = parseInt(countResult.rows[0].total, 10);

      // Формируем запрос с учётом фильтра по папке
      let query;
      let queryParams;

      if (folder !== null && folder.trim() !== '') {
        // Фильтруем по конкретной папке
        query = `
          SELECT
            id,
            original_name,
            filename,
            folder_name,
            public_url,
            width,
            height,
            file_size,
            created_at
          FROM image_library
          WHERE user_id = $1 AND folder_name = $2
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        queryParams = [userId, folder.trim(), limit, offset];
      } else {
        // Получаем все изображения пользователя
        query = `
          SELECT
            id,
            original_name,
            filename,
            folder_name,
            public_url,
            width,
            height,
            file_size,
            created_at
          FROM image_library
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [userId, limit, offset];
      }

      // Выполняем запрос
      const result = await pool.query(query, queryParams);

      // Формируем ответ
      return reply.code(200).send({
        items: result.rows,
        pagination: {
          page,
          limit,
          total
        }
      });

    } catch (err) {
      console.error('❌ Ошибка получения списка изображений:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });
}
