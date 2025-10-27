import test from 'node:test';
import assert from 'node:assert/strict';
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

test('applyActivePvDelta распространяет дельту вверх по структуре, если порог 330 не достигнут', () => {
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

  assert.ok(changedIds.includes('child'));
  assert.ok(changedIds.includes('parent'));

  const childUpdate = updates.child;
  assert.strictEqual(childUpdate.activePvState.activePv.left, 150);
  assert.strictEqual(childUpdate.activePvLocalBalance.left, 0);
  assert.strictEqual(childUpdate.activePvBalance.left, 0);

  const parentUpdate = updates.parent;
  assert.strictEqual(parentUpdate.activePvState.balance.left, 50);
  assert.strictEqual(parentUpdate.activePvLocalBalance.left, 0);
});

test('applyActivePvDelta фиксирует локальный баланс при достижении 330 единиц без подъёма вверх', () => {
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

  assert.deepStrictEqual(changedIds, ['child']);

  const childUpdate = updates.child;
  assert.strictEqual(childUpdate.activePvState.activePv.left, 5);
  assert.strictEqual(childUpdate.activePvLocalBalance.left, 1);
  assert.strictEqual(childUpdate.activePvPacks, 1);
  assert.strictEqual(updates.parent, undefined);
});

test('applyActivePvDelta обнуляет остаток при переходе через 329 и накапливает локальный баланс', () => {
  const cards = [createCard('node', { activePv: { left: 329, right: 150 } })];
  
  const { updates, changedIds } = applyActivePvDelta({
    cards,
    cardId: 'node',
    side: 'left',
    delta: 1
  });

  assert.deepStrictEqual(changedIds, ['node']);

  const update = updates.node;
  assert.strictEqual(update.activePvState.activePv.left, 0);
  assert.strictEqual(update.activePvLocalBalance.left, 1);
  assert.strictEqual(update.activePvLocal.left, 0);
  assert.strictEqual(update.activePvLocal.right, 150);  
});
