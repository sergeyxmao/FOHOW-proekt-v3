import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import {
  getUserFilePath,
  getSharedPendingFolderPath,
  ensureFolderExists,
  copyFile,
} from '../../services/yandexDiskService.js';
import { syncSharedFoldersWithYandexDisk } from '../../services/sharedFoldersSync.js';

/**
 * Регистрация маршрутов общей библиотеки изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerSharedRoutes(app) {
  /**
   * POST /api/images/:id/share-request - Отправить изображение на модерацию в общую библиотеку
   *
   * Эндпоинт для отправки изображения из личной библиотеки на модерацию
   * для публикации в общей библиотеке. Перемещает файл в папку pending на Яндекс.Диске
   * и обновляет запись в БД.
   */
  app.post(
    '/api/images/:id/share-request',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Images'],
        summary: 'Запросить публикацию изображения',
        description: 'Отправляет изображение из личной библиотеки на модерацию для публикации в общей библиотеке',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'integer' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const imageId = parseInt(req.params.id, 10);

        // Валидация ID
        if (!Number.isInteger(imageId) || imageId <= 0) {
          return reply.code(400).send({
            error: 'Некорректный ID изображения'
          });
        }

        // Найти запись в image_library по id и user_id
        const imageResult = await pool.query(
          `
          SELECT
            il.id,
            il.filename,
            il.folder_name,
            il.yandex_path,
            il.pending_yandex_path,
            il.share_requested_at,
            il.is_shared,
            u.personal_id,
            u.plan_id,
            sp.features,
            sp.name AS plan_name
          FROM image_library il
          JOIN users u ON il.user_id = u.id
          JOIN subscription_plans sp ON u.plan_id = sp.id
          WHERE il.id = $1
            AND il.user_id = $2
        `,
          [imageId, userId]
        );

        // Если запись не найдена, возвращаем 404
        if (imageResult.rows.length === 0) {
          return reply.code(404).send({
            error: 'Изображение не найдено'
          });
        }

        const image = imageResult.rows[0];
        const {
          filename,
          folder_name,
          yandex_path,
          share_requested_at,
          is_shared,
          features,
          plan_name,
          personal_id
        } = image;

        const featuresJson = features || {};

        // Проверка лимитов тарифа (пропускаем для администраторов)
        if (userRole !== 'admin') {
          const canUseImages =
            typeof featuresJson.can_use_images === 'boolean'
              ? featuresJson.can_use_images
              : false;

          if (!canUseImages) {
            return reply.code(403).send({
              error: `Доступ к библиотеке изображений запрещён для вашего тарифа "${plan_name}".`,
              code: 'IMAGE_LIBRARY_ACCESS_DENIED',
              upgradeRequired: true
            });
          }
        }

        // Проверить, что картинка ещё не в процессе модерации и не в общей библиотеке
        if (share_requested_at !== null) {
          return reply.code(409).send({
            error: 'Вы уже отправили это изображение на модерацию. Ожидайте решения администратора.',
            code: 'ALREADY_REQUESTED',
            share_requested_at: share_requested_at
          });
        }

        if (is_shared) {
          return reply.code(409).send({
            error: 'Это изображение уже находится в общей библиотеке.',
            code: 'ALREADY_SHARED'
          });
        }

        // Текущий путь файла
        let currentPath = yandex_path;

        // Если yandex_path не сохранён в БД (для старых записей), вычисляем его
        if (!currentPath) {
          currentPath = getUserFilePath(
            userId,
            personal_id,
            folder_name,
            filename
          );
        }

        // Путь папки pending
        const pendingFolderPath = getSharedPendingFolderPath();

        // Убедиться, что папка pending существует
        await ensureFolderExists(pendingFolderPath);

        // Путь к файлу в pending
        const pendingFilePath = `${pendingFolderPath}/${filename}`;

        // Скопировать файл из личной библиотеки в pending, оставляя оригинал у пользователя
        await copyFile(currentPath, pendingFilePath);

        console.log(
          `✅ Файл скопирован из "${currentPath}" в "${pendingFilePath}"`
        );

        // Обновить запись в БД
        const updateResult = await pool.query(
          `
          UPDATE image_library
          SET
            yandex_path = COALESCE(yandex_path, $1),
            pending_yandex_path = $2,
            share_requested_at = NOW(),
            moderation_status = 'pending'
          WHERE id = $3
          RETURNING
            id,
            share_requested_at,
            yandex_path,
            pending_yandex_path,
            moderation_status
            `,
          [currentPath, pendingFilePath, imageId]
        );

        const updatedImage = updateResult.rows[0];

        // Возвращаем успешный ответ
        return reply.code(200).send({
          id: updatedImage.id,
          share_requested_at: updatedImage.share_requested_at,
          yandex_path: updatedImage.yandex_path,
          pending_yandex_path: updatedImage.pending_yandex_path,
          moderation_status: updatedImage.moderation_status,
          share_request_submitted: true
        });
      } catch (err) {
        console.error('❌ Ошибка отправки изображения на модерацию:', err);

        // Доп. лог по ошибкам Яндекс.Диска
        if (err.status) {
          console.error(`❌ Yandex.Disk API вернул статус: ${err.status}`);
        }

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );

  /**
   * GET /api/images/shared - Получить структуру общей библиотеки изображений
   *
   * Эндпоинт для получения всех папок и изображений общей библиотеки.
   * Возвращает структуру, готовую для отображения на фронтенде.
   */
  app.get(
    '/api/images/shared',
    {
      preHandler: [authenticateToken],
      schema: {
        tags: ['Images'],
        summary: 'Получить публичные изображения',
        description: 'Возвращает структуру общей библиотеки изображений с папками и изображениями',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            category: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              images: { type: 'array', items: { type: 'object' } },
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' }
            }
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Информация о тарифе пользователя
        const userResult = await pool.query(
          `
          SELECT
            u.plan_id,
            sp.features,
            sp.name AS plan_name
          FROM users u
          JOIN subscription_plans sp ON u.plan_id = sp.id
          WHERE u.id = $1
        `,
          [userId]
        );

        if (userResult.rows.length === 0) {
          return reply.code(403).send({
            error: 'Не удалось определить тарифный план пользователя.'
          });
        }

        const user = userResult.rows[0];
        const features = user.features || {};
        const planName = user.plan_name;

        // Проверка лимитов тарифа (пропускаем для администраторов)
        if (userRole !== 'admin') {
          const canUseImages =
            typeof features.can_use_images === 'boolean'
              ? features.can_use_images
              : false;

          if (!canUseImages) {
            return reply.code(403).send({
              error: `Доступ к библиотеке изображений запрещён для вашего тарифа "${planName}".`,
              code: 'IMAGE_LIBRARY_ACCESS_DENIED',
              upgradeRequired: true
            });
          }
        }

        // Все папки из shared_folders
        try {
          await syncSharedFoldersWithYandexDisk();
        } catch (syncError) {
          console.error('❌ Ошибка синхронизации папок с Яндекс.Диском:', syncError);
          console.warn('⚠️ Продолжаем без синхронизации, используем данные из базы.');
        }
        const foldersResult = await pool.query(
          `
          SELECT id, name
          FROM shared_folders
          ORDER BY name ASC
        `
        );

        const folders = [];

        // Для каждой папки получаем изображения
        for (const folder of foldersResult.rows) {
          const imagesResult = await pool.query(
            `
            SELECT
              il.id,
              il.original_name,
              il.public_url,
              il.preview_url,
              il.width,
              il.height,
              il.file_size,
              u.full_name AS author_full_name,
              u.personal_id AS author_personal_id
            FROM image_library il
            JOIN users u ON il.user_id = u.id
            WHERE il.is_shared = TRUE
              AND il.shared_folder_id = $1
            ORDER BY il.created_at DESC
          `,
            [folder.id]
          );

          folders.push({
            id: folder.id,
            name: folder.name,
            images: imagesResult.rows
          });
        }

        // Возвращаем структуру
        return reply.code(200).send({
          folders
        });
      } catch (err) {
        console.error('❌ Ошибка получения общей библиотеки:', err);

        if (err.status) {
          console.error(`❌ Ошибка API: ${err.status}`);
        }

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );
}
