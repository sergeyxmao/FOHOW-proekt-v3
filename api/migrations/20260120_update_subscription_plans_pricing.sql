-- Миграция: Обновление тарифов согласно новому прайсингу
-- Дата: 2026-01-20
-- Описание: Обновление цен и лимитов тарифных планов

-- ============================================
-- 1. Обновление цен
-- ============================================

-- Индивидуальный: 249₽ → 299₽/мес, 2490₽ → 2990₽/год
UPDATE subscription_plans
SET
    price_monthly = 299,
    price_yearly = 2990,
    updated_at = NOW()
WHERE code_name = 'individual';

-- Премиум: 399₽ → 499₽/мес, 3990₽ → 4990₽/год
UPDATE subscription_plans
SET
    price_monthly = 499,
    price_yearly = 4990,
    updated_at = NOW()
WHERE code_name = 'premium';

-- ============================================
-- 2. Обновление лимитов Guest тарифа
-- ============================================

UPDATE subscription_plans
SET
    features = jsonb_set(
        jsonb_set(
            features,
            '{max_boards}', '3'
        ),
        '{max_licenses}', '10'
    ),
    updated_at = NOW()
WHERE code_name = 'guest';

-- ============================================
-- 3. Обновление лимитов Individual тарифа
-- ============================================

UPDATE subscription_plans
SET
    features = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        features,
                        '{max_boards}', '9'
                    ),
                    '{max_licenses}', '500'
                ),
                '{max_notes}', '100'
            ),
            '{max_stickers}', '100'
        ),
        '{max_comments}', '100'
    ),
    updated_at = NOW()
WHERE code_name = 'individual';

-- ============================================
-- Проверка результатов
-- ============================================

SELECT
    code_name,
    name,
    price_monthly,
    price_yearly,
    features->>'max_boards' as max_boards,
    features->>'max_licenses' as max_licenses,
    features->>'max_notes' as max_notes,
    features->>'max_stickers' as max_stickers,
    features->>'max_comments' as max_comments
FROM subscription_plans
WHERE code_name IN ('guest', 'individual', 'premium')
ORDER BY display_order;
