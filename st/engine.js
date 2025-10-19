// engine.js — чистая математика, без DOM
(function (global) {
  function normalizeSide(side) {
    const s = String(side || '').toLowerCase();
    if (s === 'right') return 'right';
    // left / bottom / top / unknown -> считаем левой (по ТЗ «снизу — влево»)
    return 'left';
  }

  function parsePv330(html) {
    // Ищем X/330pv (без учёта регистра, пробелы допустимы)
    const m = /(\d+)\s*\/\s*330\s*pv/i.exec(html || '');
    const v = m ? parseInt(m[1], 10) : 0;
    return { value: v, isFull: v >= 330 };
  }

  function buildIndex(state) {
    const byId = new Map();
    state.cards.forEach(c => byId.set(c.id, c));
    return byId;
  }

  function pickParent(byId, line) {
    // Родителем считаем карточку С ВЫСШЕЙ координатой (меньше y)
    const s = byId.get(line.startId);
    const e = byId.get(line.endId);
    if (!s || !e) return null;

    // parent = тот, у кого y меньше; child = другой
    let parent, child, sideOnParent;
    if ((s.y ?? 0) <= (e.y ?? 0)) {
      parent = s; child = e; sideOnParent = line.startSide;
    } else {
      parent = e; child = s; sideOnParent = line.endSide;
    }
    return { parentId: parent.id, childId: child.id, parentSide: normalizeSide(sideOnParent) };
  }

  function calcStagesAndCycles(totalBalls) {
    // Пороги этапов: 6, 12, 18, 36 (в сумме 72 на цикл)
    const thresholds = [6, 12, 18, 36];
    const cycles = Math.floor(totalBalls / 72);
    let within = totalBalls % 72;

    let stage = 0, toNext = 6;
    let accumulated = 0;

    for (let i = 0; i < thresholds.length; i++) {
      if (within >= accumulated + thresholds[i]) {
        accumulated += thresholds[i];
        stage = i + 1;
      } else {
        toNext = accumulated + thresholds[i] - within;
        break;
      }
    }

    // Если прошли все этапы, считаем до нового цикла
    if (stage === 4) {
      toNext = 72 - within;
    }

    return { cycles, stage, toNext };
  }

  const Engine = {
    recalc(state) {
      const byId = buildIndex(state);

      // Родительские связи (child -> { parentId, side })
      const parentOf = {};
      // Дети (parent -> { left:Set, right:Set })
      const children = {};
      state.cards.forEach(c => { children[c.id] = { left: new Set(), right: new Set() }; });

      // Пройдёмся по линиям и определим, с какой стороны ребёнок «цепляется» к родителю
      state.lines.forEach(line => {
        const pr = pickParent(byId, line);
        if (!pr) return;
        const { parentId, childId, parentSide } = pr;
        children[parentId][parentSide].add(childId);

        // если у ребёнка уже есть родитель — берём самого «верхнего» (меньший y)
        const existed = parentOf[childId];
        if (!existed) {
          parentOf[childId] = { parentId, side: parentSide };
        } else {
          const oldP = byId.get(existed.parentId);
          const newP = byId.get(parentId);
          if (oldP && newP && (newP.y ?? 0) < (oldP.y ?? 0)) {
            parentOf[childId] = { parentId, side: parentSide };
          }
        }
      });

      // PV по карточкам
      const pv = {};
      const isFull = {};
      state.cards.forEach(c => {
        const { value, isFull: full } = parsePv330(c.bodyHTML);
        pv[c.id] = value; isFull[c.id] = full;
      });

      // Считаем баллы в ногах для каждого узла
      const balls = {};
      state.cards.forEach(c => { balls[c.id] = { L: 0, R: 0, total: 0 }; });

      // Поднимаем 1 балл от каждого «полного» (330/330) вверх по предкам.
      state.cards.forEach(c => {
        if (!isFull[c.id]) return;
        let cur = c.id; let guard = 0;
        while (parentOf[cur] && guard++ < 5000) {
          const { parentId, side } = parentOf[cur];
          if (side === 'right') balls[parentId].R += 1; else balls[parentId].L += 1;
          balls[parentId].total += 1;
          cur = parentId;
        }
      });

      // Этапы/циклы по каждому узлу
      const result = {};
      state.cards.forEach(c => {
        const b = balls[c.id];
        const { cycles, stage, toNext } = calcStagesAndCycles(b.total);
        result[c.id] = { L: b.L, R: b.R, total: b.total, cycles, stage, toNext };
      });

      return { result, meta: { pv, isFull, parentOf, children } };
    }
  };

  global.Engine = Engine;
})(window);
