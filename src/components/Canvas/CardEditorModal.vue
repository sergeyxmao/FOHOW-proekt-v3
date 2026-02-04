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
  },
  cardRect: {
    type: Object,
    default: () => ({ top: 100, left: 100, width: 300, height: 300 })
  }
});

const emit = defineEmits([
  'close',
  'update-pv',
  'update-balance',
  'clear-balance',
  'update-active-pv',
  'clear-active-pv'
]);

// === Constants ===

const PV_RIGHT_VALUE = 330;
const MIN_LEFT_PV = 30;
const MAX_LEFT_PV = 330;

// === Computed values from card data ===

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
  const remainderLeft = Number.isFinite(source?.remainderLeft) ? Number(source.remainderLeft) : manual.left;
  const remainderRight = Number.isFinite(source?.remainderRight) ? Number(source.remainderRight) : manual.right;
  const localBalanceLeft = Number.isFinite(localBalanceSource?.left) ? Number(localBalanceSource.left) : 0;
  const localBalanceRight = Number.isFinite(localBalanceSource?.right) ? Number(localBalanceSource.right) : 0;

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

const calculatedBalanceDisplay = computed(() => `${finalCalculation.value.L} / ${finalCalculation.value.R}`);

const manualBalanceOverrideValue = computed(() => {
  const source = props.card?.balanceManualOverride;
  if (!source) return null;
  const parsed = parseActivePV(source);
  if (!parsed) return null;
  if (!/\d/.test(parsed.formatted)) return null;
  return parsed;
});

const balanceDisplay = computed(() => manualBalanceOverrideValue.value?.formatted ?? calculatedBalanceDisplay.value);

const balanceL = computed(() => {
  const parts = balanceDisplay.value.split(' / ');
  return parseInt(parts[0], 10) || 0;
});

const balanceR = computed(() => {
  const parts = balanceDisplay.value.split(' / ');
  return parseInt(parts[1], 10) || 0;
});

const pvLeftValue = computed(() => {
  const base = typeof props.card.pv === 'string' ? props.card.pv : '';
  const match = base.match(/^(\s*)(\d{1,3})/);
  if (!match) return PV_RIGHT_VALUE;
  let left = Number.parseInt(match[2], 10);
  if (!Number.isFinite(left)) return PV_RIGHT_VALUE;
  return Math.min(Math.max(left, MIN_LEFT_PV), MAX_LEFT_PV);
});

const cyclesDisplay = computed(() => finalCalculation.value.cycles);
const stageDisplay = computed(() => finalCalculation.value.stage);

// === Modal positioning ===

const modalStyle = computed(() => ({
  position: 'fixed',
  top: `${props.cardRect.top}px`,
  left: `${props.cardRect.left}px`,
  width: `${props.cardRect.width}px`
}));

// === PV ===

const handlePvChange = (event) => {
  let val = parseInt(event.target.value, 10);
  if (!Number.isFinite(val) || val < MIN_LEFT_PV) val = MIN_LEFT_PV;
  if (val > MAX_LEFT_PV) val = MAX_LEFT_PV;
  event.target.value = val;
  const newPv = `${val}/${PV_RIGHT_VALUE}pv`;
  if (newPv !== props.card.pv) {
    emit('update-pv', { cardId: props.card.id, pv: newPv });
  }
};

// === Balance ===

const handleBalanceChange = (side, event) => {
  const val = parseInt(event.target.value, 10) || 0;
  emit('update-balance', {
    cardId: props.card.id,
    left: side === 'left' ? val : balanceL.value,
    right: side === 'right' ? val : balanceR.value
  });
};

const handleClearBalance = () => {
  emit('clear-balance', { cardId: props.card.id });
};

// === Active PV ===

const handleActiveChange = (direction, event) => {
  const newVal = parseInt(event.target.value, 10) || 0;
  const current = direction === 'left' ? activePvManual.value.left : activePvManual.value.right;
  const delta = newVal - current;
  if (delta !== 0) {
    emit('update-active-pv', { cardId: props.card.id, direction, step: delta });
  }
};

const handleClearActive = () => {
  emit('clear-active-pv', { cardId: props.card.id });
};

// === Close ===

const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    emit('close');
  }
};

const handleEscape = (event) => {
  if (event.key === 'Escape') emit('close');
};

onMounted(() => document.addEventListener('keydown', handleEscape));
onBeforeUnmount(() => document.removeEventListener('keydown', handleEscape));
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="card-editor-overlay" @click="handleBackdropClick">
      <div class="card-editor" :style="modalStyle" @click.stop>
        <!-- Header -->
        <div class="editor-header">
          <span class="editor-title">{{ card.text }}</span>
          <button class="editor-close" @click="emit('close')" title="Закрыть">&times;</button>
        </div>

        <!-- Body -->
        <div class="editor-body">
          <!-- PV -->
          <div class="editor-row">
            <span class="editor-label">PV:</span>
            <input
              type="number"
              class="editor-input"
              :value="pvLeftValue"
              :min="MIN_LEFT_PV"
              :max="MAX_LEFT_PV"
              @change="handlePvChange"
            />
            <span class="editor-hint">/ {{ PV_RIGHT_VALUE }}pv</span>
          </div>

          <!-- Balance -->
          <div class="editor-row">
            <span class="editor-label">Баланс:</span>
            <input
              type="number"
              class="editor-input"
              :value="balanceL"
              :min="automaticBalance.L"
              @change="handleBalanceChange('left', $event)"
            />
            <span class="editor-sep">/</span>
            <input
              type="number"
              class="editor-input"
              :value="balanceR"
              :min="automaticBalance.R"
              @change="handleBalanceChange('right', $event)"
            />
            <button class="editor-trash" @click="handleClearBalance" title="Сбросить баланс">🗑️</button>
          </div>

          <!-- Active orders -->
          <div class="editor-row">
            <span class="editor-label">Актив:</span>
            <input
              type="number"
              class="editor-input"
              :value="activePvManual.left"
              :min="0"
              @change="handleActiveChange('left', $event)"
            />
            <span class="editor-sep">/</span>
            <input
              type="number"
              class="editor-input"
              :value="activePvManual.right"
              :min="0"
              @change="handleActiveChange('right', $event)"
            />
            <button class="editor-trash" @click="handleClearActive" title="Очистить актив">🗑️</button>
          </div>

          <!-- Cycle/stage -->
          <div class="editor-row">
            <span class="editor-label">Цикл/этап:</span>
            <span class="editor-readonly">{{ cyclesDisplay }} / {{ stageDisplay }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.card-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.12);
}

.card-editor {
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35), 0 20px 40px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 240px;
}

.editor-header {
  padding: 10px 36px 8px 14px;
  background: linear-gradient(180deg, #58b1ff 0%, #2f7dfd 100%);
  position: relative;
  display: flex;
  align-items: center;
}

.editor-title {
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.editor-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.editor-close:hover {
  background: rgba(0, 0, 0, 0.4);
}

.editor-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.editor-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.editor-label {
  font-weight: 500;
  color: #6b7280;
  font-size: 13px;
  min-width: 65px;
  flex-shrink: 0;
}

.editor-input {
  width: 56px;
  padding: 3px 4px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  color: #111827;
  outline: none;
  -moz-appearance: textfield;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.editor-input::-webkit-outer-spin-button,
.editor-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.editor-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.editor-sep {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.editor-hint {
  font-weight: 600;
  color: #111827;
  font-size: 13px;
}

.editor-readonly {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.editor-trash {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px;
  opacity: 0.5;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
  line-height: 1;
}

.editor-trash:hover {
  opacity: 1;
}
</style>
