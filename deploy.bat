@echo off
REM Скрипт для развертывания проекта на GitHub Pages для Windows

echo 🚀 Начинаем развертывание на GitHub Pages...

REM Проверяем, что мы в правильной директории
if not exist "package.json" (
    echo ❌ Ошибка: package.json не найден. Убедитесь, что вы в корневой директории проекта.
    pause
    exit /b 1
)

REM Устанавливаем зависимости
echo 📦 Установка зависимостей...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка при установке зависимостей.
    pause
    exit /b 1
)

REM Собираем проект
echo 🔨 Сборка проекта...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Ошибка при сборке проекта.
    pause
    exit /b 1
)

REM Проверяем, что директория dist создана
if not exist "dist" (
    echo ❌ Ошибка: директория dist не создана. Проверьте ошибки сборки.
    pause
    exit /b 1
)

REM Переходим в директорию dist
cd dist

REM Создаем файл .nojekyll для GitHub Pages
echo. > .nojekyll

REM Инициализируем репозиторий, если еще не инициализирован
if not exist ".git" (
    echo 📁 Инициализация Git репозитория...
    git init
    git branch -M gh-pages
)

REM Добавляем удаленный репозиторий, если еще не добавлен
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔗 Добавление удаленного репозитория...
    git remote add origin https://github.com/sergeyxmao/FOHOW-proekt-v3.git
)

REM Добавляем все файлы
echo 📝 Добавление файлов в Git...
git add .

REM Создаем коммит
echo 💾 Создание коммита...
git commit -m "Deploy to GitHub Pages - %date% %time%"

REM Отправляем изменения в ветку gh-pages
echo 📤 Отправка изменений на GitHub...
git push -f origin gh-pages

REM Возвращаемся в основную директорию
cd ..

echo ✅ Развертывание завершено!
echo 🌐 Проект доступен по адресу: https://sergeyxmao.github.io/FOHOW-proekt-v3/
pause