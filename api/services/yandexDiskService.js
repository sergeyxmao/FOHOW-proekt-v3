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

// Константы API Яндекс.Диска
const YANDEX_DISK_API_BASE = 'https://cloud-api.yandex.net/v1/disk';

/**
 * Внутренний помощник для выполнения HTTP-запросов к API Яндекс.Диска
 * @param {string} endpoint - Путь endpoint API (например, '/resources')
 * @param {object} options - Опции для fetch
 * @param {string} logContext - Контекст для логирования (например, путь к ресурсу)
 * @returns {Promise<object|null>} Ответ API или null
 */
async function makeYandexDiskRequest(endpoint, options = {}, logContext = '') {
  const url = `${YANDEX_DISK_API_BASE}${endpoint}`;

  // Добавляем заголовок авторизации
  const headers = {
    'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Для успешных ответов без тела (204 No Content)
    if (response.status === 204) {
      return null;
    }

    // Получаем тело ответа
    const responseData = await response.json().catch(() => null);

    // Если ответ не успешный, логируем и выбрасываем ошибку
    if (!response.ok) {
      console.error(`[Yandex Disk API Error] Статус: ${response.status}, Путь: ${logContext}`);
      console.error(`[Yandex Disk API Error] Тело ответа:`, responseData);

      const error = new Error(
        responseData?.message ||
        responseData?.description ||
        `Ошибка API Яндекс.Диска: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.responseData = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    // Если ошибка уже была обработана выше, просто пробрасываем
    if (error.status) {
      throw error;
    }

    // Логируем сетевые ошибки
    console.error(`[Yandex Disk API Network Error] Путь: ${logContext}`, error.message);
    throw new Error(`Ошибка сети при обращении к API Яндекс.Диска: ${error.message}`);
  }
}

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

// ==================== Операции с Яндекс.Диском ====================

/**
 * 2.1. Обеспечить существование папки на Яндекс.Диске
 * @param {string} path - Путь к папке
 * @returns {Promise<void>}
 */
async function ensureFolderExists(path) {
  try {
    // Разбиваем путь на сегменты
    const segments = path.split('/').filter(s => s.length > 0);

    // Последовательно создаём каждую вложенную папку
    let currentPath = '';

    for (const segment of segments) {
      currentPath += '/' + segment;

      try {
        // Проверяем существование текущей папки
        const checkEndpoint = `/resources?path=${encodeURIComponent(currentPath)}`;
        await makeYandexDiskRequest(checkEndpoint, { method: 'GET' }, currentPath);
        // Папка существует, продолжаем

      } catch (error) {
        // Если папка не найдена (404), создаём её
        if (error.status === 404) {
          try {
            const createEndpoint = `/resources?path=${encodeURIComponent(currentPath)}`;
            await makeYandexDiskRequest(createEndpoint, { method: 'PUT' }, currentPath);
            console.log(`[Yandex Disk] Папка создана: ${currentPath}`);
          } catch (createError) {
            // Если 409 (Conflict), значит папка уже существует (race condition)
            if (createError.status === 409) {
              console.log(`[Yandex Disk] Папка уже существует: ${currentPath}`);
            } else {
              throw new Error(`Не удалось создать папку ${currentPath}: ${createError.message}`);
            }
          }
        } else {
          // Другая ошибка при проверке существования
          throw new Error(`Ошибка при проверке папки ${currentPath}: ${error.message}`);
        }
      }
    }

    console.log(`[Yandex Disk] Все папки в пути ${path} готовы`);
  } catch (error) {
    thrownewError(`Ошибка при создании структуры папок ${path}: ${error.message}`);
  
  }
}

/**
* Получить список вложенных папок для указанного пути на Яндекс.Диске
 * @param {string} path - Путь к корневой папке
 * @returns {Promise<string[]>} Список имён подпапок
*/
асинхронная функция listFolderDirectories ( path ) {
  
  const listEndpoint = `/resources?path= ${ encodeURIComponent (path)} &fields=_embedded.items.name,_embedded.items.type` ;

  пытаться {
    const responseData = await makeYandexDiskRequest (listEndpoint, { method : 'GET' }, path);
 
    const items = responseData?._ embedded ? .items || [];

    возврат товаров
      . фильтр ( элемент => элемент. тип === 'dir' )
      . карта ( элемент => элемент. имя );
  } поймать (ошибка) {
    если (ошибка. статус === 404 ) {
      // Корневая папка не найдена — создаём её и возвращаем пустой список
      await ensureFolderExists (путь);
 
      возвращаться [];
    }

    ошибка броска ;
  }
}

/**
 * 2.2. Загрузить файл на Яндекс.Диск
 * @param {string} path - Полный путь к файлу на Яндекс.Диске
 * @param {Buffer} buffer - Бинарное содержимое файла
 * @param {string} mimeType - MIME-тип файла (например, "image/webp")
 * @returns {Promise<object>} Объект с данными: { yandexPath, fileSize, mimeType }
 */
async function uploadFile(path, buffer, mimeType) {
  try {
    // Шаг 1: Получить URL для загрузки файла
    const uploadEndpoint = `/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`;
    const uploadData = await makeYandexDiskRequest(uploadEndpoint, { method: 'GET' }, path);

    if (!uploadData || !uploadData.href) {
      throw new Error('Не удалось получить URL для загрузки файла');
    }

    const uploadUrl = uploadData.href;

    // Шаг 2: Загрузить файл на полученный URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType
      },
      body: buffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => 'Неизвестная ошибка');
      console.error(`[Yandex Disk Upload Error] Статус: ${uploadResponse.status}, Путь: ${path}`);
      console.error(`[Yandex Disk Upload Error] Ответ:`, errorText);
      throw new Error(`Ошибка при загрузке файла: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    console.log(`[Yandex Disk] Файл успешно загружен: ${path}`);

    // Возвращаем данные о загруженном файле
    return {
      yandexPath: path,
      fileSize: buffer.length,
      mimeType: mimeType
    };
  } catch (error) {
    throw new Error(`Не удалось загрузить файл ${path}: ${error.message}`);
  }
}

/**
 * 2.3. Опубликовать файл на Яндекс.Диске
 * @param {string} path - Путь к уже загруженному файлу
 * @returns {Promise<string>} Публичная ссылка на файл
 */
async function publishFile(path) {
  try {
    // Шаг 1: Опубликовать ресурс
    const publishEndpoint = `/resources/publish?path=${encodeURIComponent(path)}`;
    await makeYandexDiskRequest(publishEndpoint, { method: 'PUT' }, path);

    // Шаг 2: Получить метаданные ресурса с публичной ссылкой и preview
    const metaEndpoint = `/resources?path=${encodeURIComponent(path)}&fields=public_url,preview`;
    const metaData = await makeYandexDiskRequest(metaEndpoint, { method: 'GET' }, path);

    if (!metaData || !metaData.public_url) {
      throw new Error('Не удалось получить публичную ссылку на файл');
    }

    console.log(`[Yandex Disk] Файл успешно опубликован: ${path}`);
 
    // Возвращаем объект с обеими ссылками
    return {
      public_url: metaData.public_url,
      preview_url: metaData.preview || metaData.public_url
    };
	return metaData.public_url;
  } catch (error) {
    throw new Error(`Не удалось опубликовать файл ${path}: ${error.message}`);
  }
}

/**
 * 2.4. Удалить файл с Яндекс.Диска
 * @param {string} path - Путь к файлу
 * @returns {Promise<void>}
 */
async function deleteFile(path) {
  try {
    const deleteEndpoint = `/resources?path=${encodeURIComponent(path)}&permanently=true`;
    await makeYandexDiskRequest(deleteEndpoint, { method: 'DELETE' }, path);
    console.log(`[Yandex Disk] Файл успешно удален: ${path}`);
  } catch (error) {
    const deleteError = new Error(`Не удалось удалить файл ${path}: ${error.message}`);
    deleteError.status = error.status; // Сохранить статус ошибки
    throw deleteError;
  }
}

/**
 * 2.5. Переместить/переименовать файл на Яндекс.Диске
 * @param {string} fromPath - Исходный путь
 * @param {string} toPath - Целевой путь
 * @returns {Promise<void>}
 */
async function moveFile(fromPath, toPath) {
  try {
    // Перемещаем/переименовываем файл с заменой существующего
    const moveEndpoint = `/resources/move?from=${encodeURIComponent(fromPath)}&path=${encodeURIComponent(toPath)}&overwrite=true`;
    await makeYandexDiskRequest(moveEndpoint, { method: 'POST' }, `${fromPath} -> ${toPath}`);

    console.log(`[Yandex Disk] Файл успешно перемещен: ${fromPath} -> ${toPath}`);
  } catch (error) {
    throw new Error(`Не удалось переместить файл ${fromPath} в ${toPath}: ${error.message}`);
  }
}

/**
 * 2.6. Скопировать файл на Яндекс.Диске
 * @param {string} fromPath - Исходный путь
 * @param {string} toPath - Целевой путь
 * @returns {Promise<void>}
 */
async function copyFile(fromPath, toPath) {
  try {
    const copyEndpoint = `/resources/copy?from=${encodeURIComponent(fromPath)}&path=${encodeURIComponent(toPath)}&overwrite=true`;
    await makeYandexDiskRequest(copyEndpoint, { method: 'POST' }, `${fromPath} -> ${toPath}`);

    console.log(`[Yandex Disk] Файл успешно скопирован: ${fromPath} -> ${toPath}`);
  } catch (error) {
    throw new Error(`Не удалось скопировать файл ${fromPath} в ${toPath}: ${error.message}`);
  }
}

/**
 * 2.7. Переименовать корневую папку пользователя
 * @param {number} userId - ID пользователя
 * @param {string} oldPersonalId - Старый персональный ID
 * @param {string} newPersonalId - Новый персональный ID
 * @returns {Promise<string>} Новый путь к папке
 */
async function renameUserRootFolder(userId, oldPersonalId, newPersonalId) {
  const oldPath = getUserRootPath(userId, oldPersonalId);
  const newPath = getUserRootPath(userId, newPersonalId);

  await moveFile(oldPath, newPath);

  console.log(`[Yandex Disk] Корневая папка пользователя переименована: ${oldPath} -> ${newPath}`);
  return newPath;
}

// Экспорт всех функций и констант
export {
  // Константы
  YANDEX_DISK_TOKEN,
  YANDEX_DISK_BASE_DIR,
  // Функции построения путей
  getUserRootPath,
  getUserLibraryFolderPath,
  getUserFilePath,
  getSharedRootPath,
  getSharedPendingFolderPath,
  getSharedFolderPath,
  getSharedFilePath,
  // Операции с Яндекс.Диском
  ensureFolderExists,
  uploadFile,
  publishFile,
  deleteFile,
  moveFile,
  copyFile,
  списокПапокКаталоги,
  renameUserRootFolder
};
