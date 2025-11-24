-- Миграция для добавления функции max_folders (для папок досок) в тарифные планы
-- Версия: 023

-- ============================================
-- Добавление поля max_folders для board folders в features
-- ============================================

-- Обновление features для тарифа guest (бесплатный)
-- Гостевой тариф не имеет доступа к папкам досок
UPDATE subscription_plans
SET features = jsonb_set(
  features,
  '{max_folders}', '0'::jsonb
)
WHERE code_name = 'guest';

-- Обновление features для тарифа demo (демо)
-- Демо тариф имеет ограниченный доступ к 5 папкам
UPDATE subscription_plans
SET features = jsonb_set(
  features,
  '{max_folders}', '5'::jsonb
)
WHERE code_name = 'demo';

-- Обновление features для тарифа individual (индивидуальный)
-- Индивидуальный тариф имеет доступ к 15 папкам
UPDATE subscription_plans
SET features = jsonb_set(
  features,
  '{max_folders}', '15'::jsonb
)
WHERE code_name = 'individual';

-- Обновление features для тарифа premium (премиум/командный)
-- Премиум тариф имеет безлимитное количество папок
UPDATE subscription_plans
SET features = jsonb_set(
  features,
  '{max_folders}', '-1'::jsonb
)
WHERE code_name = 'premium';

-- ============================================
-- Комментарии для документации
-- ============================================
COMMENT ON COLUMN subscription_plans.features IS 'Функции тарифного плана в формате JSON. Включает:
- max_boards: максимальное количество досок (number, -1 = безлимит)
- max_folders: максимальное количество папок для досок (number, -1 = безлимит, 0 = недоступно)
- can_duplicate_boards: возможность дублировать доски (boolean)
- can_export_pdf: возможность экспортировать доски в PDF (boolean)
- can_use_images: доступ к библиотеке изображений (boolean)
- image_library_max_files: максимум файлов в личной библиотеке (number, -1 = безлимит)
- image_library_max_folders: максимум папок в личной библиотеке (number, -1 = безлимит)
- image_library_max_storage_mb: максимум объема хранилища в МБ (number)';
