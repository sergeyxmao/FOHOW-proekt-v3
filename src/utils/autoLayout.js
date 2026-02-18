/**
 * Auto-Layout — автоматическое выравнивание карточек по бинарному дереву.
 *
 * Чистая функция без зависимостей от Vue/Pinia.
 * Принимает данные (корень, карточки, соединения) и возвращает новые позиции.
 */

/**
 * Вычисляет новые позиции карточек для аккуратного бинарного дерева.
 *
 * @param {Object} params
 * @param {string} params.rootId — ID корневой карточки
 * @param {Array} params.cards — массив карточек [{ id, x, y, width, height, type, ... }]
 * @param {Array} params.connections — массив соединений [{ id, from, to, fromSide, toSide, ... }]
 * @param {Object} [params.options] — настройки раскладки
 * @param {number} [params.options.horizontalGap=50] — минимальный горизонтальный зазор между карточками
 * @param {number} [params.options.verticalGap=80] — вертикальный зазор между уровнями
 *
 * @returns {{ positions: Map<string, {x: number, y: number}>, affectedCardIds: string[] }}
 */
export function calculateAutoLayout({ rootId, cards, connections, options = {} }) {
  const {
    horizontalGap = 50,
    verticalGap = 80
  } = options

  const cardsMap = new Map()
  for (const card of cards) {
    cardsMap.set(card.id, card)
  }

  const rootCard = cardsMap.get(rootId)
  if (!rootCard) {
    return { positions: new Map(), affectedCardIds: [] }
  }

  // --- Шаг A: Построение дерева из connections ---
  const children = buildTree(rootId, connections, cardsMap)

  // Если у корня нет детей — нечего раскладывать
  if (!children.has(rootId) || (children.get(rootId).left === null && children.get(rootId).right === null)) {
    // Корень без потомков — только если корень единственный узел в дереве
    const visited = new Set()
    collectReachable(rootId, children, visited)
    if (visited.size <= 1) {
      return { positions: new Map(), affectedCardIds: [] }
    }
  }

  // --- Шаг B: Вычисление ширины поддеревьев (bottom-up) ---
  const subtreeWidths = new Map()
  const visited = new Set()
  computeSubtreeWidth(rootId, children, cardsMap, subtreeWidths, visited, horizontalGap)

  // --- Шаг C: Расчёт позиций (top-down) ---
  const positions = new Map()
  layoutNode(rootId, 0, 0, children, cardsMap, subtreeWidths, positions, horizontalGap, verticalGap)

  // --- Шаг D: Нормализация координат ---
  const calculatedRoot = positions.get(rootId)
  if (calculatedRoot) {
    const offsetX = rootCard.x - calculatedRoot.x
    const offsetY = rootCard.y - calculatedRoot.y

    for (const [cardId, pos] of positions) {
      pos.x = Math.round(pos.x + offsetX)
      pos.y = Math.round(pos.y + offsetY)
    }
  }

  const affectedCardIds = [...positions.keys()]

  return { positions, affectedCardIds }
}

/**
 * Находит корень среди выделенных карточек.
 * Корень — карточка с наименьшим количеством входящих connections
 * от других выделенных карточек.
 *
 * @param {Array} selectedCards — массив выделенных карточек
 * @param {Array} connections — соединения между выделенными карточками
 * @returns {string|undefined} — ID корневой карточки
 */
export function findRootAmongSelected(selectedCards, connections) {
  const selectedIds = new Set(selectedCards.map(c => c.id))
  const incomingCount = new Map()

  for (const id of selectedIds) {
    incomingCount.set(id, 0)
  }

  for (const conn of connections) {
    if (selectedIds.has(conn.to)) {
      incomingCount.set(conn.to, (incomingCount.get(conn.to) || 0) + 1)
    }
  }

  // Сортируем: сначала 0 входящих, при равенстве — предпочитаем large
  return [...incomingCount.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1]
      const cardA = selectedCards.find(c => c.id === a[0])
      const cardB = selectedCards.find(c => c.id === b[0])
      if (cardA?.type === 'large' && cardB?.type !== 'large') return -1
      if (cardB?.type === 'large' && cardA?.type !== 'large') return 1
      return 0
    })[0]?.[0]
}

// ========================
// Внутренние функции
// ========================

/**
 * Получает размеры карточки (width, height).
 * Для user_card использует diameter.
 */
function getCardDimensions(card) {
  if (card.type === 'user_card') {
    const diameter = Number.isFinite(card.diameter) ? card.diameter : 418
    return { width: diameter, height: diameter }
  }

  const defaultSizes = {
    large: { width: 600, height: 400 },
    gold: { width: 600, height: 400 },
    small: { width: 400, height: 300 }
  }

  const defaults = defaultSizes[card.type] || defaultSizes.large
  const width = Number.isFinite(card.width) && card.width > 0 ? card.width : defaults.width
  const height = Number.isFinite(card.height) && card.height > 0 ? card.height : defaults.height

  return { width, height }
}

