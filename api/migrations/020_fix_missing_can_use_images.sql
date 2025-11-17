-- Миграция для исправления отсутствующего поля can_use_images у всех тарифов
-- Версия: 020

-- ============================================
-- Добавление can_use_images для всех тарифных планов
-- ============================================

-- Обновляем все тарифные планы, у которых отсутствует поле can_use_images
-- Устанавливаем значение true по умолчанию для всех планов, кроме guest
UPDATE subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{can_use_images}', 'true'::jsonb
)
WHERE code_name != 'guest'
  AND (
    features IS NULL
    OR NOT (features ? 'can_use_images')
  );

-- Добавляем лимиты библиотеки изображений для планов, у которых их нет
-- Для всех планов, кроме guest, demo, individual и premium (они уже настроены в миграции 019)
UPDATE subscription_plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(features, '{}'::jsonb),
        '{can_use_images}', 'true'::jsonb
      ),
      '{image_library_max_files}', '-1'::jsonb
    ),
    '{image_library_max_folders}', '-1'::jsonb
  ),
  '{image_library_max_storage_mb}', '10240'::jsonb
)
WHERE code_name NOT IN ('guest', 'demo', 'individual', 'premium')
  AND (
    features IS NULL
    OR NOT (features ? 'image_library_max_files')
    OR NOT (features ? 'image_library_max_folders')
    OR NOT (features ? 'image_library_max_storage_mb')
  );

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON COLUMN subscription_plans.features IS 'Функции тарифного плана в формате JSON. Включает:
- can_use_images: доступ к библиотеке изображений (boolean)
- image_library_max_files: максимум файлов в личной библиотеке (number, -1 = безлимит)
- image_library_max_folders: максимум папок в личной библиотеке (number, -1 = безлимит)
- image_library_max_storage_mb: максимум объема хранилища в МБ (number)';
