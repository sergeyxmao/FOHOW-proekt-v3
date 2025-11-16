-- Создание таблицы image_library для хранения личных изображений пользователей
-- Каждое изображение привязано к пользователю и хранится на Яндекс.Диске

CREATE TABLE IF NOT EXISTS image_library (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) DEFAULT NULL,
  public_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу users с каскадным удалением
  CONSTRAINT fk_image_library_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Индекс на user_id для ускорения выборки изображений пользователя
CREATE INDEX IF NOT EXISTS idx_image_library_user_id ON image_library(user_id);

-- Индекс на folder_name для ускорения фильтрации по папкам
CREATE INDEX IF NOT EXISTS idx_image_library_folder_name ON image_library(folder_name);

-- Составной индекс для оптимизации запросов с фильтрацией по пользователю и папке
CREATE INDEX IF NOT EXISTS idx_image_library_user_folder ON image_library(user_id, folder_name);

-- Индекс на created_at для сортировки по дате создания
CREATE INDEX IF NOT EXISTS idx_image_library_created_at ON image_library(created_at DESC);

-- Комментарии для документации
COMMENT ON TABLE image_library IS 'Личная библиотека изображений пользователей';
COMMENT ON COLUMN image_library.user_id IS 'ID пользователя-владельца изображения';
COMMENT ON COLUMN image_library.original_name IS 'Оригинальное имя файла при загрузке';
COMMENT ON COLUMN image_library.filename IS 'Сгенерированное уникальное имя файла на Яндекс.Диске';
COMMENT ON COLUMN image_library.folder_name IS 'Название папки внутри library (NULL если файл в корне)';
COMMENT ON COLUMN image_library.public_url IS 'Публичная ссылка на файл на Яндекс.Диске';
COMMENT ON COLUMN image_library.width IS 'Ширина изображения в пикселях';
COMMENT ON COLUMN image_library.height IS 'Высота изображения в пикселях';
COMMENT ON COLUMN image_library.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN image_library.created_at IS 'Дата и время загрузки изображения';
