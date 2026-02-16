# Мобильные режимы производительности

Три режима производительности (Full / Light / View) управляют видимостью UI-элементов на мобильном.

## Режимы

### 🔴 Full — Расширенный

**Header:** гамбургер (☰) слева → открывает MobileFullMenu, отмена/повтор + иерархия + выделение по центру, аватар справа.

**Sidebar, Toolbar:** без изменений (всё видно).

**MobileFullMenu:** слайд-панель слева с 3 секциями:
- Инструменты: рисование, направляющие, смена темы, очистить холст, новая структура
- Вид: сетка, линии, анимация, фон, цвет заголовка, язык
- Обсуждение: партнёры, заметки, изображения, комментарии, геолокация, стикеры

### 🟡 Light — Текущий

Полный набор кнопок как есть (без изменений). Это стандартная мобильная версия.

### 🟢 View — Просмотр

**Скрыто:** отмена/повтор, иерархия, рисование, выделение, sidebar (кнопки добавления), сохранить, тема.

**Видно:** кнопка "поделиться" (📄), аватар, telegram, zoom, mode-cycle, версия.

## Файлы

| Файл | Описание |
|------|----------|
| `src/stores/performanceMode.js` | Store: `isFull`, `isLight`, `isView`, `cycleMode()` |
| `src/components/Layout/MobileHeader.vue` | Template restructure: layout зависит от режима |
| `src/components/Layout/MobileToolbar.vue` | `v-if="!isView"` на theme, save |
| `src/components/Layout/MobileSidebar.vue` | `v-if="!isView"` на весь sidebar |
| `src/components/Layout/MobileFullMenu.vue` | **NEW** — слайд-панель слева |
| `src/App.vue` | Интеграция: import, ref, handlers, template wiring |

## MobileFullMenu — секции и events

**Props:** `visible` (Boolean), `isDark` (Boolean)

**Events:** `close`, `activate-pencil`, `toggle-theme`, `clear-canvas`, `new-structure`

**Stores:**
- `useCanvasStore` — guides, grid, background
- `useViewSettingsStore` — line color/thickness, animation, header color, background
- `useSidePanelsStore` — togglePartners/Notes/Images/Comments/Anchors/StickerMessages
- `useI18n` — locale switcher

**Дизайн:**
- Teleport to `body` (вне `.m3-dark` каскада)
- Dark mode через `--dark` CSS класс + `--md-ref-*` токены
- Touch-friendly: min-height 48px на кнопки, 52px на accordion toggles
- Z-index: 2500
- Slide-in: `translateX(-100%)` → `translateX(0)` с M3 easing
- Width: `min(320px, 85vw)`

## Как добавить новый пункт в меню

1. В `MobileFullMenu.vue` добавить `<button class="fullmenu-item">` в нужную секцию
2. Создать handler, при необходимости emit + `emit('close')`
3. В `App.vue` подключить event на `<MobileFullMenu>`

## Тестирование

1. `npm run dev` → DevTools → mobile view (375px)
2. Переключить режимы (🔴→🟡→🟢)
3. **View (🟢):** только share + avatar в header, нет sidebar, нет save/theme в toolbar
4. **Light (🟡):** полный набор кнопок (регрессий нет)
5. **Full (🔴):** гамбургер слева → меню слайдом, undo/redo + hierarchy + selection по центру
6. Тёмная тема: проверить меню в dark mode
7. Закрытие меню: клик на overlay, кнопка ✕
