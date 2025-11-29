# Миграции базы данных (PostgreSQL)

Этот каталог содержит SQL-миграции для базы данных PostgreSQL проекта **«FOHOW интерактивная доска»**.

## 1. Базовая точка (baseline)

Актуальное состояние схемы боевой базы данных `fohow` на момент 28.11.2025 зафиксировано в отдельном документе:

`/docs/db/fohow_db_baseline_2025-11-28_full_with_sql.docx`

Документ включает:

- подробное текстовое описание структуры БД (таблицы, поля, индексы, связи, триггеры, функции);
- полные исходные SQL-тексты миграций **001–024**.

Состояние, описанное в этом документе, считается **baseline-схемой**.  
Все дальнейшие изменения структуры БД должны выполняться только через новые миграции с версий `025+`.

## 2. Старые миграции 001–024

Ранее в каталоге `api/migrations/` находились файлы миграций:

- `001_create_notes_table.sql`
- `002_create_user_comments_table.sql`
- `003_create_stickers_table.sql`
- `004_create_promo_codes_tables.sql`
- `005_create_active_sessions_table.sql`
- `006_add_last_seen_to_active_sessions.sql`
- `007_create_system_logs_and_update_users.sql`
- `008_create_telegram_link_codes_table.sql`
- `009_add_admin_role.sql`
- `010_add_boards_locking_fields.sql`
- `011_register_lock_boards_cron_job.sql`
- `012_register_delete_locked_boards_cron_job.sql`
- `013_create_personal_id_counter_table.sql`
- `014_create_email_verification_codes_table.sql`
- `015_create_image_library_table.sql`
- `016_add_image_sharing_fields.sql`
- `017_create_shared_folders_table.sql`
- `018_add_created_by_to_shared_folders.sql`
- `019_add_image_library_features.sql`
- `020_fix_missing_can_use_images.sql`
- `021_add_pending_yandex_path.sql`
- `022_create_user_verifications_table.sql`
- `023_add_board_folders_features.sql`
- `024_add_image_placeholders.sql`

Эти файлы **удалены из репозитория** и не используются для повторного применения миграций.

Причина:

- фактическая схема продакшн-БД `fohow` сформирована сочетанием ручных изменений и вышеуказанных миграций;
- текущее состояние полностью задокументировано в файле  
  `/docs/db/fohow_db_baseline_2025-11-28_full_with_sql.docx`.

С этого момента миграции **001–024 считаются историческими** и не создаются заново.  
При необходимости анализа их логики использовать baseline-документ в `/docs/db`.

## 3. Новые миграции (версии 025+)

Все новые изменения структуры БД должны оформляться **только** через миграции с номерами, начиная с:

```text
025_add_ui_preferences.sql
026_... .sql
027_... .sql
...
