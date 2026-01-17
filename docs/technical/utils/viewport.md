# viewport.js

> Утилиты для работы с viewport и canvas координатами

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/utils/viewport.js` |
| **Размер** | ~180 строк |
| **Создан** | Январь 2026 |
| **Зависимости** | Нет |

## Назначение

Модуль предоставляет функции для преобразования координат между viewport (экранными) и canvas (внутренними) системами координат с учетом zoom и pan.

Основные задачи:
- Разбор CSS transform строк
- Вычисление позиции для вставки объектов в видимую область viewport
- Вычисление смещения для позиционирования шаблонов

## API

### parseCanvasTransform(transformValue)

Разбирает CSS transform строку и извлекает параметры трансформации.

**Параметры:**
- `transformValue` (string) - CSS transform значение (например, `"translate(100px, 200px) scale(1.5)"`)

**Возвращает:**
```javascript
{
  scale: number,      // Масштаб (по умолчанию 1)
  translateX: number, // Смещение по X (по умолчанию 0)
  translateY: number  // Смещение по Y (по умолчанию 0)
}
```

**Поддерживаемые форматы:**
1. `DOMMatrixReadOnly` (современные браузеры)
2. `matrix(a, b, c, d, e, f)` - CSS matrix формат
3. `translate(x, y) scale(s)` - отдельные функции

**Пример:**
```javascript
import { parseCanvasTransform } from '@/utils/viewport'

const transform = 'translate(100px, 200px) scale(1.5)'
const { scale, translateX, translateY } = parseCanvasTransform(transform)
// { scale: 1.5, translateX: 100, translateY: 200 }
```

### getViewportAnchoredPosition(objectWidth, objectHeight)

Вычисляет позицию в canvas координатах для вставки объекта в нижний левый угол viewport.

**Алгоритм:**
1. Получает размеры viewport (`.canvas-container`)
2. Извлекает текущие параметры transform (scale, translateX, translateY)
3. Вычисляет экранные координаты нижнего левого угла с отступом `CANVAS_SAFE_MARGIN = 32px`
4. Преобразует экранные координаты в canvas координаты

**Формула преобразования viewport → canvas:**
```javascript
canvasX = (viewportX - translateX) / scale
canvasY = (viewportY - translateY) / scale - objectHeight
```

**Параметры:**
- `objectWidth` (number, optional) - Ширина объекта (для будущего использования, по умолчанию 0)
- `objectHeight` (number, optional) - Высота объекта (вычитается из Y, по умолчанию 0)

**Возвращает:**
```javascript
{
  x: number, // Координата X в canvas
  y: number  // Координата Y в canvas
} | null     // null если элементы не найдены
```

**Пример:**
```javascript
import { getViewportAnchoredPosition } from '@/utils/viewport'

const cardWidth = 418
const cardHeight = 280
const position = getViewportAnchoredPosition(cardWidth, cardHeight)
// { x: 45, y: 512 } - координаты в canvas для вставки в нижний левый угол
```

### calculateTemplateOffset(templateCards)

Вычисляет смещение для позиционирования шаблона в нижнем левом углу viewport.

**Алгоритм:**
1. Находит минимальный X (самая левая карточка) и максимальный Y (самая нижняя карточка)
2. Находит карточку, которая ближе всего к точке (`minX`, `maxY`) - это левая нижняя карточка шаблона
3. Получает целевую позицию для этой конкретной карточки через `getViewportAnchoredPosition()`
4. Вычисляет смещение `dx = targetX - leftBottomCard.x`, `dy = targetY - leftBottomCard.y`

**Параметры:**
- `templateCards` (Array) - Массив карточек шаблона с координатами x, y

**Возвращает:**
```javascript
{
  dx: number, // Смещение по X
  dy: number  // Смещение по Y
} | null      // null если нет карточек или невалидные данные
```

**Пример:**
```javascript
import { calculateTemplateOffset } from '@/utils/viewport'

const templateData = {
  cards: [
    { id: '1', x: 100, y: 200, width: 418, height: 280 },  // верхняя левая
    { id: '2', x: 150, y: 500, width: 418, height: 280 },  // средняя
    { id: '3', x: 200, y: 800, width: 418, height: 280 }   // нижняя правая
  ]
}

// Функция находит карточку с id='1' (minX=100, maxY=800, ближайшая к (100,800))
// и позиционирует её в левый нижний угол viewport
const offset = calculateTemplateOffset(templateData.cards)
// { dx: -55, dy: -488 } - смещение для позиционирования левой нижней карточки

// Применение смещения ко ВСЕМ карточкам шаблона
templateData.cards.forEach(card => {
  card.x += offset.dx
  card.y += offset.dy
})
// Теперь левая нижняя карточка шаблона находится в левом нижнем углу viewport
// и все остальные карточки сохранили относительное расположение
```

## Константы

### CANVAS_SAFE_MARGIN

Отступ от края viewport при позиционировании объектов (в пикселях).

```javascript
const CANVAS_SAFE_MARGIN = 32
```

Используется для того, чтобы вставляемые объекты не прилипали вплотную к краям видимой области.

## Использование в проекте

### 1. Добавление лицензии (stores/cards.js)

```javascript
import { getViewportAnchoredPosition } from '../utils/viewport'

// В функции addCard()
const viewportPosition = getViewportAnchoredPosition(widthForPlacement, heightForPlacement)
const defaultX = viewportPosition?.x ?? 320
const defaultY = viewportPosition?.y ?? 160
```

Каждая новая лицензия добавляется в нижний левый угол видимой области, независимо от текущего zoom/pan.

### 2. Вставка шаблонов (HeaderActions.vue, MobileSidebar.vue)

```javascript
import { calculateTemplateOffset } from '../../utils/viewport'

