# MobileHeader

Компонент верхней панели мобильной версии приложения.

## Расположение

```
src/components/Layout/MobileHeader.vue
```

## Описание

`MobileHeader` — фиксированная верхняя панель для мобильной версии, содержащая:
- Кнопки отмены/повтора действий (undo/redo)
- Кнопку режима иерархии
- Кнопку режима рисования
- Кнопку экспорта/шаринга
- Кнопку режима выделения
- Аватар пользователя с меню

## Props

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `isModernTheme` | `Boolean` | `false` | Флаг тёмной темы интерфейса |

## Events

| Event | Payload | Описание |
|-------|---------|----------|
| `toggle-theme` | - | Переключение темы |
| `open-profile` | - | Открытие профиля |
| `request-auth` | - | Запрос авторизации |
| `open-boards` | - | Открытие списка проектов |
| `export-html` | - | Экспорт в HTML |
| `activate-pencil` | - | Активация режима рисования |

## Stores

- **`useAuthStore`** — авторизация пользователя
- **`useHistoryStore`** — история действий (undo/redo)
- **`useCanvasStore`** — управление холстом
- **`useBoardStore`** — управление досками
- **`useMobileStore`** — мобильные настройки (масштаб меню)

## Стили (Material Design 3)

Стили полностью переведены на Material Design 3 токены из `src/assets/m3-tokens.css`.

### Основные классы

- `.mobile-header` — основной контейнер, фиксированное позиционирование сверху (transparent background)
- `.mobile-header--dark` — модификатор для тёмной темы (токены auto-switch через `.m3-dark` ancestor)
- `.mobile-header--scaled` — модификатор для масштабированного меню (сохранён `--menu-scale` механизм)
- `.mobile-header-button` — кнопка 44x44px, pill-shape (`--md-sys-shape-corner-full`)
- `.mobile-header-avatar` — аватар пользователя

### Визуальное оформление (M3 токены)

**Кнопки:**
- Фон: `color-mix(in srgb, var(--md-sys-color-surface-container-high) 92%, transparent)`
- Граница: `var(--md-sys-color-outline-variant)`
- Тень: `var(--md-sys-elevation-1)`
- Форма: pill (`var(--md-sys-shape-corner-full)` = 9999px)
- Переходы: `var(--md-sys-motion-duration-short4)` + `var(--md-sys-motion-easing-standard)`

**Состояния кнопок:**
- Hover: state layer effect с `var(--md-sys-state-hover-opacity)`
- Active (toggled): `var(--md-sys-color-primary-container)` фон вместо жёлтого (#ffc107)
- Pressed: state layer с `var(--md-sys-state-pressed-opacity)`
- Disabled: `var(--md-sys-state-disabled-opacity)`

**Аватар:**
- Инициалы: `var(--md-sys-color-primary-container)` фон вместо gradient
- Анимация `goldPulse` для верифицированных пользователей — сохранена

**Телепортированные меню (user menu, share menu):**
- Панели: `var(--md-ref-neutral-98)` фон, `var(--md-sys-shape-corner-extra-large)` (28px) border-radius
- Close кнопка: pill-shape (`var(--md-sys-shape-corner-full)`)
- Menu items: `var(--md-sys-shape-corner-large)` (16px) border-radius
- Hover: `var(--md-ref-primary-90)` фон (light) / `var(--md-ref-primary-30)` (dark) — вместо жёлтого
- Danger item: `var(--md-ref-error-90)` hover (light) / `var(--md-ref-error-30)` (dark)
- Dark mode: прямые `--md-ref-*` токены (т.к. `.m3-dark` не каскадируется в Teleport → body)

### Адаптивность

На экранах `max-width: 480px`:
- Высота уменьшается с 56px до 52px
- Размер кнопок уменьшается с 44px до 40px

## Примеры использования

```vue
<MobileHeader
  :is-modern-theme="isDarkMode"
  @toggle-theme="handleThemeToggle"
  @open-profile="openProfile"
  @request-auth="showAuthModal"
  @open-boards="showBoardsList"
  @activate-pencil="activatePencilMode"
/>
```

## История изменений

### 2026-02-16
- Полный рефакторинг CSS на Material Design 3 токены (`m3-tokens.css`)
  - Кнопки: pill-shape, M3 surface/elevation/state-layer вместо белого фона с жёлтым hover
  - Active state: `primary-container` вместо `#ffc107`
  - Avatar initials: `primary-container` фон вместо gradient
  - Teleported menus: `--md-ref-*` reference tokens для корректной работы dark mode
  - Menu items: 16px radius, primary-container tint hover вместо жёлтого
  - Danger item: error-container фон
  - Все transitions используют M3 motion tokens
  - Close buttons: pill-shape
  - Сохранены: `--menu-scale` механизм, `goldPulse` анимация, responsive media queries, fade transitions

### 2026-01-25 (v3)
- Сделаны взаимоисключающими режимы иерархии и выделения
  - При включении режима иерархии → режим выделения автоматически отключается
  - При включении режима выделения → режим иерархии автоматически отключается
  - Изменения внесены в функции `toggleHierarchyMode()` и `toggleSelectionMode()`

### 2026-01-25 (v2)
- Исправлена автоматическая активация режима иерархии при загрузке мобильной версии
  - **Проблема:** Watcher для `isMobileMode` срабатывал только при переключении режима (oldValue === false → newValue === true), но не при начальной загрузке, когда устройство изначально мобильное
  - **Решение:** Добавлен `{ immediate: true }` к watcher и упрощена логика проверки — теперь режим иерархии включается когда `isMobileMode === true`, независимо от предыдущего состояния

### 2026-01-25
- Добавлена кнопка "Режим выделения" (⬚) для управления выделением объектов в мобильной версии
- Кнопка расположена после кнопки "Поделиться проектом"
- Режим выделения по умолчанию выключен, чтобы не конфликтовать с перемещением холста
- Добавлена автоматическая активация режима иерархии при переходе на мобильную версию

### 2026-01-24
- Добавлен полупрозрачный фон с blur-эффектом на контейнер `.mobile-header`
- Добавлен стиль `.mobile-header--dark` для тёмной темы
- Исправлена проблема белых полупрозрачных полос между кнопками

## См. также

- [MobileToolbar](./MobileToolbar.md)
- [HeaderActions](./HeaderActions.md)
