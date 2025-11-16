-- Создание таблицы shared_folders для хранения папок общей библиотеки изображений
-- Каждая папка представляет собой категорию в общей библиотеке

CREATE TABLE IF NOT EXISTS shared_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индекс на name для быстрого поиска по названию
CREATE INDEX IF NOT EXISTS idx_shared_folders_name ON shared_folders(name);

-- Добавляем внешний ключ к image_library
ALTER TABLE image_library
DROP CONSTRAINT IF EXISTS fk_image_library_shared_folder;

ALTER TABLE image_library
ADD CONSTRAINT fk_image_library_shared_folder
  FOREIGN KEY (shared_folder_id)
  REFERENCES shared_folders(id)
  ON DELETE SET NULL;

-- Добавляем внешний ключ для share_approved_by на таблицу users
ALTER TABLE image_library
DROP CONSTRAINT IF EXISTS fk_image_library_approved_by;

ALTER TABLE image_library
ADD CONSTRAINT fk_image_library_approved_by
  FOREIGN KEY (share_approved_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Комментарии для документации
COMMENT ON TABLE shared_folders IS 'Папки общей библиотеки изображений';
COMMENT ON COLUMN shared_folders.id IS 'Уникальный идентификатор папки';
COMMENT ON COLUMN shared_folders.name IS 'Название папки (уникальное)';
COMMENT ON COLUMN shared_folders.created_at IS 'Дата и время создания папки';
COMMENT ON COLUMN shared_folders.updated_at IS 'Дата и время последнего обновления';

-- Добавляем несколько стандартных папок
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
