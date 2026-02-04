<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { parseActivePV } from '../../utils/activePv';
import { calcStagesAndCycles } from '../../utils/calculationEngine';

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'close',
  'update-pv',
  'update-balance',
  'update-active-pv',
  'clear-active-pv'
]);

// === Computed values from card data ===

const PV_RIGHT_VALUE = 330;
const MIN_LEFT_PV = 30;
const MAX_LEFT_PV = 330;

const calculations = computed(() => {
  const source = props.card?.calculated || {};
  return {
    L: Number.isFinite(source.L) ? source.L : 0,
    R: Number.isFinite(source.R) ? source.R : 0,
    total: Number.isFinite(source.total) ? source.total : 0,
    cycles: Number.isFinite(source.cycles) ? source.cycles : 0,
    stage: Number.isFinite(source.stage) ? source.stage : 0,
    toNext: Number.isFinite(source.toNext) ? source.toNext : 0
  };
});

const activePvManual = computed(() => {
  const source = props.card?.activePvManual
    ?? props.card?.activePvLocal
    ?? props.card?.activePv;
  return parseActivePV(source);
});

const activePvState = computed(() => {
  const manual = activePvManual.value;
  const source = props.card?.activePvAggregated;
  const localBalanceSource = props.card?.activePvLocalBalance;

  const unitsLeft = Number.isFinite(source?.left) ? Number(source.left) : 0;
  const unitsRight = Number.isFinite(source?.right) ? Number(source.right) : 0;
  const remainderLeft = Number.isFinite(source?.remainderLeft)
    ? Number(source.remainderLeft)
    : manual.left;
  const remainderRight = Number.isFinite(source?.remainderRight)
    ? Number(source.remainderRight)
    : manual.right;
  const localBalanceLeft = Number.isFinite(localBalanceSource?.left)
    ? Number(localBalanceSource.left)
    : 0;
  const localBalanceRight = Number.isFinite(localBalanceSource?.right)
    ? Number(localBalanceSource.right)
    : 0;

  return {
    manual,
    units: { left: unitsLeft, right: unitsRight, total: unitsLeft + unitsRight },
    localBalance: { left: localBalanceLeft, right: localBalanceRight, total: localBalanceLeft + localBalanceRight },
    remainder: { left: remainderLeft, right: remainderRight }
  };
});

const manualAdjustments = computed(() => {
  const source = props.card?.manualAdjustments ?? props.card?.manualBalance ?? props.card?.manualPv ?? null;
  return parseActivePV(source);
});

const automaticBalance = computed(() => {
  const base = calculations.value;
  const activeUnits = activePvState.value.units;
  return {
    L: base.L + activeUnits.left,
    R: base.R + activeUnits.right,
    total: base.total + activeUnits.total
  };
});

const finalCalculation = computed(() => {
  const auto = automaticBalance.value;
  const manual = manualAdjustments.value;
  const left = auto.L + manual.left;
  const right = auto.R + manual.right;
  const total = auto.total + manual.left + manual.right;
  const stages = calcStagesAndCycles(total);
  return {
    L: left,
    R: right,
    total,
    cycles: Number.isFinite(stages.cycles) ? stages.cycles : calculations.value.cycles,
    stage: Number.isFinite(stages.stage) ? stages.stage : calculations.value.stage,
    toNext: Number.isFinite(stages.toNext) ? stages.toNext : calculations.value.toNext
  };
});

const displayedPvValue = computed(() => {
  const fallback = `${PV_RIGHT_VALUE}/${PV_RIGHT_VALUE}pv`;
  const base = typeof props.card.pv === 'string' ? props.card.pv : '';
  const match = base.match(/^(\s*)(\d{1,3})/);
  if (!match) return fallback;
  let left = Number.parseInt(match[2], 10);
  if (!Number.isFinite(left)) return fallback;
  left = Math.min(Math.max(left, MIN_LEFT_PV), MAX_LEFT_PV);
  return `${left}/${PV_RIGHT_VALUE}pv`;
});

