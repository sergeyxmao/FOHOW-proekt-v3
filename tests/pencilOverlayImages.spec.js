import test from 'node:test';
import assert from 'node:assert/strict';
import { toCanvasPoint } from '../src/utils/canvasCoordinates.js';
import { buildPlacedImage, movePlacedImage, resizePlacedImage } from '../src/utils/placedImages.js';

const rect = { left: 0, top: 0 };

test('toCanvasPoint учитывает zoom и canvasScale при дропе', () => {
  const pointAtScaleTwo = toCanvasPoint({
    clientX: 200,
    clientY: 150,
    rect,
    zoomScale: 2,
    canvasScale: 2
  });

  assert.deepStrictEqual(pointAtScaleTwo, { x: 200, y: 150 });

  const pointAtScaleHalf = toCanvasPoint({
    clientX: 150,
    clientY: 100,
    rect,
    zoomScale: 0.5,
    canvasScale: 1
  });

  assert.deepStrictEqual(pointAtScaleHalf, { x: 300, y: 200 });
});

test('buildPlacedImage создаёт ограниченный по холсту прямоугольник', () => {
  const draft = buildPlacedImage({
    id: 'draft-1',
    src: '/image.png',
    originalWidth: 1200,
    originalHeight: 800,
    point: { x: 50, y: 50 },
    canvasWidth: 800,
    canvasHeight: 600,
    maxSize: 400
  });

  assert.strictEqual(draft.width, 400);
  assert.strictEqual(draft.height, 267);
  assert.strictEqual(draft.x, 0);
  assert.strictEqual(draft.y, 0);
});

test('movePlacedImage смещает и ограничивает изображение', () => {
  const image = {
    id: 'img',
    src: '/img',
    x: 100,
    y: 80,
    width: 200,
    height: 150,
    rotation: 0
  };

  const moved = movePlacedImage(image, 50, -40, 400, 300);
  assert.deepStrictEqual(moved.x, 150);
  assert.deepStrictEqual(moved.y, 40);

  const clamped = movePlacedImage(image, 500, 500, 400, 300);
  assert.deepStrictEqual(clamped.x, 200);
  assert.deepStrictEqual(clamped.y, 150);
});

test('resizePlacedImage меняет размеры с ручками и соблюдает минимум', () => {
  const image = {
    id: 'img',
    src: '/img',
    x: 100,
    y: 100,
    width: 120,
    height: 80,
    rotation: 0
  };

  const resizedBR = resizePlacedImage(image, 'bottom-right', 30, 20, 400, 300, 50);
  assert.deepStrictEqual(resizedBR.width, 150);
  assert.deepStrictEqual(resizedBR.height, 100);

  const resizedLeft = resizePlacedImage(image, 'left', -300, 0, 400, 300, 60);
  assert.deepStrictEqual(resizedLeft.width, 400);
  assert.strictEqual(resizedLeft.x, 0);
  assert.strictEqual(resizedLeft.height, 80);
});

test('состояния можно откатить через историю операций', () => {
  const history = [];
  const first = buildPlacedImage({
    id: 'h1',
    src: '/img',
    originalWidth: 200,
    originalHeight: 200,
    point: { x: 150, y: 150 },
    canvasWidth: 400,
    canvasHeight: 400,
    maxSize: 200
  });
  history.push(first);

  const moved = movePlacedImage(first, 40, 20, 400, 400);
  history.push(moved);

  const resized = resizePlacedImage(moved, 'bottom-right', 10, 30, 400, 400, 30);
  history.push(resized);

  const last = history.pop();
  assert.strictEqual(last.width, 210);
  assert.strictEqual(last.height, 230);

  const undoState = history.pop();
  assert.strictEqual(undoState.x, moved.x);
  assert.strictEqual(undoState.y, moved.y);
  assert.deepStrictEqual(history.at(-1), first);
});
