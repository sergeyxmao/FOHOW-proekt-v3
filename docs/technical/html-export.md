# HTML Export - useProjectActions.js

## Обзор

Функция экспорта HTML из composable `useProjectActions.js` создаёт автономные HTML-файлы схем, которые можно открывать в браузере на любом устройстве без необходимости доступа к серверу.

## Файлы

- **[src/composables/useProjectActions.js](../../src/composables/useProjectActions.js)** — основной файл с функциями экспорта

## Основные функции

### 1. Сохранить как (`handleSaveAsHTML`)

**Путь:** Кнопка "Поделиться проектом" → "Сохранить как"

Создаёт и скачивает HTML-файл схемы на устройство пользователя.

**Формат файла:** `{название_доски}_{дд.мм.гггг}.html` (например, `лена_11.02.2026.html`)

### 2. Поделиться проектом (`handleShareProject`)

**Путь:** Кнопка "Поделиться проектом" → "Поделиться"

Использует Web Share API (если доступен) для шаринга файла через системное меню Android/iOS, иначе скачивает файл и предлагает отправить через Telegram.

**Формат файла:** `{название_доски}_{дд.мм.гггг}.html` (например, `лена_11.02.2026.html`)

## Архитектура экспорта

### Генерация HTML-контента

Основная функция: `generateHTMLBlob()` (строка 439)

**Процесс:**

1. **Клонирование DOM** (строка 457):
   ```javascript
   const clone = canvasRoot.cloneNode(true)
   ```

2. **Удаление интерактивных и LOD-элементов** (строки 477-491):
   - Кнопки закрытия карточек (`.card-close-btn`)
   - Точки соединений (`.connection-point`)
   - Hitbox-слой соединений (`.line-hitbox`)
   - Контролы выделения (`.selection-box`, `.card-active-controls`)
   - Кнопки Active PV (`[data-role="active-pv-buttons"]`)
   - LOD-заголовки (`.card-lod-title`) — сокращённые имена для мелкого масштаба
   - LOD-сводки (`.card-lod-summary`) — компактные значения баланса
   - Скрытые данные Active PV (`.active-pv-hidden`)
   - Контейнеры аватарок (`.card-avatar-container`) — не работают без сервера

3. **Очистка стилей** (строки 475-484):
   - Удаление классов `selected`, `connecting`, `editing`
   - Отключение contenteditable
   - Отключение pointer-events для текстовых полей

4. **Конвертация изображений в data URI** (строка 486):
   ```javascript
   await inlineImages(clone)
   ```
   Все внешние изображения встраиваются в HTML как base64, чтобы файл был полностью автономным.

5. **Добавление кнопки масштаба** (строки 488-493):
   ```javascript
   const zoomButton = document.createElement('button')
   zoomButton.id = 'zoom-btn'
   zoomButton.className = 'zoom-button'
   zoomButton.innerHTML = 'Масштаб: <span class="zoom-value">100%</span>'
   ```

6. **Добавление watermark** (строки 495-503):
   ```javascript
   // Добавляем watermark (если его нет в DOM из-за мобильного режима)
   if (!clone.querySelector('.marketing-watermark')) {
     const watermark = document.createElement('a')
     watermark.className = 'marketing-watermark'
     watermark.href = 'https://t.me/MarketingFohow'
     watermark.textContent = '@MarketingFohow'
     clone.appendChild(watermark)
   }
   ```

7. **Генерация встроенного JavaScript** (строка 497):
   ```javascript
   const viewOnlyScript = buildViewOnlyScript(transformValues)
   ```

8. **Сборка итогового HTML** (строка 502):
   ```html
   <!DOCTYPE html>
   <html lang="ru">
   <head>
     <meta charset="UTF-8">
     <title>Просмотр схемы</title>
     <style>{cssText}</style>
   </head>
   <body style="background:{bodyBackground};">
     {clone.outerHTML}
     {viewOnlyScript}
   </body>
   </html>
   ```

## Интерактивность в экспортированном HTML

### View-Only Script (`buildViewOnlyScript`)

Генерирует встроенный JavaScript для управления схемой в режиме просмотра.

**Функциональность:**

#### 1. Pan (перемещение схемы)

**Desktop (мышь):**
- `mousedown` на canvas → начало перетаскивания
- `mousemove` → обновление позиции
- `mouseup` → завершение перетаскивания

**Mobile (touch):**
- `touchstart` (1 палец) → начало перетаскивания
- `touchmove` (1 палец) → обновление позиции
- `touchend` → завершение перетаскивания

