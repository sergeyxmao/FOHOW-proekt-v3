<script setup>
import { ref, nextTick, computed, watch, inject, onBeforeUnmount } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useViewSettingsStore } from '../../stores/viewSettings';
import { useNotesStore } from '../../stores/notes';
import { parseActivePV } from '../../utils/activePv';
import { calcStagesAndCycles } from '../../utils/calculationEngine';
import { buildCardCssVariables } from '../../utils/constants';

// Inject isReadOnly from parent (CanvasBoard)
const isReadOnly = inject('isReadOnly', ref(false));

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
  },
  performanceMode: {
    type: String,
    default: 'full'
  }
});

const isViewMode = computed(() => props.performanceMode === 'view');

const emit = defineEmits([
  'card-click',
  'start-drag',
  'add-note',
  'pv-changed',
  'open-editor'
  ]);

const cardsStore = useCardsStore();
const viewSettingsStore = useViewSettingsStore();
const notesStore = useNotesStore();
const isEditing = ref(false);
const editText = ref(props.card.text);
const textInput = ref(null);

// Состояние для редактирования PV
const isEditingPv = ref(false);
const editPvLeft = ref('');
const pvLeftInput = ref(null);

// Состояние для аватара пользователя по personal_id
const avatarData = ref({
  avatar_url: null,
  username: null,
  full_name: null,
  initials: null
});

let searchTimeout = null;
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

// Вычисляемое свойство для проверки, является ли карточка большой
const isLargeCard = computed(() => {
  return props.card?.type === 'large' || props.card?.type === 'gold' || props.card.width >= 543.4;
});

// Заголовок для LOD-ultra (< 10%): большие — обрезаем 9 последних цифр номера
const lodUltraTitle = computed(() => {
  const text = props.card?.text || '';
  if (isLargeCard.value && text.length > 9) {
    return text.slice(0, -9);
  }
  return text;
});

// Проверка наличия заметок из store
const hasNotes = computed(() => {
  const cardNotes = notesStore.getNotesForCard(props.card.id);
  if (!cardNotes || typeof cardNotes !== 'object') {
    return false;
  }
  return Object.values(cardNotes).some(note =>
    note && typeof note.content === 'string' && note.content.trim().length > 0
  );
});

// Проверка видимости окна заметки (сохраняем для совместимости, но теперь это нужно управлять через другой механизм)
const isNoteVisible = computed(() => Boolean(props.card.note?.visible));

