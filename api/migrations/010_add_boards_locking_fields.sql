-- Миграция для добавления полей блокировки досок
-- Версия: 010
-- Шаг 2.3: Реализовать логику блокировки досок при окончании платной подписки

-- ============================================
-- Добавляем поля блокировки в таблицу users
-- ============================================
DO $$
BEGIN
  -- Добавляем поле boards_locked (флаг блокировки всех досок пользователя)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'boards_locked'
  ) THEN
    ALTER TABLE users
    ADD COLUMN boards_locked BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN users.boards_locked IS 'Флаг блокировки всех досок пользователя при истечении платной подписки';
  END IF;

  -- Добавляем поле boards_locked_at (дата и время блокировки досок)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'boards_locked_at'
  ) THEN
    ALTER TABLE users
    ADD COLUMN boards_locked_at TIMESTAMP;

    COMMENT ON COLUMN users.boards_locked_at IS 'Дата и время блокировки досок пользователя';
  END IF;
END $$;

-- ============================================
-- Добавляем поле is_locked в таблицу boards
-- ============================================
DO $$
BEGIN
  -- Добавляем поле is_locked (флаг блокировки отдельной доски)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'boards'
    AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE boards
    ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN boards.is_locked IS 'Флаг блокировки доски при истечении платной подписки пользователя';
  END IF;
END $$;

-- ============================================
-- Создаем индекс для быстрой выборки заблокированных досок
-- ============================================
CREATE INDEX IF NOT EXISTS idx_boards_is_locked ON boards(is_locked);
CREATE INDEX IF NOT EXISTS idx_users_boards_locked ON users(boards_locked);

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON INDEX idx_boards_is_locked IS 'Индекс для быстрой выборки заблокированных досок';
COMMENT ON INDEX idx_users_boards_locked IS 'Индекс для быстрой выборки пользователей с заблокированными досками';
