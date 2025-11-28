/**
 * Composable для работы с кривыми Безье для соединений аватаров
 */

/**
 * Построить SVG path для кривой Безье
 * @param {Array} points - Массив точек [start, ...controlPoints, end]
 * @returns {string} SVG path строка
 */
export function buildBezierPath(points) {
  if (!points || points.length < 2) return ''

  // Для двух точек - прямая линия
  if (points.length === 2) {
    const [start, end] = points
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  // Для трех точек - квадратичная кривая Безье
  if (points.length === 3) {
    const [start, control, end] = points
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
  }

  // Для более чем трех точек - последовательность квадратичных кривых
  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i]
    const next = points[i + 1]
    const midX = (cp.x + next.x) / 2
    const midY = (cp.y + next.y) / 2
    path += ` Q ${cp.x} ${cp.y} ${midX} ${midY}`
  }

  // Последний сегмент
  const lastCp = points[points.length - 2]
  const end = points[points.length - 1]
  path += ` Q ${lastCp.x} ${lastCp.y} ${end.x} ${end.y}`

  return path
}

/**
 * Получить координаты точки соединения аватара
 * @param {Object} avatar - Объект аватара
 * @param {number} pointIndex - Индекс точки (1-9)
 * @returns {Object} Координаты {x, y}
 */
export function getAvatarConnectionPoint(avatar, pointIndex) {
  const diameter = avatar.diameter || 418
  const radius = diameter / 2
  const offset = 5

  // Углы для 9 точек (0°, 40°, 80°, 120°, 160°, 200°, 240°, 280°, 320°)
  const angles = [0, 40, 80, 120, 160, 200, 240, 280, 320]
  const angle = angles[pointIndex - 1] || 0

  const angleRad = angle * Math.PI / 180
  const centerX = avatar.x + diameter / 2
  const centerY = avatar.y + diameter / 2

  const pointX = centerX + (radius + offset) * Math.sin(angleRad)
  const pointY = centerY - (radius + offset) * Math.cos(angleRad)

  return { x: pointX, y: pointY }
}

/**
 * Вычислить начальную позицию контрольной точки посередине между двумя точками
 * @param {Object} fromPoint - Начальная точка {x, y}
 * @param {Object} toPoint - Конечная точка {x, y}
 * @returns {Object} Координаты контрольной точки {x, y}
 */
export function calculateMidpoint(fromPoint, toPoint) {
  return {
    x: (fromPoint.x + toPoint.x) / 2,
    y: (fromPoint.y + toPoint.y) / 2
  }
}

/**
 * Найти ближайшую точку на кривой Безье к заданным координатам
 * @param {Array} points - Точки кривой [start, ...controlPoints, end]
 * @param {number} x - X координата
 * @param {number} y - Y координата
 * @param {number} samples - Количество точек для сэмплирования (по умолчанию 100)
 * @returns {Object} { x, y, t, index } - координаты ближайшей точки, параметр t и индекс вставки
 */
export function findClosestPointOnBezier(points, x, y, samples = 100) {
  if (points.length < 2) return null

  let minDist = Infinity
  let closestPoint = null
  let closestT = 0
  let insertIndex = 1

  // Разбиваем кривую на сегменты и ищем ближайшую точку
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]

    for (let j = 0; j <= samples; j++) {
      const t = j / samples
      // Линейная интерполяция для простоты
      const px = p0.x + (p1.x - p0.x) * t
      const py = p0.y + (p1.y - p0.y) * t

      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2)

      if (dist < minDist) {
        minDist = dist
        closestPoint = { x: px, y: py }
        closestT = t
        insertIndex = i + 1
      }
    }
  }

  return { ...closestPoint, t: closestT, index: insertIndex }
}

/**
 * Проверить, находится ли точка близко к кривой (для hitbox)
 * @param {Array} points - Точки кривой
 * @param {number} x - X координата
 * @param {number} y - Y координата
 * @param {number} threshold - Порог расстояния (по умолчанию 10)
 * @returns {boolean}
 */
export function isPointNearBezier(points, x, y, threshold = 10) {
  const closest = findClosestPointOnBezier(points, x, y)
  if (!closest) return false

  const dist = Math.sqrt((closest.x - x) ** 2 + (closest.y - y) ** 2)
  return dist <= threshold
}

/**
 * Composable для работы с кривыми Безье
 */
export function useBezierCurves() {
  return {
    buildBezierPath,
    getAvatarConnectionPoint,
    calculateMidpoint,
    findClosestPointOnBezier,
    isPointNearBezier
  }
}
