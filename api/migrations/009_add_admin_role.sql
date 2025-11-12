-- Добавляем поле role в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Создаём индекс
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Устанавливаем роль администратора для первого пользователя
UPDATE users SET role = 'admin' WHERE email = 'sergeixmao@gmail.com';

-- Комментарии
COMMENT ON COLUMN users.role IS 'Роль пользователя: user, admin';
