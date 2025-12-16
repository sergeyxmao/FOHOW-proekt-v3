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

  if (points.length === 2) {
    const [start, end] = points
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  // Используем Catmull-Rom -> Bezier для плавных переходов между несколькими точками
  const path = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || points[i + 1]

    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    path.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`)
  }

  return path.join(' ')
}

/**
 * Получить координаты точки соединения аватара
 * @param {Object} avatar - Объект аватара
 * @param {number} pointIndex - Индекс точки (1-10)
 * @returns {Object} Координаты {x, y}
 */
export function getAvatarConnectionPoint(avatar, pointIndex) {
  const diameter = avatar.diameter || 418
  const radius = diameter / 2
  const offset = 5

  // Углы для 10 точек (0°, 40°, 80°, 120°, 160°, 180°, 200°, 240°, 280°, 320°)
  const angles = [0, 40, 80, 120, 160, 180, 200, 240, 280, 320]
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

  const segments = []

  // Строим те же сегменты Catmull-Rom, что и при генерации пути
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || points[i + 1]

    const c1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6
    }
    const c2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6
    }

    segments.push({ start: p1, c1, c2, end: p2, insertIndex: i + 1 })
  }

  const samplesPerSegment = Math.max(5, Math.round(samples / Math.max(1, segments.length)))

  segments.forEach(segment => {
    for (let j = 0; j <= samplesPerSegment; j++) {
      const t = j / samplesPerSegment
      const oneMinusT = 1 - t

      const px = oneMinusT ** 3 * segment.start.x
        + 3 * oneMinusT ** 2 * t * segment.c1.x
        + 3 * oneMinusT * t ** 2 * segment.c2.x
        + t ** 3 * segment.end.x

      const py = oneMinusT ** 3 * segment.start.y
        + 3 * oneMinusT ** 2 * t * segment.c1.y
        + 3 * oneMinusT * t ** 2 * segment.c2.y
        + t ** 3 * segment.end.y

      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2)

      if (dist < minDist) {
        minDist = dist
        closestPoint = { x: px, y: py }
        closestT = t
        insertIndex = segment.insertIndex
      }
    }
  })

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
