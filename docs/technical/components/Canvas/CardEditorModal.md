# Card Editor Modal

## Описание
Модальное окно для редактирования параметров карточки-лицензии.
Заменяет кнопки управления (+1, +10, -10, -1, очистка), ранее размещённые на каждой карточке.

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
- Редактирование PV (левое значение, 30–330)
- Управление балансом L/R через кнопки -10, -1, +1, +10
- Управление актив-заказами L/R через кнопки -10, -1, +1, +10
- Очистка всех значений актив-заказов
- Отображение цикла/этапа (только чтение)

## Технические детали

### Props
| Prop | Тип | Обязательный | Описание |
|------|------|------|------|
| `card` | Object | да | Объект карточки из cardsStore |
| `visible` | Boolean | нет (default: false) | Видимость модала |

### Emits
| Событие | Payload | Описание |
|---------|---------|----------|
| `close` | — | Закрытие модала |
| `update-pv` | `{ cardId, pv }` | Обновление PV карточки |
| `update-balance` | `{ cardId, rawText }` | Обновление ручного баланса |
| `update-active-pv` | `{ cardId, direction, step }` | Изменение Active PV (+1, -10 и т.д.) |
| `clear-active-pv` | `{ cardId }` | Очистка Active PV |

### Закрытие
- Клик на backdrop (за пределами модала)
- Клавиша `Escape`
- Кнопка `×` в заголовке

### Применение изменений
Все изменения применяются **мгновенно** — без кнопки "Сохранить".
Анимации (valueIncrease, cardBalanceFlash, line propagation) срабатывают как раньше.

### Позиционирование
- `position: fixed` по центру экрана через flexbox
- `z-index: 10000` — поверх всех элементов canvas
- Используется `<Teleport to="body">` для корректного z-index

## Архитектура обработки событий

```
CardEditorModal (emit)
  ↓
CanvasBoard (handler)
  ├─ handleEditorUpdatePv → cardsStore.updateCard + handlePvChanged (анимация)
  ├─ handleEditorUpdateBalance → cardsStore.updateCard (ручной баланс)
  ├─ handleEditorUpdateActivePv → applyActivePvDelta + applyActivePvPropagation
  └─ handleEditorClearActivePv → applyActivePvClear + applyActivePvPropagation
```

## История изменений
- 2025-02-04: Создан компонент для оптимизации производительности (снижение количества DOM-элементов на карточке)
