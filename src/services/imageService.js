/**
 * Сервис для работы с API библиотеки изображений
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

/**
 * Получить заголовки с авторизацией
 * @returns {Object}
 */
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Получить список папок личной библиотеки
 * @returns {Promise<string[]>}
 */
export async function getMyFolders() {
  const response = await fetch(`${API_URL}/images/my/folders`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const data = await response.json();

    if (data.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      const error = new Error(data.error);
      error.code = data.code;
      error.upgradeRequired = data.upgradeRequired;
      throw error;
    }

    throw new Error(data.error || 'Ошибка загрузки папок');
  }

  const data = await response.json();
  return data.folders || [];
}

/**
 * Получить список личных изображений
 * @param {Object} params - Параметры запроса
 * @param {number} params.page - Номер страницы
 * @param {number} params.limit - Количество элементов на странице
 * @param {string} params.folder - Фильтр по папке
 * @returns {Promise<{items: Array, pagination: Object}>}
 */
export async function getMyImages({ page = 1, limit = 20, folder = null } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  if (folder) {
    params.append('folder', folder);
  }

  const response = await fetch(`${API_URL}/images/my?${params}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const data = await response.json();

    if (data.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      const error = new Error(data.error);
      error.code = data.code;
      error.upgradeRequired = data.upgradeRequired;
      throw error;
    }

    throw new Error(data.error || 'Ошибка загрузки изображений');
  }

  return await response.json();
}

/**
 * Загрузить изображение
 * @param {Object} params - Параметры загрузки
 * @param {Blob} params.file - Файл изображения (WebP)
 * @param {string} params.originalName - Оригинальное имя файла
 * @param {string} params.folder - Папка (необязательно)
 * @param {number} params.width - Ширина изображения
 * @param {number} params.height - Высота изображения
 * @returns {Promise<Object>}
 */
export async function uploadImage({ file, originalName, folder = null, width = null, height = null }) {
  const formData = new FormData();
  formData.append('file', file, originalName);

  if (folder) {
    formData.append('folder', folder);
  }

  if (width) {
    formData.append('width', width.toString());
  }

  if (height) {
    formData.append('height', height.toString());
  }

  const response = await fetch(`${API_URL}/images/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });

  if (!response.ok) {
    const data = await response.json();

    // Обработка специфических кодов ошибок
    if (data.code === 'FILE_SIZE_LIMIT_EXCEEDED' ||
        data.code === 'IMAGE_COUNT_LIMIT_EXCEEDED' ||
        data.code === 'STORAGE_LIMIT_EXCEEDED') {
      const error = new Error(data.error);
      error.code = data.code;
      error.upgradeRequired = data.upgradeRequired;
      throw error;
    }

    throw new Error(data.error || 'Ошибка загрузки изображения');
  }

  return await response.json();
}

/**
 * Удалить изображение
 * @param {number} imageId - ID изображения
 * @returns {Promise<void>}
 */
export async function deleteImage(imageId) {
  const response = await fetch(`${API_URL}/images/${imageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (response.status === 409) {
    const data = await response.json();
    const error = new Error(data.error || 'Изображение используется на досках');
    error.code = 'IMAGE_IN_USE';
    throw error;
  }

  if (!response.ok && response.status !== 204) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка удаления изображения');
  }
}

/**
 * Отправить запрос на добавление изображения в общую библиотеку
 * @param {number} imageId - ID изображения
 * @returns {Promise<Object>}
 */
export async function requestShareImage(imageId) {
  const response = await fetch(`${API_URL}/images/${imageId}/share-request`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  if (response.status === 409) {
    const data = await response.json();
    const error = new Error(data.error);
    error.code = data.code;
    throw error;
  }

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка отправки запроса');
  }

  return await response.json();
}

/**
 * Получить структуру общей библиотеки
 * @returns {Promise<{folders: Array}>}
 */
export async function getSharedLibrary() {
  const response = await fetch(`${API_URL}/images/shared`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const data = await response.json();

    if (data.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      const error = new Error(data.error);
      error.code = data.code;
      error.upgradeRequired = data.upgradeRequired;
      throw error;
    }

    throw new Error(data.error || 'Ошибка загрузки общей библиотеки');
  }

  return await response.json();
}
