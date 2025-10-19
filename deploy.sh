#!/bin/bash

# Скрипт для развертывания проекта на GitHub Pages

echo "🚀 Начинаем развертывание на GitHub Pages..."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден. Убедитесь, что вы в корневой директории проекта."
    exit 1
fi

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
npm install

# Собираем проект
echo "🔨 Сборка проекта..."
npm run build

# Проверяем, что директория dist создана
if [ ! -d "dist" ]; then
    echo "❌ Ошибка: директория dist не создана. Проверьте ошибки сборки."
    exit 1
fi

# Переходим в директорию dist
cd dist

# Создаем файл .nojekyll для GitHub Pages
touch .nojekyll

# Инициализируем репозиторий, если еще не инициализирован
if [ ! -d ".git" ]; then
    echo "📁 Инициализация Git репозитория..."
    git init
    git branch -M gh-pages
fi

# Добавляем удаленный репозиторий, если еще не добавлен
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Добавление удаленного репозитория..."
    git remote add origin https://github.com/sergeyxmao/FOHOW-proekt-v3.git
fi

# Добавляем все файлы
echo "📝 Добавление файлов в Git..."
git add .

# Создаем коммит
echo "💾 Создание коммита..."
git commit -m "Deploy to GitHub Pages - $(date)"

# Отправляем изменения в ветку gh-pages
echo "📤 Отправка изменений на GitHub..."
git push -f origin gh-pages

# Возвращаемся в основную директорию
cd ..

echo "✅ Развертывание завершено!"
echo "🌐 Проект доступен по адресу: https://sergeyxmao.github.io/FOHOW-proekt-v3/"