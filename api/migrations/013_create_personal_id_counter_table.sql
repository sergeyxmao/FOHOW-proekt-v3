-- Создание таблицы personal_id_counter для автоматической генерации Personal ID
-- Таблица хранит единственную запись - счётчик последнего выданного номера

CREATE TABLE IF NOT EXISTS personal_id_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Всегда равен 1 (одна запись)
  last_issued_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Инициализируем таблицу одной записью
INSERT INTO personal_id_counter (id, last_issued_number, updated_at)
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_personal_id_counter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_personal_id_counter_updated_at
  BEFORE UPDATE ON personal_id_counter
  FOR EACH ROW
  EXECUTE FUNCTION update_personal_id_counter_updated_at();

-- Комментарии для документации
COMMENT ON TABLE personal_id_counter IS 'Счётчик для автоматической генерации уникальных Personal ID (формат: RUY00XXXXXXXXX)';
COMMENT ON COLUMN personal_id_counter.id IS 'Всегда равен 1 - таблица содержит только одну запись';
COMMENT ON COLUMN personal_id_counter.last_issued_number IS 'Последний выданный номер (начиная с 0)';
COMMENT ON COLUMN personal_id_counter.updated_at IS 'Дата последнего обновления счётчика';
