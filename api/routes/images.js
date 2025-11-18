import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { randomBytes } from 'crypto';
import {
  getUserLibraryFolderPath,
  getUserFilePath,
  getSharedPendingFolderPath,
  ensureFolderExists,
  uploadFile,
  publishFile,
  deleteFile,
  moveFile
} from '../services/yandexDiskService.js';

/**
 * Регистрация маршрутов для работы с библиотекой изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerImageRoutes(app) {
  /**
   * GET /api/images/my - Получить список личных изображений
   *
   * Эндпоинт для получения списка изображений текущего пользователя с пагинацией.
   * Позволяет фильтровать изображения по папкам.
   */
  app.get('/api/images/my', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Проверка доступа к библиотеке изображений (пропускаем для администраторов)
      if (userRole !== 'admin') {
        const userResult = await pool.query(
          `SELECT sp.features, sp.name as plan_name
           FROM users u
           JOIN subscription_plans sp ON u.plan_id = sp.id
           WHERE u.id = $1`,
          [userId]
        );

        if (userResult.rows.length > 0) {
          const features = userResult.rows[0].features;
          const planName = userResult.rows[0].plan_name;
          const canUseImages = features.can_use_images !== undefined ? features.can_use_images : true;

          if (!canUseImages) {
            return reply.code(403).send({
              error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
              code: 'IMAGE_LIBRARY_ACCESS_DENIED',
              upgradeRequired: true
            });
          }
        }
      }

      // Валидация и парсинг параметров запроса
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const folder = req.query.folder || null;

      // Валидация параметров
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

      // Рассчитываем offset для пагинации
      const offset = (page - 1) * limit;

      // Получаем общее количество изображений пользователя (без учёта фильтра по папке)
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM image_library WHERE user_id = $1',
        [userId]
      );

      const total = parseInt(countResult.rows[0].total, 10);

      // Формируем запрос с учётом фильтра по папке
      let query;
      let queryParams;

      if (folder !== null && folder.trim() !== '') {
        // Фильтруем по конкретной папке
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
          WHERE user_id = $1 AND folder_name = $2
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        queryParams = [userId, folder.trim(), limit, offset];
      } else {
        // Получаем все изображения пользователя
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
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [userId, limit, offset];
      }

      // Выполняем запрос
      const result = await pool.query(query, queryParams);

      // Формируем ответ
      return reply.code(200).send({
        items: result.rows,
        pagination: {
          page,
          limit,
          total
        }
      });

    } catch (err) {
      console.error('❌ Ошибка получения списка изображений:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/images/my/stats - Получить статистику использования библиотеки
   *
   * Эндпоинт для получения информации о текущем использовании библиотеки изображений
   * и лимитах тарифного плана.
   */
  app.get('/api/images/my/stats', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Получаем информацию о тарифе и статистику использования
      const userResult = await pool.query(
        `SELECT
          u.plan_id,
          sp.features,
          sp.name as plan_name,
          (SELECT COUNT(*) FROM image_library WHERE user_id = u.id) as image_count,
          (SELECT COUNT(DISTINCT folder_name) FROM image_library WHERE user_id = u.id AND folder_name IS NOT NULL) as folder_count,
          (SELECT COALESCE(SUM(file_size), 0) FROM image_library WHERE user_id = u.id) as total_size
         FROM users u
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(403).send({
          error: 'Не удалось определить тарифный план пользователя.'
        });
      }

      const user = userResult.rows[0];
      const features = user.features;
      const planName = user.plan_name;

      // Проверка доступа к библиотеке изображений (пропускаем для администраторов)
      if (userRole !== 'admin') {
        const canUseImages = features.can_use_images !== undefined ? features.can_use_images : true;

        if (!canUseImages) {
          return reply.code(403).send({
            error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
            code: 'IMAGE_LIBRARY_ACCESS_DENIED',
            upgradeRequired: true
          });
        }
      }

      // Получаем лимиты из тарифа
      const maxFiles = features.image_library_max_files !== undefined ? features.image_library_max_files : -1;
      const maxFolders = features.image_library_max_folders !== undefined ? features.image_library_max_folders : -1;
      const maxStorageMB = features.image_library_max_storage_mb !== undefined ? features.image_library_max_storage_mb : -1;

      // Формируем ответ
      return reply.send({
        usage: {
          files: parseInt(user.image_count, 10),
          folders: parseInt(user.folder_count, 10),
          storageMB: parseFloat((parseInt(user.total_size, 10) / 1024 / 1024).toFixed(2))
        },
        limits: {
          files: maxFiles,
          folders: maxFolders,
          storageMB: maxStorageMB
        },
        planName
      });
    } catch (err) {
      console.error('❌ Ошибка получения статистики библиотеки:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/images/my/folders - Получить список папок личной библиотеки
   *
   * Эндпоинт для получения списка уникальных папок, используемых в личной библиотеке пользователя.
   * Фронтенд использует это для построения дерева папок.
   */
  app.get('/api/images/my/folders', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Проверка доступа к библиотеке изображений (пропускаем для администраторов)
      if (userRole !== 'admin') {
        const userResult = await pool.query(
          `SELECT sp.features, sp.name as plan_name
           FROM users u
           JOIN subscription_plans sp ON u.plan_id = sp.id
           WHERE u.id = $1`,
          [userId]
        );

        if (userResult.rows.length > 0) {
          const features = userResult.rows[0].features;
          const planName = userResult.rows[0].plan_name;
          const canUseImages = features.can_use_images !== undefined ? features.can_use_images : true;

          if (!canUseImages) {
            return reply.code(403).send({
              error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
              code: 'IMAGE_LIBRARY_ACCESS_DENIED',
              upgradeRequired: true
            });
          }
        }
      }

      // Получаем уникальные значения folder_name из image_library
      const result = await pool.query(
        `SELECT DISTINCT folder_name
         FROM image_library
         WHERE user_id = $1
         ORDER BY folder_name ASC NULLS FIRST`,
        [userId]
      );

      // Извлекаем массив названий папок, фильтруя null и пустые строки
      const folders = result.rows
        .map(row => row.folder_name)
        .filter(name => name !== null && name.trim() !== '');

      // Возвращаем список папок
      return reply.code(200).send({ folders });

    } catch (err) {
      console.error('❌ Ошибка получения списка папок:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * POST /api/images/upload - Загрузить изображение в личную библиотеку
   *
   * Эндпоинт для загрузки одного изображения в личную библиотеку текущего пользователя.
   * Выполняет валидацию MIME-типа (только image/webp), проверку лимитов тарифа,
   * загружает файл на Яндекс.Диск и сохраняет запись в БД.
   */
  app.post('/api/images/upload', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
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
      const width = data.fields.width?.value ? parseInt(data.fields.width.value, 10) : null;
      const height = data.fields.height?.value ? parseInt(data.fields.height.value, 10) : null;

      // Получаем original_name
      const originalName = data.filename || 'image.webp';

      // Получаем personal_id пользователя и текущий тариф
      const userResult = await pool.query(
        `SELECT
          u.personal_id,
          u.plan_id,
          sp.features,
          sp.name as plan_name
         FROM users u
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(403).send({
          error: 'Не удалось определить тарифный план пользователя.'
        });
      }

      const user = userResult.rows[0];
      const personalId = user.personal_id;
      const features = user.features;
      const planName = user.plan_name;

      // Проверка лимитов (пропускаем для администраторов)
      if (userRole !== 'admin') {
        // Проверяем право can_use_images
        const canUseImages = features.can_use_images !== undefined ? features.can_use_images : true;

        if (!canUseImages) {
          return reply.code(403).send({
            error: `Библиотека изображений недоступна на текущем тарифе "${planName}".`,
            code: 'IMAGE_LIBRARY_ACCESS_DENIED',
            upgradeRequired: true
          });
        }

        // Получаем лимиты из тарифа (новые поля)
        const maxFiles = features.image_library_max_files !== undefined ? features.image_library_max_files : -1;
        const maxStorageMB = features.image_library_max_storage_mb !== undefined ? features.image_library_max_storage_mb : -1;
        const maxFolders = features.image_library_max_folders !== undefined ? features.image_library_max_folders : -1;

        // Получаем текущее количество изображений, суммарный размер и количество папок
        const statsResult = await pool.query(
          `SELECT
            COUNT(*) as image_count,
            COALESCE(SUM(file_size), 0) as total_size,
            COUNT(DISTINCT folder_name) FILTER (WHERE folder_name IS NOT NULL) as folder_count
           FROM image_library
           WHERE user_id = $1`,
          [userId]
        );

        const currentImageCount = parseInt(statsResult.rows[0].image_count, 10);
        const currentTotalSize = parseInt(statsResult.rows[0].total_size, 10);
        const currentFolderCount = parseInt(statsResult.rows[0].folder_count, 10);

        // Проверка максимального количества изображений
        if (maxFiles !== -1 && currentImageCount >= maxFiles) {
          return reply.code(403).send({
            error: `Превышен лимит количества изображений на текущем тарифе "${planName}". Доступно: ${maxFiles}, текущее количество: ${currentImageCount}.`,
            code: 'IMAGE_COUNT_LIMIT_EXCEEDED',
            upgradeRequired: true
          });
        }

        // Проверка максимального суммарного объёма (в МБ)
        const maxStorageBytes = maxStorageMB !== -1 ? maxStorageMB * 1024 * 1024 : -1;
        if (maxStorageBytes !== -1 && (currentTotalSize + fileSize) > maxStorageBytes) {
          return reply.code(403).send({
            error: `Превышен лимит объёма библиотеки изображений на текущем тарифе "${planName}". Доступно: ${maxStorageMB} МБ, текущий объём: ${(currentTotalSize / 1024 / 1024).toFixed(2)} МБ, размер файла: ${(fileSize / 1024 / 1024).toFixed(2)} МБ.`,
            code: 'STORAGE_LIMIT_EXCEEDED',
            upgradeRequired: true
          });
        }

        // Проверка максимального количества папок (если создаётся новая папка)
        if (folderName && folderName.trim() !== '' && maxFolders !== -1) {
          // Проверяем, существует ли уже такая папка
          const folderCheckResult = await pool.query(
            `SELECT 1 FROM image_library WHERE user_id = $1 AND folder_name = $2 LIMIT 1`,
            [userId, folderName.trim()]
          );

          // Если папки нет, это новая папка - проверяем лимит
          if (folderCheckResult.rows.length === 0 && currentFolderCount >= maxFolders) {
            return reply.code(403).send({
              error: `Превышен лимит количества папок в библиотеке изображений на текущем тарифе "${planName}". Доступно: ${maxFolders}, текущее количество: ${currentFolderCount}.`,
              code: 'FOLDER_COUNT_LIMIT_EXCEEDED',
              upgradeRequired: true
            });
          }
        }
      }

      // Определяем folder_name для записи в БД (пустая строка преобразуется в null)
      const folderNameForDB = (folderName && folderName.trim() !== '') ? folderName.trim() : null;

      // Построить путь папки на Яндекс.Диске
      const folderPath = getUserLibraryFolderPath(userId, personalId, folderNameForDB);

      // Убедиться, что папка существует
      await ensureFolderExists(folderPath);

      // Сгенерировать уникальное имя файла (UUID + .webp)
      const uniqueFilename = `${randomBytes(16).toString('hex')}.webp`;

      // Построить полный путь к файлу
      const filePath = getUserFilePath(userId, personalId, folderNameForDB, uniqueFilename);
      const yandexPath = filePath;

      // Загрузить файл на Яндекс.Диск
      await uploadFile(filePath, buffer, mimeType);

      // Опубликовать файл и получить публичную и preview-ссылки
      const publishResult = await publishFile(yandexPath);
      const publicUrl = publishResult.public_url;
      const previewUrl = publishResult.preview_url || publishResult.public_url;

      // Сохранить запись в БД
      const insertResult = await pool.query(
        `INSERT INTO image_library (
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
          yandex_path`,
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

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`❌ Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * DELETE /api/images/:id - Удалить изображение из личной библиотеки
   *
   * Эндпоинт для удаления изображения из личной библиотеки пользователя.
   * Проверяет, используется ли изображение на досках, удаляет файл с Яндекс.Диска
   * и удаляет запись из БД.
   */
  app.delete('/api/images/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
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

      // Проверка доступа к библиотеке изображений (пропускаем для администраторов)
      if (userRole !== 'admin') {
        const userResult = await pool.query(
          `SELECT sp.features, sp.name as plan_name
           FROM users u
           JOIN subscription_plans sp ON u.plan_id = sp.id
           WHERE u.id = $1`,
          [userId]
        );

        if (userResult.rows.length > 0) {
          const features = userResult.rows[0].features;
          const planName = userResult.rows[0].plan_name;
          const canUseImages = features.can_use_images !== undefined ? features.can_use_images : true;

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
        `SELECT
          il.id,
          il.filename,
          il.folder_name,
          il.public_url,
          u.personal_id
         FROM image_library il
         JOIN users u ON il.user_id = u.id
         WHERE il.id = $1 AND il.user_id = $2`,
        [imageId, userId]
      );

      // Если запись не найдена, возвращаем 404
      if (imageResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Изображение не найдено'
        });
      }

      const image = imageResult.rows[0];
      const { filename, folder_name, public_url, personal_id } = image;

      // Проверяем, используется ли это изображение на досках пользователя
      // Ищем в content->images->dataUrl по public_url
      const usageCheck = await pool.query(
        `SELECT id, name
         FROM boards
         WHERE owner_id = $1
         AND content::text LIKE $2
         LIMIT 1`,
        [userId, `%${public_url}%`]
      );

      // Если изображение используется на досках, возвращаем 409 Conflict
      if (usageCheck.rows.length > 0) {
        return reply.code(409).send({
          error: 'Картинка используется в проектах. Удалите её с досок перед удалением.'
        });
      }

      // Построить полный путь к файлу на Яндекс.Диске
      const yandexPath = getUserFilePath(userId, personal_id, folder_name, filename);

      // Удалить файл с Яндекс.Диска (если он существует)
      try {
        await deleteFile(yandexPath);
        console.log(`✅ Файл удалён с Яндекс.Диска: ${yandexPath}`);
      } catch (err) {
        console.error('❌ Ошибка удаления файла с Яндекс.Диска:', err);

        // Если файл не найден на Яндекс.Диске (404), продолжаем удаление записи из БД
        if (!err.status || err.status !== 404) {
          const errorMessage = process.env.NODE_ENV === 'development'
            ? `Ошибка удаления файла с Яндекс.Диска: ${err.message}`
            : 'Ошибка удаления файла. Попробуйте позже';

          return reply.code(500).send({ error: errorMessage });
        }

        console.warn('⚠️ Файл не найден на Яндекс.Диске (уже перемещён или удалён), продолжаем удаление записи из БД');
      }

      // Удалить запись из image_library
      await pool.query(
        'DELETE FROM image_library WHERE id = $1',
        [imageId]
      );

      console.log(`✅ Изображение успешно удалено: id=${imageId}, path=${yandexPath}`);

      // Возвращаем 204 No Content при успехе
      return reply.code(204).send();

    } catch (err) {
      console.error('❌ Ошибка удаления изображения:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * POST /api/images/:id/share-request - Отправить изображение на модерацию в общую библиотеку
   *
   * Эндпоинт для отправки изображения из личной библиотеки на модерацию
   * для публикации в общей библиотеке. Перемещает файл в папку pending на Яндекс.Диске
   * и обновляет запись в БД.
   */
  app.post('/api/images/:id/share-request', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
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
        `SELECT
          il.id,
          il.filename,
          il.folder_name,
          il.yandex_path,
          il.share_requested_at,
          il.is_shared,
          u.personal_id,
          u.plan_id,
          sp.features,
          sp.name as plan_name
         FROM image_library il
         JOIN users u ON il.user_id = u.id
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE il.id = $1 AND il.user_id = $2`,
        [imageId, userId]
      );

      // Если запись не найдена, возвращаем 404
      if (imageResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Изображение не найдено'
        });
      }

      const image = imageResult.rows[0];
      const { filename, yandex_path, share_requested_at, is_shared, features, plan_name } = image;

      // Проверка лимитов тарифа (пропускаем для администраторов)
      if (userRole !== 'admin') {
        // Проверяем право can_use_images
        const canUseImages = features.can_use_images || false;

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
          error: 'Изображение уже отправлено на модерацию',
          code: 'ALREADY_REQUESTED'
        });
      }

      if (is_shared) {
        return reply.code(409).send({
          error: 'Изображение уже находится в общей библиотеке',
          code: 'ALREADY_SHARED'
        });
      }

      // Получить текущий путь файла
      let currentPath = yandex_path;

      // Если yandex_path не сохранён в БД (для старых записей), вычисляем его
      if (!currentPath) {
        const { folder_name, personal_id } = image;
        currentPath = getUserFilePath(userId, personal_id, folder_name, filename);
      }

      // Построить путь папки pending
      const pendingFolderPath = getSharedPendingFolderPath();

      // Убедиться, что папка pending существует
      await ensureFolderExists(pendingFolderPath);

      // Построить путь к файлу в pending
      const pendingFilePath = `${pendingFolderPath}/${filename}`;

      // Переместить файл из личной библиотеки в pending
      await moveFile(currentPath, pendingFilePath);

      console.log(`✅ Файл перемещён из "${currentPath}" в "${pendingFilePath}"`);

      // Обновить запись в БД
      const updateResult = await pool.query(
        `UPDATE image_library
         SET
           yandex_path = $1,
           share_requested_at = NOW()
         WHERE id = $2
         RETURNING
           id,
           share_requested_at,
           yandex_path`,
        [pendingFilePath, imageId]
      );

      const updatedImage = updateResult.rows[0];

      // Возвращаем успешный ответ
      return reply.code(200).send({
        id: updatedImage.id,
        share_requested_at: updatedImage.share_requested_at,
        yandex_path: updatedImage.yandex_path,
        share_request_submitted: true
      });

    } catch (err) {
      console.error('❌ Ошибка отправки изображения на модерацию:', err);

      // Логируем дополнительную информацию для ошибок Яндекс.Диска
      if (err.status) {
        console.error(`❌ Yandex.Disk API вернул статус: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/images/shared - Получить структуру общей библиотеки изображений
   *
   * Эндпоинт для получения всех папок и изображений общей библиотеки.
   * Возвращает структуру, готовую для отображения на фронтенде.
   */
  app.get('/api/images/shared', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Получаем информацию о тарифе пользователя
      const userResult = await pool.query(
        `SELECT
          u.plan_id,
          sp.features,
          sp.name as plan_name
         FROM users u
         JOIN subscription_plans sp ON u.plan_id = sp.id
         WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(403).send({
          error: 'Не удалось определить тарифный план пользователя.'
        });
      }

      const user = userResult.rows[0];
      const features = user.features;
      const planName = user.plan_name;

      // Проверка лимитов тарифа (пропускаем для администраторов)
      if (userRole !== 'admin') {
        // Проверяем право can_use_images
        const canUseImages = features.can_use_images || false;

        if (!canUseImages) {
          return reply.code(403).send({
            error: `Доступ к библиотеке изображений запрещён для вашего тарифа "${planName}".`,
            code: 'IMAGE_LIBRARY_ACCESS_DENIED',
            upgradeRequired: true
          });
        }
      }

      // Получаем все папки из shared_folders
      const foldersResult = await pool.query(
        `SELECT id, name
         FROM shared_folders
         ORDER BY name ASC`
      );

      const folders = [];

      // Для каждой папки получаем изображения
      for (const folder of foldersResult.rows) {
        const imagesResult = await pool.query(
          `SELECT
            il.id,
            il.original_name,
            il.public_url,
            il.preview_url,
            il.width,
            il.height,
            il.file_size,
            u.full_name as author_full_name,
            u.personal_id as author_personal_id
           FROM image_library il
           JOIN users u ON il.user_id = u.id
           WHERE il.is_shared = TRUE
             AND il.shared_folder_id = $1
           ORDER BY il.created_at DESC`,
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

      // Логируем дополнительную информацию для ошибок
      if (err.status) {
        console.error(`❌ Ошибка API: ${err.status}`);
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/images/proxy/:id - Прокси для получения изображения
   *
   * Эндпоинт для проксирования изображений через свежие временные ссылки Yandex API.
   * Получает свежую ссылку для скачивания файла и делает редирект на неё.
   * Проверяет права доступа: личные изображения доступны только владельцу,
   * общие изображения доступны всем авторизованным пользователям.
   */
  app.get('/api/images/proxy/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
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
        `SELECT yandex_path, is_shared, user_id
         FROM image_library
         WHERE id = $1`,
        [imageId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Изображение не найдено' });
      }

      const image = result.rows[0];

      // Проверка прав доступа
      // Личные изображения (is_shared = false) доступны только владельцу
      // Общие изображения (is_shared = true) доступны всем авторизованным пользователям
      if (!image.is_shared && image.user_id !== userId) {
        return reply.code(403).send({ error: 'Доступ запрещен' });
      }

      // Проверить наличие yandex_path
      if (!image.yandex_path) {
        console.error(`❌ Отсутствует yandex_path для изображения id=${imageId}`);
        return reply.code(500).send({ error: 'Путь к файлу не найден' });
      }

      // Получить свежую ссылку для скачивания через Yandex API
      const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(image.yandex_path)}`;

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `OAuth ${process.env.YANDEX_DISK_TOKEN}`
        }
      });

      if (!response.ok) {
        console.error(`❌ Yandex API вернул статус ${response.status} для изображения id=${imageId}, path=${image.yandex_path}`);

        const errorMessage = process.env.NODE_ENV === 'development'
          ? `Не удалось получить изображение от Yandex API (статус ${response.status})`
          : 'Не удалось получить изображение';

        return reply.code(500).send({ error: errorMessage });
      }

      const data = await response.json();

      // Проверить наличие href в ответе
      if (!data.href) {
        console.error(`❌ Yandex API не вернул href для изображения id=${imageId}`);
        return reply.code(500).send({ error: 'Не удалось получить ссылку на изображение' });
      }

      console.log(`✅ Получена свежая ссылка для изображения id=${imageId}`);

      // Загрузить изображение с временной ссылки Yandex
      const imageResponse = await fetch(data.href);

      if (!imageResponse.ok) {
        console.error(`❌ Ошибка загрузки с Yandex: ${imageResponse.status}`);
        return reply.code(500).send({ error: 'Ошибка загрузки изображения' });
      }

      // Получить тело как буфер
      const imageBuffer = await imageResponse.arrayBuffer();

      console.log(`✅ Изображение загружено, размер: ${imageBuffer.byteLength} байт`);

      // Отдать клиенту с правильными заголовками
      return reply
        .header('Content-Type', imageResponse.headers.get('content-type') || 'image/webp')
        .header('Content-Length', imageBuffer.byteLength)
        .header('Cache-Control', 'private, max-age=3600')
        .send(Buffer.from(imageBuffer));

    } catch (err) {
      console.error('❌ Ошибка прокси изображения:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера';

      return reply.code(500).send({ error: errorMessage });
    }
  });
}
