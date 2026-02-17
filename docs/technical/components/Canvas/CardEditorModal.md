# Card Editor Modal

## Описание
Компактное модальное окно для редактирования параметров карточки-лицензии.
Появляется поверх карточки (того же размера), заменяет кнопки управления, ранее размещённые на каждой карточке.

## Расположение файлов
- Компонент: `src/components/Canvas/CardEditorModal.vue`
- Родитель: `src/components/Canvas/CanvasBoard.vue`
- Связанная карточка: `src/components/Canvas/Card.vue`

## Как открыть
Двойной клик (`dblclick`) на теле карточки.

**Не открывается при клике на:**
- Монетку (`.coin-icon`)
- Кнопку заметки (`.card-note-btn`)
- Кнопку удаления (`.card-close-btn`)
- В readonly-режиме доски
- Во время редактирования заголовка или PV

## Функционал
- **Аватар пользователя** (только для большой/gold лицензии) — загружается по personal_id (текст карточки)
- **Кнопка «Заметка»** (для всех типов карточек) — открывает NoteWindow/календарь
- Редактирование PV (числовой input, 30–330)
- Редактирование баланса L/R (числовые input) + кнопка сброса
- Редактирование актив-заказов L/R (числовые input) + кнопка сброса
- Отображение цикла/этапа (только чтение)

## Дизайн
- Компактный — тот же размер и позиция, что у карточки
- Позиционирование: `position: fixed` по координатам `getBoundingClientRect()` карточки
- Заголовок с именем карточки, тело с input-полями
- Ввод через `<input type="number">` (как PV), без кнопок +1/-1/+10/-10

## Технические детали

### Props
| Prop | Тип | Обязательный | Описание |
|------|------|------|------|
| `card` | Object | да | Объект карточки из cardsStore |
| `visible` | Boolean | нет (default: false) | Видимость модала |
| `cardRect` | Object | нет | `{ top, left, width, height }` — координаты карточки на экране |

### Emits
| Событие | Payload | Описание |
|---------|---------|----------|
| `close` | — | Закрытие модала |
| `update-pv` | `{ cardId, pv }` | Обновление PV карточки |
| `update-balance` | `{ cardId, left, right }` | Установка ручного баланса (абсолютные значения) |
| `clear-balance` | `{ cardId }` | Сброс ручного баланса |
| `update-active-pv` | `{ cardId, direction, step }` | Изменение Active PV (дельта от текущего) |
| `clear-active-pv` | `{ cardId }` | Очистка Active PV |
| `open-note` | `{ cardId }` | Открытие NoteWindow (календарь/заметки) для карточки |
| `open-partners` | `{ cardId }` | Открытие панели «Партнёры» (по dblclick на аватар) |

### Закрытие
- Клик на overlay (за пределами модала)
- Клавиша `Escape`
- Кнопка `x` в заголовке

### Применение изменений
Все изменения применяются **мгновенно** при `@change` на input (blur или Enter).
Анимации (valueIncrease, cardBalanceFlash, line propagation) срабатывают как раньше.

### Позиционирование
- `position: fixed` по координатам карточки (`cardRect`)
- `z-index: 10000` — поверх всех элементов canvas
- `<Teleport to="body">` для корректного z-index
- `min-width: 240px` — минимальная ширина для компактных карточек

## Архитектура обработки событий

```
CardEditorModal (emit)
  |
CanvasBoard (handler)
  |- handleEditorUpdatePv -> cardsStore.updateCard + handlePvChanged (анимация)
  |- handleEditorUpdateBalance -> cardsStore.updateCard (balanceManualOverride)
  |- handleEditorClearBalance -> сброс balanceManualOverride и manualAdjustments
  |- handleEditorUpdateActivePv -> applyActivePvDelta + applyActivePvPropagation
  |- handleEditorClearActivePv -> applyActivePvClear + applyActivePvPropagation
  |- handleEditorOpenNote -> openNoteForCard (открывает NoteWindow)
  +- handleEditorOpenPartners -> sidePanelsStore.openPartners()
```

## История изменений
- 2026-02-17: v3 — добавлен аватар пользователя для большой/gold лицензии (с загрузкой по personal_id), кнопка «Заметка» для всех типов карточек, dblclick на аватар открывает панель «Партнёры»
- 2025-02-04: v2 — компактный дизайн, позиционирование поверх карточки, числовые input вместо кнопок +/-, раздельные кнопки сброса для баланса и актива
- 2025-02-04: v1 — создан компонент для оптимизации производительности
