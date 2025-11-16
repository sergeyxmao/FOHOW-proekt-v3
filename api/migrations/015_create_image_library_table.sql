-- Создание таблицы image_library для хранения личных изображений пользователей
-- и поддержки модерации для общей библиотеки

-- Создаем универсальную функцию для обновления поля updated_at (если ещё не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем таблицу shared_folders (если ещё не существует)
-- Необходима для внешнего ключа shared_folder_id
CREATE TABLE IF NOT EXISTS shared_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по названию папки
CREATE INDEX IF NOT EXISTS idx_shared_folders_name ON shared_folders(name);

-- Комментарии для shared_folders
COMMENT ON TABLE shared_folders IS 'Папки общей библиотеки изображений';
COMMENT ON COLUMN shared_folders.id IS 'Уникальный идентификатор папки';
COMMENT ON COLUMN shared_folders.name IS 'Название папки (уникальное)';
COMMENT ON COLUMN shared_folders.created_at IS 'Дата и время создания папки';
COMMENT ON COLUMN shared_folders.updated_at IS 'Дата и время последнего обновления';

-- Добавляем стандартные папки (если их ещё нет)
INSERT INTO shared_folders (name) VALUES
  ('Природа'),
  ('Люди'),
  ('Технологии'),
  ('Архитектура'),
  ('Еда'),
  ('Спорт'),
  ('Искусство'),
  ('Животные'),
  ('Транспорт'),
  ('Другое')
ON CONFLICT (name) DO NOTHING;

-- Создаем таблицу image_library
CREATE TABLE IF NOT EXISTS image_library (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) DEFAULT NULL,
  yandex_path TEXT NOT NULL,
  public_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  moderation_score NUMERIC(5,2),
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  shared_folder_id INTEGER,
  share_requested_at TIMESTAMP,
  share_approved_at TIMESTAMP,
  share_approved_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу users с каскадным удалением
  CONSTRAINT fk_image_library_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- Внешний ключ на таблицу shared_folders
  CONSTRAINT fk_image_library_shared_folder
    FOREIGN KEY (shared_folder_id)
    REFERENCES shared_folders(id)
    ON DELETE SET NULL,

  -- Внешний ключ для модератора, одобрившего изображение
  CONSTRAINT fk_image_library_approved_by
    FOREIGN KEY (share_approved_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- Индексы для оптимизации запросов

-- Индекс на user_id для ускорения выборки изображений пользователя
CREATE INDEX IF NOT EXISTS idx_image_library_user_id ON image_library(user_id);

-- Частичный индекс для изображений в общей библиотеке
CREATE INDEX IF NOT EXISTS idx_image_library_is_shared
ON image_library(is_shared)
WHERE is_shared = TRUE;

-- Индекс на folder_name для ускорения фильтрации по папкам
CREATE INDEX IF NOT EXISTS idx_image_library_folder_name ON image_library(folder_name);

-- Индекс на shared_folder_id для фильтрации по папкам общей библиотеки
CREATE INDEX IF NOT EXISTS idx_image_library_shared_folder_id ON image_library(shared_folder_id);

-- Индекс на moderation_status для выборки изображений по статусу модерации
CREATE INDEX IF NOT EXISTS idx_image_library_moderation_status ON image_library(moderation_status);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_image_library_updated_at
  BEFORE UPDATE ON image_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии для документации
COMMENT ON TABLE image_library IS 'Личная библиотека изображений пользователей и общая библиотека';
COMMENT ON COLUMN image_library.id IS 'Уникальный идентификатор изображения';
COMMENT ON COLUMN image_library.user_id IS 'ID пользователя-владельца изображения';
COMMENT ON COLUMN image_library.filename IS 'Сгенерированное уникальное имя файла на Яндекс.Диске';
COMMENT ON COLUMN image_library.original_name IS 'Оригинальное имя файла при загрузке';
COMMENT ON COLUMN image_library.folder_name IS 'Название папки внутри library (NULL если файл в корне)';
COMMENT ON COLUMN image_library.yandex_path IS 'Текущий путь файла на Яндекс.Диске';
COMMENT ON COLUMN image_library.public_url IS 'Публичная ссылка на файл на Яндекс.Диске';
COMMENT ON COLUMN image_library.width IS 'Ширина изображения в пикселях';
COMMENT ON COLUMN image_library.height IS 'Высота изображения в пикселях';
COMMENT ON COLUMN image_library.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN image_library.moderation_status IS 'Статус модерации (approved, pending, rejected)';
COMMENT ON COLUMN image_library.moderation_score IS 'Оценка модерации (0.00 - 100.00)';
COMMENT ON COLUMN image_library.is_shared IS 'Находится ли изображение в общей библиотеке';
COMMENT ON COLUMN image_library.shared_folder_id IS 'ID папки в общей библиотеке (NULL если не в общей библиотеке)';
COMMENT ON COLUMN image_library.share_requested_at IS 'Дата и время отправки запроса на модерацию';
COMMENT ON COLUMN image_library.share_approved_at IS 'Дата и время одобрения модерации';
COMMENT ON COLUMN image_library.share_approved_by IS 'ID модератора, одобрившего изображение';
COMMENT ON COLUMN image_library.created_at IS 'Дата и время загрузки изображения';
COMMENT ON COLUMN image_library.updated_at IS 'Дата и время последнего обновления записи';
