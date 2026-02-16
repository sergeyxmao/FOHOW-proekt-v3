# MobileToolbar

Компонент нижней панели инструментов мобильной версии приложения.

## Расположение

```
src/components/Layout/MobileToolbar.vue
```

## Описание

`MobileToolbar` — фиксированная нижняя панель для мобильной версии, содержащая:
- Кнопку Telegram (@marketingFohow)
- Переключатель темы
- Индикатор масштаба с кнопкой автоподгонки
- Переключатель версии (мобильная/ПК)
- Кнопку сохранения

## Props

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `isModernTheme` | `Boolean` | `false` | Флаг тёмной темы интерфейса |

## Events

| Event | Payload | Описание |
|-------|---------|----------|
| `save` | - | Сохранение проекта |
| `toggle-theme` | - | Переключение темы |
| `fit-to-content` | - | Автоподгонка масштаба |
| `open-profile` | - | Открытие профиля |
| `request-auth` | - | Запрос авторизации |

## Stores

- **`useAuthStore`** — авторизация пользователя
- **`useBoardStore`** — управление досками (статус сохранения)
- **`useMobileStore`** — мобильные настройки (масштаб меню, режим)
- **`useViewportStore`** — viewport настройки (текущий масштаб)

## Стили (Material Design 3)

Стили полностью переписаны в стиле Material Design 3, используя глобальные CSS-токены из `src/assets/m3-tokens.css`.

### Основные классы

- `.mobile-toolbar` — основной контейнер, фиксированное позиционирование снизу, прозрачный фон
- `.mobile-toolbar--dark` — модификатор для тёмной темы (M3 токены переключаются автоматически через `.m3-dark` на родительском элементе)
- `.mobile-toolbar--scaled` — модификатор для масштабированного меню
- `.mobile-toolbar-button` — базовая кнопка: pill-shaped (`border-radius: var(--md-sys-shape-corner-full)`), 44x44px, `surface-container-high` фон
- `.marketing-button` — кнопка Telegram (сплошной `primary` цвет, белая иконка)
- `.save-button` — кнопка сохранения (сплошной `success` цвет, белая иконка)
- `.theme-button` — кнопка переключения темы (`secondary-container` фон)
- `.zoom-button` — кнопка масштаба (surface фон, `tabular-nums`)
- `.version-button` — кнопка переключения версии (`surface-container-high` фон)
- `.mode-button` — кнопка режима производительности (`surface-container-high` фон)
- `.auth-button` — кнопка авторизации (`surface-container-high` фон)

### M3 токены

Используемые группы токенов:
- **Цвета:** `--md-sys-color-primary`, `--md-sys-color-on-primary`, `--md-sys-color-surface-container-high`, `--md-sys-color-on-surface`, `--md-sys-color-secondary-container`, `--md-sys-color-on-secondary-container`, `--md-sys-color-success`, `--md-sys-color-on-success`
- **Форма:** `--md-sys-shape-corner-full` (9999px) для pill-shaped кнопок
- **Тени:** `--md-sys-elevation-0` ... `--md-sys-elevation-2`
- **Анимации:** `--md-sys-motion-duration-short3`, `--md-sys-motion-duration-short4`, `--md-sys-motion-easing-standard`
- **Состояния:** `--md-sys-state-hover-opacity` (0.08), `--md-sys-state-pressed-opacity` (0.12), `--md-sys-state-disabled-opacity` (0.38)

### State layer (M3 паттерн)

Каждая кнопка имеет `::after` псевдо-элемент, который работает как state layer:
- **Hover:** opacity 8% (`--md-sys-state-hover-opacity`) — полупрозрачный тинт `on-surface` цвета
- **Active/Pressed:** opacity 12% (`--md-sys-state-pressed-opacity`) + `scale(0.95)`
- **Disabled:** opacity 38% (`--md-sys-state-disabled-opacity`), state layer скрыт

### Визуальное оформление

Контейнер прозрачный (pointer-events: none), кнопки "плавают" отдельно:

```css
.mobile-toolbar-button {
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-sys-elevation-1);
}
```

Специальные кнопки переопределяют фон:
- Marketing: `var(--md-sys-color-primary)` — сплошной синий, без градиента
- Save: `var(--md-sys-color-success)` — сплошной зелёный, без градиента
- Theme: `var(--md-sys-color-secondary-container)` — тональный контейнер

### Адаптивность

На экранах `max-width: 480px`:
- Высота уменьшается с 56px до 52px
- Размер кнопок уменьшается с 44px до 40px

## Примеры использования

```vue
<MobileToolbar
  :is-modern-theme="isDarkMode"
  @save="handleSave"
  @toggle-theme="handleThemeToggle"
  @fit-to-content="fitToContent"
  @open-profile="openProfile"
  @request-auth="showAuthModal"
/>
```

## История изменений

### 2026-02-16
- Полностью переписаны CSS-стили в Material Design 3:
  - Pill-shaped кнопки (border-radius: 9999px) вместо 12px
  - M3 токены для цветов, теней, анимаций, состояний
  - State layer паттерн (::after) для hover (8% opacity) и active (12% opacity)
  - Убраны градиенты — marketing и save кнопки используют сплошные M3 цвета
  - Убран жёлтый (#ffc107) hover — заменён на M3 state layer
  - Disabled состояние: opacity 0.38 через M3 токен
  - Тёмная тема автоматически переключается через m3-dark родительский класс

### 2026-01-24
- Добавлен полупрозрачный фон с blur-эффектом на контейнер `.mobile-toolbar`
- Добавлен стиль `.mobile-toolbar--dark` для тёмной темы
- Исправлена проблема белых полупрозрачных полос между кнопками

## См. также

- [MobileHeader](./MobileHeader.md)
- [HeaderActions](./HeaderActions.md)
