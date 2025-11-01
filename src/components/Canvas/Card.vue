<script setup>
import { ref, nextTick, computed, watch } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { parseActivePV } from '../../utils/activePv';
import { calcStagesAndCycles } from '../../utils/calculationEngine';  
import { buildCardCssVariables } from '../../utils/constants';
  
const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  isConnecting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'card-click',
  'start-drag',
  'add-note'
]);

const cardsStore = useCardsStore();
const isEditing = ref(false);
const editText = ref(props.card.text);
const textInput = ref(null);

// Вычисляемое свойство для проверки, является ли карточка большой
const isLargeCard = computed(() => {
  return props.card?.type === 'large' || props.card?.type === 'gold' || props.card.width >= 543.4;
});
const noteState = computed(() => props.card.note || null);
const hasNotes = computed(() => {
  const entries = noteState.value?.entries;
  if (!entries || typeof entries !== 'object') {
    return false;
  }
  return Object.values(entries).some(entry => typeof entry?.text === 'string' && entry.text.trim());
});
const isNoteVisible = computed(() => Boolean(noteState.value?.visible));
const noteButtonClasses = computed(() => ({
  'card-note-btn': true,
  'has-notes': hasNotes.value,
  'is-active': isNoteVisible.value
}));
const noteButtonTitle = computed(() => {
  if (isNoteVisible.value) {
    return 'Скрыть заметку';
  }
  return hasNotes.value ? 'Открыть заметку' : 'Добавить заметку';
});
const noteIndicatorColor = computed(() => {
  const color = noteState.value?.highlightColor;
  return typeof color === 'string' && color.trim() ? color : '#f97316';
});
const cardStyle = computed(() => {
  const strokeWidth = Number.isFinite(props.card.strokeWidth) ? props.card.strokeWidth : 2;
  const {
    cssVariables,
    shellBackground,
    borderColor
  } = buildCardCssVariables(props.card, strokeWidth);  

  const style = {
    position: 'absolute',
    left: `${props.card.x}px`,
    top: `${props.card.y}px`,
    width: `${props.card.width}px`,
    background: shellBackground,
    border: `${strokeWidth}px solid ${borderColor}`
  };
  if (Number.isFinite(props.card.height)) {
    style.minHeight = `${props.card.height}px`;
  }

  Object.entries(cssVariables).forEach(([name, value]) => {
    style[name] = value;
  });

  return style;
});

const ignoreNextClick = ref(false);

const handleCardClick = (event) => {
  event.stopPropagation();

  if (ignoreNextClick.value) {
    ignoreNextClick.value = false;
    return;
  }

  emit('card-click', event, props.card.id);
};

const handlePointerDown = (event) => {
  if (isEditing.value) return;

  // Не начинаем перетаскивание, если кликнули на точку соединения
  if (event.target.classList.contains('connection-point')) {    
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    event.stopPropagation();
    ignoreNextClick.value = true;

    const clearIgnoreFlag = () => {
      setTimeout(() => {
        ignoreNextClick.value = false;
      }, 0);
      window.removeEventListener('pointerup', clearIgnoreFlag);
      window.removeEventListener('pointercancel', clearIgnoreFlag);
    };

    window.addEventListener('pointerup', clearIgnoreFlag, { once: true });
    window.addEventListener('pointercancel', clearIgnoreFlag, { once: true });

    emit('card-click', event, props.card.id);
    return;
  }

  emit('start-drag', event, props.card.id);
};
const handleAddNoteClick = (event) => {
  event.stopPropagation();
  emit('add-note', props.card.id);
};

const startEditing = () => {
  isEditing.value = true;
  editText.value = props.card.text;
  nextTick(() => {
    if (textInput.value) {
      textInput.value.focus();
      textInput.value.select();
    }
  });
};

