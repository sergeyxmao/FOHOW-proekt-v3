-- Миграция для исправления типов данных в таблице image_rename_audit
-- Проблема: таблица использует bigint, а image_library использует integer

BEGIN;

-- Изменяем типы данных на integer для соответствия image_library
ALTER TABLE image_rename_audit 
  ALTER COLUMN image_id TYPE integer,
  ALTER COLUMN user_id TYPE integer;

COMMIT;

-- Комментарий для документации
COMMENT ON TABLE image_rename_audit IS 'Аудит переименований изображений. Типы данных приведены в соответствие с image_library.';
