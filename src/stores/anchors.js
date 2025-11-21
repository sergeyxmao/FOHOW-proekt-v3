import { ref } from 'vue';
import { defineStore } from 'pinia';

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

export const useAnchorsStore = defineStore('anchors', () => {
  const anchors = ref([]);
  const isLoading = ref(false);
  const error = ref(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  async function loadForBoard(boardId) {
    if (!boardId) {
      console.warn('BoardId не указан');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_URL}/boards/${boardId}/anchors`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка загрузки точек');
      }

      const data = await response.json();
      anchors.value = (data.anchors || []).map(anchor => ({
        ...anchor,
        id: parseInt(anchor.id, 10)
      }));
    } catch (err) {
      console.error('❌ Ошибка загрузки точек:', err);
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function createAnchor(boardId, payload) {
    if (!boardId) {
      console.warn('BoardId не указан');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_URL}/boards/${boardId}/anchors`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка создания точки');
      }

      const data = await response.json();
      const newAnchor = {
        ...data.anchor,
        id: parseInt(data.anchor.id, 10)
      };
      anchors.value.push(newAnchor);
      return newAnchor;
    } catch (err) {
      console.error('❌ Ошибка создания точки:', err);
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateAnchorDescription(anchorId, description) {
    if (!anchorId) {
      console.warn('AnchorId не указан');
      return;
    }

    error.value = null;

    try {
      const response = await fetch(`${API_URL}/anchors/${anchorId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка обновления точки');
      }

      const data = await response.json();
      const anchorIndex = anchors.value.findIndex(a => a.id === anchorId || a.id === parseInt(anchorId, 10));
      if (anchorIndex !== -1) {
        anchors.value[anchorIndex] = {
          ...anchors.value[anchorIndex],
          description: data.anchor.description,
          updated_at: data.anchor.updated_at
        };
      }

      return data.anchor;
    } catch (err) {
      console.error('❌ Ошибка обновления точки:', err);
      error.value = err;
      throw err;
    }
  }

  async function deleteAnchor(anchorId) {
    if (!anchorId) {
      console.warn('AnchorId не указан');
      return;
    }

    error.value = null;

    try {
      const response = await fetch(`${API_URL}/anchors/${anchorId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка удаления точки');
      }

      anchors.value = anchors.value.filter(anchor => anchor.id !== anchorId && anchor.id !== parseInt(anchorId, 10));
    } catch (err) {
      console.error('❌ Ошибка удаления точки:', err);
      error.value = err;
      throw err;
    }
  }

  function reset() {
    anchors.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    anchors,
    isLoading,
    error,
    loadForBoard,
    createAnchor,
    updateAnchorDescription,
    deleteAnchor,
    reset
  };
});
