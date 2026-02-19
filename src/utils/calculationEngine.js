const DEFAULT_CALCULATION = Object.freeze({
  L: 0,
  R: 0,
  total: 0,
  cycles: 0,
  stage: 0,
  toNext: 0
});

function createDefaultCalculation() {
  return { ...DEFAULT_CALCULATION };
}

function normalizeSide(side) {
  const value = String(side || '').toLowerCase();
  return value === 'right' ? 'right' : 'left';
}

function parsePv330(html) {
  const text = String(html || '');
  const match = /(\d+)\s*\/\s*330\s*pv/i.exec(text);
  const value = match ? parseInt(match[1], 10) : 0;
  return { value, isFull: value >= 330 };
}

function buildIndex(cards) {
  const byId = new Map();
  cards.forEach(card => {
    if (card && card.id) {
      byId.set(card.id, card);
    }
  });
  return byId;
}

function normalizeLine(line) {
  if (!line) {
    return null;
  }
  const startId = line.startId ?? line.from;
  const endId = line.endId ?? line.to;

  if (!startId || !endId || startId === endId) {
    return null;
  }

  return {
    startId,
    endId,
    startSide: normalizeSide(line.startSide ?? line.fromSide),
    endSide: normalizeSide(line.endSide ?? line.toSide)
  };
}

function pickParent(byId, line) {
  const normalizedLine = normalizeLine(line);
  if (!normalizedLine) {
    return null;
  }

  const startCard = byId.get(normalizedLine.startId);
  const endCard = byId.get(normalizedLine.endId);

  if (!startCard || !endCard) {
    return null;
  }

  let parent;
  let child;
  let sideOnParent;

  const startY = Number.isFinite(startCard.y) ? startCard.y : 0;
  const endY = Number.isFinite(endCard.y) ? endCard.y : 0;

  if (startY <= endY) {
    parent = startCard;
    child = endCard;
    sideOnParent = normalizedLine.startSide;
  } else {
    parent = endCard;
    child = startCard;
    sideOnParent = normalizedLine.endSide;
  }

  return {
    parentId: parent.id,
    childId: child.id,
    parentSide: normalizeSide(sideOnParent)
  };
}

function calculateBalls(cards, lines) {
  const byId = buildIndex(cards);
  const parentOf = {};
  const children = {};

  cards.forEach(card => {
    if (card && card.id) {
      children[card.id] = { left: new Set(), right: new Set() };
    }
  });

  const activeLines = lines.filter(line => !line.locked);

  activeLines.forEach(line => {
    const relation = pickParent(byId, line);
    if (!relation) {
      return;
    }

    const { parentId, childId, parentSide } = relation;
    const parentChildren = children[parentId];
    if (parentChildren) {
      parentChildren[parentSide].add(childId);
    }

    const existing = parentOf[childId];
    if (!existing) {
      parentOf[childId] = { parentId, side: parentSide };
      return;
    }

    const currentParent = byId.get(existing.parentId);
    const candidateParent = byId.get(parentId);

    const currentY = Number.isFinite(currentParent?.y) ? currentParent.y : Infinity;
    const candidateY = Number.isFinite(candidateParent?.y) ? candidateParent.y : Infinity;

    if (candidateY < currentY) {
      parentOf[childId] = { parentId, side: parentSide };
    }
  });

  const pv = {};
  const isFull = {};
  cards.forEach(card => {
    if (!card || !card.id) {
      return;
    }
    const rawHtml = [card.bodyHTML, card.pv].filter(Boolean).join(' ');
    const parsed = parsePv330(rawHtml);
    pv[card.id] = parsed.value;
    isFull[card.id] = parsed.isFull;
  });

  const balls = {};
  cards.forEach(card => {
    if (card && card.id) {
      balls[card.id] = createDefaultCalculation();
    }
  });

  const MAX_ITERATIONS = 5000;
  cards.forEach(card => {
    if (!card || !card.id || !isFull[card.id]) {
      return;
    }

    let currentId = card.id;
    let iterations = 0;

    while (parentOf[currentId] && iterations < MAX_ITERATIONS) {
      iterations += 1;
      const { parentId, side } = parentOf[currentId];
      const bucket = balls[parentId];

      if (!bucket) {
        break;
      }

      if (side === 'right') {
        bucket.R += 1;
      } else {
        bucket.L += 1;
      }

      bucket.total += 1;
      currentId = parentId;
    }
  });

  return { balls, parentOf, children, pv, isFull };
}

function calcStagesAndCycles(totalBalls) {
  const thresholds = [6, 12, 18, 36];
  const total = Number.isFinite(totalBalls) ? totalBalls : 0;
  const cycles = Math.floor(total / 72);
  let within = total % 72;

  let stage = 0;
  let toNext = thresholds[0];
  let accumulated = 0;

  for (let i = 0; i < thresholds.length; i += 1) {
    const threshold = thresholds[i];
    if (within >= accumulated + threshold) {
      accumulated += threshold;
      stage = i + 1;
    } else {
      toNext = accumulated + threshold - within;
      break;
    }
  }

  if (stage === thresholds.length) {
    toNext = 72 - within;
  }

  return { cycles, stage, toNext };
}

const Engine = {
  recalc(state = {}) {
    const cards = Array.isArray(state.cards) ? state.cards : [];
    const lines = Array.isArray(state.lines) ? state.lines : [];

    if (!cards.length) {
      return {
        result: {},
        meta: {
          parentOf: {},
          children: {},
          pv: {},
          isFull: {}
        }
      };
    }

    const { balls, parentOf, children, pv, isFull } = calculateBalls(cards, lines);
    const result = {};

    cards.forEach(card => {
      if (!card || !card.id) {
        return;
      }

      const bucket = balls[card.id] || createDefaultCalculation();
      const { cycles, stage, toNext } = calcStagesAndCycles(bucket.total);

      result[card.id] = {
        L: bucket.L,
        R: bucket.R,
        total: bucket.total,
        cycles,
        stage,
        toNext
      };
    });

    return {
      result,
      meta: {
        parentOf,
        children,
        pv,
        isFull
      }
    };
  }
};

export {
  Engine,
  normalizeSide,
  parsePv330,
  pickParent,
  calculateBalls,
  calcStagesAndCycles
};

export default Engine;
