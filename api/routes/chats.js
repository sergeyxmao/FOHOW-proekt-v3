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
      // Также подтягиваем данные собеседника (для личных чатов)
      const result = await pool.query(`
        SELECT 
          c.id, 
          c.chat_type, 
          c.last_message_at,
          -- Массив участников (ID)
          array_agg(p.user_id) as participant_ids,
          -- Последнее сообщение (текст)
          (SELECT text FROM fogrup_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_text
        FROM fogrup_chats c
        JOIN fogrup_chat_participants p ON p.chat_id = c.id
        WHERE c.id IN (
            SELECT chat_id FROM fogrup_chat_participants WHERE user_id = $1
        )
        GROUP BY c.id
        ORDER BY c.last_message_at DESC
      `, [req.user.id]);

      // Преобразуем для фронтенда
      const chats = result.rows.map(row => ({
        id: row.id.toString(),
        participantIds: row.participant_ids.map(id => id.toString()),
        messages: [], // Сообщения грузим отдельно при открытии чата
        lastMessageTime: new Date(row.last_message_at).getTime(),
        lastMessagePreview: row.last_message_text
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

      // Сохраняем сообщение (триггер сам обновит last_message_at в чате)
      const result = await pool.query(
        `INSERT INTO fogrup_messages (chat_id, sender_id, text)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [id, req.user.id, text]
      );

      const row = result.rows[0];
      
      // TODO: Здесь можно добавить отправку уведомления получателю (fogrup_notifications)

      return reply.send({ 
        success: true, 
        message: {
            id: row.id.toString(),
            senderId: req.user.id.toString(),
            text: text,
            timestamp: new Date(row.created_at).getTime()
        }
      });

    } catch (err) {
      console.error('[CHATS] Ошибка отправки:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
