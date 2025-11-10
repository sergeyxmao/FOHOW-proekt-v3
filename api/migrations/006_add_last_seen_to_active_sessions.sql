-- Добавление поля last_seen в таблицу active_sessions
-- Это поле будет отслеживать последнюю активность пользователя в реальном времени

ALTER TABLE active_sessions
ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Обновляем существующие записи, устанавливая last_seen равным created_at
UPDATE active_sessions
SET last_seen = created_at
WHERE last_seen IS NULL;

-- Создаём индекс для эффективной очистки неактивных сессий
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen ON active_sessions(last_seen);

-- Комментарий для документации
COMMENT ON COLUMN active_sessions.last_seen IS 'Дата и время последней активности пользователя в этой сессии';