#### 2. Zoom (масштабирование)

**Desktop (колёсико мыши):**
- `wheel` event → масштабирование относительно курсора
- Диапазон: MIN_SCALE (0.01) – MAX_SCALE (5)

**Mobile (pinch-zoom):**
- `touchstart` (2 пальца) → начало pinch-жеста
- `touchmove` (2 пальца) → масштабирование относительно центра между пальцами
- `touchend` → завершение pinch-жеста

**Алгоритм pinch-zoom:**
```javascript
// Сохранение начального состояния
pinchState = {
  initialDistance: distance,  // Расстояние между пальцами
  initialScale: currentScale,
  initialX: currentX,
  initialY: currentY,
  centerX: (t1.x + t2.x) / 2,  // Центр между пальцами
  centerY: (t1.y + t2.y) / 2
}

// Вычисление нового масштаба
const scaleRatio = currentDistance / pinchState.initialDistance
const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
  pinchState.initialScale * scaleRatio))

// Масштабирование относительно центра жеста
const actualScaleRatio = newScale / pinchState.initialScale
currentX = centerX - (centerX - pinchState.initialX) * actualScaleRatio
currentY = centerY - (centerY - pinchState.initialY) * actualScaleRatio
```

#### 3. Fit to Content (кнопка "Масштаб")

Автоматически подгоняет масштаб так, чтобы все карточки были видны на экране с отступом 100px.

**Вызывается автоматически при загрузке** — контент всегда отцентрирован при открытии HTML-файла, а также по клику на кнопку "Масштаб".

**Алгоритм:**
1. Находит границы всех карточек (min/max X/Y)
2. Вычисляет масштаб, чтобы контент поместился в viewport
3. Центрирует контент на экране

### Touch Events

**Поддержка multi-touch:**

```javascript
const activeTouches = new Map()  // Отслеживание всех активных касаний
let isPinching = false           // Флаг pinch-жеста
let pinchState = null            // Состояние pinch (начальные параметры)
```

**Переключение режимов:**
- 1 палец → Pan (перемещение)
- 2 пальца → Pinch-zoom (масштабирование)
- Обратно на 1 палец после pinch → возобновление Pan с нового положения

## Элементы UI в экспортированном HTML

### 1. Кнопка "Масштаб" (Zoom Button)

**Позиция:** левый верхний угол (left: 20px, top: 20px)

**Функциональность:**
- Клик → автоподгонка масштаба (fitToContent)
- Отображает текущий масштаб в процентах

**CSS:**
```css
.zoom-button {
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 5000;
  padding: 14px 18px;
  border-radius: 22px;
  background: rgba(255,255,255,0.92);
  color: #111827;
  font-weight: 700;
  box-shadow: 0 12px 28px rgba(15,23,42,0.16);
}
```

### 2. Watermark "@MarketingFohow"

**Позиция:** левый нижний угол (left: 20px, bottom: 20px)

**Функциональность:**
- Ссылка на Telegram-канал: https://t.me/MarketingFohow
- Открывается в новой вкладке (target="_blank")

**CSS:**
```css
.marketing-watermark {
  position: absolute;
  left: 20px;
  bottom: 20px;
  z-index: 5000;
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(255,255,255,0.9);
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 14px 28px rgba(15,23,42,0.18);
}
```

**Важно:** Watermark добавляется в экспортированный HTML **всегда**, даже если на мобильных устройствах он скрыт в основном приложении (`v-if="!isMobileMode"` в CanvasBoard.vue).

## Исправленные проблемы

### 1. Отсутствие watermark на мобильных устройствах

**Проблема:** В CanvasBoard.vue watermark имеет условие `v-if="!isMobileMode"`, поэтому при экспорте с мобильного устройства элемент отсутствует в DOM и не клонируется.

**Исправление (2026-02-09):** При генерации HTML проверяется наличие watermark в клоне, и если его нет — создаётся программно:

```javascript
if (!clone.querySelector('.marketing-watermark')) {
  const watermark = document.createElement('a')
  watermark.className = 'marketing-watermark'
  watermark.href = 'https://t.me/MarketingFohow'
  watermark.target = '_blank'
  watermark.rel = 'noopener noreferrer'
  watermark.setAttribute('aria-label', 'Открыть Telegram-канал MarketingFohow')
  watermark.textContent = '@MarketingFohow'
  clone.appendChild(watermark)
}
```

### 2. Невозможность перемещения и масштабирования схемы на мобильных

**Проблема:** Функция `buildViewOnlyScript()` содержала только обработчики мыши (mousedown, mousemove, mouseup, wheel), но не имела обработчиков touch-событий.

