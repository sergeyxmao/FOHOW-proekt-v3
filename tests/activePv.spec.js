import test from 'node:test';
import assert from 'node:assert/strict';
import { applyActivePvDelta, applyActivePvClear } from '../src/utils/activePv.js';

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

test('applyActivePvDelta фиксирует локальный баланс при достижении 330 единиц', () => {
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

  assert.ok(changedIds.includes('child'));

  const childUpdate = updates.child;
  assert.strictEqual(childUpdate.activePvState.activePv.left, 5);
  assert.strictEqual(childUpdate.activePvLocalBalance.left, 1);
  assert.strictEqual(childUpdate.activePvPacks, 1);

  const parentUpdate = updates.parent;
  assert.ok(parentUpdate);
  assert.strictEqual(parentUpdate.activePvState.balance.left, 10);
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

test('applyActivePvDelta ограничивает накопление активного баланса значением 330', () => {
  const cards = [
    createCard('child'),
    createCard('parent', { balance: { left: 320 } })
  ];

  const meta = {
    parentOf: {
      child: { parentId: 'parent', side: 'left' }
    }
  };

  const { updates } = applyActivePvDelta({
    cards,
    meta,
    cardId: 'child',
    side: 'left',
    delta: 20
  });

  const parentUpdate = updates.parent;
  assert.strictEqual(parentUpdate.activePvState.balance.left, 330);
  assert.strictEqual(parentUpdate.activePvBalance.left, 330);
});

test('applyActivePvClear сбрасывает остаток и баланс текущей лицензии', () => {
  const cards = [
    createCard('node', {
      activePv: { left: 25, right: 10 },
      balance: { left: 70, right: 40 }
    }),
    createCard('parent', {
      balance: { left: 70, right: 40 }
    })
  ];

  const meta = {
    parentOf: {
      node: { parentId: 'parent', side: 'left' }
    }
  };

  const { updates } = applyActivePvClear({ cards, meta, cardId: 'node' });

  const nodeUpdate = updates.node;
  assert.strictEqual(nodeUpdate.activePvState.activePv.left, 0);
  assert.strictEqual(nodeUpdate.activePvState.activePv.right, 0);
  assert.strictEqual(nodeUpdate.activePvBalance.left, 0);
  assert.strictEqual(nodeUpdate.activePvBalance.right, 0);

  const parentUpdate = updates.parent;
  assert.strictEqual(parentUpdate.activePvState.balance.left, 0);
  assert.strictEqual(parentUpdate.activePvState.balance.right, 40);
});
