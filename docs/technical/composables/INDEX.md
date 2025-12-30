# Composables — Оглавление

> Детальная документация для каждого composable, созданного при рефакторинге CanvasBoard.vue

## Обзор

Все composables находятся в `src/composables/` и представляют собой 
переиспользуемые функции с реактивным состоянием (Vue 3 Composition API).

## Список composables

### Рендеринг и отрисовка

| Файл | Документация | Описание |
|------|--------------|----------|
| useCanvasImageRenderer.js | [📄 Документация](useCanvasImageRenderer.md) | Рендеринг изображений на Canvas2D, кэширование, виртуализация |

### Взаимодействие с объектами

| Файл | Документация | Описание |
|------|--------------|----------|
| useCanvasDrag.js | [📄 Документация](useCanvasDrag.md) | Drag & drop карточек, стикеров, изображений |
| useCanvasSelection.js | [📄 Документация](useCanvasSelection.md) | Выделение объектов рамкой |
| useImageResize.js | [📄 Документация](useImageResize.md) | Изменение размера изображений |
| useCanvasFocus.js | [📄 Документация](useCanvasFocus.md) | Центрирование viewport на объектах |

### Соединения

| Файл | Документация | Описание |
|------|--------------|----------|
| useCanvasConnections.js | [📄 Документация](useCanvasConnections.md) | Линии между карточками |
| useAvatarConnections.js | [📄 Документация](useAvatarConnections.md) | Соединения между аватарами |

### Бизнес-логика

| Файл | Документация | Описание |
|------|--------------|----------|
| useActivePv.js | [📄 Документация](useActivePv.md) | Логика Active PV, анимации баланса |
| useNoteWindows.js | [📄 Документация](useNoteWindows.md) | Окна заметок карточек |

### UI

| Файл | Документация | Описание |
|------|--------------|----------|
| useCanvasContextMenus.js | [📄 Документация](useCanvasContextMenus.md) | Контекстные меню |

### PencilOverlay (режим рисования)

| Файл | Документация | Описание |
|------|--------------|----------|
| usePencilHistory.js | [📄 Документация](usePencilHistory.md) | История рисования, undo/redo |
| usePencilSelection.js | [📄 Документация](usePencilSelection.md) | Выделение области на canvas |
| usePencilDrawing.js | [📄 Документация](usePencilDrawing.md) | Инструменты рисования (кисть, маркер, ластик) |
| usePencilImages.js | [📄 Документация](usePencilImages.md) | Размещение временных изображений |
| usePencilZoom.js | [📄 Документация](usePencilZoom.md) | Зум и панорамирование |

### Утилиты и вспомогательные

| Файл | Документация | Описание |
|------|--------------|----------|
| useBezierCurves.js | — | Работа с кривыми Безье для соединений аватаров |
| useKeyboardShortcuts.js | — | Горячие клавиши (Ctrl+Z/Y для undo/redo) |
| usePanZoom.js | — | Панорамирование и зум canvas |
| useMobileUIScaleGesture.js | — | Жест масштабирования UI в мобильной версии |
| useImageProxy.js | — | Прокси для загрузки изображений с JWT токеном |
| useProjectActions.js | — | Экспорт проектов (PNG, JSON, PDF) |

### UserProfile (профиль пользователя)

| Файл | Документация | Описание |
|------|--------------|----------|
| useUserAvatar.js | [📄 Документация](useUserAvatar.md) | Загрузка, обрезка, удаление аватара |
| useUserVerification.js | [📄 Документация](useUserVerification.md) | Верификация пользователя, история запросов |
| useUserPersonalInfo.js | [📄 Документация](useUserPersonalInfo.md) | Персональные данные, офис, компьютерный номер |
| useUserSocial.js | [📄 Документация](useUserSocial.md) | Социальные сети пользователя |
| useUserPrivacy.js | [📄 Документация](useUserPrivacy.md) | Настройки конфиденциальности |
| useUserLimits.js | [📄 Документация](useUserLimits.md) | Лимиты ресурсов и библиотеки изображений |
| useUserTariffs.js | [📄 Документация](useUserTariffs.md) | Тарифные планы и переход между ними |
| useUserPromo.js | [📄 Документация](useUserPromo.md) | Применение промокодов |

## Статистика

