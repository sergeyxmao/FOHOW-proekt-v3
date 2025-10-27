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
  }

  return normalized;
}

function extractChildren(meta = {}, cardId) {
  const raw = meta.children?.[cardId];
  if (!raw) {
    return { left: [], right: [] };
  }

  const toArray = (collection) => {
    if (Array.isArray(collection)) {
      return collection.filter(Boolean);
    }
    if (collection instanceof Set) {
      return Array.from(collection).filter(Boolean);
    }
    if (typeof collection === 'object' && collection) {
      return Object.values(collection).filter(Boolean);
    }
    return [];
  };

  return {
    left: toArray(raw.left),
    right: toArray(raw.right)
  };
}

export function propagateActivePvUp(cards = [], meta = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {};
  }

  const cardMap = new Map();
  const localMap = new Map();

  cards.forEach(card => {
    if (!card || !card.id) {
      return;
    }
    cardMap.set(card.id, card);
    const local = card.activePvLocal ? parseActivePV(card.activePvLocal) : parseActivePV(card.activePv);
    localMap.set(card.id, local);
  });

  const cache = new Map();
  const result = {};

  const computeAggregated = (cardId) => {
    if (!cardId || !cardMap.has(cardId)) {
      return normalizePair(0, 0);
    }

    if (cache.has(cardId)) {
      return cache.get(cardId);
    }

    const local = localMap.get(cardId) || normalizePair(0, 0);
    let left = local.left;
    let right = local.right;

    const children = extractChildren(meta, cardId);

    children.left.forEach(childId => {
      const aggregatedChild = computeAggregated(childId);
      left += aggregatedChild.total;
    });

    children.right.forEach(childId => {
      const aggregatedChild = computeAggregated(childId);
      right += aggregatedChild.total;
    });

    const aggregated = {
      left,
      right,
      total: left + right
    };

    cache.set(cardId, aggregated);
    result[cardId] = {
      local,
      aggregated
    };

    return aggregated;
  };

  cardMap.forEach((_, cardId) => {
    computeAggregated(cardId);
  });

  return result;
}

export default {
  parseActivePV,
  setActivePV,
  propagateActivePvUp
};
