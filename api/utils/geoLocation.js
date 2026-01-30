/**
 * Сервис определения геолокации по IP-адресу
 * Использует бесплатный API ip-api.com
 */

/**
 * Получить геолокацию по IP-адресу
 * @param {string} ip — IP-адрес
 * @returns {Promise<{country: string, city: string} | null>} — Геоданные или null при ошибке
 */
export async function getGeoLocation(ip) {
  // Пропускаем локальные адреса
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // таймаут 3 секунды

    const response = await fetch(
      `http://ip-api.com/json/${ip}?lang=ru&fields=status,country,city`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ GeoLocation API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'success' && data.country) {
      return {
        country: data.country,
        city: data.city || null
      };
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ GeoLocation API timeout');
    } else {
      console.error('❌ GeoLocation error:', error.message);
    }
    return null;
  }
}

/**
 * Форматировать геолокацию в строку
 * @param {{country: string, city: string} | null} geo — Геоданные
 * @param {string | null} fallbackIp — IP для отображения если геолокация недоступна
 * @returns {string} — Форматированная строка
 */
export function formatGeoLocation(geo, fallbackIp = null) {
  if (geo) {
    return geo.city ? `${geo.country}, ${geo.city}` : geo.country;
  }
  return fallbackIp || 'Неизвестно';
}
