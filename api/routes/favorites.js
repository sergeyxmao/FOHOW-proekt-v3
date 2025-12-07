module.exports = function(app, pool) {
  // Получить избранное
  app.get('/api/favorites', async (req, res) => {
    try {
      const userId = req.userId;
      const result = await pool.query(
        'SELECT favorite_user_id FROM favorites WHERE user_id = $1',
        [userId]
      );
      res.json({ 
        success: true, 
        favorites: result.rows.map(r => String(r.favorite_user_id))
      });
    } catch (e) {
      console.error('GET /api/favorites error:', e);
      res.status(500).json({ error: 'Failed to load favorites' });
    }
  });

  // Добавить в избранное
  app.post('/api/favorites', async (req, res) => {
    try {
      const userId = req.userId;
      const { favoriteUserId } = req.body;
      
      await pool.query(
        'INSERT INTO favorites (user_id, favorite_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, favoriteUserId]
      );
      
      res.json({ success: true });
    } catch (e) {
      console.error('POST /api/favorites error:', e);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });

  // Удалить из избранного
  app.delete('/api/favorites/:favoriteUserId', async (req, res) => {
    try {
      const userId = req.userId;
      const { favoriteUserId } = req.params;
      
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND favorite_user_id = $2',
        [userId, favoriteUserId]
      );
      
      res.json({ success: true });
    } catch (e) {
      console.error('DELETE /api/favorites error:', e);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });
};
