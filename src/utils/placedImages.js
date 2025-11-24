import { calculateImageDisplaySize, DEFAULT_MAX_IMAGE_SIZE } from './imageSizing.js';

export const MIN_PLACED_IMAGE_SIZE = 16;

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

export const buildPlacedImage = ({
  id,
  src,
  originalWidth,
  originalHeight,
  point,
  canvasWidth,
  canvasHeight,
  maxSize = DEFAULT_MAX_IMAGE_SIZE
}) => {
  const size = calculateImageDisplaySize(originalWidth, originalHeight, maxSize);
  const x = point.x - size.width / 2;
  const y = point.y - size.height / 2;

  const clampedX = clampValue(x, 0, Math.max(0, (canvasWidth || size.width) - size.width));
  const clampedY = clampValue(y, 0, Math.max(0, (canvasHeight || size.height) - size.height));

  return {
    id,
    src,
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    width: Math.round(size.width),
    height: Math.round(size.height),
    rotation: 0
  };
};

export const movePlacedImage = (image, dx, dy, canvasWidth, canvasHeight) => {
  if (!image) return null;
  const maxX = Math.max(0, (canvasWidth || image.width) - image.width);
  const maxY = Math.max(0, (canvasHeight || image.height) - image.height);

  return {
    ...image,
    x: Math.round(clampValue(image.x + dx, 0, maxX)),
    y: Math.round(clampValue(image.y + dy, 0, maxY))
  };
};

const resizeEdge = (value, delta, size) => {
  return {
    value: value + delta,
    size: size - delta
  };
};

const enforceMinSize = (rect, minSize) => {
  const width = Math.max(rect.width, minSize);
  const height = Math.max(rect.height, minSize);
  const deltaX = rect.width < minSize ? minSize - rect.width : 0;
  const deltaY = rect.height < minSize ? minSize - rect.height : 0;

  return {
    x: rect.x - deltaX,
    y: rect.y - deltaY,
    width,
    height
  };
};

export const resizePlacedImage = (
  image,
  handle,
  dx,
  dy,
  canvasWidth,
  canvasHeight,
  minSize = MIN_PLACED_IMAGE_SIZE
) => {
  if (!image) return null;

  const rect = { ...image };

  switch (handle) {
    case 'top-left': {
      const next = resizeEdge(rect.x, dx, rect.width);
      rect.x = next.value;
      rect.width = next.size;
      const nextY = resizeEdge(rect.y, dy, rect.height);
      rect.y = nextY.value;
      rect.height = nextY.size;
      break;
    }
    case 'top': {
      const nextY = resizeEdge(rect.y, dy, rect.height);
      rect.y = nextY.value;
      rect.height = nextY.size;
      break;
    }
    case 'top-right': {
      rect.width += dx;
      const nextY = resizeEdge(rect.y, dy, rect.height);
      rect.y = nextY.value;
      rect.height = nextY.size;
      break;
    }
    case 'right': {
      rect.width += dx;
      break;
    }
    case 'bottom-right': {
      rect.width += dx;
      rect.height += dy;
      break;
    }
    case 'bottom': {
      rect.height += dy;
      break;
    }
    case 'bottom-left': {
      rect.width -= dx;
      rect.x += dx;
      rect.height += dy;
      break;
    }
    case 'left':
    default: {
      rect.width -= dx;
      rect.x += dx;
      break;
    }
  }

  const normalized = enforceMinSize(rect, minSize);

  const safeWidth = canvasWidth || normalized.width;
  const safeHeight = canvasHeight || normalized.height;

  const maxX = Math.max(0, safeWidth - normalized.width);
  const maxY = Math.max(0, safeHeight - normalized.height);

  return {
    ...image,
    x: Math.round(clampValue(normalized.x, 0, maxX)),
    y: Math.round(clampValue(normalized.y, 0, maxY)),
    width: Math.round(Math.min(normalized.width, safeWidth)),
    height: Math.round(Math.min(normalized.height, safeHeight))
  };
};