| Composable | Строк | Сложность |
|------------|-------|-----------|
| **CanvasBoard composables** | | |
| useCanvasImageRenderer.js | ~700 | 🔴 Высокая |
| useAvatarConnections.js | ~688 | 🔴 Высокая |
| useCanvasDrag.js | ~636 | 🔴 Высокая |
| useActivePv.js | ~450 | 🟠 Средняя |
| useCanvasSelection.js | ~373 | 🟠 Средняя |
| useImageResize.js | ~369 | 🟠 Средняя |
| useCanvasConnections.js | ~226 | 🟢 Низкая |
| useCanvasFocus.js | ~180 | 🟢 Низкая |
| useNoteWindows.js | ~170 | 🟢 Низкая |
| useCanvasContextMenus.js | ~151 | 🟢 Низкая |
| **Итого CanvasBoard** | **~3943** | |
| | | |
| **UserProfile composables** | | |
| useUserVerification.js | ~455 | 🟠 Средняя |
| useUserPersonalInfo.js | ~441 | 🟠 Средняя |
| useUserAvatar.js | ~245 | 🟢 Низкая |
| useUserTariffs.js | ~180 | 🟢 Низкая |
| useUserPrivacy.js | ~114 | 🟢 Низкая |
| useUserLimits.js | ~96 | 🟢 Низкая |
| useUserSocial.js | ~77 | 🟢 Низкая |
| useUserPromo.js | ~73 | 🟢 Низкая |
| **Итого UserProfile** | **~1681** | |
| | | |
| **PencilOverlay composables** | | |
| usePencilSelection.js | ~290 | 🟠 Средняя |
| usePencilImages.js | ~250 | 🟠 Средняя |
| usePencilHistory.js | ~230 | 🟢 Низкая |
| usePencilDrawing.js | ~190 | 🟢 Низкая |
| usePencilZoom.js | ~180 | 🟢 Низкая |
| **Итого PencilOverlay** | **~1140** | |
| | | |
| **Всего** | **~6764** | |

## Архитектура

```
CanvasBoard.vue (оркестратор)
        │
        ├─── useCanvasImageRenderer ──→ Canvas2D рендеринг
        │
        ├─── useCanvasDrag ───────────→ Перемещение объектов
        │         │
        │         └─── activeGuides (snap к направляющим)
        │
        ├─── useCanvasSelection ──────→ Выделение рамкой
        │
        ├─── useImageResize ──────────→ Изменение размера
        │
        ├─── useCanvasConnections ────→ Линии карточек
        │
        ├─── useAvatarConnections ────→ Линии аватаров
        │         │
        │         └─── useBezierCurves (математика)
        │
        ├─── useActivePv ─────────────→ PV логика
        │
        ├─── useCanvasFocus ──────────→ Фокусировка
        │         │
        │         └─── usePanZoom (зум/pan)
        │
        ├─── useNoteWindows ──────────→ Заметки
        │
        └─── useCanvasContextMenus ───→ Контекстные меню
```

```
UserProfile.vue (оркестратор)
        │
        ├─── useUserAvatar ──────────→ Аватар (загрузка, обрезка, удаление)
        │         │
        │         └─── CropperJS (обрезка изображений)
        │
        ├─── useUserVerification ────→ Верификация пользователя
        │         │
        │         └─── cooldown timer (защита от спама)
        │
        ├─── useUserPersonalInfo ────→ Персональные данные
        │         │
        │         └─── office/personal_id валидация
        │
        ├─── useUserSocial ──────────→ Социальные сети
        │
        ├─── useUserPrivacy ─────────→ Настройки конфиденциальности
        │
        ├─── useUserLimits ──────────→ Лимиты ресурсов
        │         │
        │         └─── imageService (статистика)
        │
        ├─── useUserTariffs ─────────→ Тарифные планы
        │
        └─── useUserPromo ───────────→ Промокоды
```

```
PencilOverlay.vue (оркестратор)
        │
        ├─── usePencilZoom ──────────→ Зум и панорамирование
        │
        ├─── usePencilDrawing ───────→ Инструменты рисования
        │         │
        │         └─── brush/marker/eraser
        │
        ├─── usePencilHistory ───────→ История (undo/redo)
        │
        ├─── usePencilSelection ─────→ Выделение области
        │
        └─── usePencilImages ────────→ Временные изображения
                  │
                  └─── buildPlacedImage (utils)
```

## Паттерн использования

```javascript
// 1. Импорт
import { useCanvasDrag } from '@/composables/useCanvasDrag'

// 2. Инициализация с зависимостями
const {
  dragState,
  startDrag,
  handleDrag,
  endDrag,
} = useCanvasDrag({
  cardsStore,
  stickersStore,
  imagesStore,
  // ... другие зависимости
})

// 3. Использование в template через return или напрямую
<div @mousedown="(e) => startDrag(e, targets)">
```

## Общие принципы

1. **Единственная ответственность** — каждый composable делает одну вещь
2. **Инъекция зависимостей** — stores и функции передаются параметрами
3. **Реактивность** — используются ref/computed для состояния
4. **Чистые функции** — минимум side effects
5. **Throttling** — для частых событий (mousemove) используется throttle
