import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { randomBytes } from 'crypto';
import {
  getUserLibraryFolderPath,
  getUserFilePath,
  ensureFolderExists,
  uploadFile,
  publishFile
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
        // Получаем лимиты из тарифа
        const maxImages = features.max_images || 0;
        const maxStorage = features.max_storage || 0; // в байтах
        const maxImageSize = features.max_image_size || 0; // в байтах

        // Проверка максимального размера одного файла
        if (maxImageSize > 0 && fileSize > maxImageSize) {
          return reply.code(429).send({
            error: `Размер файла (${(fileSize / 1024 / 1024).toFixed(2)} МБ) превышает максимально допустимый размер (${(maxImageSize / 1024 / 1024).toFixed(2)} МБ) для вашего тарифа "${planName}".`,
            code: 'FILE_SIZE_LIMIT_EXCEEDED',
            upgradeRequired: true
          });
        }

        // Получаем текущее количество изображений и суммарный размер
        const statsResult = await pool.query(
          `SELECT
            COUNT(*) as image_count,
            COALESCE(SUM(file_size), 0) as total_size
           FROM image_library
           WHERE user_id = $1`,
          [userId]
        );

        const currentImageCount = parseInt(statsResult.rows[0].image_count, 10);
        const currentTotalSize = parseInt(statsResult.rows[0].total_size, 10);

        // Проверка максимального количества изображений
        if (maxImages > 0 && currentImageCount >= maxImages) {
          return reply.code(429).send({
            error: `Достигнут лимит изображений (${maxImages}) для вашего тарифа "${planName}".`,
            code: 'IMAGE_COUNT_LIMIT_EXCEEDED',
            upgradeRequired: true
          });
        }

        // Проверка максимального суммарного объёма
        if (maxStorage > 0 && (currentTotalSize + fileSize) > maxStorage) {
          return reply.code(429).send({
            error: `Превышен лимит хранилища (${(maxStorage / 1024 / 1024).toFixed(2)} МБ) для вашего тарифа "${planName}". Текущий размер: ${(currentTotalSize / 1024 / 1024).toFixed(2)} МБ, попытка загрузить: ${(fileSize / 1024 / 1024).toFixed(2)} МБ.`,
            code: 'STORAGE_LIMIT_EXCEEDED',
            upgradeRequired: true
          });
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

      // Загрузить файл на Яндекс.Диск
      await uploadFile(filePath, buffer, mimeType);

      // Опубликовать файл и получить публичную ссылку
      const publicUrl = await publishFile(filePath);

      // Сохранить запись в БД
      const insertResult = await pool.query(
        `INSERT INTO image_library (
          user_id,
          original_name,
          filename,
          folder_name,
          public_url,
          width,
          height,
          file_size
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          original_name,
          filename,
          folder_name,
          public_url,
          width,
          height,
          file_size,
          created_at`,
        [
          userId,
          originalName,
          uniqueFilename,
          folderNameForDB,
          publicUrl,
          width,
          height,
          fileSize
        ]
      );

      const newImage = insertResult.rows[0];

      // Возвращаем успешный ответ
      return reply.code(201).send(newImage);

    } catch (err) {
      console.error('❌ Ошибка загрузки изображения:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });
}