const handleTitleDblClick = (event) => {
  event.stopPropagation();
  event.preventDefault();
  if (!isEditing.value) {
    startEditing();
  }
};

  
const finishEditing = () => {
  if (isEditing.value) {
    if (editText.value !== props.card.text) {
      cardsStore.updateCard(props.card.id, { text: editText.value });
    }
    isEditing.value = false;
  }
};

const cancelEditing = () => {
  isEditing.value = false;
  editText.value = props.card.text;
};
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
    units: {
      left: unitsLeft,
      right: unitsRight,
      total: unitsLeft + unitsRight
    },
    localBalance: {
      left: localBalanceLeft,
      right: localBalanceRight,
      total: localBalanceLeft + localBalanceRight
    },    
    remainder: {
      left: remainderLeft,
      right: remainderRight
    }
  };
});

const manualAdjustments = computed(() => {
  const source =
    props.card?.manualAdjustments ??
    props.card?.manualBalance ??
    props.card?.manualPv ??
    null;
  return parseActivePV(source);
});

const finalCalculation = computed(() => {
  const base = calculations.value;
  const activeUnits = activePvState.value.units;
  const manual = manualAdjustments.value;

  const bonusLeft = activeUnits.left + manual.left;
  const bonusRight = activeUnits.right + manual.right;
  const bonusTotal = bonusLeft + bonusRight;

  const left = base.L + bonusLeft;
  const right = base.R + bonusRight;
  const total = base.total + bonusTotal;
  const stages = calcStagesAndCycles(total);

  return {
    L: left,
    R: right,
    total,
    cycles: Number.isFinite(stages.cycles) ? stages.cycles : base.cycles,
    stage: Number.isFinite(stages.stage) ? stages.stage : base.stage,
    toNext: Number.isFinite(stages.toNext) ? stages.toNext : base.toNext
  };
});

const calculatedBalanceDisplay = computed(() => `${finalCalculation.value.L} / ${finalCalculation.value.R}`);
const manualBalanceOverrideValue = computed(() => {
  const source = props.card?.balanceManualOverride;
  if (!source) {
    return null;
  }

  const parsed = parseActivePV(source);
  if (!parsed) {
    return null;
  }

  const formatted = parsed.formatted;
  if (!/\d/.test(formatted)) {
    return null;
  }

  return parsed;
});
const manualBalanceOverride = computed(() => manualBalanceOverrideValue.value?.formatted ?? null);  
const balanceDisplay = computed(() => manualBalanceOverride.value ?? calculatedBalanceDisplay.value);
const manualBalanceOffset = ref(null);  
  const activeOrdersDisplay = computed(
  () => `${activePvState.value.remainder.left} / ${activePvState.value.remainder.right}`
);
const cyclesDisplay = computed(() => finalCalculation.value.cycles);
const stageDisplay = computed(() => finalCalculation.value.stage);
const PV_RIGHT_VALUE = 330;
const MIN_LEFT_PV = 30;
const MAX_LEFT_PV = 330;

const normalizePvValue = (rawValue, fallback) => {
  const base = typeof rawValue === 'string' ? rawValue : '';
  const match = base.match(/^(\s*)(\d{1,3})/);

  if (!match) {
    return fallback;
  }

  let left = Number.parseInt(match[2], 10);

  if (!Number.isFinite(left)) {
    return fallback;
  }

  left = Math.min(Math.max(left, MIN_LEFT_PV), MAX_LEFT_PV);

  return `${left}/${PV_RIGHT_VALUE}pv`;
};

const displayedPvValue = computed(() => {
  const fallback = `${PV_RIGHT_VALUE}/${PV_RIGHT_VALUE}pv`;
  const normalized = normalizePvValue(props.card.pv, fallback);
  return normalized || fallback;
});

const coinFillColor = computed(() => {
  const fill = props.card?.coinFill;
  return typeof fill === 'string' && fill.trim() ? fill : '#3d85c6';
});
const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};

const handleBlur = () => {
  finishEditing();
};

