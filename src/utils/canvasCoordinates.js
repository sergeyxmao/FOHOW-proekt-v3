export const toCanvasPoint = ({ clientX, clientY, rect, zoomScale = 1, canvasScale = 1 }) => {
  if (!rect) {
    return null;
  }

  const safeZoom = zoomScale || 1;
  const safeCanvasScale = canvasScale || 1;

  return {
    x: ((clientX - rect.left) / safeZoom) * safeCanvasScale,
    y: ((clientY - rect.top) / safeZoom) * safeCanvasScale
  };
};
