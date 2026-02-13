# Всплывающие подсказки в меню (Menu Tooltips)

## Описание

Пункты выпадающих меню верхней панели имеют всплывающие подсказки (tooltips), объясняющие функцию простым языком для обычного пользователя.

## Как работает

1. При наведении курсора на пункт меню справа плавно появляется иконка `ⓘ` (opacity 0 -> 1, transition 0.2s)
2. При наведении на `ⓘ` справа появляется тултип с описанием функции
3. Клик по `ⓘ` НЕ вызывает действие пункта меню (`@click.stop`)
4. Тултип имеет стрелку, указывающую на иконку

## Реализация

- **Чистый CSS** — без внешних библиотек (tippy.js, popper и т.д.)
- Тултип позиционируется `position: absolute` относительно иконки `ⓘ`
- Поддержка обеих тем: светлой (light) и тёмной (modern)

## Файлы

| Файл | Что добавлено |
|------|---------------|
| `src/components/Layout/ProjectMenu.vue` | Иконка `ⓘ`, тултип `<span>`, CSS стили |
| `src/locales/ru.js` | `projectMenu.tooltips.*` — тексты подсказок (RU) |
| `src/locales/en.js` | `projectMenu.tooltips.*` — тексты подсказок (EN) |
| `src/locales/zh.js` | `projectMenu.tooltips.*` — тексты подсказок (ZH) |

## Структура шаблона

```html
<button class="project-menu__item" @click="handleItemClick(item)">
  <span class="project-menu__icon">{{ item.icon }}</span>
  <span class="project-menu__label">{{ item.label }}</span>
  <!-- Иконка ⓘ + тултип -->
  <span class="project-menu__info" @click.stop>
    ⓘ
    <span class="project-menu__tooltip">{{ item.tooltip }}</span>
  </span>
</button>
```

## CSS-классы

| Класс | Назначение |
|-------|------------|
| `.project-menu__info` | Контейнер иконки ⓘ, скрыт (`opacity: 0`), виден при hover родительского item |
| `.project-menu__tooltip` | Карточка тултипа, появляется при hover на `.project-menu__info` |
| `.project-menu__tooltip::before` | CSS-стрелка тултипа (треугольник) |

## Ключевые CSS-правила

```css
/* Иконка появляется при наведении на пункт */
.project-menu__item:hover .project-menu__info { opacity: 1; }

/* Тултип появляется при наведении на иконку */
.project-menu__info:hover .project-menu__tooltip { opacity: 1; }
```

## Как добавить тултипы в другие меню

1. Добавить ключи `tooltips.*` в `projectMenu` / `toolsMenu` / `viewMenu` / `discussionMenu` во всех 3 файлах локалей
2. Добавить поле `tooltip: t('xxxMenu.tooltips.itemKey')` к каждому пункту в `items` computed
3. Добавить в шаблон `<span class="project-menu__info" @click.stop>` с вложенным `<span class="project-menu__tooltip">`
4. Скопировать CSS-блок с классами `__info` и `__tooltip` (или вынести в общий компонент)

## Мобильная версия

Пока не реализовано. При необходимости можно добавить long press (долгое нажатие) для показа тултипа.
