-- Миграция для создания таблиц промокодов
-- Версия: 004

-- ============================================
-- Таблица промокодов
-- ============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL,
  max_uses_total INTEGER DEFAULT NULL, -- NULL означает безлимит
  current_uses INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  duration_days INTEGER NOT NULL, -- Количество дней подписки
  target_plan_id INTEGER NOT NULL, -- ID тарифного плана
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешний ключ на таблицу subscription_plans
  CONSTRAINT fk_promo_codes_plan
    FOREIGN KEY (target_plan_id)
    REFERENCES subscription_plans(id)
    ON DELETE RESTRICT
);

-- Индексы для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active);

-- ============================================
-- Таблица использований промокодов
-- ============================================
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешние ключи
  CONSTRAINT fk_promo_usage_code
    FOREIGN KEY (promo_code_id)
    REFERENCES promo_codes(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_promo_usage_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- Уникальный индекс для предотвращения повторного использования
  CONSTRAINT uq_promo_usage_user_code
    UNIQUE (promo_code_id, user_id)
);

-- Индексы для оптимизации выборки
CREATE INDEX IF NOT EXISTS idx_promo_usages_code ON promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_user ON promo_code_usages(user_id);

-- ============================================
-- Таблица истории подписок
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'promo_code_applied', 'subscription_purchased', etc.
  expires_at TIMESTAMP, -- Дата истечения подписки после действия
  details JSONB, -- Дополнительная информация (например, код промокода)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Внешние ключи
  CONSTRAINT fk_subscription_history_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_subscription_history_plan
    FOREIGN KEY (plan_id)
    REFERENCES subscription_plans(id)
    ON DELETE RESTRICT
);

-- Индексы для оптимизации выборки
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created ON subscription_history(created_at DESC);

-- ============================================
-- Триггеры для автоматического обновления updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_codes_updated_at();

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON TABLE promo_codes IS 'Промокоды для активации подписок';
COMMENT ON COLUMN promo_codes.code IS 'Уникальный код промокода';
COMMENT ON COLUMN promo_codes.is_active IS 'Флаг активности промокода';
COMMENT ON COLUMN promo_codes.start_date IS 'Дата начала действия промокода';
COMMENT ON COLUMN promo_codes.end_date IS 'Дата окончания действия промокода';
COMMENT ON COLUMN promo_codes.max_uses_total IS 'Максимальное количество использований (NULL = безлимит)';
COMMENT ON COLUMN promo_codes.current_uses IS 'Текущее количество использований';
COMMENT ON COLUMN promo_codes.max_uses_per_user IS 'Максимальное количество использований на пользователя';
COMMENT ON COLUMN promo_codes.duration_days IS 'Длительность подписки в днях';
COMMENT ON COLUMN promo_codes.target_plan_id IS 'ID тарифного плана, который будет активирован';

COMMENT ON TABLE promo_code_usages IS 'История использования промокодов пользователями';
COMMENT ON COLUMN promo_code_usages.promo_code_id IS 'ID промокода';
COMMENT ON COLUMN promo_code_usages.user_id IS 'ID пользователя, использовавшего промокод';
COMMENT ON COLUMN promo_code_usages.used_at IS 'Дата и время использования';

COMMENT ON TABLE subscription_history IS 'История изменений подписок пользователей';
COMMENT ON COLUMN subscription_history.user_id IS 'ID пользователя';
COMMENT ON COLUMN subscription_history.plan_id IS 'ID тарифного плана';
COMMENT ON COLUMN subscription_history.action IS 'Тип действия (promo_code_applied, subscription_purchased, etc.)';
COMMENT ON COLUMN subscription_history.expires_at IS 'Дата истечения подписки после действия';
COMMENT ON COLUMN subscription_history.details IS 'Дополнительные данные в формате JSON';
