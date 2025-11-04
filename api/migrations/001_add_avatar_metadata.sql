-- Добавление полей для метаданных аватаров
-- Выполнить: psql -U fohow_user -d fohow -f api/migrations/001_add_avatar_metadata.sql

-- Добавляем поле для метаданных аватара (JSONB)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_meta JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP DEFAULT NULL;

-- Создаем индекс для быстрого поиска по метаданным
CREATE INDEX IF NOT EXISTS idx_users_avatar_meta ON users USING GIN (avatar_meta);

-- Комментарии для документации
COMMENT ON COLUMN users.avatar_meta IS 'Метаданные аватара: rev (хеш), sizes (массив размеров), formats (массив форматов), baseUrl (базовый URL)';
COMMENT ON COLUMN users.avatar_updated_at IS 'Время последнего обновления аватара';
