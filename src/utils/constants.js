// Константы для цветовой палитры заголовков карточек

export const HEADER_COLORS = [
  { rgb: 'rgb(93, 139, 244)', name: 'Синий' },      // 0: Синий (по умолчанию)
  { rgb: 'rgb(76, 175, 80)', name: 'Зелёный' },     // 1: Зелёный
  { rgb: 'rgb(255, 235, 59)', name: 'Жёлтый' },     // 2: Жёлтый
  { rgb: 'rgb(255, 152, 0)', name: 'Оранжевый' },   // 3: Оранжевый
  { rgb: 'rgb(244, 67, 54)', name: 'Красный' },     // 4: Красный
  { rgb: 'rgb(156, 39, 176)', name: 'Фиолетовый' }, // 5: Фиолетовый
  { rgb: 'rgb(158, 158, 158)', name: 'Серый' },     // 6: Серый
  { rgb: 'rgb(255, 255, 255)', name: 'Белый' }      // 7: Белый
];

// Получить цвет по индексу
export function getHeaderColorByIndex(index) {
  return HEADER_COLORS[index] || HEADER_COLORS[0];
}

// Получить RGB строку по индексу
export function getHeaderColorRgb(index) {
  return getHeaderColorByIndex(index).rgb;
}