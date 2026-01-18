-- Скрипт подготовки данных для ручного теста блокировок (User ID: 80)
-- 1. Очистка старых досок пользователя 80
DELETE FROM boards WHERE owner_id = 80;

-- 2. Установка "Богатого" тарифа (Premium), чтобы сначала все было активно
-- (Предполагаем, что Premium имеет высокие лимиты)
UPDATE users 
SET plan_id = (SELECT id FROM subscription_plans WHERE code_name = 'premium' LIMIT 1),
    subscription_expires_at = NOW() + INTERVAL '30 days'
WHERE id = 80;

-- 3. Создание тестовых досок
-- Доска А: "Тяжелая" (150 объектов), создана вчера
INSERT INTO boards (owner_id, name, description, object_count, updated_at, lock_status, content)
VALUES (
    80, 
    'A. Тяжелая доска (150 obj)', 
    'Должна быть Soft Lock, так как > 100 объектов', 
    150, 
    NOW() - INTERVAL '1 day',
    'active',
    '{"objects": [ ... ]}' -- фиктивный контент
);

-- Доска Б: "Нормальная свежая" (10 объектов), создана сегодня (самая новая)
INSERT INTO boards (owner_id, name, description, object_count, updated_at, lock_status, content)
VALUES (
    80, 
    'B. Свежая доска (10 obj)', 
    'Должна остаться Active (топ-1)', 
    10, 
    NOW(),
    'active',
    '{"objects": [ ... ]}'
);

-- Доска В: "Нормальная старая" (10 объектов), создана 2 дня назад
INSERT INTO boards (owner_id, name, description, object_count, updated_at, lock_status, content)
VALUES (
    80, 
    'C. Старая доска (10 obj)', 
    'Должна быть Soft Lock (не влезает в лимит 1 доски)', 
    10, 
    NOW() - INTERVAL '2 days',
    'active',
    '{"objects": [ ... ]}'
);

-- 4. Вывод результата для проверки
SELECT id, name, object_count, updated_at, lock_status 
FROM boards 
WHERE owner_id = 80 
ORDER BY name;

-- ИНСТРУКЦИЯ ПО ТЕСТУ:
-- 1. Выполните этот скрипт.
-- 2. Зайдите в админку под своим аккаунтом (ID 3).
-- 3. Найдите пользователя 80.
-- 4. Смените ему тариф на "Guest" (или любой с лимитом 1 доска / 100 объектов).
-- 5. Проверьте статусы досок. Ожидается:
--    - Доска А -> Soft Lock (из-за объектов)
--    - Доска B -> Active (попала в лимит)
--    - Доска C -> Soft Lock (вытеснена более новой Доской B)
