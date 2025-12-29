import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';

/**
 * Регистрация маршрутов прокси для изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerProxyRoutes(app) {
  /**
   * GET /api/images/proxy/:id - Прокси для получения изображения
   *
   * Эндпоинт для проксирования изображений через свежие временные ссылки Yandex API.
   * Получает свежую ссылку для скачивания файла и делает редирект на неё.
   * Проверяет права доступа: личные изображения доступны только владельцу,
   * общие изображения доступны всем авторизованным пользователям.
   */
  app.get(
    '/api/images/proxy/:id',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const imageId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        // Валидация ID
        if (!Number.isInteger(imageId) || imageId <= 0) {
          return reply.code(400).send({
            error: 'Некорректный ID изображения'
          });
        }

        // Получить информацию об изображении
        const result = await pool.query(
          `
          SELECT yandex_path, is_shared, user_id, moderation_status
          FROM image_library
          WHERE id = $1
        `,
          [imageId]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({ error: 'Изображение не найдено' });
        }

        const image = result.rows[0];

        const isAdmin = req.user.role === 'admin';

        // Проверка прав доступа:
        // 1. Общие изображения (is_shared = TRUE) доступны всем авторизованным пользователям
        // 2. Одобренные изображения (moderation_status = 'approved') доступны всем (для работы на shared досках)
        // 3. Личные изображения (is_shared = FALSE) доступны только владельцу, кроме администратора
        if (!isAdmin && !image.is_shared && image.moderation_status !== 'approved' && image.user_id !== userId) {
          return reply.code(403).send({ error: 'Доступ запрещен' });
        }

        // Проверить наличие yandex_path
        if (!image.yandex_path) {
          console.error(
            `❌ Отсутствует yandex_path для изображения id=${imageId}`
          );
          return reply.code(500).send({ error: 'Путь к файлу не найден' });
        }

        // Получить свежую ссылку для скачивания через Yandex API
        const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(
          image.yandex_path
        )}`;

        const response = await fetch(downloadUrl, {
          headers: {
            Authorization: `OAuth ${process.env.YANDEX_DISK_TOKEN}`
          }
        });

        if (!response.ok) {
          console.error(
            `❌ Yandex API вернул статус ${response.status} для изображения id=${imageId}, path=${image.yandex_path}`
          );

          const errorMessage =
            process.env.NODE_ENV === 'development'
              ? `Не удалось получить изображение от Yandex API (статус ${response.status})`
              : 'Не удалось получить изображение';

          return reply.code(500).send({ error: errorMessage });
        }

        const data = await response.json();

        // Проверить наличие href в ответе
        if (!data.href) {
          console.error(
            `❌ Yandex API не вернул href для изображения id=${imageId}`
          );
          return reply
            .code(500)
            .send({ error: 'Не удалось получить ссылку на изображение' });
        }

        console.log(
          `✅ Получена свежая ссылка для изображения id=${imageId}`
        );

        // Загрузить изображение с временной ссылки Yandex
        const imageResponse = await fetch(data.href);

        if (!imageResponse.ok) {
          console.error(
            `❌ Ошибка загрузки с Yandex: ${imageResponse.status}`
          );
          return reply
            .code(500)
            .send({ error: 'Ошибка загрузки изображения' });
        }

        // Получить тело как буфер
        const imageBuffer = await imageResponse.arrayBuffer();

        console.log(
          `✅ Изображение загружено, размер: ${imageBuffer.byteLength} байт`
        );

        // Отдать клиенту с правильными заголовками
        return reply
          .header(
            'Content-Type',
            imageResponse.headers.get('content-type') || 'image/webp'
          )
          .header('Content-Length', imageBuffer.byteLength)
          .header('Cache-Control', 'private, max-age=3600')
          .send(Buffer.from(imageBuffer));
      } catch (err) {
        console.error('❌ Ошибка прокси изображения:', err);

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );
}
