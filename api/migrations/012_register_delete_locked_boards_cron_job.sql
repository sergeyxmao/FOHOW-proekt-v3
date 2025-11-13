-- Миграция для регистрации крон-задачи удаления заблокированных досок
-- Версия: 012
-- Шаг 2.5: Регистрация задачи delete_locked_boards_after_14_days в таблице cron_jobs

-- ============================================
-- Регистрация крон-задачи удаления заблокированных досок
-- ============================================
INSERT INTO cron_jobs (job_name, description, schedule, is_active) VALUES
('delete_locked_boards_after_14_days', 'Удаление заблокированных досок через 14 дней', '0 3 * * *', true)
ON CONFLICT (job_name) DO UPDATE SET
    description = EXCLUDED.description,
    schedule = EXCLUDED.schedule,
    is_active = EXCLUDED.is_active;
