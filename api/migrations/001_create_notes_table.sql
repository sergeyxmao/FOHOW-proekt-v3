-- Создание таблицы notes для хранения заметок
-- Каждая заметка привязана к доске и карточке по дате

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL,
  card_uid VARCHAR(255) NOT NULL,
  note_date DATE NOT NULL,
  content TEXT,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу boards с каскадным удалением
  CONSTRAINT fk_notes_board
    FOREIGN KEY (board_id)
    REFERENCES boards(id)
    ON DELETE CASCADE,

  -- Уникальный индекс для предотвращения дублирования заметок
  CONSTRAINT uq_notes_board_card_date
    UNIQUE (board_id, card_uid, note_date)
);

-- Индекс на board_id для ускорения выборки заметок по доске
CREATE INDEX IF NOT EXISTS idx_notes_board_id ON notes(board_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

-- Комментарии для документации
COMMENT ON TABLE notes IS 'Заметки для карточек, привязанные к доскам и датам';
COMMENT ON COLUMN notes.board_id IS 'ID доски, к которой привязана заметка';
COMMENT ON COLUMN notes.card_uid IS 'Уникальный ID карточки (из фронтенда)';
COMMENT ON COLUMN notes.note_date IS 'Дата, к которой привязана заметка';
COMMENT ON COLUMN notes.content IS 'Текстовое содержимое заметки';
COMMENT ON COLUMN notes.color IS 'Цвет заметки в формате HEX (#RRGGBB)';
