import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { authenticateToken } from './middleware/auth.js';
import { checkAdmin } from './middleware/checkAdmin.js';
import { createWriteStream, promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import Redis from 'ioredis'; // <-- Добавлен импорт Redis
import { checkFeature } from './middleware/checkFeature.js';
import { checkUsageLimit } from './middleware/checkUsageLimit.js';
import { registerPromoRoutes } from './routes/promo.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerImageRoutes } from './routes/images.js';
import { registerAnchorRoutes } from './routes/anchors.js';
import { registerBoardFolderRoutes } from './routes/boardFolders.js';
import { registerDiscussionRoutes } from './routes/discussion.js';
import verificationRoutes from './routes/verification.js';
import { registerPartnerRoutes } from './routes/partners.js';
import { registerRelationshipRoutes } from './routes/relationships.js';
import { registerUserRoutes } from './routes/users.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerChatRoutes } from './routes/chats.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerPlanRoutes } from './routes/plans.js';
import { registerTelegramRoutes } from './routes/telegram.js';
import { initializeCronTasks } from './cron/tasks.js';
import { initializeTelegramBot } from './bot/telegramBot.js';
import { setupWebSocket, notifyNewMessage, notifyChatsUpdate } from './socket.js';
import {
  ensureFolderExists,
  getSharedRootPath,
  getSharedPendingFolderPath,
  YANDEX_DISK_BASE_DIR
} from './services/yandexDiskService.js';
import { sendTelegramMessage } from './utils/telegramService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = Fastify({ logger: true });

// Проверяем наличие необходимых переменных окружения
if (!process.env.JWT_SECRET) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET не определен в переменных окружения!');
  console.error('Создайте файл .env и добавьте: JWT_SECRET=ваш_секретный_ключ');
  process.exit(1);
}

// Redis логика перенесена в services/emailVerificationService.js


// Плагины безопасности
await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB максимум
  }
});
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/'
});

// ============================================
// РЕГИСТРАЦИЯ РОУТОВ
// ============================================
registerAuthRoutes(app);
registerProfileRoutes(app);
registerBoardRoutes(app);
registerPlanRoutes(app);
registerTelegramRoutes(app);


// Проверка живости API
app.get('/api/health', async () => ({ ok: true }));

// ============================================
// ПРОМОКОДЫ (PROMO CODES)
// ============================================
registerPromoRoutes(app);

// ============================================
// АДМИН-ПАНЕЛЬ (ADMIN PANEL)
// ============================================
registerAdminRoutes(app);

// ============================================
// БИБЛИОТЕКА ИЗОБРАЖЕНИЙ (IMAGE LIBRARY)
// ============================================
registerImageRoutes(app);

// ============================================
// ТОЧКИ (ANCHORS)
// ============================================
registerAnchorRoutes(app);

// ============================================
// ПАПКИ ДОСОК (BOARD FOLDERS)
// ============================================
registerBoardFolderRoutes(app);

// ============================================
// ОБСУЖДЕНИЯ (DISCUSSIONS)
// ============================================
registerDiscussionRoutes(app);

// ============================================
// ВЕРИФИКАЦИЯ (VERIFICATION)
// ============================================
app.register(verificationRoutes);

// ============================================
// ПАРТНЁРЫ FOGRUP (FOGRUP PARTNERS)
// ============================================
registerPartnerRoutes(app, pool, authenticateToken);

// ============================================
// СВЯЗИ FOGRUP (FOGRUP RELATIONSHIPS)
// ============================================
registerRelationshipRoutes(app, pool, authenticateToken);

// ============================================
// ПОЛЬЗОВАТЕЛИ FOGRUP (FOGRUP USERS)
// ============================================
registerUserRoutes(app, pool, authenticateToken);

// ============================================
// УВЕДОМЛЕНИЯ FOGRUP (ДОБАВЛЕНО)
// ============================================
registerNotificationRoutes(app); // <--- ДОБАВИТЬ ЭТУ СТРОКУ

