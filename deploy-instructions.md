# Инструкции по развертыванию проекта на GitHub Pages

## Проблема
Ошибка `GET https://sergeyxmao.github.io/src/main.js net::ERR_ABORTED 404 (Not Found)` возникает из-за неправильной конфигурации путей для GitHub Pages.

## Решение

### 1. Конфигурация Vite
В файле `vite.config.js` добавлен параметр `base`:
```javascript
export default defineConfig({
  base: '/FOHOW-proekt-v3/', // Базовый путь для GitHub Pages
  // ... остальная конфигурация
})
```

### 2. Сборка проекта для продакшена
Выполните следующие команды в терминале:

```bash
# Перейдите в директорию проекта
cd fohow-interactive-board

# Установите зависимости (если еще не установлены)
npm install

# Соберите проект для продакшена
npm run build
```

После сборки в директории `dist` появятся статические файлы, готовые для развертывания.

### 3. Развертывание на GitHub Pages

#### Способ 1: Через GitHub CLI (рекомендуется)
```bash
# Установите GitHub CLI, если еще не установлен
# Затем выполните:

# Перейдите в директорию проекта
cd fohow-interactive-board

# Соберите проект
npm run build

# Разверните на GitHub Pages
gh pages --dist dist
```

#### Способ 2: Вручную через Git
```bash
# Перейдите в директорию проекта
cd fohow-interactive-board

# Соберите проект
npm run build

# Создайте ветку gh-pages (если еще не создана)
git checkout --orphan gh-pages

# Добавьте файлы из директории dist
git --work-tree dist add --all
git --work-tree dist commit -m "Deploy to GitHub Pages"

# Отправьте изменения
git push origin gh-pages
```

#### Способ 3: Через настройки GitHub
1. Перейдите в репозиторий на GitHub
2. Settings → Pages
3. В разделе "Build and deployment" выберите:
   - Source: Deploy from a branch
   - Branch: gh-pages
   - Folder: /root
4. Нажмите Save

### 4. Настройка GitHub Actions (автоматическое развертывание)

Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      if: github.ref == 'refs/heads/main'
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 5. Проверка
После развертывания проект будет доступен по адресу:
https://sergeyxmao.github.io/FOHOW-proekt-v3/

## Устранение неполадок

1. **Если ресурсы не загружаются (404 ошибка)**:
   - Убедитесь, что в `vite.config.js` указан правильный `base` путь
   - Проверьте, что имя репозитория совпадает с путем в `base`

2. **Если белая страница**:
   - Откройте консоль разработчика (F12)
   - Проверьте ошибки в вкладке Console
   - Убедитесь, что все ресурсы загружаются корректно

3. **Если локально работает, а на GitHub Pages нет**:
   - Очистите кэш браузера
   - Проверьте, что сборка прошла без ошибок
   - Убедитесь, что файлы попали в ветку gh-pages

## Дополнительные настройки

Для локальной разработки с правильными путями:
```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:5174/FOHOW-proekt-v3/