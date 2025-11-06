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

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    stickers,
    isLoading,
    isPlacementMode,
    currentBoardId,

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
    togglePlacementMode
  };
});
