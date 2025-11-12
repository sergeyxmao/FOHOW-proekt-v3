-- Миграция для создания таблицы telegram_link_codes
-- Версия: 008

-- ============================================
-- Таблица telegram_link_codes для хранения кодов связки Telegram
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации выборки
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires_at ON telegram_link_codes(expires_at);

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON TABLE telegram_link_codes IS 'Временные коды для связки Telegram аккаунта с пользователем';
COMMENT ON COLUMN telegram_link_codes.user_id IS 'ID пользователя, который запросил код';
COMMENT ON COLUMN telegram_link_codes.code IS 'Уникальный код для связки (например, ABC123)';
COMMENT ON COLUMN telegram_link_codes.expires_at IS 'Время истечения кода (обычно 15 минут)';
COMMENT ON COLUMN telegram_link_codes.used IS 'Флаг использования кода';
COMMENT ON COLUMN telegram_link_codes.created_at IS 'Дата и время создания кода';
