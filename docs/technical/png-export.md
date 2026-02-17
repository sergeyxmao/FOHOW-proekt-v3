# Сохранить как картинку (PNG Export)

## Обзор

Функция "Сохранить как картинку" экспортирует доску в формате PNG с двумя режимами: **Печать** (A4/A3 для принтера) и **Мессенджер** (оптимальный размер для Telegram/WhatsApp). Интерфейс упрощён — без технических параметров (DPI, пиксели).

## Файлы

- **[src/components/ExportSettingsModal.vue](../../src/components/ExportSettingsModal.vue)** — UI модального окна с двумя режимами
- **[src/composables/useProjectActions.js](../../src/composables/useProjectActions.js)** — функция `handleExportPNG()` (логика экспорта)
- **[src/components/Layout/ProjectMenu.vue](../../src/components/Layout/ProjectMenu.vue)** — пункт меню "Сохранить как картинку"

## Доступность

- **Все пользователи** — доступно (пункт `export-png` в меню)
- **Guest** — чекбоксы "Скрыть содержимое" и "Ч/Б (контур)" недоступны (disabled)

## Режимы

### Печать (Print)

Для печати схемы на принтере или сохранения в высоком качестве.

| Параметр | Значение |
|----------|----------|
| Формат | A4 (210×297 мм) или A3 (297×420 мм) |
| Ориентация | Книжная / Альбомная (по умолчанию альбомная) |
| DPI | 300 (фиксированный, не показывается в UI) |
| Область | Вся схема (админ) / Видимая область (пользователь) |

**emit payload:**
```javascript
{
  format: 'a3',           // 'a4' или 'a3'
  width: 297,             // ширина в мм
  height: 420,            // высота в мм
  orientation: 'landscape',
  dpi: 300,
  exportOnlyVisible: false, // true для не-админов
  hideContent: false,
  blackAndWhite: false
}
```

### Мессенджер (Messenger)

Для отправки в Telegram, WhatsApp и другие чаты. Оптимальный размер — только видимая область, масштаб 2x.

**emit payload:**
```javascript
{
  format: 'original',
  exportOnlyVisible: true,
  hideContent: false,
  blackAndWhite: false
}
```

## Общие опции

| Опция | Описание | Ограничение |
|-------|----------|-------------|
| Скрыть содержимое | Скрывает текстовое содержимое карточек | Guest — disabled |
| Ч/Б (контур) | Чёрно-белый режим, только контуры | Guest — disabled |

## UI компонент

### Состояние

```javascript
const mode = ref('print')              // 'print' | 'messenger'
const selectedFormat = ref('a3')       // 'a4' | 'a3'
const selectedOrientation = ref('landscape')  // 'portrait' | 'landscape'
const hideContent = ref(false)
const blackAndWhite = ref(false)
```

### Структура template

```
export-settings-panel
├── header (заголовок + кнопка закрытия)
├── body
│   ├── mode-tabs (Печать / Мессенджер)
│   ├── [print] format-buttons (A4 / A3)
│   ├── [print] orientation-buttons (Книжная / Альбомная)
│   ├── [messenger] messenger-hint (описание)
│   └── checkbox-group (Скрыть содержимое, Ч/Б)
└── footer (Отмена / Сохранить)
```

### Events

- `close` — закрытие модального окна
- `export` — экспорт с объектом настроек (обрабатывается `handleExportPNG()` из `useProjectActions.js`)

## Локализация

Все тексты через i18n. Ключи:

| Ключ | RU | EN | ZH |
|------|----|----|-----|
| `saveAsImage.title` | Сохранить как картинку | Save as image | 保存为图片 |
| `saveAsImage.forPrint` | Печать | Print | 打印 |
| `saveAsImage.forMessenger` | Мессенджер | Messenger | 聊天 |
| `saveAsImage.export` | Сохранить | Save | 保存 |

Пункт меню: `projectMenu.saveAsImage` / `projectMenu.tooltips.saveAsImage`

## Техническая цепочка

1. Пользователь нажимает "Сохранить как картинку" в ProjectMenu
2. Открывается ExportSettingsModal.vue
3. Пользователь выбирает режим и настройки
4. Нажимает "Сохранить" → `emit('export', payload)`
5. Родительский компонент передаёт payload в `handleExportPNG()` из `useProjectActions.js`
6. `handleExportPNG()` использует html2canvas для рендеринга PNG

## См. также

- [src/composables/useProjectActions.js](../../src/composables/useProjectActions.js) — логика экспорта PNG
- [docs/technical/svg-export.md](./svg-export.md) — SVG-экспорт (векторный, для печати баннеров)
- [docs/technical/html-export.md](./html-export.md) — HTML-экспорт (интерактивный, для просмотра в браузере)

## История изменений

### 2026-02-18
- Переработка UI: два режима "Печать" / "Мессенджер" вместо технических параметров
- Переименование: "Экспорт в PNG" → "Сохранить как картинку"
- Все тексты через i18n (`t('saveAsImage.xxx')`)
- Убраны: DPI-селектор, пиксельное разрешение, форматы A2/A1, блок "Итоговое разрешение"
- Убраны: `selectedDPI`, `dpiOptions`, `isDpiAvailable`, `viewportSize`, `contentSize`, `targetResolution`, resize listener
- Убрана зависимость от `useCardsStore` (больше не нужна)
- Формат по умолчанию: A3 (вместо A4), ориентация по умолчанию: альбомная (вместо книжной)
- Исправлен баг в `handleExportPNG()`: SVG-слой не восстанавливался после экспорта (overflow, width/height/viewBox атрибуты оставались)
- Исправлен баг: catch-блок не восстанавливал tempStyles, изображения, transform/position при ошибке экспорта
- Переменные для восстановления DOM вынесены на уровень функции для доступа в catch
- Кнопка экспорта: "Экспорт" → "Сохранить"
