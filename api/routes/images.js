import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getUserLibraryFolderPath,
  getUserFilePath,
  ensureFolderExists,
  uploadFile,
  publishFile,
  deleteFile
} from '../services/yandexDiskService.js';

/**
 * Регистрация маршрутов для работы с библиотекой изображений
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerImageRoutes(app) {
  /**
   * POST /api/images/upload - Загрузить изображение в библиотеку
   *
   * Загружает изображение на Яндекс.Диск и сохраняет запись в БД.
   * Требует авторизации JWT.
   */
  app.post('/api/images/upload', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;

      // Получаем файл из запроса
      const data = await req.file();

      if (!data) {
        return reply.code(400).send({
          error: 'Файл не предоставлен'
        });
      }

      // Валидация MIME-типа
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
      if (!allowedMimes.includes(data.mimetype)) {
        return reply.code(400).send({
          error: 'Разрешены только изображения (JPEG, PNG, GIF, WEBP)'
        });
      }

      // Получаем данные пользователя (нужен personal_id)
      const userResult = await pool.query(
        'SELECT id, personal_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Пользователь не найден'
        });
      }

      const user = userResult.rows[0];

      if (!user.personal_id) {
        return reply.code(400).send({
          error: 'У пользователя отсутствует personal_id'
        });
      }

      // Получаем folder_name из query параметров (опционально)
      const folderName = req.query.folder_name || null;

      // Получаем буфер файла
      const buffer = await data.toBuffer();

      // Получаем имя файла (оригинальное)
      const filename = data.filename;

      // Строим пути на Яндекс.Диске
      const libraryFolderPath = getUserLibraryFolderPath(userId, user.personal_id, folderName);
      const filePath = getUserFilePath(userId, user.personal_id, folderName, filename);

      // Убедимся что папка существует
      await ensureFolderExists(libraryFolderPath);

      // Загружаем файл на Яндекс.Диск
      const uploadResult = await uploadFile(filePath, buffer, data.mimetype);

      // Публикуем файл и получаем публичную ссылку
      const publicUrl = await publishFile(filePath);

      // Сохраняем запись в БД
      const insertResult = await pool.query(
        `INSERT INTO image_library
         (user_id, filename, folder_name, yandex_path, public_url, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          filename,
          folderName,
          uploadResult.yandexPath,
          publicUrl,
          uploadResult.fileSize,
          uploadResult.mimeType
        ]
      );

      const imageRecord = insertResult.rows[0];

      return reply.code(201).send({
        success: true,
        message: 'Изображение успешно загружено',
        image: {
          id: imageRecord.id,
          filename: imageRecord.filename,
          folderName: imageRecord.folder_name,
          publicUrl: imageRecord.public_url,
          fileSize: imageRecord.file_size,
          mimeType: imageRecord.mime_type,
          createdAt: imageRecord.created_at
        }
      });

    } catch (err) {
      console.error('❌ Ошибка загрузки изображения:', err);

      // Обработка специфичных ошибок БД
      if (err.code === '23505') { // Дублирование уникального ключа
        return reply.code(409).send({
          error: 'Файл с таким путем уже существует'
        });
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/images - Получить список изображений пользователя
   *
   * Возвращает все изображения текущего пользователя.
   * Поддерживает фильтрацию по папке через query параметр folder_name.
   */
  app.get('/api/images', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const folderName = req.query.folder_name;

      let query;
      let params;

      if (folderName !== undefined) {
        // Фильтрация по конкретной папке (включая NULL если folder_name пустое)
        query = `
          SELECT id, filename, folder_name, public_url, file_size, mime_type, created_at, updated_at
          FROM image_library
          WHERE user_id = $1 AND folder_name = $2
          ORDER BY created_at DESC
        `;
        params = [userId, folderName || null];
      } else {
        // Все изображения пользователя
        query = `
          SELECT id, filename, folder_name, public_url, file_size, mime_type, created_at, updated_at
          FROM image_library
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        params = [userId];
      }

      const result = await pool.query(query, params);

      return reply.code(200).send({
        success: true,
        count: result.rows.length,
        images: result.rows.map(row => ({
          id: row.id,
          filename: row.filename,
          folderName: row.folder_name,
          publicUrl: row.public_url,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
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
   * GET /api/images/:id - Получить изображение по ID
   *
   * Возвращает информацию об изображении.
   * Доступ только к собственным изображениям (проверка user_id).
   */
  app.get('/api/images/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const imageId = parseInt(req.params.id, 10);

      if (isNaN(imageId)) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      const result = await pool.query(
        `SELECT id, filename, folder_name, public_url, file_size, mime_type, created_at, updated_at
         FROM image_library
         WHERE id = $1 AND user_id = $2`,
        [imageId, userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Изображение не найдено'
        });
      }

      const row = result.rows[0];

      return reply.code(200).send({
        success: true,
        image: {
          id: row.id,
          filename: row.filename,
          folderName: row.folder_name,
          publicUrl: row.public_url,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      });

    } catch (err) {
      console.error('❌ Ошибка получения изображения:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * DELETE /api/images/:id - Удалить изображение
   *
   * Удаляет изображение с Яндекс.Диска и из БД.
   * Доступ только к собственным изображениям (проверка user_id).
   */
  app.delete('/api/images/:id', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const imageId = parseInt(req.params.id, 10);

      if (isNaN(imageId)) {
        return reply.code(400).send({
          error: 'Некорректный ID изображения'
        });
      }

      // Получаем изображение и проверяем владельца
      const imageResult = await pool.query(
        `SELECT id, yandex_path, filename
         FROM image_library
         WHERE id = $1 AND user_id = $2`,
        [imageId, userId]
      );

      if (imageResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Изображение не найдено'
        });
      }

      const image = imageResult.rows[0];

      // Удаляем файл с Яндекс.Диска
      await deleteFile(image.yandex_path);

      // Удаляем запись из БД
      await pool.query(
        'DELETE FROM image_library WHERE id = $1',
        [imageId]
      );

      return reply.code(200).send({
        success: true,
        message: `Изображение "${image.filename}" успешно удалено`
      });

    } catch (err) {
      console.error('❌ Ошибка удаления изображения:', err);

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });
}