// Обработчик для удаления карточки
const handleDelete = (event) => {
  event.stopPropagation();
  cardsStore.removeCard(props.card.id);
};

// Обработчик для обновления значений
const updateValue = (event, field) => {
  if (field === 'pv') {
    const newValue = event.target.textContent.trim();
    const normalized = normalizePvValue(newValue, displayedPvValue.value);

    if (event.target.textContent !== normalized) {
      event.target.textContent = normalized;
    }

    if (normalized !== props.card.pv) {
      cardsStore.updateCard(props.card.id, { [field]: normalized });
    }
    return;
  }

  if (field === 'manual-balance') {
    const rawText = event.target.textContent || '';
    const hasDigits = /\d/.test(rawText);

    if (!hasDigits) {
      if (event.target.textContent !== calculatedBalanceDisplay.value) {
        event.target.textContent = calculatedBalanceDisplay.value;
      }
      if (props.card.balanceManualOverride) {
        cardsStore.updateCard(
          props.card.id,
          { balanceManualOverride: null },
          { saveToHistory: true, description: `Сброшен ручной баланс для "${props.card.text}"` }
        );
      }
      manualBalanceOffset.value = null;      
      return;
    }

    const parsed = parseActivePV(rawText);
    const autoBalance = finalCalculation.value;
    const nextValue = {
      left: Math.max(parsed.left, autoBalance.L),
      right: Math.max(parsed.right, autoBalance.R)
    };
    const formatted = `${nextValue.left} / ${nextValue.right}`;

    if (event.target.textContent !== formatted) {
      event.target.textContent = formatted;
    }

    const current = props.card.balanceManualOverride || {};
    manualBalanceOffset.value = {
      left: Math.max(0, nextValue.left - autoBalance.L),
      right: Math.max(0, nextValue.right - autoBalance.R)
    };    
    if (current.left !== nextValue.left || current.right !== nextValue.right) {
      cardsStore.updateCard(
        props.card.id,
        { balanceManualOverride: nextValue },
        { saveToHistory: true, description: `Установлен ручной баланс для "${props.card.text}"` }
      );
    }
  }
};


watch(
  () => manualBalanceOverrideValue.value,
  (manual) => {
    if (!manual) {
      manualBalanceOffset.value = null;
      return;
    }

    const autoBalance = finalCalculation.value;
    manualBalanceOffset.value = {
      left: Math.max(0, manual.left - autoBalance.L),
      right: Math.max(0, manual.right - autoBalance.R)
    };
  },
  { immediate: true }
);

watch(
  () => [finalCalculation.value.L, finalCalculation.value.R],
  ([nextLeft, nextRight]) => {
    const current = manualBalanceOverrideValue.value;
    if (!current || !manualBalanceOffset.value) {
      return;
    }

    const offset = manualBalanceOffset.value;
    const desired = {
      left: nextLeft + Math.max(0, offset.left ?? 0),
      right: nextRight + Math.max(0, offset.right ?? 0)
    };

    if (current.left === desired.left && current.right === desired.right) {
      return;
    }

    cardsStore.updateCard(
      props.card.id,
      { balanceManualOverride: desired },
      {
        saveToHistory: true,
        description: `Обновлён ручной баланс для "${props.card.text}" вслед за автоматическими расчётами`
      }
    );
  }
);
</script>

