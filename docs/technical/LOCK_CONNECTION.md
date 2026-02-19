# Блокировка соединений (Lock Connection)

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Создан** | Февраль 2026 |
| **Затронутые файлы** | `stores/connections.js`, `utils/calculationEngine.js`, `composables/useActivePv.js`, `components/Canvas/CanvasBoard.vue` |

## Назначение

Позволяет пользователю заблокировать соединение между карточками двойным кликом. Через заблокированное соединение данные не передаются (баллы PV 330), как будто соединения нет. Линия остаётся видимой для визуальной связки и авто-раскладки.

## Как работает

### Блокировка (двойной клик по линии)
1. Соединение получает `locked: true`
2. Линия становится **сплошной красной** с SVG-иконкой замка посередине
3. `Engine.recalc()` пересчитывает баллы — заблокированное соединение исключается из `parentOf`
4. Active PV **НЕ пересчитывается** — соединение работает как удалённое для расчётов

### Разблокировка (повторный двойной клик)
1. Соединение получает `locked: false`
2. Линия возвращается к обычному виду
3. `Engine.recalc()` пересчитывает баллы с учётом восстановленного соединения
4. Active PV **НЕ пересчитывается** — соединение работает как только что нарисованное

## Модель данных

### Поле `locked` в соединении (`stores/connections.js`)

```javascript
{
  id: '...',
  from: 'card-1',
  to: 'card-2',
  fromSide: 'right',
  toSide: 'left',
  color: '#0f62fe',
  thickness: 5,
  locked: false  // true = заблокировано
}
```

Сохраняется в JSONB при сохранении доски и восстанавливается при загрузке через `loadConnections()`.

## Фильтрация в Engine

В `calculationEngine.js` функция `calculateBalls()` фильтрует заблокированные линии:

```javascript
const activeLines = lines.filter(line => !line.locked);
```

Таким образом `parentOf` не включает связи через заблокированные соединения.

## Визуальное отображение

### CSS класс `.line--locked`
```css
.line--locked {
  stroke: #dc2626 !important;
  stroke-dasharray: none !important;
  filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.4));
  opacity: 0.85;
}
```

### SVG иконка замка
Белый квадрат 32x32 с красной рамкой и SVG-иконкой замка посередине линии.

## Анимации

Заблокированные соединения исключаются из анимаций:
- `animateBalancePropagation()` — не ищет путь через locked соединения
- `highlightActivePvChange()` — не подсвечивает locked соединения

## Связанные файлы

- `src/stores/connections.js` — модель данных, `locked` поле
- `src/utils/calculationEngine.js` — фильтрация locked при расчёте `parentOf`
- `src/composables/useActivePv.js` — фильтрация locked в анимациях
- `src/components/Canvas/CanvasBoard.vue` — dblclick обработчик, SVG рендеринг, CSS
