# Card LOD (Level of Detail) — Minimal Mode

## Описание

При масштабе канваса ≤20% карточки переключаются в режим **minimal** (LOD): скрываются body, controls, кнопка закрытия и аватар. Остаётся только заголовок с автоподгонкой шрифта, что значительно улучшает читаемость при обзоре всей структуры.

## Триггер

- `zoomScale <= 0.20` — порог переключения (20% масштаба)
- `zoomScale` передаётся из `CanvasBoard.vue` через `provide/inject`

## Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `src/components/Canvas/CanvasBoard.vue` | `provide('zoomScale', zoomScale)` |
| `src/components/Canvas/Card.vue` | `inject`, computed (`isMinimalMode`, `shortTitle`, `titleAutoFitStyle`), template условия, CSS |

## Computed-свойства (Card.vue)

### `isMinimalMode`
```js
computed(() => zoomScale.value <= 0.20)
```
Определяет, активен ли режим minimal.

### `shortTitle`
Сокращает partner ID в заголовке:
- `RUY68240926666` → `RUY68` (11-12 цифр → оставляем 2)
- `CHN682409266661` → `CHN683` (13-14 цифр → оставляем 3)
- При `zoomScale > 0.20` возвращает оригинальный `card.text`

### `titleAutoFitStyle`
Автоматически рассчитывает `fontSize` чтобы заголовок помещался в карточку:
- Учитывает `isLargeCard` / `gold` тип для определения размеров карточки
- Диапазон: 14px — 100px
- При `zoomScale > 0.20` возвращает пустой объект (стили по умолчанию)

## Template-изменения

1. **Корневой div** — добавлен CSS-класс `card--minimal`
2. **card-title** — отображает `shortTitle` вместо `card.text`, применяет `:style="titleAutoFitStyle"`
3. **card-close-btn** — `v-if="!isMinimalMode"` (скрыта в minimal)
4. **card-body** — `v-if="!isMinimalMode"` (скрыт в minimal)
5. **card-controls** — `v-if="!isMinimalMode"` (скрыты в minimal)

## CSS (scoped)

```css
.card--minimal              → overflow: hidden
.card--minimal .card-header → height: 100%, border-radius: 8px, padding: 8px
.card--minimal .card-title  → font-weight: 900, line-height: 0.95, word-spacing: 100vw
.card--minimal .card-close-btn       → display: none !important
.card--minimal .card-avatar-container → display: none !important
.card--minimal .connection-point      → display: none !important
```

## Поведение при масштабе > 20%

Все computed возвращают значения по умолчанию:
- `isMinimalMode` = `false`
- `shortTitle` = `card.text` (без изменений)
- `titleAutoFitStyle` = `{}` (без стилей)
- Все `v-if` условия пропускают, элементы отображаются
- CSS-класс `card--minimal` не применяется

Таким образом при обычном масштабе карточки работают без изменений.
