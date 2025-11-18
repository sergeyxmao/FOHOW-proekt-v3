import { ref } from 'vue';

export function useImageProxy() {
  const imageCache = new Map();

  const getImageUrl = async (imageId) => {
    if (!imageId) return '';

    // Проверка кэша
    if (imageCache.has(imageId)) {
      return imageCache.get(imageId);
    }

    try {
      // Получаем JWT токен из localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('JWT токен не найден');
        return '';
      }

      // Загружаем изображение через fetch с JWT токеном
      const response = await fetch(`/api/images/proxy/${imageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Получаем blob из ответа
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      imageCache.set(imageId, blobUrl);

      return blobUrl;
    } catch (error) {
      console.error(`Ошибка загрузки изображения ${imageId}:`, error);
      return '';
    }
  };

  const clearCache = () => {
    imageCache.forEach(url => URL.revokeObjectURL(url));
    imageCache.clear();
  };

  return {
    getImageUrl,
    clearCache
  };
}
