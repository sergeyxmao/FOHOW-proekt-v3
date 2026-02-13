import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';

/**
 * Регистрация маршрутов для избранных изображений
 * @param {import('fastify').FastifyInstance} app
 */
export function registerImageFavoriteRoutes(app) {

  // GET /api/images/favorites — список избранных изображений
  app.get('/api/images/favorites', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Images'],
      summary: 'Получить избранные изображения',
      description: 'Возвращает список изображений, добавленных в избранное текущим пользователем',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  original_name: { type: 'string', nullable: true },
                  filename: { type: 'string', nullable: true },
                  public_url: { type: 'string', nullable: true },
                  preview_url: { type: 'string', nullable: true },
                  preview_placeholder: { type: 'string', nullable: true },
                  width: { type: 'integer', nullable: true },
                  height: { type: 'integer', nullable: true },
                  folder: { type: 'string', nullable: true },
                  is_shared: { type: 'boolean', nullable: true },
                  author_full_name: { type: 'string', nullable: true },
                  favorited_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        `SELECT il.id, il.original_name, il.filename, il.public_url, il.preview_url,
                il.preview_placeholder, il.width, il.height, il.folder, il.is_shared,
                u.full_name AS author_full_name,
                imf.created_at AS favorited_at
         FROM image_favorites imf
         JOIN image_library il ON il.id = imf.image_id
         LEFT JOIN users u ON u.id = il.user_id
         WHERE imf.user_id = $1
         ORDER BY imf.created_at DESC`,
        [req.user.id]
      );
      return reply.send({ success: true, items: result.rows });
    } catch (e) {
      req.log.error('[IMAGE_FAVORITES] Load error:', e);
      return reply.code(500).send({ error: 'Failed to load favorite images' });
    }
  });

  // POST /api/images/:id/favorite — добавить в избранное
  app.post('/api/images/:id/favorite', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Images'],
      summary: 'Добавить изображение в избранное',
      description: 'Добавляет изображение в список избранных текущего пользователя',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    const imageId = req.params.id;
    try {
      // Проверяем что изображение существует
      const imageCheck = await pool.query(
        'SELECT id FROM image_library WHERE id = $1',
        [imageId]
      );
      if (imageCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      await pool.query(
        'INSERT INTO image_favorites (user_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, imageId]
      );
      return reply.send({ success: true });
    } catch (e) {
      req.log.error('[IMAGE_FAVORITES] Add error:', e);
      return reply.code(500).send({ error: 'Failed to add image to favorites' });
    }
  });

  // DELETE /api/images/:id/favorite — убрать из избранного
  app.delete('/api/images/:id/favorite', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Images'],
      summary: 'Убрать изображение из избранного',
      description: 'Удаляет изображение из списка избранных текущего пользователя',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    const imageId = req.params.id;
    try {
      await pool.query(
        'DELETE FROM image_favorites WHERE user_id = $1 AND image_id = $2',
        [req.user.id, imageId]
      );
      return reply.send({ success: true });
    } catch (e) {
      req.log.error('[IMAGE_FAVORITES] Remove error:', e);
      return reply.code(500).send({ error: 'Failed to remove image from favorites' });
    }
  });

  // GET /api/images/favorite-ids — получить только ID избранных (для быстрой проверки)
  app.get('/api/images/favorite-ids', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Images'],
      summary: 'Получить ID избранных изображений',
      description: 'Возвращает массив ID изображений, добавленных в избранное (для отображения сердечек)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            ids: {
              type: 'array',
              items: { type: 'integer' }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await pool.query(
        'SELECT image_id FROM image_favorites WHERE user_id = $1',
        [req.user.id]
      );
      return reply.send({
        success: true,
        ids: result.rows.map(r => r.image_id)
      });
    } catch (e) {
      req.log.error('[IMAGE_FAVORITES] Load IDs error:', e);
      return reply.code(500).send({ error: 'Failed to load favorite IDs' });
    }
  });
}
