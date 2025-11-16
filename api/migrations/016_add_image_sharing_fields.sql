-- Добавление полей для поддержки модерации и общей библиотеки изображений
-- Эти поля позволяют пользователям отправлять свои изображения на модерацию
-- для публикации в общей библиотеке

-- Добавляем поле yandex_path для хранения текущего пути файла на Яндекс.Диске
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS yandex_path TEXT;

-- Добавляем поле share_requested_at для хранения даты запроса на модерацию
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS share_requested_at TIMESTAMP DEFAULT NULL;

-- Добавляем поле is_shared для обозначения, находится ли изображение в общей библиотеке
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE NOT NULL;

-- Добавляем поле shared_folder_id для хранения ID папки в общей библиотеке
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS shared_folder_id INTEGER DEFAULT NULL;

-- Добавляем поле share_approved_at для хранения даты одобрения модерации
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS share_approved_at TIMESTAMP DEFAULT NULL;

-- Добавляем поле share_approved_by для хранения ID модератора, одобрившего изображение
ALTER TABLE image_library
ADD COLUMN IF NOT EXISTS share_approved_by INTEGER DEFAULT NULL;

-- Создаем индекс для фильтрации изображений, ожидающих модерации
CREATE INDEX IF NOT EXISTS idx_image_library_share_requested
ON image_library(share_requested_at)
WHERE share_requested_at IS NOT NULL AND is_shared = FALSE;

-- Создаем индекс для фильтрации изображений в общей библиотеке
CREATE INDEX IF NOT EXISTS idx_image_library_shared
ON image_library(is_shared, shared_folder_id)
WHERE is_shared = TRUE;

-- Добавляем комментарии для документации
COMMENT ON COLUMN image_library.yandex_path IS 'Текущий путь файла на Яндекс.Диске (может меняться при перемещении)';
COMMENT ON COLUMN image_library.share_requested_at IS 'Дата и время отправки запроса на модерацию (NULL если не отправлено)';
COMMENT ON COLUMN image_library.is_shared IS 'Находится ли изображение в общей библиотеке';
COMMENT ON COLUMN image_library.shared_folder_id IS 'ID папки в общей библиотеке (NULL если не в общей библиотеке)';
COMMENT ON COLUMN image_library.share_approved_at IS 'Дата и время одобрения модерации (NULL если не одобрено)';
COMMENT ON COLUMN image_library.share_approved_by IS 'ID модератора, одобрившего изображение (NULL если не одобрено)';

-- ПРИМЕЧАНИЕ: Существующие записи будут иметь yandex_path = NULL
-- При необходимости, путь может быть вычислен динамически на основе user_id, personal_id, folder_name и filename
-- Новые загружаемые изображения будут автоматически сохранять yandex_path при создании
