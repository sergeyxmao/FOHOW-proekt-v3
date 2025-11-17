-- Миграция для добавления функций библиотеки изображений в тарифные планы
-- Версия: 019

-- ============================================
-- Добавление полей библиотеки изображений в features
-- ============================================

-- Обновление features для тарифа demo
UPDATE subscription_plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{can_use_images}', 'true'::jsonb
      ),
      '{image_library_max_files}', '50'::jsonb
    ),
    '{image_library_max_folders}', '10'::jsonb
  ),
  '{image_library_max_storage_mb}', '200'::jsonb
)
WHERE code_name = 'demo';

-- Обновление features для тарифа guest
UPDATE subscription_plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{can_use_images}', 'false'::jsonb
      ),
      '{image_library_max_files}', '0'::jsonb
    ),
    '{image_library_max_folders}', '0'::jsonb
  ),
  '{image_library_max_storage_mb}', '0'::jsonb
)
WHERE code_name = 'guest';

-- Обновление features для тарифа individual
UPDATE subscription_plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{can_use_images}', 'true'::jsonb
      ),
      '{image_library_max_files}', '200'::jsonb
    ),
    '{image_library_max_folders}', '30'::jsonb
  ),
  '{image_library_max_storage_mb}', '1024'::jsonb
)
WHERE code_name = 'individual';

-- Обновление features для тарифа premium
UPDATE subscription_plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{can_use_images}', 'true'::jsonb
      ),
      '{image_library_max_files}', '-1'::jsonb
    ),
    '{image_library_max_folders}', '-1'::jsonb
  ),
  '{image_library_max_storage_mb}', '10240'::jsonb
)
WHERE code_name = 'premium';

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON COLUMN subscription_plans.features IS 'Функции тарифного плана в формате JSON. Включает:
- can_use_images: доступ к библиотеке изображений (boolean)
- image_library_max_files: максимум файлов в личной библиотеке (number, -1 = безлимит)
- image_library_max_folders: максимум папок в личной библиотеке (number, -1 = безлимит)
- image_library_max_storage_mb: максимум объема хранилища в МБ (number)';
