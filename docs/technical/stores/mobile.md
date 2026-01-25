# Mobile Store

Store для управления мобильной версией приложения и мобильными настройками.

## Расположение

```
src/stores/mobile.js
```

## Описание

`useMobileStore` — Pinia store для управления состоянием мобильной версии приложения, включая:
- Определение типа устройства (мобильное/десктопное)
- Принудительное переключение между мобильным и десктопным режимами
- Управление масштабом элементов мобильного меню
- Режим выделения объектов для мобильной версии

## State

| Свойство | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `isMobileDevice` | `Ref<Boolean>` | `false` | Определяется ли устройство как мобильное (автоматическая детекция) |
| `forceMobileMode` | `Ref<Boolean>` | `false` | Пользователь принудительно включил мобильную версию |
| `forceDesktopMode` | `Ref<Boolean>` | `false` | Пользователь принудительно включил десктопную версию |
| `menuScale` | `Ref<Number>` | `1` | Текущий масштаб элементов мобильного меню (1-2) |
| `showMobileDialog` | `Ref<Boolean>` | `false` | Показывать ли диалог о мобильной версии |
| `isSelectionMode` | `Ref<Boolean>` | `false` | Режим выделения для мобильной версии |

## Computed

| Свойство | Тип | Описание |
|----------|-----|----------|
| `isMobileMode` | `Computed<Boolean>` | Текущий активный режим (учитывает принудительные переключения) |
| `isMenuScaled` | `Computed<Boolean>` | Масштабировано ли меню (> 1.01) |

## Methods

### detectDevice()

Определяет тип устройства на основе:
- Размера экрана (≤ 768px)
- User Agent
- Поддержки touch событий

### switchToMobile()

Переключает на мобильную версию принудительно.

### switchToDesktop()

Переключает на десктопную версию принудительно.

### closeMobileDialog()

Закрывает диалог о мобильной версии.

### setMenuScale(value)

Устанавливает масштаб меню (1-2). Значение сохраняется в localStorage.

**Параметры:**
- `value` (Number) — новый масштаб (будет ограничен диапазоном 1-2)

### resetMenuScale()

Сбрасывает масштаб меню на значение по умолчанию (1).

### toggleSelectionMode()

Переключает режим выделения (вкл/выкл).

### setSelectionMode(value)

Устанавливает режим выделения.

**Параметры:**
- `value` (Boolean) — включить (true) или выключить (false) режим выделения

## Логика определения режима

Вычисляемое свойство `isMobileMode` определяет активный режим по следующему приоритету:

1. Если `forceDesktopMode === true` → **Desktop режим**
2. Иначе если `forceMobileMode === true` → **Mobile режим**
3. Иначе → используется значение `isMobileDevice` (автоматическая детекция)

## Режим выделения

**Назначение:** В мобильной версии разделяет функции выделения объектов и перемещения холста (pan).

**Поведение:**
- Когда `isSelectionMode === false` (по умолчанию):
  - Долгое нажатие на пустую область → перемещение холста
  - Выделение рамкой отключено

- Когда `isSelectionMode === true`:
  - Долгое нажатие на пустую область → выделение рамкой (как на десктопе)
  - Перемещение холста работает только жестом с двумя пальцами

**Использование:**
```javascript
import { useMobileStore } from '@/stores/mobile'

const mobileStore = useMobileStore()

// Включить режим выделения
mobileStore.setSelectionMode(true)

// Переключить режим
mobileStore.toggleSelectionMode()

// Проверить состояние
if (mobileStore.isSelectionMode) {
  // Режим выделения включен
}
```

## LocalStorage

Store сохраняет масштаб меню в localStorage:

| Ключ | Значение | Описание |
|------|----------|----------|
| `fohow_mobile_menu_scale` | `String` (число) | Текущий масштаб меню (1-2) |

## Примеры использования

### Проверка мобильного режима

```javascript
import { useMobileStore } from '@/stores/mobile'
import { storeToRefs } from 'pinia'

const mobileStore = useMobileStore()
const { isMobileMode } = storeToRefs(mobileStore)

if (isMobileMode.value) {
  // Мобильная версия активна
}
```

### Управление масштабом меню

```javascript
const mobileStore = useMobileStore()

// Установить масштаб 1.5x
mobileStore.setMenuScale(1.5)

// Сбросить на 1x
mobileStore.resetMenuScale()
```

### Переключение режимов

```javascript
const mobileStore = useMobileStore()

// Принудительно включить мобильную версию
mobileStore.switchToMobile()

// Принудительно включить десктопную версию
mobileStore.switchToDesktop()
```

## История изменений

### 2026-01-25
- Добавлено состояние `isSelectionMode` для управления режимом выделения в мобильной версии
- Добавлены методы `toggleSelectionMode()` и `setSelectionMode(value)`
- Режим выделения по умолчанию выключен, чтобы не конфликтовать с перемещением холста

## См. также

- [MobileHeader](../components/Layout/MobileHeader.md)
- [MobileToolbar](../components/Layout/MobileToolbar.md)
- [CanvasBoard](../components/Canvas/CanvasBoard.md)
