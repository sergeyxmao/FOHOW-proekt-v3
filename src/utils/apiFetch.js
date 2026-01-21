/**
 * Глобальный перехватчик fetch для обработки forced_logout
 *
 * При получении 401 с reason: 'forced_logout' автоматически генерирует
 * событие session_forced_logout для корректного завершения сессии.
 *
 * Используется для автоматического выхода пользователя, когда его сессия
 * была завершена на сервере (например, при входе с другого устройства).
 */

// Флаг для предотвращения повторной инициализации
let isInitialized = false

// Флаг для предотвращения множественных вызовов forced_logout
let isForcedLogoutInProgress = false

/**
 * Инициализирует глобальный перехватчик fetch
 * Вызывается один раз при старте приложения (в main.js)
 */
export function initFetchInterceptor() {
  if (isInitialized) {
    console.warn('[ApiFetch] Перехватчик уже инициализирован')
    return
  }

  const originalFetch = window.fetch

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args)

    // Проверяем только 401 ответы
    if (response.status === 401) {
      // Клонируем response чтобы прочитать body без потребления оригинала
      const clonedResponse = response.clone()

      try {
        const data = await clonedResponse.json()

        // Если сервер вернул reason: 'forced_logout', генерируем событие
        if (data.reason === 'forced_logout' && !isForcedLogoutInProgress) {
          isForcedLogoutInProgress = true

          console.log('[ApiFetch] Получен forced_logout от сервера, генерируем событие')

          // Используем setTimeout чтобы не блокировать текущий запрос
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('session_forced_logout', {
              detail: { reason: 'session_terminated_by_server' }
            }))

            // Сбрасываем флаг через 5 секунд (время на обработку logout)
            setTimeout(() => {
              isForcedLogoutInProgress = false
            }, 5000)
          }, 0)
        }
      } catch {
        // Игнорируем ошибки парсинга JSON (не все 401 имеют JSON body)
      }
    }

    return response
  }

  isInitialized = true
  console.log('[ApiFetch] Глобальный перехватчик fetch инициализирован')
}

/**
 * Сбрасывает состояние перехватчика (для тестов)
 */
export function resetFetchInterceptor() {
  isForcedLogoutInProgress = false
}
