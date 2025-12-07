import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Middleware для аутентификации
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] User ${socket.userId} connected`);

    // Присоединяем пользователя к его персональной комнате
    socket.join(`user:${socket.userId}`);

    // Событие: пользователь печатает
    socket.on('typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId: socket.userId,
        chatId
      });
    });

    // Событие: пользователь перестал печатать
    socket.on('stop_typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user_stop_typing', {
        userId: socket.userId,
        chatId
      });
    });

    // Событие: присоединиться к чату
    socket.on('join_chat', ({ chatId }) => {
      socket.join(`chat:${chatId}`);
      console.log(`[WebSocket] User ${socket.userId} joined chat ${chatId}`);
    });

    // Событие: покинуть чат
    socket.on('leave_chat', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
      console.log(`[WebSocket] User ${socket.userId} left chat ${chatId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] User ${socket.userId} disconnected`);
    });
  });

  return io;
}

// Функция для отправки уведомления о новом сообщении
export function notifyNewMessage(io, chatId, message, participantIds) {
  // Отправляем всем участникам чата кроме отправителя
  participantIds
    .filter(id => id !== message.sender_id)
    .forEach(userId => {
      io.to(`user:${userId}`).emit('new_message', {
        chatId,
        message: {
          id: message.id.toString(),
          senderId: message.sender_id.toString(),
          text: message.text,
          timestamp: new Date(message.created_at).getTime(),
          isSystem: message.is_system || false
        }
      });
    });
}

// Функция для обновления списка чатов
export function notifyChatsUpdate(io, userId) {
  io.to(`user:${userId}`).emit('chats_updated');
}