<template>
  <div  
    class="card"
    :data-card-id="card.id"    
    :class="{
      'selected': isSelected,
      'connecting': isConnecting,
      'editing': isEditing,
      'card--large': isLargeCard,
      'card--gold': card.type === 'gold',
      'note-active': isNoteVisible
    }"
    :style="cardStyle"
    @click="handleCardClick"
    @pointerdown="handlePointerDown"
  >
    <!-- Заголовок карточки -->
    <div
      class="card-header"
      :style="{ background: card.headerBg || 'linear-gradient(180deg, #58b1ff 0%, #2f7dfd 100%)' }"
    >
      <input
        v-if="isEditing"
        ref="textInput"
        v-model="editText"
        class="card-title-input"
        @keydown="handleKeyDown"
        @blur="handleBlur"
        @click.stop
      />
      <div
        v-else
        class="card-title"
        :title="isSelected ? 'Двойной клик для редактирования' : ''"
        @dblclick.stop="handleTitleDblClick"      >
        {{ card.text }}
      </div>
      
      <!-- Кнопка закрытия -->
      <button
        class="card-close-btn"
        title="Удалить карточку"
        @click="handleDelete"
      >
        ×
      </button>
    </div>
    
    <!-- Содержимое карточки -->
    <div class="card-body">
      <div
        class="active-pv-hidden"
        aria-hidden="true"
        :data-btnl="String(activePvState.manual.left)"
        :data-btnr="String(activePvState.manual.right)"
        :data-locall="String(activePvState.units.left)"
        :data-localr="String(activePvState.units.right)"
        :data-remainderl="String(activePvState.remainder.left)"
        :data-remainderr="String(activePvState.remainder.right)"
      ></div>
      <!-- Иконка монетки и PV -->
      <div class="card-row pv-row">
        <svg class="coin-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" :fill="coinFillColor" stroke="#DAA520" stroke-width="5"/>
        </svg>
        <span
          class="value pv-value"
          contenteditable="true"
          @blur="updateValue($event, 'pv')"
        >
          {{ displayedPvValue }}
        </span>
      </div>
      
      <div class="card-row">
        <span class="label">Баланс:</span>
        <span
          class="value"
          contenteditable="true"
          @blur="updateValue($event, 'manual-balance')"
        >
          {{ balanceDisplay }}
        </span>
      </div>

      <div class="card-row">
        <span class="label">Актив-заказы:</span>
        <span class="value">{{ activeOrdersDisplay }}</span>
      </div>

      <div class="card-active-controls" data-role="active-pv-buttons">
        <div class="active-pv-controls__group">
          <button type="button" class="active-pv-btn" data-dir="left" data-step="1">+1</button>
          <button type="button" class="active-pv-btn" data-dir="left" data-step="10">+10</button>
          <button type="button" class="active-pv-btn" data-dir="left" data-step="-10">-10</button>
          <button type="button" class="active-pv-btn" data-dir="left" data-step="-1">-1</button>
        </div>
        <button
          type="button"
          class="active-pv-btn active-pv-btn--clear"
          data-action="clear-all"
          aria-label="Очистить обе ветки"
          title="Очистить обе ветки"
        >
          🗑️
        </button>
        <div class="active-pv-controls__group">
          <button type="button" class="active-pv-btn" data-dir="right" data-step="-1">-1</button>
          <button type="button" class="active-pv-btn" data-dir="right" data-step="-10">-10</button>
          <button type="button" class="active-pv-btn" data-dir="right" data-step="10">+10</button>
          <button type="button" class="active-pv-btn" data-dir="right" data-step="1">+1</button>
        </div>
      </div>

      <div class="card-row">
        <span class="label">Цикл/этап:</span>
        <span class="value">{{ cyclesDisplay }} / {{ stageDisplay }}</span>
      </div>

      <div
        v-if="card.bodyHTML"
        class="card-body-html"
        v-html="card.bodyHTML"
      ></div>
    </div>

    <div class="card-controls">
      <button
        :class="noteButtonClasses"
        type="button"
        :title="noteButtonTitle"
        @click="handleAddNoteClick"
      >
        📝
        <span
          v-if="hasNotes"
          class="card-note-btn__indicator"
          :style="{ backgroundColor: noteIndicatorColor }"
          aria-hidden="true"
        ></span>        
      </button>
    </div>    
    <!-- Значки -->
    <div v-if="card.showSlfBadge" class="slf-badge visible">SLF</div>
    <div v-if="card.showFendouBadge" class="fendou-badge visible">奋斗</div>
    <img 
      v-if="card.rankBadge" 
      :src="`/rank-${card.rankBadge}.png`" 
      class="rank-badge visible"
      alt="Ранговый значок"
    />
    
    <!-- Соединительные точки -->
    <div
      class="connection-point top"
      :data-card-id="card.id"
      data-side="top"
    ></div>
    <div
      class="connection-point right"
      :data-card-id="card.id"
      data-side="right"
    ></div>
    <div
      class="connection-point bottom"
      :data-card-id="card.id"
      data-side="bottom"
    ></div>
    <div
      class="connection-point left"
      :data-card-id="card.id"
      data-side="left"
    ></div>
  </div>
