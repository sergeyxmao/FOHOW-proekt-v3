/**
 * Helper-функция для получения URL аватара с версионированием
 * @param {number} userId - ID пользователя
 * @param {string|null} avatarData - Данные аватара из БД в формате: preview_url|yandexPath|timestamp
 * @returns {string|null} - URL аватара с версией для cache busting или null
 */
export function getAvatarUrl(userId, avatarData) {
  if (!avatarData) return null;

  const parts = avatarData.split('|');
  const timestamp = parts[2] || Date.now(); // Fallback для старых записей без timestamp

  return `/api/avatar/${userId}?v=${timestamp}`;
}
