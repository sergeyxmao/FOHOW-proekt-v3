-- Создание таблицы stickers для хранения стикеров на доске
-- Каждый стикер привязан к доске и создателю (пользователю)

CREATE TABLE IF NOT EXISTS stickers (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL,
  user_id INTEGER,
  content TEXT DEFAULT '',
  color VARCHAR(7) DEFAULT '#FFFF88',
  pos_x INTEGER NOT NULL,
  pos_y INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу boards с каскадным удалением
  CONSTRAINT fk_stickers_board
    FOREIGN KEY (board_id)
    REFERENCES boards(id)
    ON DELETE CASCADE,

  -- Внешний ключ на таблицу users с установкой NULL при удалении пользователя
  CONSTRAINT fk_stickers_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- Индекс на board_id для ускорения выборки стикеров по доске
CREATE INDEX IF NOT EXISTS idx_stickers_board_id ON stickers(board_id);

-- Индекс на user_id для ускорения выборки стикеров по автору
CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_stickers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stickers_updated_at
  BEFORE UPDATE ON stickers
  FOR EACH ROW
  EXECUTE FUNCTION update_stickers_updated_at();

-- Комментарии для документации
COMMENT ON TABLE stickers IS 'Стикеры (виртуальные заметки) на досках';
COMMENT ON COLUMN stickers.board_id IS 'ID доски, к которой привязан стикер';
COMMENT ON COLUMN stickers.user_id IS 'ID пользователя, создавшего стикер';
COMMENT ON COLUMN stickers.content IS 'Текстовое содержимое стикера';
COMMENT ON COLUMN stickers.color IS 'Цвет стикера в формате HEX (#RRGGBB)';
COMMENT ON COLUMN stickers.pos_x IS 'Позиция стикера по оси X на холсте';
COMMENT ON COLUMN stickers.pos_y IS 'Позиция стикера по оси Y на холсте';
