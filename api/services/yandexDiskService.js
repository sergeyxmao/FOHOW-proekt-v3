/**
 * Сервис для работы с Яндекс.Диском
 * Управляет путями и конфигурацией для хранения файлов
 */

// Инициализация и проверка переменных окружения при загрузке модуля
const YANDEX_DISK_TOKEN = process.env.YANDEX_DISK_TOKEN;
const YANDEX_DISK_BASE_DIR = process.env.YANDEX_DISK_BASE_DIR;

// Проверка наличия обязательных переменных окружения
if (!YANDEX_DISK_TOKEN) {
  console.error(
    '[FATAL ERROR] Переменная окружения YANDEX_DISK_TOKEN не задана. ' +
    'Пожалуйста, установите YANDEX_DISK_TOKEN в файле .env или переменных окружения.'
  );
  process.exit(1);
}

if (!YANDEX_DISK_BASE_DIR) {
  console.error(
    '[FATAL ERROR] Переменная окружения YANDEX_DISK_BASE_DIR не задана. ' +
    'Пожалуйста, установите YANDEX_DISK_BASE_DIR в файле .env или переменных окружения.'
  );
  process.exit(1);
}

console.log('[Yandex Disk Service] Сервис успешно инициализирован');
console.log(`[Yandex Disk Service] Базовая директория: ${YANDEX_DISK_BASE_DIR}`);

/**
 * Получить корневой путь пользователя на Яндекс.Диске
 * @param {number} userId - ID пользователя из таблицы users.id
 * @param {string} personalId - Персональный ID пользователя из users.personal_id
 * @returns {string} Путь вида "{BASE_DIR}/{userId}.{personalId}"
 */
function getUserRootPath(userId, personalId) {
  return `${YANDEX_DISK_BASE_DIR}/${userId}.${personalId}`;
}

/**
 * Получить путь к папке библиотеки пользователя
 * @param {number} userId - ID пользователя
 * @param {string} personalId - Персональный ID пользователя
 * @param {string|null} folderName - Название папки внутри library (опционально)
 * @returns {string} Путь к папке библиотеки
 */
function getUserLibraryFolderPath(userId, personalId, folderName) {
  const basePath = `${YANDEX_DISK_BASE_DIR}/${userId}.${personalId}/library`;

  // Если folderName не задана или пустая, возвращаем базовый путь library
  if (!folderName || folderName.trim() === '') {
    return basePath;
  }

  // Если folderName задана, добавляем её к пути
  return `${basePath}/${folderName}`;
}

/**
 * Получить путь к файлу в личной библиотеке пользователя
 * @param {number} userId - ID пользователя
 * @param {string} personalId - Персональный ID пользователя
 * @param {string|null} folderName - Название папки внутри library (опционально)
 * @param {string} filename - Имя файла
 * @returns {string} Путь к файлу
 */
function getUserFilePath(userId, personalId, folderName, filename) {
  const basePath = `${YANDEX_DISK_BASE_DIR}/${userId}.${personalId}/library`;

  // Если folderName не задана или пустая, файл находится непосредственно в library
  if (!folderName || folderName.trim() === '') {
    return `${basePath}/${filename}`;
  }

  // Если folderName задана, файл находится в подпапке
  return `${basePath}/${folderName}/${filename}`;
}

/**
 * Получить корневой путь для общих (shared) ресурсов
 * @returns {string} Путь "{BASE_DIR}/SHARED"
 */
function getSharedRootPath() {
  return `${YANDEX_DISK_BASE_DIR}/SHARED`;
}

/**
 * Получить путь к папке pending для общих ресурсов
 * @returns {string} Путь "{BASE_DIR}/SHARED/pending"
 */
function getSharedPendingFolderPath() {
  return `${YANDEX_DISK_BASE_DIR}/SHARED/pending`;
}

/**
 * Получить путь к конкретной общей папке
 * @param {string} sharedFolderName - Название общей папки (из shared_folders.name)
 * @returns {string} Путь "{BASE_DIR}/SHARED/{sharedFolderName}"
 */
function getSharedFolderPath(sharedFolderName) {
  return `${YANDEX_DISK_BASE_DIR}/SHARED/${sharedFolderName}`;
}

/**
 * Получить путь к файлу в общей папке
 * @param {string} sharedFolderName - Название общей папки
 * @param {string} filename - Имя файла
 * @returns {string} Путь "{BASE_DIR}/SHARED/{sharedFolderName}/{filename}"
 */
function getSharedFilePath(sharedFolderName, filename) {
  return `${YANDEX_DISK_BASE_DIR}/SHARED/${sharedFolderName}/${filename}`;
}

// Экспорт всех функций и констант
module.exports = {
  YANDEX_DISK_TOKEN,
  YANDEX_DISK_BASE_DIR,
  getUserRootPath,
  getUserLibraryFolderPath,
  getUserFilePath,
  getSharedRootPath,
  getSharedPendingFolderPath,
  getSharedFolderPath,
  getSharedFilePath
};