/**
 * Строит двунаправленный граф смежности из connections.
 *
 * Каждая карточка знает обо ВСЕХ своих connections — и как from, и как to.
 * Это позволяет находить вложенные структуры, где межтреугольные связи
 * записаны в обратном направлении (from=ребёнок, to=родитель).
 *
 * @returns {Map<string, Array<{neighborId: string, mySide: string, neighborSide: string}>>}
 */
function buildAdjacencyList(connections, cardsMap) {
  const adj = new Map()

  for (const conn of connections) {
    if (!cardsMap.has(conn.from) || !cardsMap.has(conn.to)) continue

    // Связь со стороны from-карточки
    if (!adj.has(conn.from)) adj.set(conn.from, [])
    adj.get(conn.from).push({
      neighborId: conn.to,
      mySide: conn.fromSide || 'left',
      neighborSide: conn.toSide || 'top'
    })

    // Связь со стороны to-карточки (обратное направление)
    if (!adj.has(conn.to)) adj.set(conn.to, [])
    adj.get(conn.to).push({
      neighborId: conn.from,
      mySide: conn.toSide || 'top',
      neighborSide: conn.fromSide || 'left'
    })
  }

  return adj
}

/**
 * Нормализует сторону в контексте бинарного дерева.
 * "left" → "left", "right" → "right"
 * Всё остальное ("top", "bottom") → null (подвесить на первую свободную)
 */
function normalizeSide(side) {
  const s = String(side || '').toLowerCase()
  if (s === 'left') return 'left'
  if (s === 'right') return 'right'
  return null
}

/**
 * Строит дерево из connections, начиная от rootId.
 *
 * Использует двунаправленный обход: для каждой карточки находит ВСЕ связи,
 * где она участвует (и как from, и как to). При BFS от корня:
 * - Кто уже посещён = ближе к корню = родитель
 * - Кто ещё не посещён = дальше от корня = ребёнок
 * - Сторона определяется по стороне РОДИТЕЛЯ в данном connection
 *
 * @returns {Map<string, {left: string|null, right: string|null}>}
 */
function buildTree(rootId, connections, cardsMap) {
  const adj = buildAdjacencyList(connections, cardsMap)
  const children = new Map()
  const visited = new Set()
  const queue = [rootId]
  visited.add(rootId)

  while (queue.length > 0) {
    const currentId = queue.shift()
    const edges = adj.get(currentId) || []

    if (!children.has(currentId)) {
      children.set(currentId, { left: null, right: null })
    }
    const node = children.get(currentId)

    // Группируем непосещённых соседей по стороне на текущей (родительской) карточке
    const leftCandidates = []
    const rightCandidates = []
    const unassigned = []

    for (const edge of edges) {
      if (visited.has(edge.neighborId)) continue
      if (!cardsMap.has(edge.neighborId)) continue

      const side = normalizeSide(edge.mySide)
      if (side === 'left') {
        leftCandidates.push(edge.neighborId)
      } else if (side === 'right') {
        rightCandidates.push(edge.neighborId)
      } else {
        unassigned.push(edge.neighborId)
      }
    }

    // Назначаем первого кандидата каждой стороны
    if (leftCandidates.length > 0 && node.left === null) {
      node.left = leftCandidates[0]
      visited.add(leftCandidates[0])
      queue.push(leftCandidates[0])
    }
    if (rightCandidates.length > 0 && node.right === null) {
      node.right = rightCandidates[0]
      visited.add(rightCandidates[0])
      queue.push(rightCandidates[0])
    }

    // Если на одной стороне >1 кандидата — дополнительные на свободную сторону или цепочкой
    for (let i = 1; i < leftCandidates.length; i++) {
      const extra = leftCandidates[i]
      if (visited.has(extra)) continue
      if (node.right === null) {
        node.right = extra
      } else {
        // Обе стороны заняты — подвесить цепочкой к предыдущему left-кандидату
        attachAsChain(leftCandidates[i - 1], extra, 'left', children)
      }
      visited.add(extra)
      queue.push(extra)
    }
    for (let i = 1; i < rightCandidates.length; i++) {
      const extra = rightCandidates[i]
      if (visited.has(extra)) continue
      if (node.left === null) {
        node.left = extra
      } else {
        attachAsChain(rightCandidates[i - 1], extra, 'right', children)
      }
      visited.add(extra)
      queue.push(extra)
    }

    // Unassigned (top/bottom) — на первую свободную сторону
    for (const neighborId of unassigned) {
      if (visited.has(neighborId)) continue
      if (node.left === null) {
        node.left = neighborId
      } else if (node.right === null) {
        node.right = neighborId
      }
      visited.add(neighborId)
      queue.push(neighborId)
    }

    // Инициализируем записи для всех добавленных детей
    if (node.left && !children.has(node.left)) {
      children.set(node.left, { left: null, right: null })
    }
    if (node.right && !children.has(node.right)) {
      children.set(node.right, { left: null, right: null })
    }
  }

  return children
}

/**
 * Подвешивает дополнительного ребёнка цепочкой к предыдущему кандидату.
 */