</template>

<style scoped>
.card {
  border-radius: 14px;
  background: var(--card-shell-background, #ffffff);
  border: 1px solid var(--card-border-color, rgba(47, 128, 237, 0.25));
  box-shadow: 0 18px 32px rgba(47, 128, 237, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  overflow: visible;
  touch-action: none;
  display: flex;
  flex-direction: column;  
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 36px rgba(47, 128, 237, 0.16);
}

.card.card--gold {
  box-shadow: 0 18px 32px rgba(209, 173, 68, 0.28);
}

.card.card--gold:hover {
  box-shadow: 0 24px 40px rgba(209, 173, 68, 0.32);
}

.card.selected {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.45), 0 22px 36px rgba(47, 128, 237, 0.2);
}

.card.note-active {
  position: relative;
}

.card.note-active::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 2px solid rgba(225, 29, 72, 0.55);
  box-shadow: 0 0 12px rgba(225, 29, 72, 0.35);
  pointer-events: none;
}

.card.note-active .card-header {
  box-shadow: inset 0 -2px 0 rgba(225, 29, 72, 0.45);
}

  
.card-header {
  padding: 16px 48px 14px;
  position: relative;
  border-radius: 14px 14px 0 0;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex-shrink: 0;
  min-height: 64px;
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.35);
}

.card-title {
  color: #fff;
  text-align: center;
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.3px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.card.selected .card-title {
  cursor: pointer;
}

.card-title-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  border-radius: 6px;
  padding: 6px;
  text-align: center;
  color: #333;
  font-size: 20px;
  font-weight: 700;
}

.card--large .card-title,
.card--gold .card-title,

.card--large .card-title-input,
.card--gold .card-title-input {
  font-weight: 900;
  font-size: 30px;
}
.card-controls {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px; 
}

.card-note-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.12);
  color: #111827;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
  position: relative;  
}

.card-note-btn:hover {
  background: rgba(15, 23, 42, 0.18);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
}

.card-note-btn:active {
  transform: scale(0.96);
}

.card-note-btn.has-notes {
  background: rgba(59, 130, 246, 0.18);
  color: #1d4ed8;
}

.card-note-btn.is-active {
  background: rgba(234, 88, 12, 0.22);
  color: #b91c1c;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.35);
}
.card-note-btn__indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
}  
.card--large .card-note-btn,
.card--gold .card-note-btn {
  width: 48px;
  height: 48px;
  font-size: 22px;
  border-radius: 16px;
}
.card-close-btn {
.card--large .card-note-btn__indicator,
.card--gold .card-note-btn__indicator {
  width: 14px;
  height: 14px;
}  
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.15s ease;
}

.card-close-btn:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

