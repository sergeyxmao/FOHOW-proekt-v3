import { registerAdminUsersRoutes } from './users.js';
import { registerAdminStatsRoutes } from './stats.js';
import { registerAdminTransactionsRoutes } from './transactions.js';
import { registerAdminImagesRoutes } from './images.js';
import { registerAdminVerificationsRoutes } from './verifications.js';
import { registerAdminExportsRoutes } from './exports.js';

/**
 * Регистрация всех маршрутов админ-панели
 *
 * Модульная структура:
 * - users.js        - Управление пользователями и сессиями
 * - stats.js        - Статистика и мониторинг
 * - transactions.js - История транзакций
 * - images.js       - Модерация изображений и папки общей библиотеки
 * - verifications.js - Модерация верификации пользователей
 * - exports.js      - Экспорт пользователей в CSV
 *
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminRoutes(app) {
  // Управление пользователями
  registerAdminUsersRoutes(app);

  // Статистика и мониторинг
  registerAdminStatsRoutes(app);

  // История транзакций
  registerAdminTransactionsRoutes(app);

  // Модерация изображений
  registerAdminImagesRoutes(app);

  // Модерация верификации
  registerAdminVerificationsRoutes(app);

  // Экспорт пользователей
  registerAdminExportsRoutes(app);

  console.log('✅ Маршруты админ-панели зарегистрированы');
}
