-- Добавляем столбец для хранения пути файла, отправленного на модерацию
ALTER TABLE image_library
  ADD COLUMN IF NOT EXISTS pending_yandex_path TEXT;

COMMENT ON COLUMN image_library.pending_yandex_path IS 'Путь файла в папке pending на Яндекс.Диске для модерации';

-- Для уже отправленных на модерацию изображений сохраняем текущий путь как pending
UPDATE image_library
SET pending_yandex_path = yandex_path
WHERE share_requested_at IS NOT NULL
  AND is_shared = FALSE
  AND pending_yandex_path IS NULL;
