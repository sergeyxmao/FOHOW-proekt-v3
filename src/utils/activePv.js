const ACTIVE_PV_BASE = 330;

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

function clampRemainder(value) {
  const normalized = Math.max(0, toInteger(value));
  return normalized % ACTIVE_PV_BASE;
}

function normalizeSide(side) {
  return side === 'right' ? 'right' : 'left';
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

function ensureManualPair(source) {
  const parsed = parseActivePV(source);
  return {
    left: parsed.left,
    right: parsed.right,
    total: parsed.left + parsed.right,
    formatted: parsed.formatted
  };
}

function cloneState(state) {
  return {
    activePv: {
      left: state.activePv.left,
      right: state.activePv.right
    },
    activePacks: state.activePacks,
    localBalance: {
      left: state.localBalance.left,
      right: state.localBalance.right
    },    
    balance: {
      left: state.balance.left,
      right: state.balance.right
    },
    cycles: state.cycles
  };
}

function createEmptyState() {
  return {
    activePv: { left: 0, right: 0 },
    activePacks: 0,
    localBalance: { left: 0, right: 0 },    
    balance: { left: 0, right: 0 },
    cycles: 0
  };
}

function normalizeState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return createEmptyState();
  }
  const activePvSource = rawState.activePv || {};
  const balanceSource = rawState.balance || {};
  const normalized = {
    activePv: {
      left: clampRemainder(activePvSource.left ?? activePvSource.L ?? activePvSource.l ?? rawState.left ?? 0),
      right: clampRemainder(activePvSource.right ?? activePvSource.R ?? activePvSource.r ?? rawState.right ?? 0)
    },
    activePacks: Math.max(0, toInteger(rawState.activePacks ?? rawState.packs ?? 0)),
    localBalance: {
      left: Math.max(0, toInteger(rawState.localBalance?.left ?? rawState.localBalance?.L ?? rawState.localBalance?.l ?? 0)),
      right: Math.max(0, toInteger(rawState.localBalance?.right ?? rawState.localBalance?.R ?? rawState.localBalance?.r ?? 0))
    },    
    balance: {
      left: Math.max(0, toInteger(balanceSource.left ?? balanceSource.L ?? balanceSource.l ?? 0)),
      right: Math.max(0, toInteger(balanceSource.right ?? balanceSource.R ?? balanceSource.r ?? 0))
    },
    cycles: Math.max(0, toInteger(rawState.cycles ?? rawState.cycle ?? 0))
  };
  return normalized;
}

function getStateFromCard(card = {}) {
  if (card.activePvState && typeof card.activePvState === 'object') {
    return normalizeState(card.activePvState);
  }
  const manual = ensureManualPair(card.activePvManual ?? card.activePvLocal ?? card.activePv);
  const leftTotal = Math.max(0, toInteger(manual.left));
  const rightTotal = Math.max(0, toInteger(manual.right));
  const packs = Math.floor(leftTotal / ACTIVE_PV_BASE) + Math.floor(rightTotal / ACTIVE_PV_BASE);
  return {
    activePv: {
      left: leftTotal % ACTIVE_PV_BASE,
      right: rightTotal % ACTIVE_PV_BASE
    },
    activePacks: packs,
    localBalance: { left: 0, right: 0 },    
    balance: { left: 0, right: 0 },
    cycles: 0
  };
}

