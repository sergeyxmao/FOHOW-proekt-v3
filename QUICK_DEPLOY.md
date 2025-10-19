# Быстрое развертывание на GitHub Pages

## Что было исправлено

1. ✅ Добавлен правильный базовый путь в `vite.config.js`: `base: '/FOHOW-proekt-v3/'`
2. ✅ Обновлены скрипты развертывания для использования ветки `gh-pages`
3. ✅ Создан GitHub Actions для автоматического развертывания
4. ✅ Добавлен файл `.nojekyll` для корректной работы GitHub Pages
5. ✅ Проверена структура файлов после сборки

## Инструкция по развертыванию

### Вариант 1: Автоматическое развертывание (рекомендуется)

1. Сделайте коммит всех изменений:
   ```bash
   git add .
   git commit -m "Fix GitHub Pages deployment"
   git push origin main
   ```

2. Настройте GitHub Pages:
   - Перейдите в https://github.com/sergeyxmao/FOHOW-proekt-v3/settings/pages
   - Выберите "Source: Deploy from a branch"
   - Выберите "Branch: gh-pages" и "Folder: / (root)"
   - Нажмите "Save"

3. GitHub Actions автоматически соберет и развернет проект

### Вариант 2: Ручное развертывание

1. Выполните скрипт развертывания:
   ```bash
   # Для Windows
   deploy.bat
   
   # Для Linux/Mac
   ./deploy.sh
   
   # Или через npm
   npm run deploy
   ```

2. Убедитесь, что в настройках GitHub Pages выбрана ветка `gh-pages`

## Проверка

После развертывания откройте https://sergeyxmao.github.io/FOHOW-proekt-v3/ и проверьте консоль разработчика (F12) на отсутствие ошибок.

## Если возникли проблемы

1. Убедитесь, что в настройках репозитория GitHub Pages выбрана ветка `gh-pages`
2. Проверьте, что в `vite.config.js` указан правильный базовый путь
3. Очистите кэш браузера
4. Проверьте вкладку "Actions" в репозитории на предмет ошибок сборки