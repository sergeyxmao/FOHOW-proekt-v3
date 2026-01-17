/**
 * Утилиты для работы с viewport и canvas координатами
 *
 * Этот модуль содержит функции для преобразования координат между viewport (экранными)
 * и canvas (внутренними) системами координат с учетом zoom и pan.
 */

const CANVAS_SAFE_MARGIN = 32

/**
 * Разбирает CSS transform строку и извлекает scale, translateX, translateY
 *
 * @param {string} transformValue - CSS transform значение (например, "translate(100px, 200px) scale(1.5)")
 * @returns {{ scale: number, translateX: number, translateY: number }}
 */
export function parseCanvasTransform(transformValue) {
  if (!transformValue || transformValue === 'none') {
    return { scale: 1, translateX: 0, translateY: 0 }
  }

  if (typeof DOMMatrixReadOnly === 'function') {
    try {
      const matrix = new DOMMatrixReadOnly(transformValue)
      const scaleX = Number.isFinite(matrix.a) ? matrix.a : 1
      const scaleY = Number.isFinite(matrix.d) ? matrix.d : 1
      const translateX = Number.isFinite(matrix.m41) ? matrix.m41 : 0
      const translateY = Number.isFinite(matrix.m42) ? matrix.m42 : 0
      const scale = scaleX || scaleY || 1

      return { scale: scale || 1, translateX, translateY }
    } catch (error) {
      // Игнорируем и пробуем разобрать строку вручную
    }
  }

  const matrixMatch = transformValue.match(/^matrix\(([^)]+)\)$/)
  if (matrixMatch) {
    const parts = matrixMatch[1].split(',').map(part => Number(part.trim()))
    if (parts.length >= 6) {
      const [a, , , d, e, f] = parts
      const scale = a || d || 1
      return {
        scale: scale || 1,
        translateX: Number.isFinite(e) ? e : 0,
        translateY: Number.isFinite(f) ? f : 0
      }
    }
  }

  const translateMatch = transformValue.match(/translate\(\s*([-0-9.]+)px(?:,\s*([-0-9.]+)px)?\s*\)/)
  const scaleMatch = transformValue.match(/scale\(\s*([-0-9.]+)\s*\)/)

  return {
    scale: scaleMatch ? Number(scaleMatch[1]) || 1 : 1,
    translateX: translateMatch ? Number(translateMatch[1]) || 0 : 0,
    translateY: translateMatch ? Number(translateMatch[2]) || 0 : 0
  }
}

/**
 * Вычисляет позицию в canvas координатах для вставки объекта в нижний левый угол viewport
 *
 * Алгоритм:
 * 1. Получает размеры viewport (.canvas-container)
 * 2. Извлекает текущие параметры transform (scale, translateX, translateY)
 * 3. Вычисляет экранные координаты нижнего левого угла с отступом
 * 4. Преобразует экранные координаты в canvas координаты с учетом zoom/pan
 *
 * Формула преобразования viewport → canvas:
 * canvasX = (viewportX - translateX) / scale
 * canvasY = (viewportY - translateY) / scale - objectHeight
 *
 * @param {number} [objectWidth=0] - Ширина объекта (для будущего использования)
 * @param {number} [objectHeight=0] - Высота объекта (вычитается из Y для правильного позиционирования)
 * @returns {{ x: number, y: number } | null} Координаты в canvas или null если элементы не найдены
 */
export function getViewportAnchoredPosition(objectWidth = 0, objectHeight = 0) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const container = document.querySelector('.canvas-container')
  const content = container?.querySelector('.canvas-content')

  if (!container || !content) {
    return null
  }

  const { height } = container.getBoundingClientRect()
  const transformValue = content.style.transform || window.getComputedStyle(content).transform
  const { scale, translateX, translateY } = parseCanvasTransform(transformValue)

  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const safeTranslateX = Number.isFinite(translateX) ? translateX : 0
  const safeTranslateY = Number.isFinite(translateY) ? translateY : 0

  // Экранные координаты: левый край + отступ, нижний край - отступ
  const viewportX = CANVAS_SAFE_MARGIN
  const viewportY = height - CANVAS_SAFE_MARGIN

  // Преобразуем viewport координаты в canvas координаты
  const canvasX = (viewportX - safeTranslateX) / safeScale
  const canvasY = (viewportY - safeTranslateY) / safeScale - objectHeight

  return {
    x: Math.max(0, Math.round(canvasX)),
    y: Math.max(0, Math.round(canvasY))
  }
}

/**
 * Вычисляет смещение для позиционирования шаблона в нижнем левом углу viewport
 *
 * Алгоритм:
 * 1. Находит минимальные координаты (minX, minY) среди всех карточек шаблона
 * 2. Находит максимальные размеры среди всех карточек
 * 3. Получает целевую позицию через getViewportAnchoredPosition
 * 4. Вычисляет смещение dx = targetX - minX, dy = targetY - minY
 *
 * @param {Array} templateCards - Массив карточек шаблона с координатами x, y
 * @returns {{ dx: number, dy: number } | null} Смещение или null если нет карточек
 */
export function calculateTemplateOffset(templateCards) {
  if (!Array.isArray(templateCards) || templateCards.length === 0) {
    return null
  }

  // Находим минимальные координаты и максимальные размеры
  let minX = Infinity
  let minY = Infinity
  let maxWidth = 0
  let maxHeight = 0

  templateCards.forEach(card => {
    if (card && Number.isFinite(card.x) && Number.isFinite(card.y)) {
      minX = Math.min(minX, card.x)
      minY = Math.min(minY, card.y)

      if (Number.isFinite(card.width)) {
        maxWidth = Math.max(maxWidth, card.width)
      }
      if (Number.isFinite(card.height)) {
        maxHeight = Math.max(maxHeight, card.height)
      }
    }
  })

  // Если не нашли валидных координат
  if (minX === Infinity || minY === Infinity) {
    return null
  }

  // Получаем целевую позицию в viewport (используем максимальные размеры как референс)
  const targetPosition = getViewportAnchoredPosition(maxWidth, maxHeight)

  if (!targetPosition) {
    return null
  }

  // Вычисляем смещение
  const dx = targetPosition.x - minX
  const dy = targetPosition.y - minY

  return { dx, dy }
}
