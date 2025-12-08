-- Добавление таблицы аудита переименований изображений
-- Версия: 026

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'image_rename_audit'
  ) THEN
    CREATE TABLE image_rename_audit (
      id BIGSERIAL PRIMARY KEY,
      image_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      old_name TEXT NOT NULL,
      new_name TEXT NOT NULL,
      folder_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT fk_image_rename_audit_image FOREIGN KEY (image_id) REFERENCES image_library (id) ON DELETE CASCADE,
      CONSTRAINT fk_image_rename_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    COMMENT ON TABLE image_rename_audit IS 'Аудит переименований изображений пользователя';
    COMMENT ON COLUMN image_rename_audit.folder_name IS 'Название папки, где находилось изображение';
  END IF;
END $$;
