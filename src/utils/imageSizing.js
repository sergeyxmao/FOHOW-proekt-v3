export const DEFAULT_MAX_IMAGE_SIZE = 500;

export const calculateImageDisplaySize = (originalWidth, originalHeight, maxSize = DEFAULT_MAX_IMAGE_SIZE) => {
  if (originalWidth <= maxSize && originalHeight <= maxSize) {
    return { width: originalWidth, height: originalHeight };
  }

  let displayWidth;
  let displayHeight;

  if (originalWidth > originalHeight) {
    displayWidth = maxSize;
    displayHeight = (originalHeight / originalWidth) * maxSize;
  } else if (originalHeight > originalWidth) {
    displayHeight = maxSize;
    displayWidth = (originalWidth / originalHeight) * maxSize;
  } else {
    displayWidth = maxSize;
    displayHeight = maxSize;
  }

  return {
    width: Math.round(displayWidth),
    height: Math.round(displayHeight)
  };
};
