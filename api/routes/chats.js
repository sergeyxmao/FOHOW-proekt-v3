// api/routes/chats.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export async function registerChatRoutes(app) {

  // GET /api/chats - Список моих чатов
  app.get('/api/chats', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      // Получаем чаты, сортируем по последнему сообщению
      // Также подтягиваем данные собеседника и количество непрочитанных сообщений
      const result = await pool.query(`
        SELECT
          c.id, c.updated_at,
          json_agg(json_build_object(
            'user_id', u.id,
            'full_name', u.full_name,
            'avatar_url', u.avatar_url
          )) as participants,
          (SELECT text FROM fogrup_messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM fogrup_messages 
           WHERE chat_id = c.id 
           AND sender_id != $1 
           AND status != 'read'
          ) as unread_count
        FROM fogrup_chats c
        JOIN fogrup_chat_participants cp ON cp.chat_id = c.id
        JOIN users u ON u.id = cp.user_id
        WHERE c.id IN (
          SELECT chat_id FROM fogrup_chat_participants WHERE user_id = $1
          )
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        `, [req.user.id]);

      // Преобразуем для фронтенда
      const chats = result.rows.map(row => ({
        id: row.id.toString(),
        participantIds: row.participants.map(p => p.user_id.toString()),
        participants: row.participants.map(p => ({
          userId: p.user_id.toString(),
          fullName: p.full_name,
          avatarUrl: p.avatar_url
        })),
        messages: [], // Сообщения грузим отдельно при открытии чата
        lastMessageTime: new Date(row.updated_at).getTime(),
        lastMessagePreview: row.last_message,
        unreadCount: Number(row.unread_count)
      }));

      return reply.send({ success: true, chats });
    } catch (err) {
      console.error('[CHATS] Ошибка загрузки списка:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // POST /api/chats - Создать или получить существующий чат
  app.post('/api/chats', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { targetId } = req.body;
    if (!targetId) return reply.code(400).send({ error: 'targetId обязателен' });

    try {
      // Используем SQL функцию из БД, которая сама проверит дубликаты
      const result = await pool.query(
        'SELECT get_or_create_private_chat($1, $2) as chat_id',
        [req.user.id, targetId]
      );
      
      const chatId = result.rows[0].chat_id;
      
      return reply.send({ success: true, chatId: chatId.toString() });
    } catch (err) {
      console.error('[CHATS] Ошибка создания:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // GET /api/chats/:id/messages - История сообщений
  app.get('/api/chats/:id/messages', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;
    
    try {
      // Проверка доступа к чату
      const accessCheck = await pool.query(
        'SELECT 1 FROM fogrup_chat_participants WHERE chat_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (accessCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Нет доступа к чату' });
      }

      const result = await pool.query(`
        SELECT id, sender_id, text, created_at, is_system
        FROM fogrup_messages
        WHERE chat_id = $1
        ORDER BY created_at ASC
        LIMIT 100
      `, [id]);

      const messages = result.rows.map(row => ({
        id: row.id.toString(),
        senderId: row.sender_id.toString(),
        text: row.text,
        timestamp: new Date(row.created_at).getTime(),
        isSystem: row.is_system
      }));

      return reply.send({ success: true, messages });
    } catch (err) {
      console.error('[CHATS] Ошибка загрузки сообщений:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // POST /api/chats/:id/messages - Отправить сообщение
  app.post('/api/chats/:id/messages', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) return reply.code(400).send({ error: 'Текст обязателен' });

    try {
      // Проверка доступа
      const accessCheck = await pool.query(
        'SELECT 1 FROM fogrup_chat_participants WHERE chat_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (accessCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Нет доступа к чату' });
      }

      // Отправить сообщение
      const result = await pool.query(
        'INSERT INTO fogrup_messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *',
        [id, req.user.id, text.trim()]
      );

      // WebSocket уведомление
      const participants = await pool.query(
        'SELECT user_id FROM fogrup_chat_participants WHERE chat_id = $1',
        [id]
      );
      const participantIds = participants.rows.map(p => p.user_id);
      
      if (req.server.io) {
        req.server.io.to(`chat:${id}`).emit('new_message', {
          chatId: id,
          message: {
            id: result.rows[0].id.toString(),
            senderId: req.user.id.toString(),
            text: text.trim(),
            timestamp: Date.now()
          }
        });
        
        // Обновить список чатов для всех участников
        participantIds.forEach(userId => {
          req.server.io.to(`user:${userId}`).emit('chats_updated');
        });
      }
      // TODO: Здесь можно добавить отправку уведомления получателю (fogrup_notifications)

      return reply.send({
        success: true,
        message: {
            id: result.rows[0].id.toString(),
            senderId: req.user.id.toString(),
            text: text.trim(),
            timestamp: new Date(result.rows[0].created_at).getTime()
        }
      });

    } catch (err) {
      console.error('[CHATS] Ошибка отправки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // POST /api/chats/:id/read - Отметить все входящие сообщения прочитанными
  app.post('/api/chats/:id/read', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    const { id } = req.params;

    try {
      // Проверка доступа к чату
      const accessCheck = await pool.query(
        'SELECT 1 FROM fogrup_chat_participants WHERE chat_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (accessCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Нет доступа к чату' });
      }

      // Массово отмечаем непрочитанные входящие сообщения как прочитанные
      const updateResult = await pool.query(
        `UPDATE fogrup_messages
         SET status = 'read'
         WHERE chat_id = $1
           AND sender_id != $2
           AND status != 'read'
         RETURNING id`,
        [id, req.user.id]
      );

      return reply.send({ success: true, updatedCount: updateResult.rowCount });
    } catch (err) {
      console.error('[CHATS] Ошибка отметки как прочитанных:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
// POST /api/chats/broadcast - Групповая рассылка
app.post('/api/chats/broadcast', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  const { recipientIds, text } = req.body;

  if (!recipientIds || recipientIds.length === 0) {
    return reply.code(400).send({ error: 'Список получателей пуст' });
  }

  if (!text || text.trim().length === 0) {
    return reply.code(400).send({ error: 'Текст сообщения пустой' });
  }

  try {
    let successCount = 0;
    let errors = [];

    // Отправляем сообщение каждому получателю в отдельный приватный чат
    for (const recipientId of recipientIds) {
      try {
        // Получить или создать приватный чат
        const chatResult = await pool.query(
          'SELECT get_or_create_private_chat($1, $2) as chat_id',
          [req.user.id, recipientId]
        );
        
        const chatId = chatResult.rows[0].chat_id;

        // Отправить сообщение
        await pool.query(
          'INSERT INTO fogrup_messages (chat_id, sender_id, text) VALUES ($1, $2, $3)',
          [chatId, req.user.id, text.trim()]
        );

        // Создать уведомление
        const sender = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
        const senderName = sender.rows[0]?.full_name || 'Пользователь';

        await pool.query(
          'INSERT INTO fogrup_notifications (user_id, type, from_user_id, text) VALUES ($1, $2, $3, $4)',
          [recipientId, 'message', req.user.id, `Новое сообщение от ${senderName}`]
        );

        successCount++;
      } catch (err) {
        console.error(`[BROADCAST] Error sending to user ${recipientId}:`, err);
        errors.push(recipientId);
      }
    }

    return reply.send({ 
      success: true, 
      sent: successCount,
      failed: errors.length,
      failedUsers: errors
    });
  } catch (err) {
    console.error('[BROADCAST] Error:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});  
}
