-- Создание таблицы user_comments для хранения личных комментариев пользователей
-- Каждый комментарий принадлежит только одному пользователю (не привязан к доскам)

CREATE TABLE IF NOT EXISTS user_comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу users с каскадным удалением
  CONSTRAINT fk_user_comments_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Индекс на user_id для ускорения выборки комментариев пользователя
CREATE INDEX IF NOT EXISTS idx_user_comments_user_id ON user_comments(user_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_user_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_comments_updated_at
  BEFORE UPDATE ON user_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_user_comments_updated_at();

-- Комментарии для документации
COMMENT ON TABLE user_comments IS 'Личные комментарии пользователей (не привязаны к доскам)';
COMMENT ON COLUMN user_comments.user_id IS 'ID пользователя, владельца комментария';
COMMENT ON COLUMN user_comments.content IS 'Текстовое содержимое комментария';
COMMENT ON COLUMN user_comments.color IS 'Цвет фона комментария в формате HEX (#RRGGBB)';
