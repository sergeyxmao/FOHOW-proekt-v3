import { registerMyLibraryRoutes } from './myLibrary.js';
import { registerSharedRoutes } from './shared.js';
import { registerProxyRoutes } from './proxy.js';
import { registerImageFavoriteRoutes } from './favorites.js';

/**
 * Регистрация всех маршрутов для работы с изображениями
 *
 * Модульная структура:
 * - myLibrary.js - личная библиотека изображений (7 роутов)
 * - shared.js - общая библиотека изображений (2 роута)
 * - proxy.js - прокси для получения изображений (1 роут)
 * - favorites.js - избранные изображения (4 роута)
 *
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerImageRoutes(app) {
  // Личная библиотека изображений
  registerMyLibraryRoutes(app);

  // Общая библиотека изображений
  registerSharedRoutes(app);

  // Прокси для получения изображений
  registerProxyRoutes(app);

  // Избранные изображения
  registerImageFavoriteRoutes(app);
}
