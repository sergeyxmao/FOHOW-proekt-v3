-- Добавление ui_preferences для хранения пользовательских настроек интерфейса
-- Версия: 025

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'ui_preferences'
  ) THEN
    ALTER TABLE users
    ADD COLUMN ui_preferences JSONB DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN users.ui_preferences IS 'UI-настройки пользователя (цвет анимации, переключатели и т.п.)';
  END IF;
END $$;
