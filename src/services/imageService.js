import { useAuthStore } from '../stores/auth.js';

/**
 * Сервис для работы с API библиотеки изображений
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

/**
 * Получить заголовки с авторизацией
 * @returns {Object}
 */
function getAuthHeaders() {
  const authStore = useAuthStore();
  const token = localStorage.getItem('token') || authStore.token;

  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Обработка ответа с ошибкой
 * @param {Response} response - Ответ от сервера
 * @param {string} defaultMessage - Сообщение по умолчанию
 * @returns {Promise<Error>}
 */
async function handleErrorResponse(response, defaultMessage = 'Произошла ошибка') {
  let data;
  try {
    data = await response.json();
  } catch (e) {
    // Если не удалось распарсить JSON, используем текст ответа
    const text = await response.text();
    const error = new Error(text || defaultMessage);
    error.status = response.status;
    throw error;
  }

  const normalizedData = (data && typeof data === 'object') ? data : {};
  const errorMessage = typeof normalizedData.error === 'string' && normalizedData.error.trim()
    ? normalizedData.error
    : defaultMessage;

  const error = new Error(errorMessage);
  error.code = normalizedData.code;
  error.status = response.status;
  error.upgradeRequired = normalizedData.upgradeRequired;

  // Обработка специфических HTTP статус кодов
  switch (response.status) {
    case 401:
      error.code = error.code || 'UNAUTHORIZED';
      error.message = normalizedData.error || 'Требуется авторизация. Пожалуйста, войдите в систему.';
      break;
    case 403:
      error.code = error.code || 'FORBIDDEN';
      if (!normalizedData.error) {
        error.message = 'Нет прав доступа к этому ресурсу.';
      }
      break;
    case 404:
      error.code = error.code || 'NOT_FOUND';
      if (!normalizedData.error) {
        error.message = 'Ресурс не найден или был удалён.';
      }
      break;
    case 413:
      error.code = error.code || 'FILE_TOO_LARGE';
      error.message = normalizedData.error || 'Файл слишком большой. Максимальный размер файла превышен.';
      break;
    case 429:
      error.code = error.code || 'RATE_LIMIT_EXCEEDED';
      error.message = normalizedData.error || 'Превышены лимиты по библиотеке изображений на текущем тарифе.';
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      error.code = error.code || 'SERVER_ERROR';
      if (!normalizedData.error) {
        error.message = 'Ошибка на сервере. Попробуйте позже.';
      }
      break;
  }

  throw error;
}

/**
 * Получить список папок личной библиотеки
 * @returns {Promise<string[]>}
 */
export async function getMyFolders() {
  try {
    const response = await fetch(`${API_URL}/images/my/folders`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Ошибка загрузки папок');
    }

    const data = await response.json();

    return (data?.folders || [])
      .map(folder => (typeof folder === 'string' ? folder : folder?.name))
      .filter(Boolean)
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}
/**
 * Создать папку в личной библиотеке
 * @param {string} folderName - Название новой папки
 * @returns {Promise<Object>}
 */
export async function createFolder(folderName) {
  try {
    const response = await fetch(`${API_URL}/images/my/folders`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ folder_name: folderName })
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Ошибка создания папки');
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}
/**
 * Получить статистику использования библиотеки
 * @returns {Promise<{usage: Object, limits: Object, planName: string}>}
 */
export async function getMyStats() {
  try {
    const response = await fetch(`${API_URL}/images/my/stats`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Ошибка получения статистики');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
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
  try {
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
      await handleErrorResponse(response, 'Ошибка загрузки изображений');
    }

    return await response.json();
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
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
  try {
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
      await handleErrorResponse(response, 'Ошибка загрузки изображения');
    }

    return await response.json();
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}

/**
 * Удалить изображение
 * @param {number} imageId - ID изображения
 * @returns {Promise<void>}
 */
export async function deleteImage(imageId) {
  try {
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
      await handleErrorResponse(response, 'Ошибка удаления изображения');
    }
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}

/**
 * Отправить запрос на добавление изображения в общую библиотеку
 * @param {number} imageId - ID изображения
 * @returns {Promise<Object>}
 */
export async function requestShareImage(imageId) {
  try {
    const response = await fetch(`${API_URL}/images/${imageId}/share-request`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Специальная обработка для конфликта (409)
      if (response.status === 409) {
        const error = new Error(errorData.error || 'Изображение уже отправлено на модерацию');
        error.code = errorData.code;
        error.share_requested_at = errorData.share_requested_at;
        throw error;
      }

      throw new Error(errorData.error || 'Ошибка отправки на модерацию');
    }

    return await response.json();
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}

/**
 * Получить структуру общей библиотеки
 * @param {Object} params - Параметры запроса
 * @param {number} params.page - Номер страницы
 * @param {number} params.limit - Количество элементов на странице
 * @returns {Promise<{folders: Array, items?: Array, pagination?: Object}>}
 */
export async function getSharedLibrary({ page, limit } = {}) {
  try {
    const params = new URLSearchParams()

    if (page) {
      params.append('page', page.toString())
    }

    if (limit) {
      params.append('limit', limit.toString())
    }

    const query = params.toString()
    const response = await fetch(`${API_URL}/images/shared${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Ошибка загрузки общей библиотеки');
    }

    return await response.json();
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}
/**
 * Переименовать изображение
 * @param {number} imageId - ID изображения
 * @param {string} newName - Новое имя файла (без расширения)
 * @returns {Promise<Object>}
 */
export async function renameImage(imageId, newName) {
  try {
    const response = await fetch(`${API_URL}/images/${imageId}/rename`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ new_name: newName })
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Ошибка переименования изображения');
    }

    return await response.json();
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw error;
  }
}
