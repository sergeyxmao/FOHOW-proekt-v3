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

## Стили

### Основные классы

- `.mobile-toolbar` — основной контейнер, фиксированное позиционирование снизу
- `.mobile-toolbar--dark` — модификатор для тёмной темы
- `.mobile-toolbar--scaled` — модификатор для масштабированного меню
- `.mobile-toolbar-button` — базовая кнопка с "стеклянным" эффектом
- `.marketing-button` — кнопка Telegram (синий градиент)
- `.save-button` — кнопка сохранения (зелёный градиент)
- `.theme-button` — кнопка переключения темы
- `.zoom-button` — кнопка масштаба

### Визуальное оформление

Контейнер использует полупрозрачный фон с blur-эффектом:

```css
.mobile-toolbar {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.mobile-toolbar--dark {
  background: rgba(28, 38, 58, 0.85);
}
```

Кнопки имеют аналогичный "стеклянный" эффект:
- Светлая тема: `background: rgba(255, 255, 255, 0.95)`
- Тёмная тема: `background: rgba(28, 38, 58, 0.95)`

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

### 2026-01-24
- Добавлен полупрозрачный фон с blur-эффектом на контейнер `.mobile-toolbar`
- Добавлен стиль `.mobile-toolbar--dark` для тёмной темы
- Исправлена проблема белых полупрозрачных полос между кнопками

## См. также

- [MobileHeader](./MobileHeader.md)
- [HeaderActions](./HeaderActions.md)
