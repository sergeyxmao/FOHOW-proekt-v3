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
      stickers.value = data.stickers || [];

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
   * @param {Object} stickerData - Данные стикера { pos_x, pos_y, color }
   */
  async function addSticker(boardId, stickerData) {
    if (!boardId) {
      console.warn('BoardId не указан');
      return;
    }

    isLoading.value = true;

    try {
      const response = await fetch(`${API_URL}/boards/${boardId}/stickers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(stickerData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка создания стикера');
      }

      const data = await response.json();
      const newSticker = data.sticker;

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
        const data = await response.json();
        throw new Error(data.error || 'Ошибка обновления стикера');
      }

      const data = await response.json();
      const updatedSticker = data.sticker;

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
    if (!stickerId) {
      console.warn('StickerId не указан');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/stickers/${stickerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка удаления стикера');
      }

      // Удаляем стикер из массива
      stickers.value = stickers.value.filter(s => s.id !== stickerId);

    } catch (error) {
      console.error('❌ Ошибка удаления стикера:', error);
      throw error;
    }
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

    // Getters
    hasStickers,

    // Actions
    fetchStickers,
    addSticker,
    updateSticker,
    deleteSticker,
    clearStickers,
    enablePlacementMode,
    disablePlacementMode,
    togglePlacementMode,
    selectSticker,
    deselectSticker,
    toggleStickerSelection,
    deselectAllStickers
  };
});
