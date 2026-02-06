export function registerFavoriteRoutes(app, pool, authenticateToken) {
  // Получить избранное
  app.get('/api/favorites', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Favorites'],
      summary: 'Получить избранных пользователей',
      description: 'Возвращает список избранных пользователей текущего авторизованного пользователя',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            favorites: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  favorite_user_id: { type: 'integer' },
                  full_name: { type: 'string' },
                  avatar_url: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' }
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
        'SELECT favorite_user_id FROM favorites WHERE user_id = $1',
        [req.user.id]
      );
      return reply.send({
        success: true,
        favorites: result.rows.map(r => String(r.favorite_user_id))
      });
    } catch (e) {
      req.log.error('[FAVORITES] Load error:', e);
      return reply.code(500).send({ error: 'Failed to load favorites' });
    }
  });

  // Добавить в избранное
  app.post('/api/favorites', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Favorites'],
      summary: 'Добавить в избранное',
      description: 'Добавляет пользователя в список избранных текущего авторизованного пользователя',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['favoriteUserId'],
        properties: {
          favoriteUserId: { type: 'integer' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            favorite: { type: 'object' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    const { favoriteUserId } = req.body || {};
    if (!favoriteUserId) {
      return reply.code(400).send({ error: 'favoriteUserId is required' });
    }
    try {
      await pool.query(
        'INSERT INTO favorites (user_id, favorite_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, favoriteUserId]
      );
      return reply.send({ success: true });
    } catch (e) {
      req.log.error('[FAVORITES] Add error:', e);
      return reply.code(500).send({ error: 'Failed to add favorite' });
    }
  });

  // Удалить из избранного
  app.delete('/api/favorites/:favoriteUserId', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Favorites'],
      summary: 'Удалить из избранного',
      description: 'Удаляет пользователя из списка избранных текущего авторизованного пользователя',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          favoriteUserId: { type: 'integer' }
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
    const { favoriteUserId } = req.params;
    try {
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND favorite_user_id = $2',
        [req.user.id, favoriteUserId]
      );
      return reply.send({ success: true });
    } catch (e) {
      req.log.error('[FAVORITES] Remove error:', e);
      return reply.code(500).send({ error: 'Failed to remove favorite' });
    }
  });
}
