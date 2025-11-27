import { pool } from '../db.js'
import { authenticateToken } from '../middleware/auth.js'

/**
 * Регистрация маршрутов для меню «Обсуждения»
 * @param {import('fastify').FastifyInstance} app
 */
export function registerDiscussionRoutes(app) {
  app.get(
    '/api/boards/:boardId/discussion-counters',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      const { boardId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return reply.code(401).send({ success: false, error: 'Unauthorized' })
      }

      try {
        // Проверка доступа к доске с получением content
        const boardResult = await pool.query(
          'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
          [boardId, userId]
        )

        if (boardResult.rows.length === 0) {
          return reply.code(404).send({ success: false, error: 'Board not found' })
        }

        const boardContent = boardResult.rows[0].content

        // Запросы 1-5: выполняются параллельно
        const [notesResult, imagesResult, commentsResult, anchorsResult, stickersResult] =
          await Promise.all([
            // Запрос 1: Список заметок
            pool.query('SELECT COUNT(*) AS count FROM notes WHERE board_id = $1', [boardId]),
            // Запрос 2: Изображения (личные пользователя / всего в системе)
            pool.query(
              `SELECT
                 COUNT(*) FILTER (WHERE user_id = $1) AS user_images,
                 COUNT(*) AS total_images
               FROM image_library`,
              [userId]
            ),
            // Запрос 3: Комментарии пользователя
            pool.query('SELECT COUNT(*) AS count FROM user_comments WHERE user_id = $1', [userId]),
            // Запрос 4: Геолокация (точки на доске)
            pool.query('SELECT COUNT(*) AS count FROM board_anchors WHERE board_id = $1', [boardId]),
            // Запрос 5: Стикеры на доске
            pool.query('SELECT COUNT(*) AS count FROM stickers WHERE board_id = $1', [boardId])
          ])

        // Запрос 6: Партнеры на доске
        let partnersCount = 0

        if (boardContent && boardContent.cards && Array.isArray(boardContent.cards)) {
          // Извлекаем personal_id из карточек типа 'large' или 'gold'
          const personalIds = boardContent.cards
            .filter((card) => card.type === 'large' || card.type === 'gold')
            .map((card) => card.text)
            .filter((personalId) => personalId && personalId !== 'RUY68123456789') // Исключаем дефолтный номер

          // Оставляем только уникальные personal_id
          const uniquePersonalIds = [...new Set(personalIds)]

          if (uniquePersonalIds.length > 0) {
            // Выполняем SQL-запрос для подсчёта верифицированных партнёров
            const partnersResult = await pool.query(
              `SELECT COUNT(*) as count
               FROM users
               WHERE personal_id = ANY($1)
                 AND is_verified = true
                 AND plan_id IN (6, 7)
                 AND avatar_url IS NOT NULL
                 AND avatar_url != '/Avatar.png'`,
              [uniquePersonalIds]
            )
            partnersCount = Number(partnersResult.rows[0]?.count ?? 0)
          }
        }

        const counters = {
          notes: Number(notesResult.rows[0]?.count ?? 0),
          images: `${Number(imagesResult.rows[0]?.user_images ?? 0)}/${Number(
            imagesResult.rows[0]?.total_images ?? 0
          )}`,
          comments: Number(commentsResult.rows[0]?.count ?? 0),
          geolocation: Number(anchorsResult.rows[0]?.count ?? 0),
          stickers: Number(stickersResult.rows[0]?.count ?? 0),
          partners: partnersCount
        }

        return reply.send({ success: true, counters })
      } catch (error) {
        req.log.error('Ошибка получения счетчиков обсуждения', error)
        return reply.code(500).send({ success: false, error: 'Internal server error' })
      }
    }
  )
}
