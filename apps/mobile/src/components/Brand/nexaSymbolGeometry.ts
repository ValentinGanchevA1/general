export const NEXA_SYMBOL_VIEWBOX = 160;

export const NEXA_EYE = {
  centerX: 80,
  centerY: 82,

  upperLeft: 'M80 52 C60 42 36 53 19 76',
  upperRight: 'M80 52 C101 43 125 56 141 75',

  lowerLeft: 'M24 92 C41 105 58 113 72 115',
  lowerRight: 'M88 115 C103 113 120 105 136 91',

  irisRadius: 27,
  pupilRadius: 11,
} as const;

export const NEXA_EYE_PATH_LENGTH = {
  upper: 78,
  lower: 63,
  iris: Math.PI * 2 * NEXA_EYE.irisRadius,
} as const;
