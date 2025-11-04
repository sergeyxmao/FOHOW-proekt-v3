import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация из ENV
const AVATAR_MAX_PX = parseInt(process.env.AVATAR_MAX_PX || '512', 10);
const AVATAR_SIZES = (process.env.AVATAR_SIZES || '64,128,256').split(',').map(s => parseInt(s, 10));
const AVATAR_QUALITY_WEBP = parseInt(process.env.AVATAR_QUALITY_WEBP || '80', 10);
const AVATAR_QUALITY_JPEG = parseInt(process.env.AVATAR_QUALITY_JPEG || '82', 10);
const AVATAR_QUALITY_AVIF = parseInt(process.env.AVATAR_QUALITY_AVIF || '45', 10);
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

// Разрешённые MIME-типы (без SVG для безопасности)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
];

/**
 * Проверяет сигнатуру файла и возвращает его тип
 * @param {Buffer} buffer - Буфер с данными файла
 * @returns {Promise<string|null>} - MIME-тип или null
 */
export async function validateImageType(buffer) {
  const type = await fileTypeFromBuffer(buffer);

  if (!type) {
    return null;
  }

  if (!ALLOWED_MIME_TYPES.includes(type.mime)) {
    return null;
  }

  return type.mime;
}

/**
 * Вычисляет контент-хеш буфера
 * @param {Buffer} buffer - Буфер с данными
 * @returns {string} - SHA256 хеш
 */
export function computeContentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').substring(0, 16);
}

/**
 * Обрабатывает и сохраняет аватар в разных размерах и форматах
 * @param {Buffer} buffer - Исходный буфер изображения
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} - Метаданные аватара
 */
export async function processAvatar(buffer, userId) {
  // Проверяем тип файла
  const mimeType = await validateImageType(buffer);
  if (!mimeType) {
    throw new Error('Unsupported image format. Only JPEG, PNG, WebP, and AVIF are allowed.');
  }

  // Вычисляем контент-хеш
  const hash = computeContentHash(buffer);

  // Создаём директорию для аватаров пользователя
  const userAvatarDir = path.join(process.cwd(), 'api', UPLOADS_DIR, 'avatars', userId.toString());
  await fsPromises.mkdir(userAvatarDir, { recursive: true });

  // Обрабатываем изображение через sharp
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Сохраняем оригинал
  const originalDir = path.join(userAvatarDir, 'original');
  await fsPromises.mkdir(originalDir, { recursive: true });

  const originalExt = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
  const originalPath = path.join(originalDir, `${hash}.${originalExt}`);
  await fsPromises.writeFile(originalPath, buffer);

  // Ресайзим и конвертируем
  const formats = ['avif', 'webp', 'jpg'];
  const processedFiles = [];

  for (const size of AVATAR_SIZES) {
    // Resize с умным кропом
    const resized = sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'entropy' // Умное позиционирование
      });

    for (const format of formats) {
      const sizeDir = path.join(userAvatarDir, size.toString());
      await fsPromises.mkdir(sizeDir, { recursive: true });

      const filename = `${hash}.${format === 'jpg' ? 'jpg' : format}`;
      const filepath = path.join(sizeDir, filename);

      // Конвертируем и сохраняем
      switch (format) {
        case 'avif':
          await resized
            .clone()
            .avif({ quality: AVATAR_QUALITY_AVIF })
            .toFile(filepath);
          break;
        case 'webp':
          await resized
            .clone()
            .webp({ quality: AVATAR_QUALITY_WEBP })
            .toFile(filepath);
          break;
        case 'jpg':
          await resized
            .clone()
            .jpeg({ quality: AVATAR_QUALITY_JPEG, mozjpeg: true })
            .toFile(filepath);
          break;
      }

      processedFiles.push({
        size,
        format,
        path: filepath,
        url: `/uploads/avatars/${userId}/${size}/${filename}`
      });
    }
  }

  // Формируем метаданные
  const avatarMeta = {
    rev: hash,
    sizes: AVATAR_SIZES,
    formats: formats,
    baseUrl: `/uploads/avatars/${userId}/`
  };

  return {
    meta: avatarMeta,
    files: processedFiles
  };
}

/**
 * Удаляет все файлы аватара пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<void>}
 */
export async function deleteAvatarFiles(userId) {
  const userAvatarDir = path.join(process.cwd(), 'api', UPLOADS_DIR, 'avatars', userId.toString());

  try {
    await fsPromises.rm(userAvatarDir, { recursive: true, force: true });
  } catch (err) {
    // Игнорируем ошибки, если директория не существует
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Удаляет старую версию аватара (по старому хешу)
 * @param {number} userId - ID пользователя
 * @param {string} oldHash - Старый хеш
 * @returns {Promise<void>}
 */
export async function deleteOldAvatarVersion(userId, oldHash) {
  if (!oldHash) return;

  const userAvatarDir = path.join(process.cwd(), 'api', UPLOADS_DIR, 'avatars', userId.toString());

  try {
    // Удаляем файлы со старым хешом
    for (const size of AVATAR_SIZES) {
      const sizeDir = path.join(userAvatarDir, size.toString());
      const formats = ['avif', 'webp', 'jpg'];

      for (const format of formats) {
        const filepath = path.join(sizeDir, `${oldHash}.${format}`);
        try {
          await fsPromises.unlink(filepath);
        } catch (err) {
          // Игнорируем ошибки
        }
      }
    }

    // Удаляем оригинал
    const originalDir = path.join(userAvatarDir, 'original');
    const originalFiles = await fsPromises.readdir(originalDir).catch(() => []);

    for (const file of originalFiles) {
      if (file.startsWith(oldHash)) {
        await fsPromises.unlink(path.join(originalDir, file)).catch(() => {});
      }
    }
  } catch (err) {
    // Игнорируем ошибки
  }
}