const pvLeftValue = computed(() => {
  const match = displayedPvValue.value.match(/^(\d+)\//);
  return match ? match[1] : String(PV_RIGHT_VALUE);
});

const calculatedBalanceDisplay = computed(() => `${finalCalculation.value.L} / ${finalCalculation.value.R}`);

const manualBalanceOverrideValue = computed(() => {
  const source = props.card?.balanceManualOverride;
  if (!source) return null;
  const parsed = parseActivePV(source);
  if (!parsed) return null;
  if (!/\d/.test(parsed.formatted)) return null;
  return parsed;
});

const manualBalanceOverride = computed(() => manualBalanceOverrideValue.value?.formatted ?? null);
const balanceDisplay = computed(() => manualBalanceOverride.value ?? calculatedBalanceDisplay.value);

const activeOrdersDisplay = computed(
  () => `${activePvState.value.remainder.left} / ${activePvState.value.remainder.right}`
);
const cyclesDisplay = computed(() => finalCalculation.value.cycles);
const stageDisplay = computed(() => finalCalculation.value.stage);

// === PV editing ===

const handlePvInput = (event) => {
  const rawValue = event.target.value.trim();
  let leftNum = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(leftNum) || leftNum < MIN_LEFT_PV) {
    leftNum = MIN_LEFT_PV;
  }
  if (leftNum > MAX_LEFT_PV) {
    leftNum = MAX_LEFT_PV;
  }
  const newPvValue = `${leftNum}/${PV_RIGHT_VALUE}pv`;
  if (newPvValue !== props.card.pv) {
    emit('update-pv', { cardId: props.card.id, pv: newPvValue });
  }
};

// === Active PV button handlers ===

const handleActivePvButton = (direction, step) => {
  emit('update-active-pv', {
    cardId: props.card.id,
    direction,
    step
  });
};

const handleClearAll = () => {
  emit('clear-active-pv', { cardId: props.card.id });
};

// === Balance editing ===

const handleBalanceBlur = (event) => {
  const rawText = event.target.textContent || '';
  emit('update-balance', {
    cardId: props.card.id,
    rawText
  });
};

// === Modal close ===

