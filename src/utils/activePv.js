function toInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return Math.trunc(parsed);
  }
  return 0;
}
const ACTIVE_PV_BASE = 330;

function normalizePair(left, right) {
  const normalizedLeft = Math.max(0, toInteger(left));
  const normalizedRight = Math.max(0, toInteger(right));
  const total = normalizedLeft + normalizedRight;
  return {
    left: normalizedLeft,
    right: normalizedRight,
    total,
    formatted: `${normalizedLeft} / ${normalizedRight}`
  };
}
function ensureManualPair(source) {
  const parsed = parseActivePV(source);
  return {
    left: parsed.left,
    right: parsed.right,
    total: parsed.left + parsed.right,
    formatted: parsed.formatted
  };
}

function toChildArray(collection) {
  if (!collection) {
    return [];
  }
  if (Array.isArray(collection)) {
    return collection.filter(Boolean);
  }
  if (collection instanceof Set) {
    return Array.from(collection).filter(Boolean);
  }
  if (typeof collection === 'object') {
    return Object.values(collection).filter(Boolean);
  }
  return [];
}
export function parseActivePV(source) {
  if (!source) {
    return normalizePair(0, 0);
  }

  if (typeof source === 'object') {
    const left = toInteger(source.left ?? source.L ?? source.l ?? 0);
    const right = toInteger(source.right ?? source.R ?? source.r ?? 0);
    return normalizePair(left, right);
  }

  if (typeof source === 'string') {
    const cleaned = source.replace(/,/g, '.');
    const matches = cleaned.match(/-?\d+/g);
    if (matches && matches.length >= 2) {
      return normalizePair(matches[0], matches[1]);
    }

    const parts = cleaned.split('/');
    if (parts.length >= 2) {
      return normalizePair(parts[0], parts[1]);
    }

    const value = toInteger(cleaned);
    return normalizePair(value, 0);
  }

  if (typeof source === 'number' && Number.isFinite(source)) {
    return normalizePair(source, 0);
  }

  return normalizePair(0, 0);
}

export function setActivePV(target, nextValue = {}) {
  const normalized = parseActivePV(nextValue);

  if (target && typeof target === 'object') {
    target.activePv = normalized.formatted;
    target.activePvLocal = {
      left: normalized.left,
      right: normalized.right,
      total: normalized.total
    };
     target.activePvManual = {
      left: normalized.left,
      right: normalized.right,
      total: normalized.total
    };   
  }

  return normalized;
}

function extractChildren(meta = {}, cardId, side) {
  if (!cardId) {
    return [];
  }
  const raw = meta.children?.[cardId];
  if (!raw) {
    return [];
  }

  const bucket = side === 'right' ? raw.right : raw.left;
  return toChildArray(bucket);
}

function getManualMap(cards = []) {
  const map = new Map();
  cards.forEach(card => {
    if (!card || !card.id) {
      return;
    }
    const manualSource = card.activePvManual ?? card.activePvLocal ?? card.activePv;
    const manual = ensureManualPair(manualSource);
    map.set(card.id, manual);
  });
  return map;
}

export function propagateActivePvUp(cards = [], meta = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {};
  }

  const cardMap = new Map();
  cards.forEach(card => {
    if (card && card.id) {
      cardMap.set(card.id, card);
    }
  });
  if (cardMap.size === 0) {
    return {};
  }

  const manualMap = getManualMap(cards);
  const cache = new Map();

  const computeState = (cardId) => {
    if (!cardMap.has(cardId)) {
      return {
        manual: { left: 0, right: 0 },
        remainder: { left: 0, right: 0 },
        units: { left: 0, right: 0 },
        totals: { left: 0, right: 0, overall: 0 }
      };
    }

    if (cache.has(cardId)) {
      return cache.get(cardId);
    }

    const manual = manualMap.get(cardId) || { left: 0, right: 0, total: 0 };

    const children = extractChildren(meta, cardId);

    let leftPv = Math.max(0, toInteger(manual.left));
    let rightPv = Math.max(0, toInteger(manual.right));
    leftChildren.forEach(childId => {
      if (!cardMap.has(childId)) {
        return;
      }
      const childState = computeState(childId);
      leftPv += childState.totals.overall;
    });

    const rightChildren = extractChildren(meta, cardId, 'right');
    rightChildren.forEach(childId => {
      if (!cardMap.has(childId)) {
        return;
      }
      const childState = computeState(childId);
      rightPv += childState.totals.overall;
    });

    leftPv = Math.max(0, leftPv);
    rightPv = Math.max(0, rightPv);

    const unitsLeft = Math.floor(leftPv / ACTIVE_PV_BASE);
    const unitsRight = Math.floor(rightPv / ACTIVE_PV_BASE);

    const remainderLeft = leftPv - (unitsLeft * ACTIVE_PV_BASE);
    const remainderRight = rightPv - (unitsRight * ACTIVE_PV_BASE);

    const state = {
      manual: {
        left: Math.max(0, toInteger(manual.left)),
        right: Math.max(0, toInteger(manual.right))
      },
      remainder: {
        left: remainderLeft,
        right: remainderRight
      },
      units: {
        left: unitsLeft,
        right: unitsRight
      },
      totals: {
        left: remainderLeft + unitsLeft * ACTIVE_PV_BASE,
        right: remainderRight + unitsRight * ACTIVE_PV_BASE,
        overall: (remainderLeft + unitsLeft * ACTIVE_PV_BASE) + (remainderRight + unitsRight * ACTIVE_PV_BASE)
      }
    };

    return aggregated;
  };

  cardMap.forEach((_, cardId) => {
    cache.set(cardId, state);
    return state;
  });

  const result = {};
  cache.forEach((state, cardId) => {
    result[cardId] = {
      manual: {
        left: state.manual.left,
        right: state.manual.right,
        total: state.manual.left + state.manual.right
      },
      remainder: {
        left: state.remainder.left,
        right: state.remainder.right
      },
      units: {
        left: state.units.left,
        right: state.units.right,
        total: state.units.left + state.units.right
      },
      totals: {
        left: state.totals.left,
        right: state.totals.right,
        overall: state.totals.overall
      }
    };
  });

  return result;
}

export default {
  parseActivePV,
  setActivePV,
  propagateActivePvUp
};
