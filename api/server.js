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
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerImageRoutes } from './routes/images/index.js';
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
import { registerStickerRoutes } from './routes/stickers.js';
import { registerNoteRoutes } from './routes/notes.js';
import { registerCommentRoutes } from './routes/comments.js';
import { registerBoardPartnerRoutes } from './routes/boardPartners.js';
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
registerStickerRoutes(app);
registerNoteRoutes(app);
registerCommentRoutes(app);
registerBoardPartnerRoutes(app);


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
