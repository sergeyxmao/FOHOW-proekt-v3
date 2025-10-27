import { describe, expect, it } from 'vitest';
import { applyActivePvDelta } from '../src/utils/activePv.js';

function createState(overrides = {}) {
  const base = {
    activePv: { left: 0, right: 0 },
    activePacks: 0,
    localBalance: { left: 0, right: 0 },
    balance: { left: 0, right: 0 },
    cycles: 0
  };

  if (overrides.activePv) {
    base.activePv = { ...base.activePv, ...overrides.activePv };
  }
  if (overrides.localBalance) {
    base.localBalance = { ...base.localBalance, ...overrides.localBalance };
  }
  if (overrides.balance) {
    base.balance = { ...base.balance, ...overrides.balance };
  }
  if (typeof overrides.activePacks === 'number') {
    base.activePacks = overrides.activePacks;
  }
  if (typeof overrides.cycles === 'number') {
    base.cycles = overrides.cycles;
  }

  return base;
}

function createCard(id, stateOverrides = {}) {
  return {
    id,
    activePvState: createState(stateOverrides)
  };
}

describe('applyActivePvDelta', () => {
  it('распространяет дельту вверх по структуре, если порог 330 не достигнут', () => {
    const cards = [
      createCard('child', { activePv: { left: 100, right: 0 } }),
      createCard('parent')
    ];

    const meta = {
      parentOf: {
        child: { parentId: 'parent', side: 'left' }
      }
    };

    const { updates, changedIds } = applyActivePvDelta({
      cards,
      meta,
      cardId: 'child',
      side: 'left',
      delta: 50
    });

    expect(changedIds).toContain('child');
    expect(changedIds).toContain('parent');

    const childUpdate = updates.child;
    expect(childUpdate.activePvState.activePv.left).toBe(150);
    expect(childUpdate.activePvLocalBalance.left).toBe(0);
    expect(childUpdate.activePvBalance.left).toBe(0);

    const parentUpdate = updates.parent;
    expect(parentUpdate.activePvState.balance.left).toBe(50);
    expect(parentUpdate.activePvLocalBalance.left).toBe(0);
  });

  it('фиксирует локальный баланс при достижении 330 единиц без подъёма вверх', () => {
    const cards = [
      createCard('child', { activePv: { left: 325, right: 0 } }),
      createCard('parent')
    ];

    const meta = {
      parentOf: {
        child: { parentId: 'parent', side: 'left' }
      }
    };

    const { updates, changedIds } = applyActivePvDelta({
      cards,
      meta,
      cardId: 'child',
      side: 'left',
      delta: 10
    });

    expect(changedIds).toEqual(['child']);

    const childUpdate = updates.child;
    expect(childUpdate.activePvState.activePv.left).toBe(5);
    expect(childUpdate.activePvLocalBalance.left).toBe(1);
    expect(childUpdate.activePvPacks).toBe(1);
    expect(updates.parent).toBeUndefined();
  });

  it('обнуляет остаток при переходе через 329 и накапливает локальный баланс', () => {
    const cards = [createCard('node', { activePv: { left: 329, right: 150 } })];

    const { updates, changedIds } = applyActivePvDelta({
      cards,
      cardId: 'node',
      side: 'left',
      delta: 1
    });

    expect(changedIds).toEqual(['node']);

    const update = updates.node;
    expect(update.activePvState.activePv.left).toBe(0);
    expect(update.activePvLocalBalance.left).toBe(1);
    expect(update.activePvLocal.left).toBe(0);
    expect(update.activePvLocal.right).toBe(150);
  });
});
