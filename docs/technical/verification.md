# Верификация пользователей

## Описание

Система верификации позволяет пользователям подтвердить свою личность как партнёра FOHOW. Пользователь заполняет форму (ФИО + реферальная ссылка), администратор проверяет данные и одобряет или отклоняет заявку.

## Расположение файлов

| Компонент | Файл |
|-----------|------|
| Backend роуты | `api/routes/verification.js` |
| Backend сервис | `api/services/verificationService.js` |
| Frontend composable | `src/composables/useUserVerification.js` |

## API эндпоинты

### `GET /api/verification/can-submit`

Проверяет, может ли пользователь подать заявку.

- **Auth**: Bearer token
- **Ответ 200**: `{ canSubmit: boolean, reason: string | null }`

### `GET /api/verification/status`

Возвращает текущий статус верификации пользователя.

- **Auth**: Bearer token
- **Ответ 200**: `{ status: string, verification: object | null }`
- Поля статуса: `isVerified`, `hasPendingRequest`, `lastRejection`, `lastAttempt`, `cooldownUntil`

### `POST /api/verification/submit`

Отправляет заявку на верификацию.

- **Auth**: Bearer token
- **Content-Type**: `multipart/form-data` (основной) или `application/json`
- **Поля формы**:
  - `full_name` (string, обязательное) — полное ФИО пользователя
  - `referral_link` (string, обязательное) — персональная реферальная ссылка FOHOW
- **Валидация реферальной ссылки**:
  - Должна начинаться с `http://www.fohow`
  - Должна содержать параметр `id=`
  - Максимум 60 символов
- **Ответ 200**: `{ success: true, message: string, verificationId: integer }`
- **Ответ 400**: Ошибка валидации полей
- **Ответ 409**: Пользователь уже верифицирован или есть активная заявка
- **Ответ 415**: Неподдерживаемый Content-Type

> **Важно**: body schema в Swagger отсутствует, т.к. фронтенд отправляет `multipart/form-data`, который не проходит JSON-валидацию AJV в Fastify. Валидация полей выполняется вручную в хэндлере.

### `GET /api/verification/history`

Возвращает историю всех заявок пользователя.

- **Auth**: Bearer token
- **Ответ 200**: `{ success: true, history: [{ id, full_name, status, rejection_reason, submitted_at, processed_at, processed_by_username }] }`

### `DELETE /api/verification/cancel`

Отменяет активную (pending) заявку.

- **Auth**: Bearer token
- **Ответ 200**: `{ success: true, message: string }`
- **Ответ 404**: Активная заявка не найдена

## Механика cooldown

После отклонения заявки действует кулдаун — период, в течение которого повторная подача невозможна. Фронтенд отображает обратный отсчёт (`cooldownUntil` из статуса). Таймер обновляется каждую секунду; по истечении кулдауна статус автоматически перезагружается.

## Фронтенд: composable `useUserVerification`

### Реактивное состояние
- `verificationStatus` — текущий статус (isVerified, hasPendingRequest, cooldownUntil и др.)
- `verificationForm` — форма заявки (full_name, referral_link)
- `verificationHistory` — массив прошлых заявок
- `showVerificationModal` — флаг модального окна

### Computed
- `canSubmitVerification` — можно ли подать заявку (проверяет pending, personal_id, cooldown)
- `cooldownMessage` — текст оставшегося времени кулдауна
- `verificationBlockReason` — причина блокировки кнопки подачи

### Методы
- `loadVerificationStatus()` — загрузка статуса с сервера
- `submitVerification()` — отправка заявки (multipart/form-data)
- `cancelVerification()` — отмена активной заявки
- `loadVerificationHistory()` — загрузка истории
- `cleanup()` — очистка интервалов при размонтировании

## История изменений

- **2026-02-09**: Убрана `body` schema из `POST /api/verification/submit` — multipart/form-data не проходит JSON-валидацию AJV в Fastify, что вызывало ошибку «body must be object» (400/500). Валидация полей выполняется в хэндлере.
