import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { randomBytes } from 'crypto';
import {
  getUserLibraryFolderPath,
  getUserFilePath,
  getSharedPendingFolderPath,
  ensureFolderExists,
  listFolderDirectories,
  uploadFile,
  publishFile,
  deleteFile,
  copyFile
} from '../services/yandexDiskService.js';
import { syncSharedFoldersWithYandexDisk } from '../services/sharedFoldersSync.js';

/**
 * Регистрация маршрутов для работы с библиотекой изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerImageRoutes(app) {
  /**
   * GET /api/images/my/folders - Получить список папок личной библиотеки
   *
   * Возвращает список папок в личной библиотеке пользователя с количеством
   * изображений и суммарным размером по каждой папке.
   * Также подтягивает список папок с Яндекс.Диска и объединяет их с БД.
   */
  app.get(
    '/api/images/my/folders',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Получаем personal_id и тариф пользователя
        const userResult = await pool.query(
          `
          SELECT
            u.personal_id,
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
        const personalId = user.personal_id;
        const features = user.features || {};
        const planName = user.plan_name;

        // Проверка права доступа к библиотеке изображений (кроме админов)
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

        // Корневая папка библиотеки пользователя на Яндекс.Диске
        const libraryRootPath = getUserLibraryFolderPath(
          userId,
          personalId,
          null
        );

        // Папки на Яндекс.Диске
        let yandexFolders = [];
        try {
          yandexFolders = await listFolderDirectories(libraryRootPath);
        } catch (error) {
          console.error(
            '❌ Ошибка получения списка папок на Яндекс.Диске:',
            error
          );
          return reply.code(500).send({
            error:
              process.env.NODE_ENV === 'development'
                ? `Ошибка сервера (Yandex.Disk): ${error.message}`
                : 'Ошибка сервера. Попробуйте позже'
          });
        }

        // Папки из БД (только личные изображения)
        const foldersResult = await pool.query(
          `
          SELECT
            folder_name AS name,
            COUNT(*) AS images_count,
            COALESCE(SUM(file_size), 0) AS total_size
          FROM image_library
          WHERE user_id = $1
            AND is_shared = FALSE
            AND folder_name IS NOT NULL
            AND folder_name <> ''
          GROUP BY folder_name
          ORDER BY folder_name ASC
        `,
          [userId]
        );

        const foldersMap = new Map();

        // Заполняем из БД
        for (const row of foldersResult.rows) {
          const folderName = row.name;
          foldersMap.set(folderName, {
            name: folderName,
            images_count: parseInt(row.images_count, 10) || 0,
            total_size: parseInt(row.total_size, 10) || 0
          });
        }

        // Добавляем папки, которые есть на Я.Диске, но ещё нет записей в БД
        for (const folderName of yandexFolders) {
          if (!foldersMap.has(folderName)) {
            foldersMap.set(folderName, {
              name: folderName,
              images_count: 0,
              total_size: 0
            });
          }
        }

        const folders = Array.from(foldersMap.values());

        return reply.code(200).send({ folders });
      } catch (err) {
        console.error('❌ Ошибка получения списка папок:', err);

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );
  /**
   * GET /api/images/my/stats - Получить статистику личной библиотеки изображений
   */
  app.get(
    '/api/images/my/stats',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const userResult = await pool.query(
          `
          SELECT
            u.personal_id,
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

        const statsResult = await pool.query(
          `
          SELECT
            COUNT(*) AS image_count,
            COALESCE(SUM(file_size), 0) AS total_size,
            COUNT(DISTINCT folder_name) FILTER (
              WHERE folder_name IS NOT NULL
                AND folder_name <> ''
            ) AS folder_count
          FROM image_library
          WHERE user_id = $1
            AND is_shared = FALSE
        `,
          [userId]
        );

        const currentImageCount = parseInt(
          statsResult.rows[0]?.image_count || '0',
          10
        );
        const currentTotalSize = parseInt(
          statsResult.rows[0]?.total_size || '0',
          10
        );
        const currentFolderCount = parseInt(
          statsResult.rows[0]?.folder_count || '0',
          10
        );

        const limits = {
          files:
            features.image_library_max_files !== undefined
              ? features.image_library_max_files
              : -1,
          storageMB:
            features.image_library_max_storage_mb !== undefined
              ? features.image_library_max_storage_mb
              : -1,
          folders:
            features.image_library_max_folders !== undefined
              ? features.image_library_max_folders
              : -1
        };

        const stats = {
          usage: {
            files: currentImageCount,
            folders: currentFolderCount,
            storageBytes: currentTotalSize,
            storageMB: currentTotalSize / 1024 / 1024
          },
          limits,
          planName
        };

        return reply.code(200).send(stats);
      } catch (err) {
        console.error('❌ Ошибка получения статистики библиотеки изображений:', err);

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );

  /**
   * GET /api/images/my - Получить список личных изображений
   *
   * Эндпоинт для получения списка изображений текущего пользователя с пагинацией.
   * Позволяет фильтровать изображения по папкам.
   *
   * ВАЖНО:
   * - Возвращаются только ЛИЧНЫЕ изображения (is_shared = FALSE).
   * - Параметр folder:
   *    - '' или 'Все папки' -> без фильтра по папке
   *    - любое другое значение -> фильтр по folder_name = value
   */
  app.get(
    '/api/images/my',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Получаем тариф пользователя и проверяем доступ к библиотеке изображений
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

        // Проверка права доступа к библиотеке изображений (кроме админов)
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

        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const folderRaw = req.query.folder ?? ''; // undefined / 'Все папки' / имя папки

        if (page < 1) {
          return reply.code(400).send({
            error: 'Параметр page должен быть >= 1'
          });
        }

        if (limit < 1 || limit > 100) {
          return reply.code(400).send({
            error: 'Параметр limit должен быть в диапазоне 1-100'
          });
        }

        const offset = (page - 1) * limit;

        // Нормализуем имя папки
        const folderName = String(folderRaw).trim();

        // "Все папки" и пустое значение — это отсутствие фильтра
        const hasFolderFilter =
          folderName !== '' && folderName !== 'Все папки';

        // Считаем ОБЩЕЕ количество личных изображений С УЧЁТОМ фильтра по папке
        let total = 0;

        if (hasFolderFilter) {
          const countResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM image_library
            WHERE user_id = $1
              AND is_shared = FALSE
              AND folder_name = $2
          `,
            [userId, folderName]
          );
          total = parseInt(countResult.rows[0]?.total || '0', 10);
        } else {
          const countResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM image_library
            WHERE user_id = $1
              AND is_shared = FALSE
          `,
            [userId]
          );
          total = parseInt(countResult.rows[0]?.total || '0', 10);
        }

        // Формируем запрос за списком изображений
        let query;
        let queryParams;

        if (hasFolderFilter) {
          // Фильтр по конкретной папке
          query = `
            SELECT
              id,
              original_name,
              filename,
              folder_name,
              public_url,
              preview_url,
              width,
              height,
              file_size,
              created_at
            FROM image_library
            WHERE user_id = $1
              AND is_shared = FALSE
              AND folder_name = $2
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
          `;
          queryParams = [userId, folderName, limit, offset];
        } else {
          // Без фильтра по папке — все личные картинки
          query = `
            SELECT
              id,
              original_name,
              filename,
              folder_name,
              public_url,
              preview_url,
              width,
              height,
              file_size,
              created_at
            FROM image_library
            WHERE user_id = $1
              AND is_shared = FALSE
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
          `;
          queryParams = [userId, limit, offset];
        }

        const imagesResult = await pool.query(query, queryParams);

        return reply.send({
          success: true,
          items: imagesResult.rows,
          pagination: {
            page,
            limit,
            total
          }
        });
      } catch (err) {
        console.error('❌ Ошибка получения списка изображений:', err);

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );

  /**
   * POST /api/images/upload - Загрузить изображение в личную библиотеку
   *
   * Эндпоинт для загрузки одного изображения в личную библиотеку текущего пользователя.
   * Выполняет валидацию MIME-типа (только image/webp), проверку лимитов тарифа,
   * загружает файл на Яндекс.Диск и сохраняет запись в БД.
   */
  app.post(
    '/api/images/upload',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Получаем multipart данные
        const data = await req.file();

        if (!data) {
          return reply.code(400).send({
            error: 'Файл не был передан. Поле "file" обязательно.'
          });
        }

        // Валидация MIME-типа
        const mimeType = data.mimetype;
        if (mimeType !== 'image/webp') {
          return reply.code(400).send({
            error: 'Недопустимый формат файла. Разрешен только image/webp.'
          });
        }

        // Получаем buffer файла
        const buffer = await data.toBuffer();
        const fileSize = buffer.length;

        // Получаем опциональное поле folder
        const folderName = data.fields.folder?.value || null;

        // Получаем опциональные width и height
        const width = data.fields.width?.value
          ? parseInt(data.fields.width.value, 10)
          : null;
        const height = data.fields.height?.value
          ? parseInt(data.fields.height.value, 10)
          : null;

        // Получаем original_name
        const originalName = data.filename || 'image.webp';

        // Получаем personal_id пользователя и текущий тариф
        const userResult = await pool.query(
          `
          SELECT
            u.personal_id,
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
        const personalId = user.personal_id;
        const features = user.features || {};
        const planName = user.plan_name;

        // Проверка лимитов (пропускаем для администраторов)
        if (userRole !== 'admin') {
          // Проверяем право can_use_images
          const canUseImages =
            typeof features.can_use_images === 'boolean'
              ? features.can_use_images
              : true;

          if (!canUseImages) {
            return reply.code(403).send({
              error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
              code: 'IMAGE_LIBRARY_ACCESS_DENIED',
              upgradeRequired: true
            });
          }

          // Получаем лимиты из тарифа (новые поля)
          const maxFiles =
            features.image_library_max_files !== undefined
              ? features.image_library_max_files
              : -1;
          const maxStorageMB =
            features.image_library_max_storage_mb !== undefined
              ? features.image_library_max_storage_mb
              : -1;
          const maxFolders =
            features.image_library_max_folders !== undefined
              ? features.image_library_max_folders
              : -1;

          // Получаем текущее количество изображений, суммарный размер и количество папок
          const statsResult = await pool.query(
            `
            SELECT
              COUNT(*) AS image_count,
              COALESCE(SUM(file_size), 0) AS total_size,
              COUNT(DISTINCT folder_name) FILTER (WHERE folder_name IS NOT NULL) AS folder_count
            FROM image_library
            WHERE user_id = $1
          `,
            [userId]
          );

          const currentImageCount = parseInt(
            statsResult.rows[0].image_count,
            10
          );
          const currentTotalSize = parseInt(
            statsResult.rows[0].total_size,
            10
          );
          const currentFolderCount = parseInt(
            statsResult.rows[0].folder_count,
            10
          );

          // Проверка максимального количества изображений
          if (maxFiles !== -1 && currentImageCount >= maxFiles) {
            return reply.code(403).send({
              error: `Превышен лимит количества изображений на текущем тарифе "${planName}". Доступно: ${maxFiles}, текущее количество: ${currentImageCount}.`,
              code: 'IMAGE_COUNT_LIMIT_EXCEEDED',
              upgradeRequired: true
            });
          }

          // Проверка максимального суммарного объёма (в МБ)
          const maxStorageBytes =
            maxStorageMB !== -1 ? maxStorageMB * 1024 * 1024 : -1;
          if (
            maxStorageBytes !== -1 &&
            currentTotalSize + fileSize > maxStorageBytes
          ) {
            return reply.code(403).send({
              error: `Превышен лимит объёма библиотеки изображений на текущем тарифе "${planName}". Доступно: ${maxStorageMB} МБ, текущий объём: ${(
                currentTotalSize /
                1024 /
                1024
              ).toFixed(2)} МБ, размер файла: ${(
                fileSize /
                1024 /
                1024
              ).toFixed(2)} МБ.`,
              code: 'STORAGE_LIMIT_EXCEEDED',
              upgradeRequired: true
            });
          }

          // Проверка максимального количества папок (если создаётся новая папка)
          if (
            folderName &&
            folderName.trim() !== '' &&
            maxFolders !== -1
          ) {
            // Проверяем, существует ли уже такая папка
            const folderCheckResult = await pool.query(
              `
              SELECT 1
              FROM image_library
              WHERE user_id = $1
                AND folder_name = $2
              LIMIT 1
            `,
              [userId, folderName.trim()]
            );

            // Если папки нет, это новая папка - проверяем лимит
            if (
              folderCheckResult.rows.length === 0 &&
              currentFolderCount >= maxFolders
            ) {
              return reply.code(403).send({
                error: `Превышен лимит количества папок в библиотеке изображений на текущем тарифе "${planName}". Доступно: ${maxFolders}, текущее количество: ${currentFolderCount}.`,
                code: 'FOLDER_COUNT_LIMIT_EXCEEDED',
                upgradeRequired: true
              });
            }
          }
        }

        // Определяем folder_name для записи в БД (пустая строка -> null)
        const folderNameForDB =
          folderName && folderName.trim() !== ''
            ? folderName.trim()
            : null;

        // Путь папки на Яндекс.Диске
        const folderPath = getUserLibraryFolderPath(
          userId,
          personalId,
          folderNameForDB
        );

        // Убедиться, что папка существует
        await ensureFolderExists(folderPath);

        // Уникальное имя файла (UUID + .webp)
        const uniqueFilename = `${randomBytes(16).toString('hex')}.webp`;

        // Полный путь к файлу
        const filePath = getUserFilePath(
          userId,
          personalId,
          folderNameForDB,
          uniqueFilename
        );
        const yandexPath = filePath;

        // Загрузить файл на Яндекс.Диск
        await uploadFile(filePath, buffer, mimeType);

        // Опубликовать файл и получить публичную и preview-ссылки
        const publishResult = await publishFile(yandexPath);
        const publicUrl = publishResult.public_url;
        const previewUrl =
          publishResult.preview_url || publishResult.public_url;

        // Сохранить запись в БД
        const insertResult = await pool.query(
          `
          INSERT INTO image_library (
            user_id,
            original_name,
            filename,
            folder_name,
            public_url,
            preview_url,
            width,
            height,
            file_size,
            yandex_path,
            moderation_status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
          RETURNING
            id,
            original_name,
            filename,
            folder_name,
            public_url,
            preview_url,
            width,
            height,
            file_size,
            created_at,
            yandex_path
        `,
          [
            userId,
            originalName,
            uniqueFilename,
            folderNameForDB,
            publicUrl,
            previewUrl,
            width,
            height,
            fileSize,
            yandexPath,
            'none'
          ]
        );

        const newImage = {
          ...insertResult.rows[0],
          public_url: publicUrl,
          preview_url: previewUrl
        };

        // Возвращаем успешный ответ
        return reply.code(201).send(newImage);
      } catch (err) {
        console.error('❌ Ошибка загрузки изображения:', err);

        // Доп.лог по ошибкам Яндекс.Диска
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
   * DELETE /api/images/:id - Удалить изображение из библиотеки
   *
   * Удаляет изображение (личное или общее) пользователя:
   *  - проверяет, используется ли на досках;
   *  - удаляет файл по yandex_path;
   *  - удаляет запись из БД.
   */
  app.delete(
    '/api/images/:id',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const imageId = parseInt(req.params.id, 10);

        if (!Number.isInteger(imageId) || imageId <= 0) {
          return reply.code(400).send({
            error: 'Некорректный ID изображения'
          });
        }

        // Проверка доступа к библиотеке изображений (кроме админов)
        if (userRole !== 'admin') {
          const userResult = await pool.query(
            `
            SELECT sp.features, sp.name AS plan_name
            FROM users u
            JOIN subscription_plans sp ON u.plan_id = sp.id
            WHERE u.id = $1
          `,
            [userId]
          );

          if (userResult.rows.length > 0) {
            const features = userResult.rows[0].features || {};
            const planName = userResult.rows[0].plan_name;
            const canUseImages =
              typeof features.can_use_images === 'boolean'
                ? features.can_use_images
                : true;

            if (!canUseImages) {
              return reply.code(403).send({
                error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
                code: 'IMAGE_LIBRARY_ACCESS_DENIED',
                upgradeRequired: true
              });
            }
          }
        }

        // Получаем запись изображения по id и user_id
        const imageResult = await pool.query(
          `
          SELECT
            il.id,
            il.filename,
            il.folder_name,
            il.public_url,
            il.yandex_path,
            il.is_shared,
            u.personal_id
          FROM image_library il
          JOIN users u ON il.user_id = u.id
          WHERE il.id = $1
            AND il.user_id = $2
        `,
          [imageId, userId]
        );

        if (imageResult.rows.length === 0) {
          return reply.code(404).send({
            error: 'Изображение не найдено'
          });
        }

        const image = imageResult.rows[0];
        const { filename, folder_name, public_url, personal_id, yandex_path } =
          image;

        // Проверяем, используется ли изображение на досках пользователя
        const usageCheck = await pool.query(
          `
          SELECT id, name
          FROM boards
          WHERE owner_id = $1
            AND content::text LIKE $2
          LIMIT 1
        `,
          [userId, `%${public_url}%`]
        );

        if (usageCheck.rows.length > 0) {
          return reply.code(409).send({
            error:
              'Картинка используется в проектах. Удалите её с досок перед удалением.'
          });
        }

        // Итоговый путь к файлу — в приоритете yandex_path
        let filePath = yandex_path;

        // Для старых записей, где yandex_path ещё не заполнен, вычисляем путь
        if (!filePath) {
          filePath = getUserFilePath(
            userId,
            personal_id,
            folder_name,
            filename
          );
        }

        // Удаляем файл с Яндекс.Диска (если существует)
        try {
          await deleteFile(filePath);
          console.log(`✅ Файл удалён с Яндекс.Диска: ${filePath}`);
        } catch (err) {
          console.error('❌ Ошибка удаления файла с Яндекс.Диска:', err);

          // Если файл не найден (404), продолжаем удаление записи
          if (!err.status || err.status !== 404) {
            const errorMessage =
              process.env.NODE_ENV === 'development'
                ? `Ошибка удаления файла с Яндекс.Диска: ${err.message}`
                : 'Ошибка удаления файла. Попробуйте позже';

            return reply.code(500).send({ error: errorMessage });
          }

          console.warn(
            '⚠️ Файл не найден на Яндекс.Диске, но запись будет удалена из БД'
          );
        }

        // Удаляем запись из БД
        await pool.query(
          `
          DELETE FROM image_library
          WHERE id = $1
            AND user_id = $2
        `,
          [imageId, userId]
        );

        return reply.code(200).send({
          success: true
        });
      } catch (err) {
        console.error('❌ Ошибка удаления изображения из библиотеки:', err);

        const errorMessage =
          process.env.NODE_ENV === 'development'
            ? `Ошибка сервера: ${err.message}`
            : 'Ошибка сервера. Попробуйте позже';

        return reply.code(500).send({ error: errorMessage });
      }
    }
  );

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
      preHandler: [authenticateToken]
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
      preHandler: [authenticateToken]
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
  /**
   * PATCH /api/images/:id/rename - Переименовать изображение в личной библиотеке
   */
  app.patch(
    '/api/images/:id/rename',
    {
      preHandler: [authenticateToken]
    },
    async (req, reply) => {
      try {
        const userId = req.user.id;
        const imageId = parseInt(req.params.id, 10);
        const { new_name } = req.body;

        // Валидация
        if (!Number.isInteger(imageId) || imageId <= 0) {
          return reply.code(400).send({
            error: 'Некорректный ID изображения',
            code: 'INVALID_INPUT',
            suggestion: 'Обновите страницу и повторите попытку или выберите корректный файл.'
          });
        }

        if (!new_name || typeof new_name !== 'string' || new_name.trim().length === 0) {
          return reply.code(400).send({
            error: 'Новое имя файла не может быть пустым',
            code: 'INVALID_INPUT',
            suggestion: 'Укажите непустое имя файла.'
          });
        }

        const trimmedName = new_name.trim();

        if (trimmedName.length > 200) {
          return reply.code(400).send({
            error: 'Имя файла слишком длинное (максимум 200 символов)',
            code: 'INVALID_INPUT',
            suggestion: 'Сократите имя файла до 200 символов.'
          });
        }

        // Получаем изображение
        const imageResult = await pool.query(
          `SELECT id, user_id, original_name, is_shared, folder_name
           FROM image_library
           WHERE id = $1`,
          [imageId]
        );

        if (imageResult.rows.length === 0) {
          return reply.code(404).send({
            error: 'Изображение не найдено',
            code: 'NOT_FOUND',
            suggestion: 'Обновите список изображений и выберите актуальный файл.'
          });
        }

        const image = imageResult.rows[0];

        // Проверяем права доступа
        if (image.user_id !== userId) {
          return reply.code(403).send({
            error: 'Нет прав для переименования этого изображения',
            code: 'FORBIDDEN',
            suggestion: 'Выполните вход под аккаунтом владельца изображения.'
          });
        }

        // Нельзя переименовывать изображения в общей библиотеке
        if (image.is_shared) {
          return reply.code(403).send({
            error: 'Нельзя переименовать изображение, которое находится в общей библиотеке',
            code: 'SHARED_IMAGE',
            suggestion: 'Скопируйте файл в личную папку, чтобы переименовать его.'
          });
        }

        // Определяем расширение из оригинального имени
        const extension = image.original_name.match(/\.[^/.]+$/)?.[0] || '.webp';
        const newFullName = trimmedName + extension;

        // Проверяем дубли в папке пользователя
        const duplicateCheck = await pool.query(
          `SELECT id
           FROM image_library
           WHERE user_id = $1
             AND is_shared = FALSE
             AND id <> $2
             AND original_name = $3
             AND (
               (folder_name IS NULL AND $4 IS NULL)
               OR folder_name = $4
             )
           LIMIT 1`,
          [userId, imageId, newFullName, image.folder_name || null]
        );

        if (duplicateCheck.rows.length > 0) {
          return reply.code(409).send({
            error: 'Файл с таким именем уже существует в этой папке',
            code: 'DUPLICATE_NAME',
            suggestion: 'Попробуйте добавить номер или дату в название файла.'
          });
        }

        // Обновляем имя в БД
        await pool.query(
          `UPDATE image_library
           SET original_name = $1, updated_at = NOW()
           WHERE id = $2`,
          [newFullName, imageId]
        );

        // Логируем переименование для аудита
        await pool.query(
          `INSERT INTO image_rename_audit (image_id, user_id, old_name, new_name, folder_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [imageId, userId, image.original_name, newFullName, image.folder_name || null]
        );

        console.log(`✅ Изображение ${imageId} переименовано: "${image.original_name}" → "${newFullName}"`);

        return reply.send({
          success: true,
          message: 'Изображение успешно переименовано',
          new_name: newFullName
        });

      } catch (err) {
        console.error('❌ Ошибка переименования изображения:', err);
        return reply.code(500).send({
          error: 'Ошибка сервера при переименовании изображения',
          code: 'SERVER_ERROR',
          suggestion: 'Повторите попытку позже или обратитесь в поддержку.'
        });
      }
    }
  );

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
        
        const isAdmin = req.user.role === 'admin'

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
