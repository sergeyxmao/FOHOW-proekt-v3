import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useHistoryStore } from '../stores/history'

export function useKeyboardShortcuts(options = {}) {
  const historyStore = useHistoryStore()
  
  // Определяем операционную систему для правильного отображения клавиш
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const ctrlKey = isMac ? 'metaKey' : 'ctrlKey'
  
  // Состояние для визуальной обратной связи
  const undoButtonHighlight = ref(false)
  const redoButtonHighlight = ref(false)
  
  // Опции для настройки
  const {
    enabled: initialEnabled = true,
    preventDefault = true,
    visualFeedback = true,
    feedbackDuration = 300,
    disableOnInput = true
  } = options
  
  // Реактивное состояние для включения/выключения горячих клавиш
  const enabled = ref(initialEnabled)
  
  // Проверка, находится ли фокус в поле ввода
  const isInputElement = (event) => {
    const target = event.target
    const tagName = target.tagName.toLowerCase()
    const isInput = tagName === 'input' || tagName === 'textarea' || target.contentEditable === 'true'
    
    // Исключаем некоторые комбинации, которые должны работать даже в полях ввода
    if (disableOnInput && isInput) {
      // Разрешаем hotkeys только если не зажат Shift (для Ctrl+Shift+Z)
      if (!event.shiftKey) {
        return true
      }
    }
    
    return false
  }
 
  
  // Функция для подсветки кнопки
  const highlightButton = (buttonType) => {
    if (!visualFeedback) return
    
    if (buttonType === 'undo') {
      undoButtonHighlight.value = true
      setTimeout(() => {
        undoButtonHighlight.value = false
      }, feedbackDuration)
    } else if (buttonType === 'redo') {
      redoButtonHighlight.value = true
      setTimeout(() => {
        redoButtonHighlight.value = false
      }, feedbackDuration)
    }
  }
  
  // Обработчик нажатия клавиш
  const handleKeyDown = async (event) => {
    // Если горячие клавиши отключены
    if (!enabled.value) return
    
    // Если фокус в поле ввода и отключено для полей ввода
    if (isInputElement(event)) return
    
    // Определяем правильную клавишу в зависимости от ОС
    const modifierKey = event[ctrlKey]
    
    // Ctrl+Z (или Cmd+Z на Mac) - отмена действия
    if (modifierKey && event.key === 'z' && !event.shiftKey) {
      if (preventDefault) {
        event.preventDefault()
      }
      
      if (historyStore.canUndo) {
        const success = historyStore.undo()
        if (success) {
          highlightButton('undo')
        }
      }
	  
    }
    
    // Ctrl+Shift+Z (или Cmd+Shift+Z на Mac) - повтор действия
    if (modifierKey && event.shiftKey && event.key === 'z') {
      if (preventDefault) {
        event.preventDefault()
      }
      
      if (historyStore.canRedo) {
        const success = historyStore.redo()
        if (success) {
          highlightButton('redo')
        }
      }
    }
    
    // Ctrl+Y (или Cmd+Y на Mac) - повтор действия
    if (modifierKey && event.key === 'y' && !event.shiftKey) {
      if (preventDefault) {
        event.preventDefault()
      }
      
      if (historyStore.canRedo) {
        const success = historyStore.redo()
        if (success) {
          highlightButton('redo')
        }
      }
    }
  }
  
  // Delete - удаление выделенных элементов
if (event.key === 'Delete' || event.code === 'Delete') {
  // Пропускаем обработку, если фокус в поле ввода
  if (isInputElement(event)) return;
  
  // Здесь логика удаления будет обрабатываться в CanvasBoard.vue
  // Мы просто предотвращаем стандартное поведение
  if (preventDefault) {
    event.preventDefault();
  }
}
  
  
  // Функция для включения/выключения горячих клавиш
  const setEnabled = (value) => {
    enabled.value = value
  }
  
  // Функция для очистки
  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
  
  // Регистрируем обработчик при монтировании компонента
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })
  
  // Удаляем обработчик при размонтировании компонента
  onUnmounted(() => {
    cleanup()
  })
  
  // Возвращаем функции и состояния для использования в компонентах
  return {
    isMac,
    undoButtonHighlight,
    redoButtonHighlight,
    enabled,
    setEnabled,
    cleanup
  }
}
