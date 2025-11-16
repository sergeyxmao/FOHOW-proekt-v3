/**
 * Утилиты для работы с изображениями
 */

/**
 * Конвертировать изображение в формат WebP
 * @param {File} file - Исходный файл изображения
 * @param {number} quality - Качество изображения (0.0 - 1.0)
 * @param {number} maxWidth - Максимальная ширина
 * @param {number} maxHeight - Максимальная высота
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function convertToWebP(file, quality = 0.9, maxWidth = 2048, maxHeight = 2048) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };

    img.onload = () => {
      try {
        // Вычисляем новые размеры с сохранением пропорций
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Создаём canvas для конвертации
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Конвертируем в WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, width, height });
            } else {
              reject(new Error('Не удалось конвертировать изображение'));
            }
          },
          'image/webp',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Не удалось загрузить изображение'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Проверить, является ли файл изображением
 * @param {File} file - Файл для проверки
 * @returns {boolean}
 */
export function isImageFile(file) {
  return file && file.type && file.type.startsWith('image/');
}

/**
 * Отформатировать размер файла в читаемый вид
 * @param {number} bytes - Размер в байтах
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Обрезать имя файла для отображения
 * @param {string} filename - Имя файла
 * @param {number} maxLength - Максимальная длина
 * @returns {string}
 */
export function truncateFilename(filename, maxLength = 20) {
  if (!filename || filename.length <= maxLength) {
    return filename;
  }

  const ext = filename.split('.').pop();
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
  const truncatedName = nameWithoutExt.substring(0, maxLength - ext.length - 4) + '...';

  return `${truncatedName}.${ext}`;
}