**Исправление (2026-02-09):** Добавлены обработчики touch-событий с поддержкой:
- Перемещение одним пальцем (pan)
- Масштабирование двумя пальцами (pinch-zoom)
- Динамическое переключение между режимами
- Корректная обработка touchend/touchcancel

**Затронутые события:**
- `touchstart` — начало касания, регистрация поинтеров
- `touchmove` — движение (pan или pinch в зависимости от количества пальцев)
- `touchend` — завершение касания, очистка поинтеров
- `touchcancel` — отмена касания (системный жест)

## Ограничения

1. **Размер файла:** При большом количестве изображений файл может быть очень большим (все изображения встроены как base64)
2. **Нет синхронизации:** Изменения в основном проекте не отражаются в экспортированном HTML
3. **Статичность:** Экспортируется только текущее состояние схемы на момент экспорта
4. **Отсутствие редактирования:** HTML предназначен только для просмотра, редактирование невозможно

## Рекомендации

1. **Для шаринга:** используйте "Поделиться" для отправки через системное меню (WhatsApp, Telegram, Email и т.д.)
2. **Для архивирования:** используйте "Сохранить как" для локального хранения
3. **Для презентаций:** экспортированный HTML можно открывать на любом устройстве с браузером
4. **Для оффлайн-доступа:** HTML работает без интернета (все изображения встроены)

## См. также

- [src/composables/useProjectActions.js](../../src/composables/useProjectActions.js) — реализация экспорта
- [src/components/Canvas/CanvasBoard.vue](../../src/components/Canvas/CanvasBoard.vue) — основной компонент canvas
- [docs/technical/composables/useExport.md](./composables/useExport.md) — документация экспорта PNG
- [docs/technical/svg-export.md](./svg-export.md) — документация экспорта SVG

## История изменений

### 2026-02-17
- Исправлено смещение контента при открытии экспортированного HTML: добавлен автоматический вызов `fitToContent()` при загрузке страницы
- Добавлен запас высоты (+80px) при расчёте границ карточек в `fitToContent` для учёта контента, выходящего за пределы карточки
- Удалены LOD-элементы из DOM при экспорте (`.card-lod-title`, `.card-lod-summary`, `.active-pv-hidden`, `.card-avatar-container`)
- Добавлены CSS-правила для скрытия LOD-элементов (safety net)
- **Полная синхронизация `getExportHtmlCss()` с Card.vue scoped-стилями:**
  - `.card` border-radius: 26px → 14px, box-shadow и border синхронизированы с Card.vue
  - Добавлена поддержка CSS-переменных (`--card-shell-background`, `--card-border-color`, `--card-body-background`, `--card-body-divider`) для корректного отображения цветовых тем карточек
  - Добавлен `.card-header` (padding, min-height, border-radius, box-shadow)
  - `.card-title`: color → #fff, font-size → 20px, добавлен text-shadow, удалён padding (теперь на header)
  - `.card-body`: добавлены border-radius, border-top, flex, width, box-sizing, line-height, overflow
  - Добавлены стили для маленьких карточек (padding-bottom: 30px, gap: 8px)
  - `.card-row`: flex-wrap → wrap (было nowrap)
  - `.label`: font-weight 700 → 500, font-size 24px → 23px, добавлен line-height
  - `.value`: font-weight 700 → 600, font-size 28px → 24px, line-height 1.5 → 1.2
  - Добавлены `.pv-value`, `.pv-value-left`, `.pv-value-right` (29px, 600)
  - `.pv-separator`: 28px → 29px, 700 → 600, добавлен color и margin
  - Добавлен `.value-container` (inline-flex, gap: 0)
  - Добавлен `.card.card--gold` с отдельным box-shadow
  - Large/gold `.card-title`: 32px → 30px
  - Large/gold `.label`: добавлен font-weight: 700
  - Исправлены text-shadow значков (.slf-badge, .fendou-badge)
  - `.card-body-html`: text-align → center, line-height → 1.5, убран margin-top

### 2026-02-11
- Имя файла HTML-экспорта теперь содержит название доски и текущую дату (`{название}_{дд.мм.гггг}.html`) вместо timestamp

### 2026-02-09
- Исправлен баг с отсутствием watermark при экспорте с мобильных устройств
- Добавлена поддержка touch-событий (touchstart, touchmove, touchend, touchcancel)
- Добавлен pinch-zoom для масштабирования двумя пальцами на мобильных
- Добавлено динамическое переключение между pan и pinch-zoom режимами
