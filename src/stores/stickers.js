import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

export const useStickersStore = defineStore('stickers', () => {
  // ============================================
  // STATE
  // ============================================

  // Массив всех стикеров для текущей доски
  const stickers = ref([]);

  // Состояние загрузки
  const isLoading = ref(false);

  // Текущий режим размещения стикера
  const isPlacementMode = ref(false);

  // ID текущей доски
  const currentBoardId = ref(null);

  // Массив ID выделенных стикеров
  const selectedStickerIds = ref([]);

  // ID стикера, на который нужно сфокусироваться
  const pendingFocusStickerId = ref(null);

  // Данные изображения, ожидающего размещения на доске
  const pendingImageData = ref(null);

  // ============================================
  // GETTERS
  // ============================================

  const hasStickers = computed(() => stickers.value.length > 0);

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Получить заголовки для API запросов с авторизацией
   */
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  /**
   * Загрузить все стикеры для доски
   * @param {number|string} boardId - ID доски
   */
  async function fetchStickers(boardId) {
    if (!boardId) {
      console.warn('BoardId не указан');
      return;
    }

    isLoading.value = true;
    currentBoardId.value = boardId;

    try {
      const response = await fetch(`${API_URL}/boards/${boardId}/stickers`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка загрузки стикеров');
      }

      const data = await response.json();
      // Нормализуем данные стикеров, убеждаемся что ID всегда числа
      stickers.value = (data.stickers || []).map(sticker => {
        // Проверяем z_index и устанавливаем минимум 10000 (стикеры ВСЕГДА на переднем плане)
        let zIndex = sticker.z_index ?? 10000
        if (zIndex < 10000) {
          zIndex = 10000
        }

        return {
          ...sticker,
          id: parseInt(sticker.id, 10),
          z_index: zIndex
        }
      });

    } catch (error) {
      console.error('❌ Ошибка загрузки стикеров:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Добавить новый стикер
   * @param {number|string} boardId - ID доски
   * @param {Object} stickerData - Данные стикера { pos_x, pos_y, color, z_index }
   */
  async function addSticker(boardId, stickerData) {
    if (!boardId) {
      console.warn('BoardId не указан');
      return;
    }

    isLoading.value = true;

    try {
      // Вычисляем максимальный zIndex среди существующих стикеров
      const maxZIndex = stickers.value.length > 0
        ? Math.max(...stickers.value.map(s => s.z_index || 0), 0)
        : 0;

      // Добавляем z_index в данные стикера (минимум 10000 - стикеры ВСЕГДА на переднем плане)
      const stickerDataWithZIndex = {
        ...stickerData,
        z_index: Math.max(maxZIndex + 1, 10000)
      };

      const response = await fetch(`${API_URL}/boards/${boardId}/stickers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(stickerDataWithZIndex)
      });

      if (!response.ok) {
        // Проверяем, не превышен ли лимит
        if (response.status === 403) {
          try {
            const errorData = await response.json();
            if (errorData.code === 'USAGE_LIMIT_REACHED') {
              // Показываем специфичное сообщение о превышении лимита
              alert(errorData.error || 'Достигнут лимит стикеров на вашем тарифе');
              isLoading.value = false;
              return null;
            }
          } catch (parseError) {
            // Если не удалось распарсить JSON, продолжаем с общей ошибкой
          }
        }
        const data = await response.json();
        throw new Error(data.error || 'Ошибка создания стикера');
      }

      const data = await response.json();

      // Сервер может вернуть стикер с произвольным z_index.
      // По ТЗ стикеры всегда должны находиться поверх изображений,
      // поэтому жестко гарантируем минимальное значение 10000.
      let serverZIndex = data.sticker.z_index ?? maxZIndex + 1
      if (serverZIndex < 10000) {
        serverZIndex = 10000
      }      
      const newSticker = {
        ...data.sticker,
        id: parseInt(data.sticker.id, 10),
        z_index: serverZIndex
      };

      // Добавляем новый стикер в массив
      stickers.value.push(newSticker);

      return newSticker;
    } catch (error) {
      console.error('❌ Ошибка создания стикера:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Обновить стикер
   * @param {number} stickerId - ID стикера
   * @param {Object} updateData - Данные для обновления { content, pos_x, pos_y, color }
   */
  async function updateSticker(stickerId, updateData) {
    if (!stickerId) {
      console.warn('StickerId не указан');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/stickers/${stickerId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        // Проверяем, не превышен ли лимит
        if (response.status === 403) {
          try {
            const errorData = await response.json();
            if (errorData.code === 'USAGE_LIMIT_REACHED') {
              // Показываем специфичное сообщение о превышении лимита
              alert(errorData.error || 'Достигнут лимит на вашем тарифе');
              return null;
            }
          } catch (parseError) {
            // Если не удалось распарсить JSON, продолжаем с общей ошибкой
          }
        }
        const data = await response.json();
        throw new Error(data.error || 'Ошибка обновления стикера');
      }

      const data = await response.json();
      const updatedSticker = {
        ...data.sticker,
        id: parseInt(data.sticker.id, 10)
      };

      // Обновляем стикер в массиве
      const index = stickers.value.findIndex(s => s.id === updatedSticker.id);
      if (index !== -1) {
        stickers.value[index] = updatedSticker;
      }

      return updatedSticker;
    } catch (error) {
      console.error('❌ Ошибка обновления стикера:', error);
      throw error;
    }
  }

  /**
   * Удалить стикер
   * @param {number} stickerId - ID стикера
   */
  async function deleteSticker(stickerId) {
    // Улучшенная валидация stickerId
    if (!stickerId) {
      const error = new Error('ID стикера не указан');
      console.warn('❌ StickerId не указан');
      throw error;
    }

    // Проверяем, что stickerId является числом
    const stickerIdNum = parseInt(stickerId, 10);
    if (isNaN(stickerIdNum) || stickerIdNum <= 0) {
      const error = new Error(`Некорректный ID стикера: ${stickerId}`);
      console.error('❌ Некорректный stickerId:', stickerId);
      throw error;
    }

    try {
      // ---> НАЧАЛО ИЗМЕНЕНИЙ
      // Создаем заголовки специально для этого запроса, БЕЗ 'Content-Type'
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch(`${API_URL}/stickers/${stickerIdNum}`, {
        method: 'DELETE',
        headers: headers // <-- Используем новые заголовки
      });
      // <--- КОНЕЦ ИЗМЕНЕНИЙ

      // Этот код остается таким же, как и был
      if (!response.ok) {
        let errorMessage = 'Ошибка удаления стикера';
        try {
          // Если сервер все же ответил с JSON (например, 404), пытаемся его прочитать
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (parseError) {
          // Если не удалось распарсить JSON (например, при ответе 204),
          // используем текст статуса ответа
          errorMessage = response.statusText || `Ошибка сервера (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      // Удаляем стикер из массива в сторе
      stickers.value = stickers.value.filter(s => s.id !== stickerIdNum);

      console.log('✅ Стикер успешно удален:', stickerIdNum);

    } catch (error) {
      console.error('❌ Ошибка удаления стикера:', error);
      throw error; // Пробрасываем ошибку дальше, чтобы компонент мог ее поймать и показать alert
    }
  }

  /**
   * Загрузить стикеры из сохраненных данных (для восстановления из структуры)
   * @param {Array} stickersData - Массив данных стикеров
   */
  function loadStickers(stickersData) {
    if (!Array.isArray(stickersData)) {
      console.warn('loadStickers: данные должны быть массивом');
      stickers.value = [];
      return;
    }

    // Преобразуем данные в нужный формат с нормализацией ID
    stickers.value = stickersData.map(stickerData => {
      // Проверяем z_index и устанавливаем минимум 10000 (стикеры ВСЕГДА на переднем плане)
      let zIndex = stickerData.z_index ?? 10000
      if (zIndex < 10000) {
        zIndex = 10000
      }

      return {
        id: parseInt(stickerData.id, 10),
        pos_x: stickerData.pos_x || 0,
        pos_y: stickerData.pos_y || 0,
        color: stickerData.color || '#FFFF88',
        content: stickerData.content || '',
        z_index: zIndex,
        selected: false
      }
    });

    console.log('✅ Загружено стикеров из сохраненных данных:', stickers.value.length);
  }

  /**
   * Очистить все стикеры (при закрытии доски)
   */
  function clearStickers() {
    stickers.value = [];
    currentBoardId.value = null;
    isPlacementMode.value = false;
    selectedStickerIds.value = [];
  }

  /**
   * Включить режим размещения стикера
   */
  function enablePlacementMode() {
    isPlacementMode.value = true;
  }

  /**
   * Выключить режим размещения стикера
   */
  function disablePlacementMode() {
    isPlacementMode.value = false;
  }

  /**
   * Переключить режим размещения стикера
   */
  function togglePlacementMode() {
    isPlacementMode.value = !isPlacementMode.value;
  }

  /**
   * Выделить стикер
   * @param {number} stickerId - ID стикера
   */
  function selectSticker(stickerId) {
    const sticker = stickers.value.find(s => s.id === stickerId);
    if (sticker && !sticker.selected) {
      sticker.selected = true;
      if (!selectedStickerIds.value.includes(stickerId)) {
        selectedStickerIds.value.push(stickerId);
      }
    }
  }

  /**
   * Снять выделение со стикера
   * @param {number} stickerId - ID стикера
   */
  function deselectSticker(stickerId) {
    const sticker = stickers.value.find(s => s.id === stickerId);
    if (sticker && sticker.selected) {
      sticker.selected = false;
      const index = selectedStickerIds.value.indexOf(stickerId);
      if (index > -1) {
        selectedStickerIds.value.splice(index, 1);
      }
    }
  }

  /**
   * Переключить выделение стикера
   * @param {number} stickerId - ID стикера
   */
  function toggleStickerSelection(stickerId) {
    const sticker = stickers.value.find(s => s.id === stickerId);
    if (sticker) {
      if (sticker.selected) {
        deselectSticker(stickerId);
      } else {
        selectSticker(stickerId);
      }
    }
  }

  /**
   * Снять выделение со всех стикеров
   */
  function deselectAllStickers() {
    stickers.value.forEach(sticker => {
      if (sticker.selected) {
        sticker.selected = false;
      }
    });
    selectedStickerIds.value = [];
  }

  /**
   * Запросить фокусировку на стикере
   * @param {number} stickerId - ID стикера для фокусировки
   */
  function requestFocusOnSticker(stickerId) {
    pendingFocusStickerId.value = stickerId;
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    stickers,
    isLoading,
    isPlacementMode,
    currentBoardId,
    selectedStickerIds,
    pendingFocusStickerId,
    pendingImageData,

    // Getters
    hasStickers,

    // Actions
    fetchStickers,
    addSticker,
    updateSticker,
    deleteSticker,
    loadStickers,
    clearStickers,
    enablePlacementMode,
    disablePlacementMode,
    togglePlacementMode,
    selectSticker,
    deselectSticker,
    toggleStickerSelection,
    deselectAllStickers,
    requestFocusOnSticker
  };
});
