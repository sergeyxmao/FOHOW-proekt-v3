/**
 * Helper-функция для получения URL превью доски с версионированием
 * @param {number} boardId - ID доски
 * @param {string|null} thumbnailData - Данные превью из БД в формате: preview_url|yandexPath|timestamp
 * @returns {string|null} - URL превью с версией для cache busting или null
 */
export function getBoardPreviewUrl(boardId, thumbnailData) {
  if (!thumbnailData) return null;

  // Если это уже локальный placeholder, вернуть как есть
  if (thumbnailData.startsWith('/uploads/')) {
    return thumbnailData;
  }

  const parts = thumbnailData.split('|');
  const timestamp = parts[2] || Date.now(); // Fallback для старых записей без timestamp

  return `/api/boards/${boardId}/preview?v=${timestamp}`;
}