// ============================================
// ЧАТЫ FOGRUP (ДОБАВИТЬ ЭТОТ БЛОК)
// ============================================
registerChatRoutes(app); // <--- ВОТ ЭТУ СТРОКУ ВСТАВИТЬ СЮДА

// ============================================
// ИЗБРАННОЕ FOGRUP
// ============================================
registerFavoriteRoutes(app, pool, authenticateToken);

// ============================================
// СТИКЕРЫ (STICKERS)
// ============================================

// Получить все стикеры для доски
app.get('/api/boards/:boardId/stickers', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;

    // Проверяем, что пользователь является владельцем доски
    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Получаем все стикеры для этой доски с информацией об авторе
    const result = await pool.query(
      `SELECT
        s.id,
        s.board_id,
        s.user_id,
        s.content,
        s.color,
        s.pos_x,
        s.pos_y,
        s.created_at,
        s.updated_at,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.board_id = $1
       ORDER BY s.created_at ASC`,
      [boardId]
    );

    return reply.send({ stickers: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения стикеров:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать новый стикер
    app.post('/api/boards/:boardId/stickers', {
      preHandler: [authenticateToken, checkUsageLimit('stickers', 'max_stickers')]
    }, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { pos_x, pos_y, color } = req.body;

    // Валидация входных данных
    if (pos_x === undefined || pos_y === undefined) {
      return reply.code(400).send({
        error: 'Обязательные поля: pos_x, pos_y'
      });
    }

    // Проверяем, что пользователь является владельцем доски
    const boardCheck = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Создаём новый стикер
    const result = await pool.query(
      `INSERT INTO stickers (board_id, user_id, content, color, pos_x, pos_y)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [boardId, req.user.id, '', color || '#FFFF88', pos_x, pos_y]
    );

    // Получаем информацию об авторе
    const stickerWithAuthor = await pool.query(
      `SELECT
        s.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [result.rows[0].id]
    );

    return reply.send({
      success: true,
      sticker: stickerWithAuthor.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка создания стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Обновить стикер
app.put('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { stickerId } = req.params;
    const { content, pos_x, pos_y, color } = req.body;

    // Проверяем, что стикер существует и принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM stickers WHERE id = $1',
      [stickerId]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Стикер не найден' });
    }

    // Администраторы могут редактировать любые стикеры
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого стикера' });
    }

    // Обновляем стикер
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex++}`);
      updateValues.push(content);
    }
    if (pos_x !== undefined) {
      updateFields.push(`pos_x = $${paramIndex++}`);
      updateValues.push(pos_x);
    }
    if (pos_y !== undefined) {
      updateFields.push(`pos_y = $${paramIndex++}`);
      updateValues.push(pos_y);
    }
    if (color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      updateValues.push(color);
    }

    if (updateFields.length === 0) {
      return reply.code(400).send({ error: 'Нет полей для обновления' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(stickerId);

    const result = await pool.query(
      `UPDATE stickers
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    // Получаем информацию об авторе
    const stickerWithAuthor = await pool.query(
      `SELECT
        s.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM stickers s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [result.rows[0].id]
    );

    return reply.send({
      success: true,
      sticker: stickerWithAuthor.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Удалить стикер (ИСПРАВЛЕННАЯ ВЕРСИЯ)
app.delete('/api/stickers/:stickerId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { stickerId } = req.params;
    const userId = req.user.id;

    // Валидация ID стикера
    const stickerIdNum = parseInt(stickerId, 10);
    if (isNaN(stickerIdNum) || stickerIdNum <= 0) {
      // Это единственная валидная причина для 400 Bad Request
      return reply.code(400).send({ error: 'Некорректный ID стикера' });
    }

    // Выполняем ОДИН безопасный запрос на удаление
    // Администраторы могут удалить любой стикер
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'DELETE FROM stickers WHERE id = $1'
      : 'DELETE FROM stickers WHERE id = $1 AND user_id = $2';
    const params = isAdmin ? [stickerIdNum] : [stickerIdNum, userId];

    const result = await pool.query(query, params);

    // Проверяем, была ли удалена строка.
    // Если rowCount === 0, значит стикер либо не найден, либо не принадлежит пользователю.
    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Стикер не найден или у вас нет прав на его удаление' });
    }

    // Отправляем успешный ответ. Стандарт для DELETE - это 204 No Content.
    // Фронтенд увидит, что response.ok === true и не будет пытаться парсить тело ответа.
    return reply.code(204).send();

  } catch (err) {
    console.error('❌ Ошибка удаления стикера:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ЗАМЕТКИ (NOTES)
// ============================================

// Получить все заметки для доски
app.get('/api/boards/:boardId/notes', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;

    // Проверяем, что пользователь является владельцем доски
    // Администраторы могут получить заметки любой доски
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT id FROM boards WHERE id = $1'
      : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [boardId] : [boardId, req.user.id];

    const boardCheck = await pool.query(query, params);

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Получаем все заметки для этой доски
    const result = await pool.query(
      `SELECT id, card_uid, note_date, content, color, created_at, updated_at
       FROM notes
       WHERE board_id = $1
       ORDER BY note_date ASC`,
      [boardId]
    );

    return reply.send({ notes: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения заметок:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать/обновить/удалить заметку (UPSERT + DELETE)
    app.post('/api/notes', {
      preHandler: [authenticateToken, checkUsageLimit('notes', 'max_notes')]
    }, async (req, reply) => {
  try {
    const { boardId, cardUid, noteDate, content, color } = req.body;

    // Валидация входных данных
    if (!boardId || !cardUid || !noteDate) {
      return reply.code(400).send({
        error: 'Обязательные поля: boardId, cardUid, noteDate'
      });
    }

    // Проверяем, что пользователь является владельцем доски
    // Администраторы могут создать/обновить заметку для любой доски
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT id FROM boards WHERE id = $1'
      : 'SELECT id FROM boards WHERE id = $1 AND owner_id = $2';
    const params = isAdmin ? [boardId] : [boardId, req.user.id];

    const boardCheck = await pool.query(query, params);

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Доска не найдена или нет доступа' });
    }

    // Проверяем, нужно ли удалить заметку (пустой текст = удаление, независимо от цвета)
    const shouldDelete = !content || content.trim() === '';

    if (shouldDelete) {
      // Удаляем заметку
      const deleteResult = await pool.query(
        `DELETE FROM notes
         WHERE board_id = $1 AND card_uid = $2 AND note_date = $3
         RETURNING id`,
        [boardId, cardUid, noteDate]
      );

      if (deleteResult.rows.length > 0) {
        return reply.send({
          success: true,
          deleted: true,
          message: 'Заметка удалена'
        });
      } else {
        return reply.send({
          success: true,
          deleted: false,
          message: 'Заметка не найдена'
        });
      }
    }

    // UPSERT: создаём или обновляем заметку
    const result = await pool.query(
      `INSERT INTO notes (board_id, card_uid, note_date, content, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (board_id, card_uid, note_date)
       DO UPDATE SET
         content = EXCLUDED.content,
         color = EXCLUDED.color,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [boardId, cardUid, noteDate, content || null, color || null]
    );

    return reply.send({
      success: true,
      note: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка сохранения заметки:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ЛИЧНЫЕ КОММЕНТАРИИ ПОЛЬЗОВАТЕЛЯ (USER_COMMENTS)
// ============================================

// Получить все личные комментарии пользователя
app.get('/api/comments', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    // Получаем все комментарии пользователя, отсортированные по дате создания (новые вверху)
    const result = await pool.query(
      `SELECT id, user_id, content, color, created_at, updated_at
       FROM user_comments
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return reply.send({ comments: result.rows });
  } catch (err) {
    console.error('❌ Ошибка получения комментариев:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Создать новый личный комментарий
    app.post('/api/comments', {
      preHandler: [authenticateToken, checkUsageLimit('comments', 'max_comments')]
    }, async (req, reply) => {
  try {
    const { content, color } = req.body;

    // Валидация входных данных
    if (!content || content.trim() === '') {
      return reply.code(400).send({
        error: 'Содержимое комментария обязательно'
      });
    }

    // Создаём новый комментарий
    const result = await pool.query(
      `INSERT INTO user_comments (user_id, content, color)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, color, created_at, updated_at`,
      [req.user.id, content.trim(), color || null]
    );

    return reply.send({
      success: true,
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка создания комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Обновить личный комментарий
app.put('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { commentId } = req.params;
    const { content, color } = req.body;

    // Валидация commentId
    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      console.error('❌ Некорректный commentId:', commentId);
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    // Проверяем, что commentId является числом
    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      console.error('❌ commentId не является положительным числом:', commentId);
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    // Валидация входных данных
    if (!content || content.trim() === '') {
      return reply.code(400).send({
        error: 'Содержимое комментария обязательно'
      });
    }

    // Проверяем, что комментарий принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    // Администраторы могут редактировать любые комментарии
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к редактированию этого комментария' });
    }

    // Обновляем комментарий
    const query = isAdmin
      ? `UPDATE user_comments
         SET content = $1,
             color = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, user_id, content, color, created_at, updated_at`
      : `UPDATE user_comments
         SET content = $1,
             color = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING id, user_id, content, color, created_at, updated_at`;
    const params = isAdmin
      ? [content.trim(), color || null, commentIdNum]
      : [content.trim(), color || null, commentIdNum, req.user.id];

    const result = await pool.query(query, params);

    return reply.send({
      success: true,
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// Удалить личный комментарий
app.delete('/api/comments/:commentId', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { commentId } = req.params;

    // Валидация commentId
    if (!commentId || commentId === 'undefined' || commentId === 'null') {
      console.error('❌ Некорректный commentId:', commentId);
      return reply.code(400).send({ error: 'Некорректный ID комментария' });
    }

    // Проверяем, что commentId является числом
    const commentIdNum = Number(commentId);
    if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
      console.error('❌ commentId не является положительным числом:', commentId);
      return reply.code(400).send({ error: 'ID комментария должен быть положительным числом' });
    }

    // Проверяем, что комментарий принадлежит текущему пользователю
    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_comments WHERE id = $1',
      [commentIdNum]
    );

    if (ownerCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Комментарий не найден' });
    }

    // Администраторы могут удалить любой комментарий
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ownerCheck.rows[0].user_id !== req.user.id) {
      return reply.code(403).send({ error: 'Нет доступа к удалению этого комментария' });
    }

    // Удаляем комментарий
    const query = isAdmin
      ? 'DELETE FROM user_comments WHERE id = $1'
      : 'DELETE FROM user_comments WHERE id = $1 AND user_id = $2';
    const params = isAdmin ? [commentIdNum] : [commentIdNum, req.user.id];

    await pool.query(query, params);

    return reply.send({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления комментария:', err);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
});

// ============================================
// ПАРТНЕРЫ (PARTNERS)
// ============================================
// Партнёры с досок с Аватарами
app.get('/api/boards/:boardId/avatar-partners', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { search } = req.query;

    const boardCheck = await pool.query(
      'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ success: false, error: 'Board not found' });
    }

    const board = boardCheck.rows[0];
    const content = board.content || {};
    const cardsArray = content?.cards || content?.objects || [];

    const avatarCards = cardsArray.filter(
      (card) => card.type === 'avatar' && card.userId !== null
    );

    if (avatarCards.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    const avatarsByUserId = avatarCards.reduce((acc, avatar) => {
      const userId = Number(avatar.userId);

      if (!Number.isFinite(userId)) {
        return acc;
      }

      if (!acc.has(userId)) {
        acc.set(userId, []);
      }

      acc.get(userId).push(avatar);
      return acc;
    }, new Map());

    const uniqueUserIds = [...avatarsByUserId.keys()];

    if (uniqueUserIds.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    const usersResult = await pool.query(
      `SELECT
         id,
         username,
         full_name,
         avatar_url,
         personal_id,
         phone,
         city,
         country,
         office,
         telegram_user,
         instagram_profile,
         vk_profile,
         website,
         search_settings,
         visibility_settings,
         is_verified
       FROM users
       WHERE id = ANY($1)`,
      [uniqueUserIds]
    );

    const isEnabled = (settings, key) => {
      if (!settings || typeof settings !== 'object') return true;
      const value = settings[key];
      return value === true || value === 'true' || value === 1 || value === undefined;
    };

    const isSearchable = (settings, key) => {
      if (!settings || typeof settings !== 'object') return false;
      const value = settings[key];
      return value === true || value === 'true' || value === 1;
    };

    const normalize = (value) => (value ?? '').toString().toLowerCase();
    const searchTerm = normalize(search).trim();

    const partners = [];

    usersResult.rows.forEach((userRow) => {
      const relatedAvatars = avatarsByUserId.get(userRow.id) || [];

      // Пропускаем неверифицированных пользователей
      if (!userRow.is_verified) {
        return;
      }

      relatedAvatars.forEach((avatar) => {
        const visibility = userRow.visibility_settings || {};
        const searchSettings = userRow.search_settings || {};

        const partner = {
          id: userRow.id,
          avatarObjectId: avatar.id,
          userId: userRow.id,
          username: isEnabled(visibility, 'username') ? userRow.username : null,
          full_name: isEnabled(visibility, 'full_name') ? userRow.full_name : null,
          avatar_url: isEnabled(visibility, 'avatar_url') ? userRow.avatar_url : '/Avatar.png',
          personal_id: isEnabled(visibility, 'personal_id') ? userRow.personal_id : null,
          phone: isEnabled(visibility, 'phone') ? userRow.phone : null,
          city: isEnabled(visibility, 'city') ? userRow.city : null,
          country: isEnabled(visibility, 'country') ? userRow.country : null,
          office: isEnabled(visibility, 'office') ? userRow.office : null,
          telegram_user: isEnabled(visibility, 'telegram_user') ? userRow.telegram_user : null,
          instagram_profile: isEnabled(visibility, 'instagram_profile') ? userRow.instagram_profile : null,
          vk_profile: isEnabled(visibility, 'showVK') ? userRow.vk_profile : null,
          website: isEnabled(visibility, 'showWebsite') ? userRow.website : null,
          search_settings: searchSettings,
          x: avatar.x,
          y: avatar.y,
          diameter: avatar.diameter
        };

        if (searchTerm) {
          const searchableFields = [];

          if (isSearchable(searchSettings, 'username')) searchableFields.push(userRow.username);
          if (isSearchable(searchSettings, 'full_name')) searchableFields.push(userRow.full_name);
          if (isSearchable(searchSettings, 'phone')) searchableFields.push(userRow.phone);
          if (isSearchable(searchSettings, 'city')) searchableFields.push(userRow.city);
          if (isSearchable(searchSettings, 'country')) searchableFields.push(userRow.country);
          if (isSearchable(searchSettings, 'office')) searchableFields.push(userRow.office);
          if (isSearchable(searchSettings, 'personal_id')) searchableFields.push(userRow.personal_id);
          if (isSearchable(searchSettings, 'telegram_user')) searchableFields.push(userRow.telegram_user);
          if (isSearchable(searchSettings, 'instagram_profile')) searchableFields.push(userRow.instagram_profile);

          const matches = searchableFields
            .filter(Boolean)
            .some((field) => normalize(field).includes(searchTerm));

          if (!matches) {
            return;
          }
        }

        delete partner.search_settings;
        partners.push(partner);
      });
    });

    return reply.send({ success: true, partners });
  } catch (err) {
    console.error('❌ Ошибка получения партнёров для аватаров:', err);
    return reply.code(500).send({ success: false, error: 'Internal server error' });
  }
});

// Получить список партнёров для доски
app.get('/api/boards/:boardId/partners', {
  preHandler: [authenticateToken]
}, async (req, reply) => {
  try {
    const { boardId } = req.params;
    const { search } = req.query;

    // Проверяем, что доска существует и принадлежит текущему пользователю
    const boardCheck = await pool.query(
      'SELECT id, content FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );

    if (boardCheck.rows.length === 0) {
      return reply.code(404).send({ success: false, error: 'Board not found' });
    }

    const board = boardCheck.rows[0];
    const content = board.content || {};
    const cardsArray = content?.cards || content?.objects || []
    const normalizePersonalId = (value) =>
      (value ?? '')
        .toString()
        .replace(/\s+/g, '')
        .toUpperCase();
    // Фильтруем карточки типа large и gold
    const largeAndGoldCards = cardsArray.filter(
      (card) => card.type === 'large' || card.type === 'gold'
    );

    // Извлекаем номера лицензий (personal_id) из card.text
    const personalIds = largeAndGoldCards
      .map((card) => normalizePersonalId(card.text))
      .filter((text) => text && text !== 'RUY68123456789'); // Исключаем дефолтный номер
    // Получаем уникальные personal_id
    const uniquePersonalIds = [...new Set(personalIds)];

    // Если нет партнёров, возвращаем пустой массив
    if (uniquePersonalIds.length === 0) {
      return reply.send({ success: true, partners: [] });
    }

    // Формируем SQL-запрос с учётом поиска
    let query;
    let params;

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = `
        SELECT
          u.id,
          u.username,
          u.personal_id,
          u.avatar_url,
          u.plan_id,
          u.search_settings,
          CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
          CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
          CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
          CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
          CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
          CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
          CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile,
          CASE WHEN u.search_settings->>'vk_profile' = 'true' THEN u.vk_profile ELSE NULL END as vk_profile,
          CASE WHEN u.search_settings->>'website' = 'true' THEN u.website ELSE NULL END as website
        FROM users u
        WHERE u.personal_id = ANY($1)
          AND u.is_verified = true
          AND u.plan_id IN (6, 7)
          AND u.avatar_url IS NOT NULL
          AND u.avatar_url != '/Avatar.png'
          AND (
            (u.search_settings->>'username' = 'true' AND LOWER(u.username) LIKE LOWER($2)) OR
            (u.search_settings->>'full_name' = 'true' AND LOWER(u.full_name) LIKE LOWER($2)) OR
            (u.search_settings->>'phone' = 'true' AND u.phone LIKE $2) OR
            (u.search_settings->>'city' = 'true' AND LOWER(u.city) LIKE LOWER($2)) OR
            (u.search_settings->>'country' = 'true' AND LOWER(u.country) LIKE LOWER($2)) OR
            (u.search_settings->>'office' = 'true' AND LOWER(u.office) LIKE LOWER($2)) OR
            (u.search_settings->>'personal_id' = 'true' AND u.personal_id LIKE $2) OR
            (u.search_settings->>'telegram_user' = 'true' AND LOWER(u.telegram_user) LIKE LOWER($2)) OR
            (u.search_settings->>'instagram_profile' = 'true' AND LOWER(u.instagram_profile) LIKE LOWER($2)) OR
            (u.search_settings->>'vk_profile' = 'true' AND LOWER(u.vk_profile) LIKE LOWER($2)) OR
            (u.search_settings->>'website' = 'true' AND LOWER(u.website) LIKE LOWER($2))
          )
        ORDER BY u.username ASC
      `;
      params = [uniquePersonalIds, searchTerm];
    } else {
      query = `
        SELECT
          u.id,
          u.username,
          u.personal_id,
          u.avatar_url,
          u.plan_id,
          u.search_settings,
          CASE WHEN u.search_settings->>'full_name' = 'true' THEN u.full_name ELSE NULL END as full_name,
          CASE WHEN u.search_settings->>'phone' = 'true' THEN u.phone ELSE NULL END as phone,
          CASE WHEN u.search_settings->>'city' = 'true' THEN u.city ELSE NULL END as city,
          CASE WHEN u.search_settings->>'country' = 'true' THEN u.country ELSE NULL END as country,
          CASE WHEN u.search_settings->>'office' = 'true' THEN u.office ELSE NULL END as office,
          CASE WHEN u.search_settings->>'telegram_user' = 'true' THEN u.telegram_user ELSE NULL END as telegram_user,
          CASE WHEN u.search_settings->>'instagram_profile' = 'true' THEN u.instagram_profile ELSE NULL END as instagram_profile,
          CASE WHEN u.search_settings->>'vk_profile' = 'true' THEN u.vk_profile ELSE NULL END as vk_profile,
          CASE WHEN u.search_settings->>'website' = 'true' THEN u.website ELSE NULL END as website
        FROM users u
        WHERE u.personal_id = ANY($1)
          AND u.is_verified = true
          AND u.plan_id IN (6, 7)
          AND u.avatar_url IS NOT NULL
          AND u.avatar_url != '/Avatar.png'
        ORDER BY u.username ASC
      `;
      params = [uniquePersonalIds];
    }

    const result = await pool.query(query, params);
    const foundPersonalIds = result.rows.map((row) => normalizePersonalId(row.personal_id));
    const missingPersonalIds = uniquePersonalIds.filter(
      (personalId) => !foundPersonalIds.includes(personalId)
    );

    if (missingPersonalIds.length > 0) {
      req.log.warn(
        {
          boardId,
          missingPersonalIds
        },
        'На доске указаны personal_id без подходящих верифицированных партнёров'
      );
    }
    return reply.send({
      success: true,
      partners: result.rows
    });

  } catch (err) {
    console.error('❌ Ошибка получения партнёров:', err);
    return reply.code(500).send({ success: false, error: 'Internal server error' });
  }
});

const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';
/**
 * Инициализация структуры папок на Яндекс.Диске
 * Создаёт все необходимые служебные папки при старте сервера
 */
async function initializeYandexDiskFolders() {
  try {
    console.log('[Yandex Disk] 🚀 Инициализация структуры папок...');

    // Создать базовую директорию
    await ensureFolderExists(YANDEX_DISK_BASE_DIR);
    console.log(`[Yandex Disk] ✅ Базовая директория: ${YANDEX_DISK_BASE_DIR}`);

    // Создать папку SHARED
    const sharedRoot = getSharedRootPath();
    await ensureFolderExists(sharedRoot);
    console.log(`[Yandex Disk] ✅ Папка для общих изображений: ${sharedRoot}`);

    // Создать папку для модерации (pending)
    const pendingFolder = getSharedPendingFolderPath();
    await ensureFolderExists(pendingFolder);
    console.log(`[Yandex Disk] ✅ Папка для модерации: ${pendingFolder}`);

    console.log('[Yandex Disk] ✅ Инициализация структуры папок завершена');
  } catch (error) {
    console.error('[Yandex Disk] ❌ Ошибка инициализации папок:', error.message);
    console.warn('[Yandex Disk] ⚠️ Сервер продолжит работу, но могут быть проблемы с загрузкой файлов');
    // Не останавливаем сервер при ошибке инициализации
  }
}

// Инициализация папок на Яндекс.Диске
await initializeYandexDiskFolders();

try {
  // Инициализация WebSocket ДО запуска сервера
  const io = setupWebSocket(app.server);
  app.decorate('io', io);
  console.log(`🔌 WebSocket server initialized`);
  
  await app.listen({ port: PORT, host: HOST });


  console.log(`🔌 WebSocket server initialized`); 
  app.log.info(`API listening on http://${HOST}:${PORT}`);

  // Инициализируем крон-задачи после успешного запуска сервера
  initializeCronTasks();
  console.log('✅ Cron jobs initialized');

  // Инициализируем Telegram бота
  initializeTelegramBot();
  console.log('✅ Telegram bot initialized');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
