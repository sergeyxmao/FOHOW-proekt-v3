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
        const boardResult = await pool.query('SELECT id FROM boards WHERE id = $1', [boardId])

        if (boardResult.rows.length === 0) {
          return reply.code(404).send({ success: false, error: 'Board not found' })
        }

        const [notesResult, imagesResult, commentsResult, anchorsResult, stickersResult] =
          await Promise.all([
            pool.query('SELECT COUNT(*) AS count FROM notes WHERE board_id = $1', [boardId]),
            pool.query(
              `SELECT 
                 COUNT(*) FILTER (WHERE user_id = $1) AS user_images,
                 COUNT(*) AS total_images
               FROM image_library`,
              [userId]
            ),
            pool.query('SELECT COUNT(*) AS count FROM user_comments WHERE user_id = $1', [userId]),
            pool.query('SELECT COUNT(*) AS count FROM board_anchors WHERE board_id = $1', [boardId]),
            pool.query('SELECT COUNT(*) AS count FROM stickers WHERE board_id = $1', [boardId])
          ])

        const counters = {
          notes: Number(notesResult.rows[0]?.count ?? 0),
          images: `${Number(imagesResult.rows[0]?.user_images ?? 0)}/${Number(
            imagesResult.rows[0]?.total_images ?? 0
          )}`,
          comments: Number(commentsResult.rows[0]?.count ?? 0),
          geolocation: Number(anchorsResult.rows[0]?.count ?? 0),
          stickers: Number(stickersResult.rows[0]?.count ?? 0)
        }

        return reply.send({ success: true, counters })
      } catch (error) {
        req.log.error('Ошибка получения счетчиков обсуждения', error)
        return reply.code(500).send({ success: false, error: 'Internal server error' })
      }
    }
  )
}
