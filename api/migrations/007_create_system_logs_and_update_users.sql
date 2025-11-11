-- Миграция для создания таблицы system_logs и добавления поля auto_renew в users
-- Версия: 007

-- ============================================
-- Таблица system_logs для хранения системных логов
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'debug'
  action VARCHAR(100) NOT NULL, -- Название действия
  details JSONB, -- Дополнительные данные в формате JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации выборки
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- ============================================
-- Добавляем поле auto_renew в таблицу users
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'auto_renew'
  ) THEN
    ALTER TABLE users
    ADD COLUMN auto_renew BOOLEAN DEFAULT false;

    COMMENT ON COLUMN users.auto_renew IS 'Автоматическое продление подписки';
  END IF;
END $$;

-- ============================================
-- Добавляем поле name в таблицу subscription_plans (если не существует)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    AND column_name = 'name'
  ) THEN
    ALTER TABLE subscription_plans
    ADD COLUMN name VARCHAR(100);

    COMMENT ON COLUMN subscription_plans.name IS 'Название тарифного плана';
  END IF;
END $$;

-- ============================================
-- Обновляем структуру subscription_history для совместимости
-- ============================================
DO $$
BEGIN
  -- Добавляем start_date если не существует
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_history'
    AND column_name = 'start_date'
  ) THEN
    ALTER TABLE subscription_history
    ADD COLUMN start_date TIMESTAMP;
  END IF;

  -- Добавляем end_date если не существует
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_history'
    AND column_name = 'end_date'
  ) THEN
    ALTER TABLE subscription_history
    ADD COLUMN end_date TIMESTAMP;
  END IF;

  -- Добавляем source если не существует
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_history'
    AND column_name = 'source'
  ) THEN
    ALTER TABLE subscription_history
    ADD COLUMN source VARCHAR(100);
  END IF;

  -- Добавляем amount_paid если не существует
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_history'
    AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE subscription_history
    ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0.00;
  END IF;

  -- Добавляем currency если не существует
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_history'
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE subscription_history
    ADD COLUMN currency VARCHAR(3) DEFAULT 'RUB';
  END IF;
END $$;

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON TABLE system_logs IS 'Системные логи для отслеживания крон-задач и важных событий';
COMMENT ON COLUMN system_logs.level IS 'Уровень логирования (info, warning, error, debug)';
COMMENT ON COLUMN system_logs.action IS 'Название действия или события';
COMMENT ON COLUMN system_logs.details IS 'Дополнительные данные в формате JSON';
COMMENT ON COLUMN system_logs.created_at IS 'Дата и время создания записи';
