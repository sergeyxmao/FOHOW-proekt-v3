import { ref } from 'vue';
import axios from 'axios';

export function useImageProxy() {
  const imageCache = new Map();

  const getImageUrl = async (imageId) => {
    if (!imageId) return '';

    // Проверка кэша
    if (imageCache.has(imageId)) {
      return imageCache.get(imageId);
    }

    try {
      const response = await axios.get(`/api/images/proxy/${imageId}`, {
        responseType: 'blob'
      });

      const blobUrl = URL.createObjectURL(response.data);
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
