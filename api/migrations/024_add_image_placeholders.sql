-- Добавление полей для прогрессивных превью изображений
ALTER TABLE image_library
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_placeholder TEXT,
  ADD COLUMN IF NOT EXISTS blurhash TEXT;

COMMENT ON COLUMN image_library.preview_placeholder IS 'Маленькое webp-превью (data URL) для мгновенного отображения';
COMMENT ON COLUMN image_library.blurhash IS 'Blurhash-плейсхолдер для прогрессивной загрузки';
COMMENT ON COLUMN image_library.preview_url IS 'Preview-ссылка Яндекс.Диска (если доступна)';
