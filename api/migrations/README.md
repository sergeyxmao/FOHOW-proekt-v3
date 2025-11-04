# Миграции базы данных

## Применение миграций

### 001_add_avatar_metadata.sql

Эта миграция добавляет поля для хранения метаданных аватаров пользователей:
- `avatar_meta` (JSONB) - метаданные аватара (форматы, размеры, хеш)
- `avatar_updated_at` (TIMESTAMP) - время последнего обновления аватара

**Применить миграцию:**

```bash
cd api
PGPASSWORD=fohow_pass psql -h localhost -U fohow_user -d fohow -f migrations/001_add_avatar_metadata.sql
```

**Проверить применение:**

```bash
PGPASSWORD=fohow_pass psql -h localhost -U fohow_user -d fohow -c "\d users"
```

Вы должны увидеть новые поля `avatar_meta` и `avatar_updated_at` в таблице users.

## Структура avatar_meta

Поле `avatar_meta` содержит JSON со следующей структурой:

```json
{
  "rev": "a1b2c3d4e5f6g7h8",
  "sizes": [64, 128, 256],
  "formats": ["avif", "webp", "jpg"],
  "baseUrl": "/uploads/avatars/123/"
}
```

Где:
- `rev` - контент-хеш для cache busting
- `sizes` - доступные размеры аватара
- `formats` - доступные форматы изображения
- `baseUrl` - базовый URL для загрузки аватара

## Примеры использования

### Загрузка аватара

**API Endpoint:** `POST /api/me/avatar`

```bash
curl -X POST http://localhost:4000/api/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@avatar.jpg"
```

**Ответ:**

```json
{
  "success": true,
  "avatarMeta": {
    "rev": "a1b2c3d4e5f6g7h8",
    "sizes": [64, 128, 256],
    "formats": ["avif", "webp", "jpg"],
    "baseUrl": "/uploads/avatars/123/"
  }
}
```

### Удаление аватара

**API Endpoint:** `DELETE /api/me/avatar`

```bash
curl -X DELETE http://localhost:4000/api/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Получение аватара

Аватары доступны по следующим URL:

```
/uploads/avatars/{userId}/{size}/{hash}.{format}
```

Примеры:
- `/uploads/avatars/123/128/a1b2c3d4.avif` - AVIF формат, 128px
- `/uploads/avatars/123/256/a1b2c3d4.webp` - WebP формат, 256px
- `/uploads/avatars/123/64/a1b2c3d4.jpg` - JPEG формат, 64px

## Настройка окружения

В файле `api/.env` добавлены следующие параметры:

```env
UPLOADS_DIR=uploads
AVATAR_MAX_PX=512
AVATAR_SIZES=64,128,256
AVATAR_QUALITY_WEBP=80
AVATAR_QUALITY_JPEG=82
AVATAR_QUALITY_AVIF=45
```

Вы можете изменить эти параметры под свои нужды.
