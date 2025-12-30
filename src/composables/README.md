# Composables

Переиспользуемые Vue 3 Composition API функции.

## Структура

### Canvas (CanvasBoard.vue)
| Файл | Назначение |
|------|------------|
| `useCanvasImageRenderer.js` | Рендеринг изображений на холст |
| `useCanvasDrag.js` | Drag & drop объектов |
| `useCanvasSelection.js` | Выделение объектов |
| `useCanvasConnections.js` | Линии связей между объектами |
| `useAvatarConnections.js` | Связи между аватарами |
| `useCanvasFocus.js` | Фокус и навигация |
| `useCanvasContextMenus.js` | Контекстные меню |
| `useActivePv.js` | Активный PV |
| `useImageResize.js` | Изменение размера изображений |
| `useNoteWindows.js` | Окна заметок |

### PencilOverlay (режим рисования)
| Файл | Назначение |
|------|------------|
| `usePencilHistory.js` | История, undo/redo |
| `usePencilSelection.js` | Выделение области |
| `usePencilDrawing.js` | Кисть, маркер, ластик |
| `usePencilImages.js` | Временные изображения |
| `usePencilZoom.js` | Зум и панорамирование |

### UserProfile
| Файл | Назначение |
|------|------------|
| `useUserVerification.js` | Верификация пользователя |
| `useUserPersonalInfo.js` | Личные данные |
| `useUserAvatar.js` | Аватар пользователя |
| `useUserTariffs.js` | Тарифные планы |
| `useUserPrivacy.js` | Настройки приватности |
| `useUserLimits.js` | Лимиты ресурсов |
| `useUserSocial.js` | Социальные сети |
| `useUserPromo.js` | Промокоды |

### Общие
| Файл | Назначение |
|------|------------|
| `useImageProxy.js` | Прокси для изображений |

## Использование
```javascript
import { useCanvasDrag } from '@/composables/useCanvasDrag'

const { startDrag, onDrag, endDrag } = useCanvasDrag({
  canvasRef,
  objects,
  onUpdate
})
```

## Документация

Детальная документация: `docs/technical/composables/`
