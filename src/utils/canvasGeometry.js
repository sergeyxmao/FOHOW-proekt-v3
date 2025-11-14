export const MARKER_OFFSET = 12;

const SIDES = new Set(['top', 'bottom', 'left', 'right']);

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getCardConnectorPoint(card, side) {
  if (!card) {
    return { x: 0, y: 0 };
  }

  const width = toFiniteNumber(card.width);
  const height = toFiniteNumber(card.height);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const x = toFiniteNumber(card.x);
  const y = toFiniteNumber(card.y);

  switch (side) {
    case 'top':
      return { x: x + halfWidth, y };
    case 'bottom':
      return { x: x + halfWidth, y: y + height };
    case 'left':
      return { x, y: y + halfHeight };
    case 'right':
      return { x: x + width, y: y + halfHeight };
    default:
      return { x: x + halfWidth, y: y + halfHeight };
  }
}

export function resolveConnectionSides(fromCard, toCard, preferredFromSide, preferredToSide) {
  if (SIDES.has(preferredFromSide) && SIDES.has(preferredToSide)) {
    return { fromSide: preferredFromSide, toSide: preferredToSide };
  }

  let fromSide = 'right';
  let toSide = 'left';

  if (fromCard && toCard) {
    if (fromCard.x > toCard.x) {
      fromSide = 'left';
      toSide = 'right';
    } else if (fromCard.y > toCard.y) {
      fromSide = 'top';
      toSide = 'bottom';
    } else if (fromCard.y < toCard.y) {
      fromSide = 'bottom';
      toSide = 'top';
    }
  }

  return { fromSide, toSide };
}

function dedupePoints(points) {
  return points.filter((point, index, array) => {
    if (!point) {
      return false;
    }

    if (index === 0) {
      return true;
    }

    const prevPoint = array[index - 1];
    return !(prevPoint && prevPoint.x === point.x && prevPoint.y === point.y);
  });
}

function formatPoint(value) {
  return Number.parseFloat(Number(value).toFixed(2));
}

export function buildOrthogonalConnectionPath(startAnchor, endAnchor, fromSide, toSide) {
  if (!startAnchor || !endAnchor) {
    return { d: '', points: [] };
  }

  const startPoint = { ...startAnchor };
  const endPoint = { ...endAnchor };
  const controlPoint = {};

  switch (fromSide) {
    case 'top':
      startPoint.y -= MARKER_OFFSET;
      break;
    case 'bottom':
      startPoint.y += MARKER_OFFSET;
      break;
    case 'left':
      startPoint.x -= MARKER_OFFSET;
      break;
    case 'right':
      startPoint.x += MARKER_OFFSET;
      break;
  }

  if (toSide) {
    switch (toSide) {
      case 'top':
        endPoint.y -= MARKER_OFFSET;
        break;
      case 'bottom':
        endPoint.y += MARKER_OFFSET;
        break;
      case 'left':
        endPoint.x -= MARKER_OFFSET;
        break;
      case 'right':
        endPoint.x += MARKER_OFFSET;
        break;
    }
  }

  if (fromSide === 'left' || fromSide === 'right') {
    controlPoint.x = endPoint.x;
    controlPoint.y = startPoint.y;
  } else {
    controlPoint.x = startPoint.x;
    controlPoint.y = endPoint.y;
  }

  const points = dedupePoints([
    { x: formatPoint(startAnchor.x), y: formatPoint(startAnchor.y) },
    { x: formatPoint(startPoint.x), y: formatPoint(startPoint.y) },
    { x: formatPoint(controlPoint.x), y: formatPoint(controlPoint.y) },
    { x: formatPoint(endPoint.x), y: formatPoint(endPoint.y) },
    { x: formatPoint(endAnchor.x), y: formatPoint(endAnchor.y) }
  ]);

  if (!points.length) {
    return { d: '', points: [] };
  }

  const [firstPoint, ...rest] = points;
  const commands = [`M ${firstPoint.x} ${firstPoint.y}`];

  rest.forEach(point => {
    commands.push(`L ${point.x} ${point.y}`);
  });

  return { d: commands.join(' '), points };
}

export function buildConnectionGeometry(connection, fromCard, toCard) {
  if (!connection || !fromCard || !toCard) {
    return null;
  }

  const { fromSide, toSide } = resolveConnectionSides(
    fromCard,
    toCard,
    connection.fromSide,
    connection.toSide
  );

  const startAnchor = getCardConnectorPoint(fromCard, fromSide);
  const endAnchor = getCardConnectorPoint(toCard, toSide);

  return {
    ...buildOrthogonalConnectionPath(startAnchor, endAnchor, fromSide, toSide),
    fromSide,
    toSide
  };
}

export function getPointsBoundingBox(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(point => {
    if (!point) {
      return;
    }

    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

export function expandBoundingBox(box, padding) {
  if (!box) {
    return null;
  }

  const offset = Number.isFinite(padding) ? padding : 0;

  return {
    minX: box.minX - offset,
    minY: box.minY - offset,
    maxX: box.maxX + offset,
    maxY: box.maxY + offset
  };
}

export function mergeBoundingBoxes(base, addition) {
  if (!addition) {
    return base || null;
  }

  if (!base) {
    return addition;
  }

  return {
    minX: Math.min(base.minX, addition.minX),
    minY: Math.min(base.minY, addition.minY),
    maxX: Math.max(base.maxX, addition.maxX),
    maxY: Math.max(base.maxY, addition.maxY)
  };
}