const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    emit('close');
  }
};

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="card-editor-backdrop"
      @click="handleBackdropClick"
    >
      <div class="card-editor-modal" @click.stop>
        <div class="card-editor-header">
          <span class="card-editor-title">{{ card.text }}</span>
          <button class="card-editor-close" @click="emit('close')" title="Закрыть">&times;</button>
        </div>

        <div class="card-editor-body">
          <!-- PV -->
          <div class="editor-row">
            <span class="editor-label">PV:</span>
            <div class="editor-pv-group">
              <input
                type="number"
                class="editor-pv-input"
                :value="pvLeftValue"
                :min="MIN_LEFT_PV"
                :max="MAX_LEFT_PV"
                @change="handlePvInput"
              />
              <span class="editor-pv-separator">/ {{ PV_RIGHT_VALUE }}pv</span>
            </div>
          </div>

          <!-- Balance -->
          <div class="editor-section">
            <span class="editor-label">Баланс:</span>
            <div class="editor-control-row">
              <span class="editor-side-label">L:</span>
              <div class="editor-btn-group">
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('left', -10)">-10</button>
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('left', -1)">-1</button>
                <span
                  class="editor-value"
                  contenteditable="true"
                  @blur="handleBalanceBlur"
                >{{ balanceDisplay.split(' / ')[0] }}</span>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('left', 1)">+1</button>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('left', 10)">+10</button>
              </div>
            </div>
            <div class="editor-control-row">
              <span class="editor-side-label">R:</span>
              <div class="editor-btn-group">
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('right', -10)">-10</button>
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('right', -1)">-1</button>
                <span
                  class="editor-value"
                  contenteditable="true"
                  @blur="handleBalanceBlur"
                >{{ balanceDisplay.split(' / ')[1] }}</span>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('right', 1)">+1</button>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('right', 10)">+10</button>
              </div>
            </div>
          </div>

          <!-- Active orders -->
          <div class="editor-section">
            <span class="editor-label">Актив-заказы:</span>
            <div class="editor-control-row">
              <span class="editor-side-label">L:</span>
              <div class="editor-btn-group">
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('left', -10)">-10</button>
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('left', -1)">-1</button>
                <span class="editor-value editor-value--readonly">{{ activeOrdersDisplay.split(' / ')[0] }}</span>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('left', 1)">+1</button>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('left', 10)">+10</button>
              </div>
            </div>
            <div class="editor-control-row">
              <span class="editor-side-label">R:</span>
              <div class="editor-btn-group">
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('right', -10)">-10</button>
                <button class="editor-btn editor-btn--minus" @click="handleActivePvButton('right', -1)">-1</button>
                <span class="editor-value editor-value--readonly">{{ activeOrdersDisplay.split(' / ')[1] }}</span>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('right', 1)">+1</button>
                <button class="editor-btn editor-btn--plus" @click="handleActivePvButton('right', 10)">+10</button>
              </div>
            </div>
          </div>

          <!-- Clear button -->
          <div class="editor-clear-row">
            <button class="editor-btn-clear" @click="handleClearAll">
              🗑️ Очистить всё
            </button>
          </div>

          <!-- Cycle/stage (display only) -->
          <div class="editor-row">
            <span class="editor-label">Цикл/этап:</span>
            <span class="editor-value editor-value--readonly">{{ cyclesDisplay }} / {{ stageDisplay }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.card-editor-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-editor-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  width: 480px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.card-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(180deg, #58b1ff 0%, #2f7dfd 100%);
  border-radius: 16px 16px 0 0;
  min-height: 48px;
}

.card-editor-title {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-editor-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.card-editor-close:hover {
  background: rgba(0, 0, 0, 0.4);
}

.card-editor-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-label {
  font-weight: 600;
  color: #6b7280;
  font-size: 14px;
  min-width: 100px;
  flex-shrink: 0;
}

.editor-side-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
  min-width: 20px;
  text-align: right;
}

.editor-pv-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.editor-pv-input {
  width: 72px;
  padding: 6px 8px;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: box-shadow 0.15s ease;
}

.editor-pv-input:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.editor-pv-separator {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.editor-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px;
}

.editor-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.editor-btn {
  border: 1px solid rgba(15, 98, 254, 0.25);
  background: #fff;
  color: #0f62fe;
  border-radius: 6px;
  padding: 4px 8px;
  min-width: 36px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.editor-btn:hover {
  background: rgba(15, 98, 254, 0.12);
}

.editor-btn:active {
  transform: translateY(1px);
}

.editor-btn--minus {
  border-color: rgba(220, 53, 69, 0.25);
  color: #c81e1e;
}

.editor-btn--minus:hover {
  background: rgba(220, 53, 69, 0.08);
}

.editor-btn--plus {
  border-color: rgba(16, 185, 129, 0.3);
  color: #047857;
}

.editor-btn--plus:hover {
  background: rgba(16, 185, 129, 0.08);
}

.editor-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 4px 8px;
  font-weight: 600;
  font-size: 15px;
  color: #111827;
  text-align: center;
  border-radius: 6px;
  outline: none;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.editor-value:not(.editor-value--readonly):focus {
  background: #fff8dc;
  box-shadow: 0 0 6px 2px rgba(255, 193, 7, 0.35);
}

.editor-value--readonly {
  cursor: default;
  background: rgba(243, 244, 246, 0.6);
  border-radius: 6px;
}

.editor-clear-row {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.editor-btn-clear {
  background: rgba(220, 53, 69, 0.08);
  color: #c81e1e;
  border: 1px solid rgba(220, 53, 69, 0.24);
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
  user-select: none;
}

.editor-btn-clear:hover {
  background: rgba(220, 53, 69, 0.14);
}

.editor-btn-clear:active {
  transform: translateY(1px);
}
</style>
