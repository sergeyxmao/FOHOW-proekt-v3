-- Миграция для создания таблицы user_verifications
-- Версия: 022

-- ============================================
-- Таблица заявок на верификацию
-- ============================================
CREATE TABLE IF NOT EXISTS user_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  screenshot_1_path TEXT NOT NULL,
  screenshot_2_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_verification_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_user_verifications_user_id ON user_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verifications_status ON user_verifications(status);
CREATE INDEX IF NOT EXISTS idx_user_verifications_submitted_at ON user_verifications(submitted_at DESC);

-- ============================================
-- Добавляем поля в таблицу users
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_verification_attempt'
  ) THEN
    ALTER TABLE users ADD COLUMN last_verification_attempt TIMESTAMP;
  END IF;
END $$;

-- Индекс для быстрого поиска верифицированных пользователей
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON TABLE user_verifications IS 'Заявки пользователей на верификацию компьютерных номеров';
COMMENT ON COLUMN user_verifications.user_id IS 'ID пользователя';
COMMENT ON COLUMN user_verifications.full_name IS 'Полное ФИО пользователя';
COMMENT ON COLUMN user_verifications.screenshot_1_path IS 'Путь к первому скриншоту на Yandex.Disk';
COMMENT ON COLUMN user_verifications.screenshot_2_path IS 'Путь к второму скриншоту на Yandex.Disk';
COMMENT ON COLUMN user_verifications.status IS 'Статус заявки: pending, approved, rejected';
COMMENT ON COLUMN user_verifications.rejection_reason IS 'Причина отклонения (заполняется админом)';
COMMENT ON COLUMN user_verifications.submitted_at IS 'Дата и время подачи заявки';
COMMENT ON COLUMN user_verifications.processed_at IS 'Дата и время обработки заявки';
COMMENT ON COLUMN user_verifications.processed_by IS 'ID администратора, обработавшего заявку';

COMMENT ON COLUMN users.is_verified IS 'Статус верификации компьютерного номера';
COMMENT ON COLUMN users.verified_at IS 'Дата и время верификации';
COMMENT ON COLUMN users.last_verification_attempt IS 'Время последней попытки подачи заявки на верификацию';
