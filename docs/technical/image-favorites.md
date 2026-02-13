# Избранные изображения и вкладка «На доске»

## Описание

Система избранных изображений позволяет пользователям отмечать изображения из личной и общей библиотеки как избранные. Вкладка «На доске» показывает изображения, размещённые на текущей доске, с возможностью фокусировки камеры на выбранном изображении.

## Расположение файлов

### Frontend

| Файл | Назначение |
|---|---|
| `src/components/Images/FavoritesTab.vue` | Вкладка «Избранное» — список избранных изображений |
| `src/components/Images/BoardImagesTab.vue` | Вкладка «На доске» — изображения текущей доски |
| `src/components/Images/ImageCard.vue` | Карточка изображения с кнопкой избранного |
| `src/components/Panels/ImagesPanel.vue` | Панель изображений с вкладками |
| `src/services/imageService.js` | API-клиент (getFavoriteImages, getFavoriteImageIds, addImageToFavorites, removeImageFromFavorites) |
| `src/composables/useImageProxy.js` | Composable для загрузки изображений через прокси `/api/images/proxy/:id` |
| `src/stores/images.js` | Store изображений на canvas (включая `requestFocusOnImage`) |
| `src/composables/useCanvasFocus.js` | Composable для фокусировки камеры на объектах canvas |

### Backend

| Файл | Назначение |
|---|---|
| `api/routes/images/favorites.js` | 4 API-эндпоинта для избранных изображений |
| `api/routes/images/index.js` | Регистрация маршрутов (включая favorites) |

### База данных

| Таблица | Назначение |
|---|---|
| `image_favorites` | Связь пользователь-изображение (id, user_id, image_id, created_at) |

Индексы:
- `idx_image_favorites_user` — по `user_id`
- `idx_image_favorites_image` — по `image_id`
- Уникальный индекс на `(user_id, image_id)` — предотвращает дубли

## Как использовать

### Избранное

1. В панели «Изображения» на вкладках «Личные» или «Общая» нажать кнопку-сердечко на карточке изображения
2. Перейти на вкладку с сердечком — отображаются все избранные изображения
3. Повторное нажатие сердечка — убирает изображение из избранного

### На доске

1. Перейти на вкладку с иконкой изображения в панели «Изображения»
2. Отображаются все изображения, размещённые на текущей доске
3. Клик по превью — камера плавно центрируется на выбранном изображении

## API эндпоинты

Все эндпоинты требуют авторизации (`Bearer` токен). Swagger-схемы определены в `api/routes/images/favorites.js`.

### GET /api/images/favorites

Получить список избранных изображений текущего пользователя.

**Ответ 200:**
```json
{
  "success": true,
  "items": [
    {
      "id": 42,
      "original_name": "photo.jpg",
      "filename": "abc123.webp",
      "public_url": "https://...",
      "preview_url": "https://...",
      "preview_placeholder": "data:image/webp;base64,...",
      "width": 1920,
      "height": 1080,
      "folder_name": "Мои фото",
      "is_shared": false,
      "author_full_name": "Иван Иванов",
      "favorited_at": "2026-02-13T10:00:00.000Z"
    }
  ]
}
```

### GET /api/images/favorite-ids

Получить массив ID избранных изображений (для быстрого отображения сердечек на карточках).

**Ответ 200:**
```json
{
  "success": true,
  "ids": [42, 55, 78]
}
```

### POST /api/images/:id/favorite

Добавить изображение в избранное. При повторном добавлении — `ON CONFLICT DO NOTHING` (идемпотентно).

**Параметры:** `id` (integer) — ID изображения из `image_library`.

**Ответ 200:** `{ "success": true }`
**Ответ 404:** `{ "error": "Image not found" }` — изображение не существует в библиотеке.

### DELETE /api/images/:id/favorite

Убрать изображение из избранного.

**Параметры:** `id` (integer) — ID изображения из `image_library`.

**Ответ 200:** `{ "success": true }`

## Технические детали

### Загрузка превью на вкладке «На доске»

Компонент `BoardImagesTab.vue` загружает превью изображений, размещённых на canvas. Порядок приоритетов:

1. **Кэш** (`thumbCache`) — если URL уже загружен, используется из Map-кэша
2. **Прокси по imageId** — если у изображения есть `imageId` (привязка к `image_library`), загрузка через `useImageProxy.getImageUrl(imageId)` → `/api/images/proxy/:id`
3. **Валидный blob из dataUrl** — только как запасной вариант, если нет `imageId`; blob проверяется HEAD-запросом на доступность
4. **previewDataUrl** — base64 превью (не протухает, используется как placeholder)

### Баг с протухшими blob URL (исправлен)

**Проблема:** `blob:` URL, созданные через `URL.createObjectURL()`, становятся невалидными после перезагрузки страницы (ERR_FILE_NOT_FOUND). Старая логика доверяла blob URL из `image.dataUrl` и пропускала загрузку через прокси.

**Решение:** Загрузка через прокси всегда имеет приоритет над blob URL. Blob используется как фоллбэк только при отсутствии `imageId`, и его доступность проверяется HEAD-запросом.

### Фокусировка на изображении

1. Клик по превью в `BoardImagesTab` → `imagesStore.requestFocusOnImage(imageId)`
2. Store устанавливает `pendingFocusImageId`
3. `CanvasBoard.vue` отслеживает `pendingFocusImageId` через watcher
4. `useCanvasFocus.focusImageOnCanvas(imageId)` вычисляет координаты центра изображения и перемещает viewport

### Кэш изображений useImageProxy

`useImageProxy` поддерживает внутренний `imageCache` (Map: imageId → blobUrl). При вызове `getImageUrl(imageId)`:
- Если есть в кэше — возвращает blob URL из кэша
- Иначе — загружает через `fetch('/api/images/proxy/:id')` с JWT, создаёт blob URL, сохраняет в кэш

## Swagger-документация

Все 4 эндпоинта в `api/routes/images/favorites.js` имеют полные Swagger-схемы:
- `tags: ['Images']` — группировка под тегом Images
- `security: [{ bearerAuth: [] }]` — требуется JWT
- `params` с `required` — для POST и DELETE
- `response` — описаны все статус-коды (200, 400, 401, 404, 500)

## История изменений

- **2026-02-13**: Создание системы избранных изображений и вкладки «На доске»
- **2026-02-13**: Фикс протухших blob URL в BoardImagesTab — приоритет загрузки через прокси
- **2026-02-13**: Добавление Swagger-схем для всех 4 эндпоинтов favorites.js