function attachAsChain(parentId, childId, side, children) {
  if (!children.has(parentId)) {
    children.set(parentId, { left: null, right: null })
  }
  const parentNode = children.get(parentId)

  if (side === 'left' && parentNode.left === null) {
    parentNode.left = childId
  } else if (side === 'right' && parentNode.right === null) {
    parentNode.right = childId
  } else if (parentNode.left === null) {
    parentNode.left = childId
  } else if (parentNode.right === null) {
    parentNode.right = childId
  }

  if (!children.has(childId)) {
    children.set(childId, { left: null, right: null })
  }
}

/**
 * Собирает все достижимые узлы от nodeId.
 */
function collectReachable(nodeId, children, visited) {
  if (visited.has(nodeId)) return
  visited.add(nodeId)
  const node = children.get(nodeId)
  if (!node) return
  if (node.left) collectReachable(node.left, children, visited)
  if (node.right) collectReachable(node.right, children, visited)
}

/**
 * Вычисляет ширину поддерева (bottom-up).
 *
 * subtreeWidth(leaf) = card.width
 * subtreeWidth(node) = max(card.width, subtreeWidth(left) + horizontalGap + subtreeWidth(right))
 * Если у узла только один ребёнок — subtreeWidth = max(card.width, subtreeWidth(child))
 */
function computeSubtreeWidth(nodeId, children, cardsMap, subtreeWidths, visited, horizontalGap) {
  if (visited.has(nodeId)) {
    subtreeWidths.set(nodeId, 0)
    return
  }
  visited.add(nodeId)

  const card = cardsMap.get(nodeId)
  if (!card) {
    subtreeWidths.set(nodeId, 0)
    return
  }

  const { width: cardWidth } = getCardDimensions(card)
  const node = children.get(nodeId)

  if (!node || (node.left === null && node.right === null)) {
    // Лист
    subtreeWidths.set(nodeId, cardWidth)
    return
  }

  const hasLeft = node.left !== null
  const hasRight = node.right !== null

  if (hasLeft) {
    computeSubtreeWidth(node.left, children, cardsMap, subtreeWidths, visited, horizontalGap)
  }
  if (hasRight) {
    computeSubtreeWidth(node.right, children, cardsMap, subtreeWidths, visited, horizontalGap)
  }

  const leftWidth = hasLeft ? (subtreeWidths.get(node.left) || 0) : 0
  const rightWidth = hasRight ? (subtreeWidths.get(node.right) || 0) : 0

  let totalWidth

  if (hasLeft && hasRight) {
    totalWidth = Math.max(cardWidth, leftWidth + horizontalGap + rightWidth)
  } else if (hasLeft) {
    totalWidth = Math.max(cardWidth, leftWidth)
  } else {
    totalWidth = Math.max(cardWidth, rightWidth)
  }

  subtreeWidths.set(nodeId, totalWidth)
}

/**
 * Рекурсивно назначает позиции (children-first, then center parent).
 *
 * Сначала размещает детей, затем центрирует родителя между центрами
 * непосредственных детей. Это гарантирует что родитель визуально стоит
 * точно посередине между left и right.
 */
function layoutNode(nodeId, x, y, children, cardsMap, subtreeWidths, positions, horizontalGap, verticalGap) {
  const card = cardsMap.get(nodeId)
  if (!card) return

  const { width: cardWidth, height: cardHeight } = getCardDimensions(card)

  const node = children.get(nodeId)
  const hasLeft = node && node.left !== null
  const hasRight = node && node.right !== null

  if (!node || (!hasLeft && !hasRight)) {
    // Лист — ставим по allocatedX
    positions.set(nodeId, { x, y })
    return
  }

  const childY = y + cardHeight + verticalGap

  if (hasLeft && hasRight) {
    const leftSubWidth = subtreeWidths.get(node.left) || 0
    const leftStart = x
    const rightStart = x + leftSubWidth + horizontalGap

    // Сначала размещаем детей рекурсивно
    layoutNode(node.left, leftStart, childY, children, cardsMap, subtreeWidths, positions, horizontalGap, verticalGap)
    layoutNode(node.right, rightStart, childY, children, cardsMap, subtreeWidths, positions, horizontalGap, verticalGap)

    // Центрируем родителя между центрами непосредственных детей
    const leftChildPos = positions.get(node.left)
    const rightChildPos = positions.get(node.right)
    const leftChildDims = getCardDimensions(cardsMap.get(node.left))
    const rightChildDims = getCardDimensions(cardsMap.get(node.right))

    const leftChildCenter = leftChildPos.x + leftChildDims.width / 2
    const rightChildCenter = rightChildPos.x + rightChildDims.width / 2
    const parentCenter = (leftChildCenter + rightChildCenter) / 2
    const parentX = parentCenter - cardWidth / 2

    positions.set(nodeId, { x: parentX, y })

  } else {
    // Один ребёнок — центрируем над ним
    const childId = hasLeft ? node.left : node.right

    layoutNode(childId, x, childY, children, cardsMap, subtreeWidths, positions, horizontalGap, verticalGap)

    const childPos = positions.get(childId)
    const childDims = getCardDimensions(cardsMap.get(childId))
    const childCenter = childPos.x + childDims.width / 2
    const parentX = childCenter - cardWidth / 2

    positions.set(nodeId, { x: parentX, y })
  }
}
