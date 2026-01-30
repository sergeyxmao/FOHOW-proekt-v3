# GeoLocation Service — Определение местоположения по IP

## Расположение

`api/utils/geoLocation.js`

## Описание

Сервис для определения географического местоположения по IP-адресу.
Используется для информирования пользователей о месте, откуда выполнено действие (смена пароля, вход и т.д.)

## Внешний API

Используется бесплатный сервис **ip-api.com**:
- Лимит: 45 запросов/минуту
- Не требует API-ключа
- Поддерживает русский язык

## Функции

### `getGeoLocation(ip)`

Получить геолокацию по IP-адресу.

**Параметры:**
- `ip` (string) — IP-адрес

**Возвращает:** `Promise<{country: string, city: string} | null>`

**Особенности:**
- Таймаут 3 секунды
- Локальные адреса (127.0.0.1, 192.168.*, 10.*) возвращают null
- При ошибке возвращает null (не бросает исключение)

**Пример:**
```javascript
const geo = await getGeoLocation('144.31.19.203');
// { country: 'Россия', city: 'Москва' }
```

---

### `formatGeoLocation(geo, fallbackIp)`

Форматировать геолокацию в строку.

**Параметры:**
- `geo` (object | null) — Результат getGeoLocation
- `fallbackIp` (string, optional) — IP для отображения если геолокация недоступна

**Возвращает:** `string`

**Примеры:**
```javascript
formatGeoLocation({ country: 'Россия', city: 'Москва' }, '1.2.3.4')
// "Россия, Москва"

formatGeoLocation({ country: 'Россия', city: null }, '1.2.3.4')
// "Россия"

formatGeoLocation(null, '1.2.3.4')
// "1.2.3.4"

formatGeoLocation(null, null)
// "Неизвестно"
```

## Использование

```javascript
import { getGeoLocation, formatGeoLocation } from '../utils/geoLocation.js';

const ip = req.headers['x-real-ip'];
const geo = await getGeoLocation(ip);
const location = formatGeoLocation(geo, ip);

console.log(location); // "Россия, Москва" или "1.2.3.4" если геолокация недоступна
```

## Где используется

- `api/routes/profile.js` — уведомления о смене пароля (Email и Telegram)