.card-body {
  padding: 20px 20px 60px;
  background: var(--card-body-background, var(--card-body-gradient, var(--surface, #ffffff)));
  border-radius: 0 0 14px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.3;
  border-top: 1px solid var(--card-body-divider, var(--card-border-color, rgba(47, 128, 237, 0.25)));  
}
.card:not(.card--large):not(.card--gold) .card-body {
  padding-bottom: 40px;
  gap: 8px;
}
.card--large .card-body,
.card--gold .card-body {
  justify-content: center;
}
.card-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  text-align: center;
  flex-wrap: wrap;
  width: 100%;
}
.card:not(.card--large):not(.card--gold) .card-row {
  gap: 8px;
}

.card-row.pv-row {
  justify-content: center;
  gap: 10px;
}

.coin-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.label {
  font-weight: 500;
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.value {
  color: #111827;
  font-weight: 600;
  font-size: 15px;
  outline: none;
  padding: 3px 6px;
  border-radius: 6px;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  cursor: text;
  text-align: center;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.value:focus {
  background: #fff8dc;
  box-shadow: 0 0 6px 2px rgba(255, 193, 7, 0.35);
}

.pv-value {
  font-size: 18px;
  font-weight: 600;
}

/* Значки */
.slf-badge,
.fendou-badge,
.rank-badge {
  position: absolute;
  display: none;
  user-select: none;
  pointer-events: none;
}

.slf-badge.visible,
.fendou-badge.visible,
.rank-badge.visible {
  display: block;
}

.slf-badge {
  top: 15px;
  left: 15px;
  color: #ffc700;
  font-weight: 900;
  font-size: 36px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.fendou-badge {
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  color: red;
  font-weight: 900;
  font-size: 56px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.rank-badge {
  top: -15px;
  right: 15px;
  width: 80px;
  height: auto;
  transform: rotate(15deg);
}

/* Соединительные точки */
.connection-point {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 3px solid rgb(93, 139, 244);
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  display: none;
  transition: background 0.15s ease, transform 0.15s ease;
  z-index: 101;
}

.card:hover .connection-point {
  display: block;
}

.connection-point:hover {
  background: rgb(93, 139, 244);
  transform: scale(1.15) translate(-50%, -50%);
}

.connection-point.top {
  top: 0;
  left: 50%;
}

.connection-point.bottom {
  top: 100%;
  left: 50%;
}

.connection-point.left {
  top: 50%;
  left: 0;
}

.connection-point.right {
  top: 50%;
  left: 100%;
}

.card-body-html {
  font-size: 14px;
  color: #111827;
  line-height: 1.5;
  width: 100%;
  text-align: center;
  word-break: break-word;
  overflow-wrap: anywhere;  
}

  
/* Большая и золотая карточки */
.card--large,
.card--gold {
  min-height: 280px;
}

.card--large .label,
.card--gold .label {
  font-size: 20px;
  font-weight: 700;
}

.card--large .value,
.card--gold .value {
  font-size: 22px;
  font-weight: 700;
}

.card--large .pv-value,
.card--gold .pv-value {
  font-size: 26px;
  font-weight: 800;
}

.active-pv-hidden {
  display: none;
}

.card-active-controls {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
  padding: 10px 12px;
  border-radius: 12px;
  background: none;
  border: none;
  box-shadow: none;
}
.active-pv-controls__group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

@media (min-width: 560px) {
  .card-active-controls {
    justify-content: center;

  }
}

.active-pv-btn {
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
  pointer-events: auto;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  line-height: 1;  
}

.active-pv-btn:hover {
  background: rgba(15, 98, 254, 0.12);
}

.active-pv-btn:active {
  transform: translateY(1px);
}

.active-pv-btn--clear {
  background: rgba(220, 53, 69, 0.08);
  color: #c81e1e;
  border-color: rgba(220, 53, 69, 0.24);
  min-width: 40px;  
}

.active-pv-btn--clear:hover {
  background: rgba(220, 53, 69, 0.14);
}

.card.card--balance-highlight {
  animation: cardBalanceFlash 0.6s ease;
  box-shadow: 0 0 0 3px rgba(15, 98, 254, 0.35), 0 12px 26px rgba(0, 0, 0, 0.18);
}

@keyframes cardBalanceFlash {
  0% {
    box-shadow: 0 0 0 0 rgba(15, 98, 254, 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(15, 98, 254, 0.35);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(15, 98, 254, 0);
  }
}  
</style>  
