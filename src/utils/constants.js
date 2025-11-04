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

export const CARD_STYLE_DEFAULTS = {
  borderColor: '#c8d9ff',
  goldBorderColor: '#d1ad44',
  shellBackground: '#f7fbff',
  goldShellBackground: '#fff8ea',
  fill: '#ffffff',
  bodyDivider: 'rgba(47, 128, 237, 0.2)',
  goldBodyDivider: 'rgba(209, 173, 68, 0.38)',
  bodyBackground: '#ffffff'
};

export function buildCardCssVariables(card, strokeWidth = 2) {
  const type = card?.type;
  const isGoldCard = type === 'gold';

  const baseFill = card?.fill || CARD_STYLE_DEFAULTS.fill;
  const bodyBackground = card?.bodyGradient || baseFill;
  const shellBackground = card?.shellBackground
    || (isGoldCard ? CARD_STYLE_DEFAULTS.goldShellBackground : CARD_STYLE_DEFAULTS.shellBackground);

  const rawStroke = typeof card?.stroke === 'string' ? card.stroke.trim() : '';
  const hasCustomStroke = rawStroke && rawStroke.toLowerCase() !== '#000000';
  const borderColor = hasCustomStroke
    ? rawStroke
    : (isGoldCard ? CARD_STYLE_DEFAULTS.goldBorderColor : CARD_STYLE_DEFAULTS.borderColor);

  const cssVariables = {
    '--card-shell-background': shellBackground,
    '--card-border': `${strokeWidth}px solid ${borderColor}`,
    '--card-border-color': borderColor,
    '--card-fill': baseFill,
    '--card-body-gradient': isGoldCard ? bodyBackground : 'none',
    '--card-body-background': isGoldCard ? bodyBackground : CARD_STYLE_DEFAULTS.bodyBackground,
    '--card-body-divider': isGoldCard ? CARD_STYLE_DEFAULTS.goldBodyDivider : CARD_STYLE_DEFAULTS.bodyDivider
  };

  return {
    cssVariables,
    shellBackground,
    borderColor,
    cardFill: baseFill,
    bodyBackground,
    bodyDivider: cssVariables['--card-body-divider'],
    isGoldCard
  };  
}
