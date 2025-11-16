-- Создание таблицы image_library для хранения файлов в личной библиотеке пользователей
-- Эта таблица отслеживает файлы, загруженные на Яндекс.Диск

CREATE TABLE IF NOT EXISTS image_library (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) DEFAULT NULL,
  yandex_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по user_id (основной сценарий использования)
CREATE INDEX idx_image_library_user_id ON image_library(user_id);

-- Индекс для поиска по папкам пользователя
CREATE INDEX idx_image_library_user_folder ON image_library(user_id, folder_name);

-- Уникальный индекс для предотвращения дублирования файлов
-- Один и тот же yandex_path не может быть у разных записей
CREATE UNIQUE INDEX idx_image_library_yandex_path ON image_library(yandex_path);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_image_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_image_library_updated_at
  BEFORE UPDATE ON image_library
  FOR EACH ROW
  EXECUTE FUNCTION update_image_library_updated_at();

-- Комментарии для документации
COMMENT ON TABLE image_library IS 'Библиотека изображений пользователей на Яндекс.Диске';
COMMENT ON COLUMN image_library.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN image_library.user_id IS 'ID пользователя (владельца файла)';
COMMENT ON COLUMN image_library.filename IS 'Имя файла';
COMMENT ON COLUMN image_library.folder_name IS 'Название папки внутри library (может быть NULL)';
COMMENT ON COLUMN image_library.yandex_path IS 'Полный путь к файлу на Яндекс.Диске';
COMMENT ON COLUMN image_library.public_url IS 'Публичная ссылка на файл';
COMMENT ON COLUMN image_library.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN image_library.mime_type IS 'MIME-тип файла (например, image/webp, image/jpeg)';
COMMENT ON COLUMN image_library.created_at IS 'Дата создания записи';
COMMENT ON COLUMN image_library.updated_at IS 'Дата последнего обновления записи';
