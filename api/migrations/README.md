# Миграции базы данных

Эта папка содержит SQL-миграции для базы данных PostgreSQL.

## Применение миграции

Для применения миграции выполните следующую команду:

```bash
psql -U <username> -d <database_name> -f api/migrations/<migration_file>.sql
```

Или через переменные окружения:

```bash
psql -U $DB_USER -d $DB_NAME -f api/migrations/<migration_file>.sql
```

## Список миграций

- **001_create_notes_table.sql** - Создание таблицы notes для хранения заметок карточек
- **002_create_user_comments_table.sql** - Создание таблицы user_comments для хранения личных комментариев пользователей

## Применение всех миграций

Для применения всех миграций последовательно:

```bash
psql -U $DB_USER -d $DB_NAME -f api/migrations/001_create_notes_table.sql
psql -U $DB_USER -d $DB_NAME -f api/migrations/002_create_user_comments_table.sql
```
