import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
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
import { registerTributeRoutes } from './routes/tribute.js';
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
await app.register(cors, {
  origin: [
    'https://interactive.marketingfohow.ru',
    'https://1508.marketingfohow.ru',
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null
  ].filter(Boolean),
  credentials: true
});
await app.register(rateLimit, { global: false });
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
// SWAGGER / OPENAPI ДОКУМЕНТАЦИЯ
// ============================================
await app.register(swagger, {
  openapi: {
    info: {
      title: 'FOHOW Interactive Board API',
      description: 'API для интерактивной доски FOHOW — управление структурами, партнёрами, подписками',
      version: '1.0.0'
    },
    servers: [
      { url: 'https://interactive.marketingfohow.ru', description: 'Production' },
      { url: 'https://1508.marketingfohow.ru', description: 'Staging' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Регистрация, авторизация, сброс пароля' },
      { name: 'Profile', description: 'Профиль пользователя, аватар, приватность' },
      { name: 'Users', description: 'Управление пользователями, блокировка, настройки' },
      { name: 'Boards', description: 'Структуры (доски)' },
      { name: 'Board Folders', description: 'Папки для структур' },
      { name: 'Board Partners', description: 'Партнёры на досках' },
      { name: 'Stickers', description: 'Стикеры на досках' },
      { name: 'Notes', description: 'Заметки к карточкам' },
      { name: 'Comments', description: 'Комментарии пользователей' },
      { name: 'Anchors', description: 'Якоря на досках' },
      { name: 'Images', description: 'Библиотека изображений' },
      { name: 'Partners', description: 'Поиск и просмотр партнёров' },
      { name: 'Relationships', description: 'Связи между пользователями' },
      { name: 'Favorites', description: 'Избранные пользователи' },
      { name: 'Chats', description: 'Чат (FoGrup)' },
      { name: 'Notifications', description: 'Уведомления' },
      { name: 'Telegram', description: 'Привязка Telegram' },
      { name: 'Plans', description: 'Тарифные планы' },
      { name: 'Promo', description: 'Промокоды' },
      { name: 'Verification', description: 'Верификация пользователей' },
      { name: 'Tribute', description: 'Платежи Tribute' },
      { name: 'Admin', description: 'Админ-панель' },
      { name: 'System', description: 'Здоровье системы' }
    ]
  }
});

await app.register(swaggerUi, {
  routePrefix: '/api/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    defaultModelsExpandDepth: 3
  }
});

// ============================================
// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================
app.setErrorHandler((error, request, reply) => {
  console.error('[GLOBAL ERROR HANDLER]', {
    url: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack
  });

  // В режиме разработки отправляем детальную информацию
  const errorMessage = process.env.NODE_ENV === 'development'
    ? `Ошибка сервера: ${error.message}`
    : 'Ошибка сервера. Попробуйте позже';

  reply.code(500).send({ error: errorMessage });
});

// ============================================
// ХУКИ ДЛЯ ОТЛАДКИ (ЛОГИРОВАНИЕ ВСЕХ ЗАПРОСОВ К /api/login)
// ============================================
app.addHook('onRequest', async (request, reply) => {
  // Защита Swagger UI — доступ только для администраторов
  if (request.url.startsWith('/api/docs')) {
    // Пропускаем статику swagger-ui (css, js, иконки)
    if (request.url.includes('/static/') || request.url.includes('/index.css') || request.url.includes('/swagger-ui') || request.url.includes('/favicon')) {
      return;
    }

    // Извлекаем токен из заголовка или query-параметра
    let token = null;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }

    if (!token) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        token = url.searchParams.get('token');
      } catch {}
    }

    if (!token) {
      return reply.code(401).type('text/html').send(`
        <html><body style="font-family:sans-serif;max-width:400px;margin:100px auto;text-align:center">
          <h2>Swagger API Docs</h2>
          <p>Доступ только для администраторов</p>
          <p>Добавьте токен в URL: <code>?token=YOUR_JWT_TOKEN</code></p>
        </body></html>
      `);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.userId || decoded.id]);
      if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
        return reply.code(403).send({ error: 'Доступ запрещён' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Недействительный токен' });
    }
  }

  if (request.url.includes('/api/login')) {
    console.log('[HOOK onRequest /api/login]', {
      method: request.method,
      url: request.url,
      contentType: request.headers['content-type'],
      hasBody: !!request.body
    });
  }
});

app.addHook('preHandler', async (request, reply) => {
  if (request.url.includes('/api/login')) {
    console.log('[HOOK preHandler /api/login]', {
      body: request.body,
      bodyKeys: request.body ? Object.keys(request.body) : []
    });
  }
});

app.addHook('onError', async (request, reply, error) => {
  if (request.url.includes('/api/login')) {
    console.error('[HOOK onError /api/login]', {
      error: error.message,
      stack: error.stack,
      statusCode: reply.statusCode
    });
  }
});

// ============================================
// РЕГИСТРАЦИЯ РОУТОВ
// ============================================
console.log('[DEBUG] Начало регистрации маршрутов...');
registerAuthRoutes(app);
registerProfileRoutes(app);
registerBoardRoutes(app);
registerPlanRoutes(app);
registerTelegramRoutes(app);
registerStickerRoutes(app);
registerNoteRoutes(app);
registerCommentRoutes(app);
registerBoardPartnerRoutes(app);
registerTributeRoutes(app);


// Проверка живости API
app.get('/api/health', {
  schema: {
    tags: ['System'],
    summary: 'Проверка работоспособности сервера',
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' }
        }
      }
    }
  }
}, async () => ({ ok: true }));

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

  // Логирование зарегистрированных маршрутов
  console.log('[DEBUG] Зарегистрированные маршруты:');
  console.log(app.printRoutes());

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
