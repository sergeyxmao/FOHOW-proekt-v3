# Миграции базы данных

Эта папка содержит SQL-миграции для базы данных PostgreSQL.

## Применение миграции

Для применения миграции выполните следующую команду:

```bash
psql -U <username> -d <database_name> -f api/migrations/001_create_notes_table.sql
```

Или через переменные окружения:

```bash
psql -U $DB_USER -d $DB_NAME -f api/migrations/001_create_notes_table.sql
```

## Список миграций

- **001_create_notes_table.sql** - Создание таблицы notes для хранения заметок карточек