function insertTemplate(templateData) {
  // Вычисляем смещение для позиционирования шаблона в viewport
  const offset = calculateTemplateOffset(templateData.cards)
  const dx = offset?.dx ?? 0
  const dy = offset?.dy ?? 0

  templateData.cards.forEach(cardDef => {
    // Применяем смещение к координатам карточки
    const adjustedPayload = { ...cardPayload }
    if (Number.isFinite(cardPayload.x)) {
      adjustedPayload.x = cardPayload.x + dx
    }
    if (Number.isFinite(cardPayload.y)) {
      adjustedPayload.y = cardPayload.y + dy
    }

    cardsStore.addCard({
      type,
      ...adjustedPayload,
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })
  })
}
```

Весь шаблон вставляется в нижний левый угол видимой области, сохраняя относительное расположение карточек.

## Координатные системы

### Viewport (экранные координаты)

- Начало координат: верхний левый угол `.canvas-container`
- Единицы: пиксели экрана
- Не зависят от zoom/pan
- Используются для позиционирования UI элементов

### Canvas (внутренние координаты)

- Начало координат: верхний левый угол `.canvas-content`
- Единицы: пиксели canvas
- Зависят от zoom/pan (transform)
- Используются для позиционирования карточек и других объектов

### Преобразование координат

**Viewport → Canvas:**
```javascript
canvasX = (viewportX - translateX) / scale
canvasY = (viewportY - translateY) / scale
```

**Canvas → Viewport:**
```javascript
viewportX = canvasX * scale + translateX
viewportY = canvasY * scale + translateY
```

## Диаграмма

```
┌────────────────────────────────────────┐
│  Viewport (.canvas-container)          │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │  Canvas (.canvas-content)        │  │
│  │  transform: translate(tx, ty)    │  │
│  │            scale(s)               │  │
│  │                                  │  │
│  │  ┌─────┐                         │  │
│  │  │Card │ (canvas coords)          │  │
│  │  └─────┘                         │  │
│  │                                  │  │
│  │                    ┌──────────┐  │  │
│  │                    │ Viewport │  │  │
│  │                    │ Anchor   │  │  │
│  │                    │ (32px    │  │  │
│  │                    │  margin) │  │  │
│  └────────────────────┴──────────┴──┘  │
└────────────────────────────────────────┘
```

## История изменений

### 2026-01-17 (v2): Исправление алгоритма позиционирования шаблонов

**Проблема:** Шаблоны позиционировались некорректно - часть карточек выходила за пределы экрана снизу.

**Причина:** Алгоритм `calculateTemplateOffset` находил минимальный Y (верхняя карточка) вместо максимального Y (нижняя карточка).

**Исправление:**
- Изменен алгоритм поиска левой нижней карточки: теперь ищется карточка, ближайшая к точке (`minX`, `maxY`)
- Вместо `minY` теперь используется `maxY` (самая нижняя карточка)
- Позиционирование происходит относительно конкретной левой нижней карточки, а не абстрактных минимальных координат

**Результат:**
- Левая нижняя карточка шаблона точно позиционируется в левый нижний угол viewport
- Все карточки шаблона остаются в видимой области
- Относительное расположение карточек сохраняется

### 2026-01-17 (v1): Создание модуля viewport.js

**Цель:** Реализовать вставку шаблонов в видимую область viewport (нижний левый угол) независимо от zoom/pan.

**Изменения:**
- Создан новый модуль `src/utils/viewport.js`
- Вынесены функции `parseCanvasTransform` и `getViewportAnchoredPosition` из `stores/cards.js`
- Добавлена новая функция `calculateTemplateOffset` для вычисления смещения шаблонов
- Обновлены `HeaderActions.vue` и `MobileSidebar.vue` для использования новой логики
- Обновлен `stores/cards.js` для импорта функций из утилит

**Поведение до изменений:**
- Шаблоны вставлялись в фиксированное место canvas (координаты из JSON файла)
- При zoom/pan шаблоны могли появляться за пределами видимой области

**Поведение после изменений:**
- Шаблоны всегда вставляются в нижний левый угол видимой области viewport
- Работает корректно при любом zoom/pan
- Сохраняется относительное расположение карточек внутри шаблона

## Best Practices

1. **Использование fallback значений**
   ```javascript
   const position = getViewportAnchoredPosition(width, height)
   const x = position?.x ?? defaultX
   const y = position?.y ?? defaultY
   ```

2. **Проверка координат перед применением смещения**
   ```javascript
   if (Number.isFinite(card.x)) {
     card.x += dx
   }
   if (Number.isFinite(card.y)) {
     card.y += dy
   }
   ```

3. **Округление координат**
   - Функции автоматически округляют результаты через `Math.round()`
   - Предотвращает субпиксельное позиционирование и размытие

4. **Безопасность при отсутствии DOM**
   - Все функции проверяют наличие `window` и `document`
   - Возвращают `null` если элементы не найдены

## Связанные файлы

- `src/stores/cards.js` - использует `getViewportAnchoredPosition` для добавления лицензий
- `src/components/Layout/HeaderActions.vue` - использует `calculateTemplateOffset` для вставки шаблонов
- `src/components/Layout/MobileSidebar.vue` - использует `calculateTemplateOffset` для вставки шаблонов
- `src/composables/usePanZoom.js` - управляет zoom/pan, которые учитываются при преобразовании координат
- `docs/technical/composables/usePanZoom.md` - документация по zoom/pan