function parseActivePV(source) {
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

function setActivePV(target, nextValue = {}) {
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

function prepareStateMap(cards = []) {
  const stateMap = new Map();
  cards.forEach(card => {
    if (!card || !card.id) {
      return;
    }
    stateMap.set(card.id, cloneState(getStateFromCard(card)));

  });
  return stateMap;
}

function serializeState(state) {
  return {
    activePv: { left: state.activePv.left, right: state.activePv.right },
    activePacks: state.activePacks,
    localBalance: { left: state.localBalance.left, right: state.localBalance.right },    
    balance: { left: state.balance.left, right: state.balance.right },
    cycles: state.cycles
  };
}

function buildUpdatePayload(state) {
  const left = state.activePv.left;
  const right = state.activePv.right;
  const total = left + right;
  return {
    activePvState: serializeState(state),
    activePvManual: { left, right, total },
    activePvLocal: { left, right, total },
    activePv: `${left} / ${right}`,
    activePvPacks: state.activePacks,
    activePvLocalBalance: {
      left: state.localBalance.left,
      right: state.localBalance.right,
      total: state.localBalance.left + state.localBalance.right
    },    
    activePvBalance: { left: state.balance.left, right: state.balance.right },
    activePvCycles: state.cycles
  };
}

function propagateToAncestors(stateMap, meta, childId, amount, changed) {
  if (!amount) {
    return;
  }
  const parentLookup = meta?.parentOf || {};
  let currentId = childId;  

  while (true) {
    const relation = parentLookup[currentId];
    if (!relation || !relation.parentId) {
      break;
    }

    const parentId = relation.parentId;
    const side = normalizeSide(relation.side);
    const parentState = stateMap.get(parentId) || createEmptyState();

    const nextBalance = parentState.balance[side] + amount;
    const nonNegative = nextBalance < 0 ? 0 : nextBalance;
    parentState.balance[side] = Math.min(nonNegative, ACTIVE_PV_BASE);
    
    if (amount > 0) {
      while (parentState.balance.left >= ACTIVE_PV_BASE && parentState.balance.right >= ACTIVE_PV_BASE) {
        parentState.balance.left -= ACTIVE_PV_BASE;
        parentState.balance.right -= ACTIVE_PV_BASE;
        parentState.cycles += 1;
      }
    }

    stateMap.set(parentId, parentState);
    changed.add(parentId);
    currentId = parentId;
  }
}
function applyAddition(state, side, delta) {
  const amount = Math.max(0, toInteger(delta));
  if (amount <= 0) {
    return 0;
  }

  const previousRemainder = Math.max(0, toInteger(state.activePv[side]));
  const previousUnits = Math.max(0, toInteger(state.localBalance[side]));
  const previousTotal = previousRemainder + previousUnits * ACTIVE_PV_BASE;

  let remainderSum = previousRemainder + amount;
  let nextUnits = previousUnits;

  if (remainderSum >= ACTIVE_PV_BASE) {
    const extraUnits = Math.floor(remainderSum / ACTIVE_PV_BASE);
    nextUnits += extraUnits;
    state.activePacks += extraUnits;
    remainderSum -= extraUnits * ACTIVE_PV_BASE;  
  }

  state.activePv[side] = remainderSum;
  state.localBalance[side] = nextUnits;

  const totalAfter = remainderSum + nextUnits * ACTIVE_PV_BASE;
  const applied = totalAfter - previousTotal;

  return applied > 0 ? applied : 0;
}
function applySubtraction(state, side, delta) {
  const amount = Math.max(0, toInteger(-delta));
  if (amount <= 0) {
    return 0;
  }

  const previousRemainder = Math.max(0, toInteger(state.activePv[side]));
  const previousUnits = Math.max(0, toInteger(state.localBalance[side]));
  const previousTotal = previousRemainder + previousUnits * ACTIVE_PV_BASE;

  const take = Math.min(amount, previousRemainder);
  if (take <= 0) {
    return 0;
  }

  const newRemainder = previousRemainder - take;
  state.activePv[side] = newRemainder;

  const totalAfter = newRemainder + previousUnits * ACTIVE_PV_BASE;
  const applied = totalAfter - previousTotal;

  return applied < 0 ? applied : 0;
}

function applyDeltaInternal({ stateMap, meta, cardId, side, delta, changed }) {
  if (!cardId || !stateMap.has(cardId)) {
    return;
  }
  const normalizedSide = normalizeSide(side);
  const state = stateMap.get(cardId);
  const propagate = delta >= 0
    ? applyAddition(state, normalizedSide, delta)
    : applySubtraction(state, normalizedSide, delta);

  changed.add(cardId);

  if (propagate !== 0) {
    propagateToAncestors(stateMap, meta, cardId, propagate, changed);
  }
}

function buildUpdates(stateMap, changedIds) {
  const updates = {};
  changedIds.forEach(cardId => {
    const state = stateMap.get(cardId);
    if (!state) {
      return;
    }
    updates[cardId] = buildUpdatePayload(state);
  });
  return updates;
}

function applyActivePvDelta({ cards = [], meta = {}, cardId, side = 'left', delta = 0 }) {
  if (!cardId || !Number.isFinite(delta) || delta === 0) {
    return { updates: {} };
  }

  const stateMap = prepareStateMap(cards);
  const changed = new Set();

  applyDeltaInternal({ stateMap, meta, cardId, side, delta, changed });

  const updates = buildUpdates(stateMap, changed);
  return { updates, changedIds: Array.from(changed) };
}
function applyActivePvClear({ cards = [], meta = {}, cardId }) {
  if (!cardId) {
    return { updates: {} };
  }
  const stateMap = prepareStateMap(cards);
  if (!stateMap.has(cardId)) {
    return { updates: {} };
  }
  const changed = new Set();
  const state = stateMap.get(cardId);
  const leftRemainder = state.activePv.left;
  const rightRemainder = state.activePv.right;
  const leftBalance = state.balance.left;
  const rightBalance = state.balance.right;
  
  if (leftRemainder > 0) {
    applyDeltaInternal({ stateMap, meta, cardId, side: 'left', delta: -leftRemainder, changed });
  }
  if (rightRemainder > 0) {
    applyDeltaInternal({ stateMap, meta, cardId, side: 'right', delta: -rightRemainder, changed });
  }
  if (leftBalance > 0) {
    state.balance.left = 0;
    propagateToAncestors(stateMap, meta, cardId, -leftBalance, changed);
    changed.add(cardId);
  }

  if (rightBalance > 0) {
    state.balance.right = 0;
    propagateToAncestors(stateMap, meta, cardId, -rightBalance, changed);
    changed.add(cardId);
  }

  const updates = buildUpdates(stateMap, changed);
  return { updates, changedIds: Array.from(changed) };
}

function propagateActivePvUp(cards = [], meta = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {};
  }

  const stateMap = prepareStateMap(cards);
  const result = {};

  stateMap.forEach((state, cardId) => {
    const manualLeft = state.activePv.left;
    const manualRight = state.activePv.right;
    const localBalanceLeft = state.localBalance.left;
    const localBalanceRight = state.localBalance.right;
    const balanceLeft = state.balance.left;
    const balanceRight = state.balance.right;
    const cycles = state.cycles;

    const remainderLeft = Math.min(ACTIVE_PV_BASE, Math.max(0, manualLeft + balanceLeft));
    const remainderRight = Math.min(ACTIVE_PV_BASE, Math.max(0, manualRight + balanceRight));

    const unitsLeft = localBalanceLeft + cycles;
    const unitsRight = localBalanceRight + cycles;

    const totalsLeft = remainderLeft + unitsLeft * ACTIVE_PV_BASE;
    const totalsRight = remainderRight + unitsRight * ACTIVE_PV_BASE;
    result[cardId] = {
      manual: {
        left: manualLeft,
        right: manualRight,
        total: manualLeft + manualRight
      },
      remainder: {
        left: remainderLeft,
        right: remainderRight
      },
      units: {
        left: unitsLeft,
        right: unitsRight,
        total: unitsLeft + unitsRight
      },
      localBalance: {
        left: localBalanceLeft,
        right: localBalanceRight
      },
      totals: {
        left: totalsLeft,
        right: totalsRight,
        overall: totalsLeft + totalsRight
      },
      activePacks: state.activePacks,
      balance: {
        left: balanceLeft,
        right: balanceRight
      },
      cycles
    };
  });

  return result;
}
export {
  parseActivePV,
  setActivePV,
  propagateActivePvUp,
  applyActivePvDelta,
  applyActivePvClear
};

export default {
  parseActivePV,
  setActivePV,
  propagateActivePvUp,
  applyActivePvDelta,
  applyActivePvClear
};
