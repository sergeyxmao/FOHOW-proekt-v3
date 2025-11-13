-- Миграция для регистрации крон-задачи блокировки досок
-- Версия: 011
-- Шаг 2.3: Регистрация задачи lock_boards_after_expiry в таблице cron_jobs

-- ============================================
-- Создаем таблицу cron_jobs (если её ещё нет)
-- ============================================
CREATE TABLE IF NOT EXISTS cron_jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  schedule VARCHAR(50) NOT NULL, -- Cron-расписание (например, '0 1 * * *')
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индекс для быстрого поиска активных задач
CREATE INDEX IF NOT EXISTS idx_cron_jobs_is_active ON cron_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_job_name ON cron_jobs(job_name);

-- Комментарии для документации
COMMENT ON TABLE cron_jobs IS 'Реестр крон-задач для автоматизации';
COMMENT ON COLUMN cron_jobs.job_name IS 'Уникальное имя крон-задачи';
COMMENT ON COLUMN cron_jobs.description IS 'Описание задачи';
COMMENT ON COLUMN cron_jobs.schedule IS 'Расписание в формате cron (например, 0 1 * * *)';
COMMENT ON COLUMN cron_jobs.is_active IS 'Флаг активности задачи';
COMMENT ON COLUMN cron_jobs.last_run_at IS 'Дата и время последнего запуска';
COMMENT ON COLUMN cron_jobs.next_run_at IS 'Дата и время следующего запуска';

-- ============================================
-- Регистрация крон-задачи блокировки досок
-- ============================================
INSERT INTO cron_jobs (job_name, description, schedule, is_active) VALUES
('lock_boards_after_expiry', 'Блокировка досок после окончания платной подписки', '0 1 * * *', true)
ON CONFLICT (job_name) DO UPDATE SET
    description = EXCLUDED.description,
    schedule = EXCLUDED.schedule,
    is_active = EXCLUDED.is_active;

-- ============================================
-- Регистрация остальных крон-задач (для полноты)
-- ============================================
INSERT INTO cron_jobs (job_name, description, schedule, is_active) VALUES
('notify_expiring_subscriptions', 'Уведомления о истечении подписок', '0 9 * * *', true),
('block_expired_subscriptions', 'Блокировка истекших подписок', '0 1 * * *', true),
('cleanup_old_sessions', 'Очистка старых сессий', '0 * * * *', true),
('close_demo_periods', 'Закрытие демо-периодов', '0 2 * * *', true),
('switch_demo_to_guest', 'Автоматическая смена тарифа с Демо на Гостевой', '30 2 * * *', true)
ON CONFLICT (job_name) DO UPDATE SET
    description = EXCLUDED.description,
    schedule = EXCLUDED.schedule;
