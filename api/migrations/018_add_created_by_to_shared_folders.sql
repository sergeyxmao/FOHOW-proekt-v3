-- Добавление поля created_by в таблицу shared_folders
-- Это поле указывает, какой администратор создал папку

ALTER TABLE shared_folders
ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- Добавляем внешний ключ к таблице users
ALTER TABLE shared_folders
DROP CONSTRAINT IF EXISTS fk_shared_folders_created_by;

ALTER TABLE shared_folders
ADD CONSTRAINT fk_shared_folders_created_by
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Создаем индекс для ускорения поиска по создателю
CREATE INDEX IF NOT EXISTS idx_shared_folders_created_by ON shared_folders(created_by);

-- Комментарий для документации
COMMENT ON COLUMN shared_folders.created_by IS 'ID администратора, создавшего папку';
