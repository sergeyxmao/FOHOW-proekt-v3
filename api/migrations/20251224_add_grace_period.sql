-- Безопасное добавление поля grace_period_until
ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMP DEFAULT NULL;

-- Безопасное добавление поля archived
ALTER TABLE boards ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Обновить NULL значения
UPDATE boards SET archived = FALSE WHERE archived IS NULL;

-- Добавить индексы
CREATE INDEX IF NOT EXISTS idx_users_grace_period ON users(grace_period_until) WHERE grace_period_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boards_archived ON boards(archived) WHERE archived = TRUE;

-- Комментарии
COMMENT ON COLUMN users.grace_period_until IS 'Льготный период (7 дней для individual/premium)';
COMMENT ON COLUMN boards.archived IS 'Доска заархивирована (read-only)';
