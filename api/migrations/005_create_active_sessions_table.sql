-- Создание таблицы active_sessions для управления активными сессиями пользователей
-- Каждая сессия соответствует одному авторизованному устройству/браузеру

CREATE TABLE IF NOT EXISTS active_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_signature TEXT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  -- Внешний ключ на таблицу users с каскадным удалением
  CONSTRAINT fk_active_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Индекс на user_id для ускорения выборки сессий пользователя
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);

-- Индекс на expires_at для ускорения очистки истекших сессий
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON active_sessions(expires_at);

-- Индекс на token_signature для быстрой проверки валидности токена
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(token_signature);

-- Комментарии для документации
COMMENT ON TABLE active_sessions IS 'Активные сессии пользователей для управления одновременными входами';
COMMENT ON COLUMN active_sessions.user_id IS 'ID пользователя, которому принадлежит сессия';
COMMENT ON COLUMN active_sessions.token_signature IS 'Сигнатура JWT-токена для идентификации сессии';
COMMENT ON COLUMN active_sessions.ip_address IS 'IP-адрес клиента';
COMMENT ON COLUMN active_sessions.user_agent IS 'User-Agent браузера/приложения';
COMMENT ON COLUMN active_sessions.expires_at IS 'Дата и время истечения сессии';
