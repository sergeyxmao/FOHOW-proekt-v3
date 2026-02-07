# Библиотека изображений

## Описание
Модуль библиотеки изображений позволяет пользователям загружать, организовывать
и использовать изображения на интерактивных досках. Включает личную и общую библиотеки.

## Расположение файлов
### Backend
- API роуты личной библиотеки: api/routes/images/myLibrary.js
- API роуты общей библиотеки: api/routes/images/shared.js
- API роуты прокси: api/routes/images/proxy.js
- Индексный файл: api/routes/images/index.js
- Сервис Яндекс.Диска: api/services/yandexDiskService.js
- Синхронизация папок: api/services/sharedFoldersSync.js

### Frontend
- Панель изображений: src/components/Panels/ImagesPanel.vue
- Вкладка "Моя библиотека": src/components/Images/MyLibraryTab.vue
- Вкладка "Общая": src/components/Images/SharedLibraryTab.vue
- Карточка изображения: src/components/Images/ImageCard.vue
- Сервис API: src/services/imageService.js
- Composable прокси: src/composables/useImageProxy.js

## API эндпоинты

### Личная библиотека
- GET /api/images/my — Список личных изображений (с пагинацией и фильтрацией по папке)
- GET /api/images/my/folders — Список папок личной библиотеки
- POST /api/images/my/folders — Создание папки (body: { folder_name: string })
- GET /api/images/my/stats — Статистика использования
- POST /api/images/upload — Загрузка изображения (multipart/form-data: file — обязательно, folder/width/height — опционально). Body schema НЕ используется — multipart обрабатывается через req.file() в handler
- DELETE /api/images/:id — Удаление изображения
- PATCH /api/images/:id/rename — Переименование изображения
- POST /api/images/:id/share-request — Отправка на модерацию

### Общая библиотека
- GET /api/images/shared — Структура общей библиотеки (папки + изображения). Возвращает массив `folders`, каждый элемент содержит `id`, `name` и массив `images`. Изображения без привязки к папке возвращаются в виртуальной папке "Без категории" (id: null).

### Прокси
- GET /api/images/proxy/:id — Получение изображения через прокси (свежие ссылки Яндекс.Диска)

## Лимиты по тарифам
Из таблицы subscription_plans (поле features):
- can_use_images — доступ к библиотеке (boolean)
- image_library_max_files — максимум файлов (-1 = безлимит)
- image_library_max_folders — максимум папок (-1 = безлимит)
- image_library_max_storage_mb — максимум хранилища в МБ

## Таблицы БД
- image_library — изображения (личные и общие)
- shared_folders — папки общей библиотеки

## Важные технические ограничения

### Response schema в Fastify 5
Response schema в Fastify 5 используется для сериализации (`fast-json-stringify`),
а не только для документации. Это означает:
- Все поля handler'а ОБЯЗАНЫ быть описаны в response schema — иначе удаляются
- Типы ОБЯЗАНЫ совпадать с реальными значениями — несоответствие ломает данные
- При добавлении нового поля в handler — обязательно обновить response schema

### Multipart-эндпоинты в Fastify 5
При использовании `@fastify/multipart` нельзя указывать `body` в schema.
Multipart-данные обрабатываются через `req.file()` внутри handler'а,
а не через стандартную AJV-валидацию. Описание полей формы следует
размещать в поле `description` schema для отображения в Swagger.
Эталон: загрузка аватара в `api/routes/profile.js`.

## История изменений
- 2026-02-07: Исправлена schema для POST /api/images/my/folders (folder_name вместо name)
- 2026-02-07: Исправлена response schema для GET /api/images/shared (folders вместо images)
- 2026-02-07: Добавлено отображение изображений без привязки к папке ("Без категории")
- 2026-02-07: Удалён body schema из POST /api/images/upload (multipart несовместим с AJV-валидацией в Fastify 5)
- 2026-02-07: Исправлена response schema GET /api/images/my (items+pagination вместо images+total)
- 2026-02-07: Исправлена response schema GET /api/images/my/stats (usage+limits+planName)