const noteButtonClasses = computed(() => ({
  'card-note-btn': true,
  'has-notes': hasNotes.value,
  'is-active': isNoteVisible.value
}));
const noteButtonTitle = computed(() => {
  if (isNoteVisible.value) {
    return 'Скрыть календарь';
  }
  return hasNotes.value ? 'Открыть календарь' : 'Добавить запись';
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

  // Добавляем CSS-переменную для цвета анимации (PV changed)
  style['--user-card-animation-color'] = viewSettingsStore.animationColor || '#ef4444';

  // CSS-переменная для цвета монетки (используется в LOD-deep для покраски body)
  style['--coin-fill-color'] = coinFillColor.value;

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
  // Запрещаем редактирование в readonly режиме
  if (isReadOnly.value) return;

  isEditing.value = true;
  editText.value = props.card.text;
  // Слушаем pointerdown (а не mousedown — mousedown может быть подавлен preventDefault на pointerdown)
  document.addEventListener('pointerdown', handleOutsidePointerDown, true);
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
  // Запрещаем редактирование в readonly режиме и в режиме Просмотр
  if (isReadOnly.value || isViewMode.value) return;
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
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
};

const cancelEditing = () => {
  isEditing.value = false;
  editText.value = props.card.text;
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
};

// ИСПРАВЛЕННАЯ ЛОГИКА РАСЧЁТА БАЛАНСА
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

// Автоматический баланс - это баланс, который поднимается вверх по структуре
const automaticBalance = computed(() => {
  const base = calculations.value;
  const activeUnits = activePvState.value.units;
  
  // Автоматический баланс = базовый расчёт + активные единицы
  const left = base.L + activeUnits.left;
  const right = base.R + activeUnits.right;
  const total = base.total + activeUnits.total;
  
  return {
    L: left,
    R: right,
    total
  };
});

// Финальный расчёт включает ручные корректировки, которые НЕ поднимаются вверх
const finalCalculation = computed(() => {
  const auto = automaticBalance.value;
  const manual = manualAdjustments.value;
  
  // Финальный баланс = автоматический + ручные корректировки
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

// Ручное переопределение баланса с учётом минимальных значений
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
const cyclesDisplay = computed(() => {
  const override = props.card?.cyclesManualOverride;
  if (override && Number.isFinite(override.cycles)) return override.cycles;
  return finalCalculation.value.cycles;
});
const stageDisplay = computed(() => {
  const override = props.card?.cyclesManualOverride;
  if (override && Number.isFinite(override.stage)) return override.stage;
  return finalCalculation.value.stage;
});
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

// Извлекаем левую часть PV (например, "30" из "30/330pv")
const pvLeftValue = computed(() => {
  const match = displayedPvValue.value.match(/^(\d+)\//);
  return match ? match[1] : String(PV_RIGHT_VALUE);
});

// Правая часть всегда 330pv
const pvRightValue = computed(() => `${PV_RIGHT_VALUE}pv`);

const coinFillColor = computed(() => {
  const fill = props.card?.coinFill;
  return typeof fill === 'string' && fill.trim() ? fill : '#3d85c6';
});

// Проверяем, является ли кружок синим (полным)
const isCoinBlue = computed(() => {
  return coinFillColor.value === '#3d85c6';
});

// Проверяем, является ли кружок золотым
const isCoinGold = computed(() => {
  return coinFillColor.value === '#ffd700';
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

// Закрытие редактирования заголовка при клике вне карточки
// Используем pointerdown в capture-фазе на document — он срабатывает раньше всех
// и не подавляется preventDefault() от дочерних обработчиков
const handleOutsidePointerDown = (event) => {
  if (!isEditing.value) return;
  const cardEl = event.target.closest(`[data-card-id="${props.card.id}"]`);
  if (!cardEl) {
    finishEditing();
  }
};

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
});

// Обработчик для удаления карточки
const handleDelete = async (event) => {
  event.stopPropagation();
  await cardsStore.removeCard(props.card.id);
};

// Обработчик двойного клика на левой части PV для начала редактирования
const startEditingPv = (event) => {
  event.stopPropagation();
  event.preventDefault();
  // Запрещаем редактирование в readonly режиме и в режиме Просмотр
  if (isReadOnly.value || isViewMode.value) return;
  if (!isEditingPv.value) {
    isEditingPv.value = true;
    editPvLeft.value = pvLeftValue.value;
    nextTick(() => {
      if (pvLeftInput.value) {
        pvLeftInput.value.focus();
        pvLeftInput.value.select();
      }
    });
  }
};

// Завершение редактирования левой части PV
const finishEditingPv = () => {
  if (isEditingPv.value) {
    let newValue = editPvLeft.value.trim();

    // Парсим введенное значение
    let leftNum = Number.parseInt(newValue, 10);

    // Проверяем корректность
    if (!Number.isFinite(leftNum) || leftNum < MIN_LEFT_PV) {
      leftNum = MIN_LEFT_PV;
    }
    if (leftNum > MAX_LEFT_PV) {
      leftNum = MAX_LEFT_PV;
    }

    const newPvValue = `${leftNum}/${PV_RIGHT_VALUE}pv`;

    if (newPvValue !== props.card.pv) {
      cardsStore.updateCard(props.card.id, { pv: newPvValue });
    }

    isEditingPv.value = false;
  }
};

// Отмена редактирования PV
const cancelEditingPv = () => {
  isEditingPv.value = false;
  editPvLeft.value = pvLeftValue.value;
};

// Обработчик нажатия клавиш при редактировании PV
const handlePvKeyDown = (event) => {
  if (event.key === 'Enter') {
    finishEditingPv();
  } else if (event.key === 'Escape') {
    cancelEditingPv();
  }
};

// Обработчик клика на кружок
const handleCoinClick = (event) => {
  event.stopPropagation();

  const currentLeft = Number.parseInt(pvLeftValue.value, 10);

  if (isCoinBlue.value) {
    // Если кружок синий, меняем на желтый и устанавливаем максимальное значение (330)
    cardsStore.updateCard(props.card.id, {
      pv: `${MAX_LEFT_PV}/${PV_RIGHT_VALUE}pv`,
      coinFill: '#ffd700',
      previousPvLeft: currentLeft // Сохраняем текущее значение
    });
    // Эмитим событие об изменении PV для запуска анимации баланса

    emit('pv-changed', props.card.id);

  } else if (isCoinGold.value) {

    // Если кружок желтый, возвращаем сохраненное значение или устанавливаем минимальное

    const previousLeft = Number.isFinite(props.card.previousPvLeft) ? props.card.previousPvLeft : MIN_LEFT_PV;

    cardsStore.updateCard(props.card.id, {

      pv: `${previousLeft}/${PV_RIGHT_VALUE}pv`,

      coinFill: '#3d85c6',

      previousPvLeft: currentLeft // Сохраняем текущее значение для следующего переключения
          });

    // Эмитим событие об изменении PV для запуска анимации баланса

    emit('pv-changed', props.card.id);
  }
};

// ИСПРАВЛЕННЫЙ ОБРАБОТЧИК для обновления значений
const updateValue = (event, field) => {
  if (field === 'manual-balance') {
    const rawText = event.target.textContent || '';
    const hasDigits = /\d/.test(rawText);

    if (!hasDigits) {
      // Если нет цифр - сбрасываем на автоматический баланс
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
    const autoBalance = automaticBalance.value; // Используем автоматический баланс как минимум
    
    // ВАЖНО: Не позволяем установить значения меньше автоматического баланса
    const nextValue = {
      left: Math.max(parsed.left, autoBalance.L),
      right: Math.max(parsed.right, autoBalance.R)
    };
    const formatted = `${nextValue.left} / ${nextValue.right}`;

    if (event.target.textContent !== formatted) {
      event.target.textContent = formatted;
    }

    const current = props.card.balanceManualOverride || {};
    
    // Сохраняем разницу между ручным и автоматическим балансом
    manualBalanceOffset.value = {
      left: Math.max(0, nextValue.left - autoBalance.L),
      right: Math.max(0, nextValue.right - autoBalance.R)
    };
    
    if (current.left !== nextValue.left || current.right !== nextValue.right) {
      // Сохраняем полные значения ручного баланса
      cardsStore.updateCard(
        props.card.id,
        { balanceManualOverride: nextValue },
        { saveToHistory: true, description: `Установлен ручной баланс для "${props.card.text}"` }
      );

      // Также сохраняем ручные корректировки (разницу) для правильного расчёта
      const manualAdditions = {
        left: manualBalanceOffset.value.left,
        right: manualBalanceOffset.value.right
      };

      cardsStore.updateCard(
        props.card.id,
        { manualAdjustments: manualAdditions },
        { saveToHistory: false }
      );
    }
  }
};

// Следим за изменением ручного переопределения баланса
watch(
  () => manualBalanceOverrideValue.value,
  (manual) => {
    if (!manual) {
      manualBalanceOffset.value = null;
      return;
    }

    const autoBalance = automaticBalance.value;
    manualBalanceOffset.value = {
      left: Math.max(0, manual.left - autoBalance.L),
      right: Math.max(0, manual.right - autoBalance.R)
    };
  },
  { immediate: true }
);

// Следим за изменением автоматического баланса и корректируем ручной
watch(
  () => [automaticBalance.value.L, automaticBalance.value.R],
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

    // Обновляем ручной баланс с сохранением смещения
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

// Анимация для изменения чисел
const isBalanceLeftAnimating = ref(false);

const isBalanceRightAnimating = ref(false);

const isActiveOrdersLeftAnimating = ref(false);

const isActiveOrdersRightAnimating = ref(false);

// Хранилище ID таймеров для отмены предыдущих анимаций
let balanceLeftTimer = null;
let balanceRightTimer = null;
let activeOrdersLeftTimer = null;
let activeOrdersRightTimer = null;



// Функция для парсинга значения "X / Y"

const parseBalanceValue = (str) => {

  const match = String(str).match(/(\d+)\s*\/\s*(\d+)/);

  if (!match) return { left: 0, right: 0 };

  return {

    left: parseInt(match[1], 10),

    right: parseInt(match[2], 10)

  };

};

 

// Длительность одной пульсации числа (фиксированная)
const PULSE_DURATION = 600;

// Общая длительность анимации (из настроек, синхронизирована с анимацией линии)
const animationDuration = computed(() => viewSettingsStore.animationDurationMs || 2000);

// Количество повторений пульсации для соответствия длительности анимации линий
const pulseIterations = computed(() => Math.ceil(animationDuration.value / PULSE_DURATION));

 

// Следим за изменением баланса

watch(

  () => balanceDisplay.value,

  (newValue, oldValue) => {

    if (!oldValue || newValue === oldValue) return;

    // Проверяем, включена ли анимация (PV changed) и режим производительности
    if (!viewSettingsStore.isAnimationEnabled || props.performanceMode !== 'full') return;

    const prev = parseBalanceValue(oldValue);

    const next = parseBalanceValue(newValue);



    // Анимируем только если число увеличилось

    if (next.left > prev.left) {

      // Отменяем предыдущую анимацию левого баланса
      if (balanceLeftTimer !== null) {
        clearTimeout(balanceLeftTimer);
      }

      isBalanceLeftAnimating.value = true;

      balanceLeftTimer = setTimeout(() => {

        isBalanceLeftAnimating.value = false;
        balanceLeftTimer = null;

      }, animationDuration.value);

    }



    if (next.right > prev.right) {

      // Отменяем предыдущую анимацию правого баланса
      if (balanceRightTimer !== null) {
        clearTimeout(balanceRightTimer);
      }

      isBalanceRightAnimating.value = true;

      balanceRightTimer = setTimeout(() => {

        isBalanceRightAnimating.value = false;
        balanceRightTimer = null;

      }, animationDuration.value);

    }

  }

);



// Следим за изменением активных заказов

watch(

  () => activeOrdersDisplay.value,

  (newValue, oldValue) => {

    if (!oldValue || newValue === oldValue) return;

    // Проверяем, включена ли анимация (PV changed) и режим производительности
    if (!viewSettingsStore.isAnimationEnabled || props.performanceMode !== 'full') return;

    const prev = parseBalanceValue(oldValue);

    const next = parseBalanceValue(newValue);



    // Анимируем только если число увеличилось

    if (next.left > prev.left) {

      // Отменяем предыдущую анимацию левых активных заказов
      if (activeOrdersLeftTimer !== null) {
        clearTimeout(activeOrdersLeftTimer);
      }

      isActiveOrdersLeftAnimating.value = true;

      activeOrdersLeftTimer = setTimeout(() => {

        isActiveOrdersLeftAnimating.value = false;
        activeOrdersLeftTimer = null;

      }, animationDuration.value);

    }



    if (next.right > prev.right) {

      // Отменяем предыдущую анимацию правых активных заказов
      if (activeOrdersRightTimer !== null) {
        clearTimeout(activeOrdersRightTimer);
      }

      isActiveOrdersRightAnimating.value = true;

      activeOrdersRightTimer = setTimeout(() => {

        isActiveOrdersRightAnimating.value = false;
        activeOrdersRightTimer = null;

      }, animationDuration.value);

    }
  }
);

// Обработчик двойного клика на теле карточки — открывает модал редактирования
const handleBodyDblClick = (event) => {
  // Не открывать модал при клике на монетку, заметку или кнопку удаления
  if (event.target.closest('.coin-icon') || event.target.closest('.card-note-btn') || event.target.closest('.card-close-btn')) return;
  // Не открывать модал при редактировании заголовка или PV
  if (isEditing.value || isEditingPv.value) return;
  // Запрещаем в readonly режиме и в режиме Просмотр
  if (isReadOnly.value || isViewMode.value) return;

  event.stopPropagation();
  emit('open-editor', props.card.id);
};

// === Double-tap для мобильных (touch не генерирует dblclick) ===
const DOUBLE_TAP_MS = 300;

let lastTitleTapTime = 0;
const handleTitleTouchEnd = (event) => {
  const now = Date.now();
  if (now - lastTitleTapTime < DOUBLE_TAP_MS) {
    event.preventDefault();
    event.stopPropagation();
    lastTitleTapTime = 0;
    if (isReadOnly.value || isViewMode.value) return;
    if (!isEditing.value) {
      startEditing();
    }
  } else {
    lastTitleTapTime = now;
  }
};

let lastBodyTapTime = 0;
const handleBodyTouchEnd = (event) => {
  if (event.target.closest('.coin-icon') || event.target.closest('.card-note-btn') || event.target.closest('.card-close-btn') || event.target.closest('.card-header')) return;
  if (isEditing.value || isEditingPv.value) return;
  if (isReadOnly.value || isViewMode.value) return;

  const now = Date.now();
  if (now - lastBodyTapTime < DOUBLE_TAP_MS) {
    event.preventDefault();
    event.stopPropagation();
    lastBodyTapTime = 0;
    emit('open-editor', props.card.id);
  } else {
    lastBodyTapTime = now;
  }
};

// Функции для работы с аватаром
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

// Получить инициалы из имени
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Получить полный URL аватара
function getAvatarUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL.replace('/api', '')}${url}`;
}

// Обработчик ввода personal_id для поиска аватара
async function handlePersonalIdInput(value) {
  // Очищаем предыдущий таймер
  if (searchTimeout) clearTimeout(searchTimeout);

  // Если поле пустое - очищаем аватар
  if (!value || value.trim() === '') {
    avatarData.value = {
      avatar_url: null,
      username: null,
      full_name: null,
      initials: null
    };
    return;
  }

  // Debounce - ждем 500ms после последнего ввода
  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`${API_URL}/users/search-by-personal-id/${value}`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      });

      const data = await response.json();

      if (data.found) {
        avatarData.value = {
          avatar_url: data.user.avatar_url,
          username: data.user.username,
          full_name: data.user.full_name,
          initials: getInitials(data.user.full_name || data.user.username)
        };
      } else {
        // Пользователь не найден или доступ запрещен
        avatarData.value = {
          avatar_url: null,
          username: null,
          full_name: null,
          initials: null
        };
      }
    } catch (err) {
      console.error('Ошибка поиска пользователя:', err);
    }
  }, 500);
}

// Следим за изменением текста карточки для больших карточек
watch(
  () => props.card.text,
  (newText) => {
    if (isLargeCard.value) {
      handlePersonalIdInput(newText);
    }
  },
  { immediate: true }
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
      'card--coin-gold': isCoinGold,
      'card--coin-blue': isCoinBlue,
      'note-active': isNoteVisible,
      'highlighted': card.highlighted
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
        @dblclick.stop="handleTitleDblClick"
        @touchend.stop="handleTitleTouchEnd"
      >
        {{ card.text }}
      </div>
      
      <!-- Кнопка закрытия -->
      <button
        v-if="!isViewMode"
        class="card-close-btn card-lod-hide"
        title="Удалить карточку"
        @click="handleDelete"
      >
        ×
      </button>
    </div>
    
    <!-- Содержимое карточки -->
    <div class="card-body" @dblclick="handleBodyDblClick" @touchend="handleBodyTouchEnd">
      <!-- Имя из шапки — видно только при LOD-ultra (zoom < 10%) -->
      <div class="card-lod-title">{{ lodUltraTitle }}</div>

      <!-- Аватар пользователя (только для больших и Gold карточек) -->
      <div v-if="isLargeCard" class="card-avatar-container card-lod-hide-minimal">
        <div
          v-if="avatarData.avatar_url"
          class="card-avatar"
          :style="{ backgroundImage: `url(${getAvatarUrl(avatarData.avatar_url)})` }"
          :title="avatarData.full_name || avatarData.username"
        ></div>
        <div
          v-else-if="avatarData.initials"
          class="card-avatar card-avatar--placeholder"
          :title="avatarData.full_name || avatarData.username"
        >
          {{ avatarData.initials }}
        </div>
        <div
          v-else
          class="card-avatar card-avatar--default"
          title="Партнёр"
        ></div>
      </div>

      <div
        class="active-pv-hidden card-lod-hide"
        aria-hidden="true"
        :data-btnl="String(activePvState.manual.left)"
        :data-btnr="String(activePvState.manual.right)"
        :data-locall="String(activePvState.units.left)"
        :data-localr="String(activePvState.units.right)"
        :data-remainderl="String(activePvState.remainder.left)"
        :data-remainderr="String(activePvState.remainder.right)"
        :data-auto-balance-l="String(automaticBalance.L)"
        :data-auto-balance-r="String(automaticBalance.R)"
      ></div>
      <!-- Иконка монетки и PV -->
      <div class="card-row pv-row">
        <div class="coin-icon-wrapper">
          <svg
            class="coin-icon"
            :class="{ 'coin-icon--clickable': true }"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            @click="handleCoinClick"
            :title="isCoinBlue ? 'Кликните, чтобы установить максимальное значение (330)' : 'Кликните, чтобы вернуть предыдущее значение'"
          >
            <circle cx="50" cy="50" r="45" :fill="coinFillColor" stroke="#DAA520" stroke-width="5"/>
          </svg>
        </div>
        <div class="pv-value-container card-lod-hide">
          <input
            v-if="isEditingPv"
            ref="pvLeftInput"
            v-model="editPvLeft"
            type="text"
            class="pv-left-input"
            @keydown="handlePvKeyDown"
            @blur="finishEditingPv"
            @click.stop
          />
          <span
            v-else
            class="value pv-value-left"
          >
            {{ pvLeftValue }}
          </span>
          <span class="pv-separator">/</span>
          <span class="value pv-value-right">{{ pvRightValue }}</span>
        </div>
      </div>

      <!-- Компактная строка баланса — видна только в LOD режиме -->
      <div class="card-row card-lod-summary">
        <span class="value" style="font-size: 12px; color: #6b7280;">
          {{ calculations.L }}/{{ calculations.R }}
        </span>
      </div>

      <div class="card-row">
        <span class="label card-lod-hide">Баланс:</span>
        <span
          class="value value-container"

          :title="`Автоматический баланс: ${automaticBalance.L} / ${automaticBalance.R}`"

        >

          <span
            :class="{ 'value--animating': isBalanceLeftAnimating }"
            :style="{ '--pulse-iterations': pulseIterations }"
          >{{ balanceDisplay.split(' / ')[0] }}</span>

          <span class="value-separator"> / </span>

          <span
            :class="{ 'value--animating': isBalanceRightAnimating }"
            :style="{ '--pulse-iterations': pulseIterations }"
          >{{ balanceDisplay.split(' / ')[1] }}</span>

        </span>

      </div>

 

      <div class="card-row">

        <span class="label card-lod-hide">Актив-заказы:</span>

        <span class="value value-container">

          <span
            :class="{ 'value--animating': isActiveOrdersLeftAnimating }"
            :style="{ '--pulse-iterations': pulseIterations }"
          >{{ activeOrdersDisplay.split(' / ')[0] }}</span>

          <span class="value-separator"> / </span>

          <span
            :class="{ 'value--animating': isActiveOrdersRightAnimating }"
            :style="{ '--pulse-iterations': pulseIterations }"
          >{{ activeOrdersDisplay.split(' / ')[1] }}</span>

        </span>
      </div>


      <div class="card-row card-lod-hide">
        <span class="label">Цикл/этап:</span>
        <span class="value">{{ cyclesDisplay }} / {{ stageDisplay }}</span>
      </div>

      <div
        v-if="card.bodyHTML"
        class="card-body-html card-lod-hide"
        v-html="card.bodyHTML"
      ></div>
    </div>

    <div v-if="!isViewMode" class="card-controls card-lod-hide">
      <button
        :class="noteButtonClasses"
        type="button"
        :title="noteButtonTitle"
        @click="handleAddNoteClick"
      >
        📅
        <span
          v-if="hasNotes"
          class="card-note-btn__indicator"
          :style="{ backgroundColor: noteIndicatorColor }"
          aria-hidden="true"
        ></span>        
      </button>
    </div>    
    <!-- Значки -->
    <div v-if="card.showSlfBadge" class="slf-badge visible card-lod-hide">SLF</div>
    <div v-if="card.showFendouBadge" class="fendou-badge visible card-lod-hide">奋斗</div>
    <img
      v-if="card.rankBadge"
      :src="`/rank-${card.rankBadge}.png`"
      class="rank-badge visible card-lod-hide"
      alt="Ранговый значок"
    />
    
    <!-- Соединительные точки -->
    <div
      class="connection-point top card-lod-hide"
      :data-card-id="card.id"
      data-side="top"
    ></div>
    <div
      class="connection-point right card-lod-hide"
      :data-card-id="card.id"
      data-side="right"
    ></div>
    <div
      class="connection-point bottom card-lod-hide"
      :data-card-id="card.id"
      data-side="bottom"
    ></div>
    <div
      class="connection-point left card-lod-hide"
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
  /* НЕ использовать paint — аватарка на больших карточках выступает за границу */
  contain: layout style;
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

/* Анимация подсветки карточки при навигации от партнёра */
@keyframes cardHighlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
  }
  25% {
    box-shadow: 0 0 0 6px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 0 12px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.3);
  }
  75% {
    box-shadow: 0 0 0 6px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.4);
  }
}

.card.highlighted {
  animation: cardHighlight 2s ease-in-out;
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
  width: 54px;
  height: 54px;
  border: none;
  border-radius: 16px;
  background: rgba(255, 193, 7, 0.22);
  color: #111827;
  font-size: 27px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  box-shadow: 0 6px 18px rgba(255, 193, 7, 0.25);
  position: relative;
}

.card-note-btn:hover {
  background: rgba(255, 193, 7, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(255, 193, 7, 0.35);
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
  width: 72px;
  height: 72px;
  font-size: 33px;
  border-radius: 20px;
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
  position: relative;
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
  overflow: visible;
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

.coin-icon-wrapper {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.coin-icon {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.coin-icon--clickable {
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.coin-icon--clickable:hover {
  transform: scale(1.1);
  filter: brightness(1.15);
}

.coin-icon--clickable:active {
  transform: scale(1.05);
}

/* Стили для аватара в карточке */
.card-avatar-container {
  position: absolute;
  width: 250px;
  height: 250px;
  left: -75px;
  top: 50%;
  transform: translateY(-50%);
  flex-shrink: 0;
  z-index: 10;
}

.card-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-avatar--placeholder {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #5a3e00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
}

.card-avatar--default {
  background-image: url('/Avatar.svg');
  background-size: cover;
  background-position: center;
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  width: 100%;
  height: 100%;
}

.label {
  font-weight: 500;
  color: #6b7280;
  font-size: 23px;
  text-align: center;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.value {
  color: #111827;
  font-weight: 600;
  font-size: 24px;
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
  font-size: 29px;
  font-weight: 600;
}

.pv-value-container {
  display: flex;
  align-items: center;
  gap: 2px;
}

.pv-value-left {
  cursor: default;
  padding: 2px 4px;
  border-radius: 4px;
  user-select: none;
}

.pv-separator {
  font-size: 29px;
  font-weight: 600;
  color: #111827;
  margin: 0 1px;
}

.pv-value-right {
  font-size: 29px;
  font-weight: 600;
  cursor: default;
}

.pv-left-input {
  width: 80px;
  padding: 2px 6px;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  background: #fff8dc;
  color: #111827;
  font-size: 29px;
  font-weight: 600;
  text-align: center;
  outline: none;
  box-shadow: 0 0 6px 2px rgba(255, 193, 7, 0.35);
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
  width: 22px;
  height: 22px;
  background: #fff;
  border: 4px solid rgb(93, 139, 244);
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  display: none;
  transition: background 0.15s ease, transform 0.15s ease;
  z-index: 101;
}

.card:hover .connection-point,
.card.connecting .connection-point {
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
  font-size: 29px;
  font-weight: 700;
}

.card--large .value,
.card--gold .value {
  font-size: 31px;
  font-weight: 700;
}

.card--large .coin-icon-wrapper,
.card--gold .coin-icon-wrapper {
  width: 49px;
  height: 49px;
}

.card--large .coin-icon,
.card--gold .coin-icon {
  width: 49px;
  height: 49px;
}

.card--large .pv-value,
.card--gold .pv-value {
  font-size: 39px;
  font-weight: 800;
}

.card--large .pv-value-left,
.card--large .pv-value-right,
.card--large .pv-separator,
.card--gold .pv-value-left,
.card--gold .pv-value-right,
.card--gold .pv-separator {
  font-size: 39px;
  font-weight: 800;
}

.card--large .pv-left-input,
.card--gold .pv-left-input {
  width: 110px;
  font-size: 39px;
  font-weight: 800;
}

.active-pv-hidden {
  display: none;
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

 

.card.card--balance-propagation {

  box-shadow: 0 0 0 3px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.45), 0 22px 36px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.25);

  animation: cardBalancePulse 1.5s ease-in-out infinite;

}



@keyframes cardBalancePulse {

  0% {

    box-shadow: 0 0 0 3px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.45), 0 22px 36px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.25);

  }

  50% {

    box-shadow: 0 0 0 6px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.65), 0 26px 42px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.35);

  }

  100% {

    box-shadow: 0 0 0 3px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.45), 0 22px 36px rgba(var(--user-card-animation-color-rgb, 239, 68, 68), 0.25);

  }

}

/* Контейнер для значений с разделением на части */

.value-container {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

.value-container > span,
.value-separator {
  font-size: inherit;
  font-weight: inherit;
}

 

/* Анимация для изменения чисел */

.value--animating {

  display: inline-block;
  animation: valueIncrease 0.6s ease-out;
  animation-iteration-count: var(--pulse-iterations, 1);
}

@keyframes valueIncrease {
  0% {
    transform: scale(1);
    color: #111827;
  }
  25% {
    transform: scale(1.3);
    color: var(--user-card-animation-color, #ef4444);
  }
  50% {
    transform: scale(1.6);
    color: var(--user-card-animation-color, #ef4444);
    font-weight: 700;
  }
  75% {
    transform: scale(1.3);
    color: var(--user-card-animation-color, #ef4444);
  }
  100% {
    transform: scale(1);
    color: #111827;
  }
}

.card--large .value--animating,
.card--gold .value--animating {
  animation: valueIncreaseLarge 0.6s ease-out;
  animation-iteration-count: var(--pulse-iterations, 1);
}

@keyframes valueIncreaseLarge {
  0% {
    transform: scale(1);
    color: #111827;
  }
  25% {
    transform: scale(1.5);
    color: var(--user-card-animation-color, #ef4444);
  }
  50% {
    transform: scale(2.0);
    color: var(--user-card-animation-color, #ef4444);
    font-weight: 900;
  }
  75% {
    transform: scale(1.5);
    color: var(--user-card-animation-color, #ef4444);
  }
  100% {
    transform: scale(1);
    color: #111827;
  }
}

/* Увеличение шрифта и центрирование строк для больших и Gold карточек */
.card--large .card-row,
.card--gold .card-row {
  font-size: 18px; /* Увеличиваем размер шрифта с базового значения */
  line-height: 1.6; /* Увеличиваем межстрочный интервал для лучшей читаемости */
  justify-content: center; /* Центрируем содержимое по горизонтали */
  text-align: center; /* Центрируем текст */
}

/* Центрирование содержимого карточки по вертикали */
.card--large .card-body,
.card--gold .card-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding-left: 140px; /* Сдвигаем контент правее аватара */
}

/* Увеличиваем размер шрифта для лейблов и значений */
.card--large .card-row .label,
.card--gold .card-row .label {
  font-size: 29px;
}
.card--large .card-row .value,
.card--gold .card-row .value {
  font-size: 31px;
}

/* Print Styles - Скрываем кнопки управления при печати */
@media print {
  /* Скрываем кнопки управления карточкой */
  .card-close-btn,
  .card-note-btn,
  .card-controls,
  .connection-point {
    display: none !important;
  }

  /* Убираем интерактивные эффекты */
  .card {
    cursor: default !important;
  }

  .card:hover {
    transform: none !important;
    box-shadow: 0 18px 32px rgba(47, 128, 237, 0.12) !important;
  }

  /* Иконка монетки остается видимой, но не интерактивной */
  .coin-icon {
    cursor: default !important;
  }

  .coin-icon--clickable:hover {
    transform: none !important;
    filter: none !important;
  }
}
</style>
