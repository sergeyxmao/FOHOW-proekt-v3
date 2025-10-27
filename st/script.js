// ============== НАЧАЛО ИСПРАВЛЕННОЙ ВЕРСИИ SCRIPT.JS ==============
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const svgLayer = document.getElementById('svg-layer');
  const addCardBtn = document.getElementById('add-card-btn');
  const addLargeCardBtn = document.getElementById('add-large-card-btn');
  const addTemplateBtn = document.getElementById('add-template-btn');
  const gradientSelector = document.getElementById('gradient-selector');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const leftPanel = document.querySelector('.ui-panel-left');
  const rightPanel = document.querySelector('.ui-panel-right');
  const leftPanelToggle = document.getElementById('left-panel-toggle');
  const rightPanelToggle = document.getElementById('right-panel-toggle');
  const loadProjectBtn = document.getElementById('load-project-btn');
  const loadProjectInput = document.getElementById('load-project-input');
  const selectionModeBtn = document.getElementById('selection-mode-btn');
  const saveProjectBtn = document.getElementById('save-project-btn');
  const exportHtmlBtn = document.getElementById('export-html-btn');
  const exportSvgBtn = document.getElementById('export-svg-btn');
  const notesListBtn = document.getElementById('notes-list-btn');
  const preparePrintBtn = document.getElementById('prepare-print-btn');
  const toggleGuidesBtn = document.getElementById('toggle-guides-btn');
  const hierarchicalDragModeBtn = document.getElementById('hierarchical-drag-mode-btn');

  const thicknessSlider = document.getElementById('thickness-slider');
  const thicknessValue = document.getElementById('thickness-value');
  const lineColorTrigger = document.getElementById('line-color-trigger');
  const hiddenLineColorPicker = document.getElementById('hidden-line-color-picker');
  const animationDurationInput = document.getElementById('animation-duration-input');
  const applyAllToggle = document.getElementById('apply-all-toggle');
  const headerColorTrigger = document.getElementById('card-header-color-trigger');
  const headerColorCycleBtn = document.getElementById('card-header-cycle-btn');
  const headerColorInput = document.getElementById('card-header-color-input');

  const GRID_SIZE = 70;
  const MARKER_OFFSET = 12;
  const HISTORY_LIMIT = 50;
  const SNAP_TOLERANCE = 5;
  const ACTIVE_PV_BASE = 330;
  const DEFAULT_LINE_COLOR = '#0f62fe';
  const DEFAULT_ANIMATION_DURATION = 2000;
  const MIN_ANIMATION_DURATION = 2000;
  const MAX_ANIMATION_DURATION = 999000;
  const MAX_ANIMATION_LOOP_DURATION = 3000; // ограничиваем длительность одного цикла анимации для плавности
  let canvasState = {
    x: 0,
    y: 0,
    scale: 1,
    isPanning: false,
    lastPointerX: 0,
    lastPointerY: 0,
    panPointerId: null,
    panCaptureTarget: null
  };

  let activeState = {
    currentThickness: 5,
    currentColor: DEFAULT_LINE_COLOR,    selectedLine: null,
    selectedCards: new Set(),
    lastFocusedCard: null,
    isSelecting: false,
    isSelectionMode: false,
    isHierarchicalDragMode: false,
    isGlobalLineMode: false,
    guidesEnabled: true,
    lineStart: null,
    previewLine: null,
    linePointerId: null,
    lineCaptureTarget: null,
    selectionPointerId: null,
    selectionCaptureTarget: null
  };
  let cards = [];
  let lines = [];
  let notesDropdownApi = null;
  const cardColors = ['#5D8BF4', '#38A3A5', '#E87A5D', '#595959'];

  let undoStack = [];
  let redoStack = [];
  let clipboard = null;
  let lastSavedSnapshot = null;
  let lastEngineMeta = null;
  const imageDataUriCache = new Map();
  const activePointers = new Map();
  let pinchState = null;
  const lastCalculatedBalances = new Map();
  let highlightedBalanceParts = new Map();
  const lastActivePvValues = new Map();
  const partHighlightTimers = new WeakMap();
  const lineHighlightTimers = new WeakMap();
  const animationSettings = {
    durationMs: DEFAULT_ANIMATION_DURATION
  };
  let refreshAnimationControls = null;
  const vGuide = document.createElement('div');
  vGuide.className = 'guide-line vertical';
  document.body.appendChild(vGuide);

  const hGuide = document.createElement('div');
  hGuide.className = 'guide-line horizontal';
  document.body.appendChild(hGuide);

  if (!canvas || !svgLayer) return;

  if (addCardBtn) addCardBtn.addEventListener('click', () => { createCard(); saveState(); });
  if (addLargeCardBtn) addLargeCardBtn.addEventListener('click', () => { createCard({ isLarge: true }); saveState(); });
  if (addTemplateBtn) addTemplateBtn.addEventListener('click', loadTemplate);
  if (preparePrintBtn) preparePrintBtn.addEventListener('click', prepareForPrint);
  if (exportSvgBtn) exportSvgBtn.addEventListener('click', exportToSvg);

  setupLineControls();
  setupHeaderControls();
  setupGlobalEventListeners();
  setupGradientSelector();
  setupHistoryButtons();
  setupDragModes();
  setupSaveButtons();
  setupNotesDropdown();
  setupNoteAutoClose();
  setupGuides();
  setupPanelToggles();

  if (window.initializeCardFeatures) {
    initializeCardFeatures(() => cards, saveState);
  }

  const numPop = document.createElement('div');
  numPop.className = 'num-color-pop';
  numPop.innerHTML = `
    <div class="dot red"    data-color="#e53935" title="Красный"></div>
    <div class="dot yellow" data-color="#ffeb3b" title="Жёлтый"></div>
    <div class="dot green"  data-color="#43a047" title="Зелёный"></div>
  `;
  document.body.appendChild(numPop);
  let lastRange = null;

  function showNumPop() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return hideNumPop();
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const valueEl = (common.nodeType === 1 ? common : common.parentElement)?.closest('.value[contenteditable="true"]');
    if (!valueEl || sel.isCollapsed) { hideNumPop(); return; }
    const rect = range.getBoundingClientRect();
    numPop.style.left = `${Math.max(8, rect.left)}px`;
    numPop.style.top  = `${rect.bottom + 6}px`;
    numPop.style.display = 'flex';
    lastRange = range;
  }
  function hideNumPop(){ numPop.style.display='none'; lastRange = null; }
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.num-color-pop') && !e.target.closest('.value[contenteditable="true"]')) hideNumPop();
  });
  numPop.addEventListener('click', (e) => {
    const btn = e.target.closest('.dot');
    if (!btn || !lastRange) return;
    const color = btn.dataset.color;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(lastRange);
    const span = document.createElement('span');
    span.setAttribute('data-num-color', color);
    span.style.color = color;
    try { lastRange.surroundContents(span); }
    catch(_) { const frag = lastRange.extractContents(); span.appendChild(frag); lastRange.insertNode(span); }
    hideNumPop(); saveState();
  });

  function setupGlobalEventListeners() {
    const shouldIgnorePointer = (target) => (
      target.closest('.ui-panel-left') ||
      target.closest('.ui-panel-right') ||
      target.closest('.note-window') ||
      target.closest('.card-context-menu')
    );

    const updateTrackedPointer = (e) => {
      const pointer = activePointers.get(e.pointerId);
      if (pointer) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.type = e.pointerType;
      }
    };

    const tryStartPinch = () => {
      if (pinchState) return;
      const touches = Array.from(activePointers.entries()).filter(([, info]) => info.type === 'touch');
      if (touches.length < 2) return;
      const [first, second] = touches;
      const distance = Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y);
      if (!distance) return;
      pinchState = {
        id1: first[0],
        id2: second[0],
        initialDistance: distance,
        initialScale: canvasState.scale,
        prevMidX: (first[1].x + second[1].x) / 2,
        prevMidY: (first[1].y + second[1].y) / 2
      };
      if (canvasState.isPanning && canvasState.panPointerId != null) {
        if (canvasState.panCaptureTarget && canvasState.panCaptureTarget.releasePointerCapture) {
          try { canvasState.panCaptureTarget.releasePointerCapture(canvasState.panPointerId); } catch (_) { /* noop */ }
        }
        canvasState.isPanning = false;
        canvasState.panPointerId = null;
        canvasState.panCaptureTarget = null;
        document.body.style.cursor = 'default';
      }
      if (activeState.isSelecting) {
        endMarqueeSelection();
      }
    };

    const handlePinchMove = () => {
      if (!pinchState) return;
      const first = activePointers.get(pinchState.id1);
      const second = activePointers.get(pinchState.id2);
      if (!first || !second) return;
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      if (pinchState.prevMidX != null && pinchState.prevMidY != null) {
        canvasState.x += midX - pinchState.prevMidX;
        canvasState.y += midY - pinchState.prevMidY;
      }
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (distance > 0) {
        const prevScale = canvasState.scale;
        const newScale = Math.max(0.1, Math.min(3, pinchState.initialScale * (distance / pinchState.initialDistance)));
        const ratio = newScale / prevScale;
        canvasState.x = midX - (midX - canvasState.x) * ratio;
        canvasState.y = midY - (midY - canvasState.y) * ratio;
        canvasState.scale = newScale;
      }
      pinchState.prevMidX = midX;
      pinchState.prevMidY = midY;
      updateCanvasTransform();
    };

    const endPinch = (pointerId) => {
      if (!pinchState) return;
      if (pointerId === pinchState.id1 || pointerId === pinchState.id2) {
        pinchState = null;
      }
    };

    window.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (e.pointerType === 'touch') tryStartPinch();

      if (shouldIgnorePointer(e.target)) return;
      if (pinchState && e.pointerType === 'touch') return;

      if (e.button === 1) {
        e.preventDefault();
        canvasState.isPanning = true;
        canvasState.panPointerId = e.pointerId;
        canvasState.lastPointerX = e.clientX;
        canvasState.lastPointerY = e.clientY;
        if (e.target instanceof Element && e.target.setPointerCapture) {
          e.target.setPointerCapture(e.pointerId);
          canvasState.panCaptureTarget = e.target;
        } else {
          canvasState.panCaptureTarget = null;
        }
        document.body.style.cursor = 'move';
        return;
      }

      if (e.button === 0) {
        if (!e.target.closest('.card')) {
          if (activeState.selectedLine) {
            activeState.selectedLine.element.classList.remove('selected');
            activeState.selectedLine = null;
          }
          if (activeState.isSelectionMode && activePointers.size === 1) {
            startMarqueeSelection(e);
            activeState.selectionPointerId = e.pointerId;
            if (e.target instanceof Element && e.target.setPointerCapture) {
              e.target.setPointerCapture(e.pointerId);
              activeState.selectionCaptureTarget = e.target;
            } else {
              activeState.selectionCaptureTarget = null;
            }
          } else if (!e.ctrlKey) {
            clearSelection();
          }
        } else if (activeState.selectedLine) {
          activeState.selectedLine.element.classList.remove('selected');
          activeState.selectedLine = null;
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      updateTrackedPointer(e);

      if (pinchState && (e.pointerId === pinchState.id1 || e.pointerId === pinchState.id2)) {
        handlePinchMove();
        return;
      }

      if (canvasState.isPanning && e.pointerId === canvasState.panPointerId) {
        const dx = e.clientX - canvasState.lastPointerX;
        const dy = e.clientY - canvasState.lastPointerY;
        canvasState.x += dx;
        canvasState.y += dy;
        canvasState.lastPointerX = e.clientX;
        canvasState.lastPointerY = e.clientY;
        updateCanvasTransform();
      } else if (activeState.isDrawingLine) {
        if (activeState.linePointerId == null) {
          activeState.linePointerId = e.pointerId;
        }
        if (activeState.linePointerId === e.pointerId) {
          const coords = getCanvasCoordinates(e.clientX, e.clientY);
          const startPoint = getPointCoords(activeState.lineStart.card, activeState.lineStart.side);
          updateLinePath(activeState.previewLine, startPoint, coords, activeState.lineStart.side, null);
        }
      } else if (activeState.isSelecting && activeState.selectionPointerId === e.pointerId) {
        updateMarqueeSelection(e);
      }
    });

    const handlePointerEnd = (e) => {
      activePointers.delete(e.pointerId);
      endPinch(e.pointerId);

      if (canvasState.isPanning && e.pointerId === canvasState.panPointerId) {
        canvasState.isPanning = false;
        if (canvasState.panCaptureTarget && canvasState.panCaptureTarget.releasePointerCapture) {
          try { canvasState.panCaptureTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        }
        canvasState.panPointerId = null;
        canvasState.panCaptureTarget = null;
        document.body.style.cursor = 'default';
      }

      if (activeState.isSelecting && e.pointerId === activeState.selectionPointerId) {
        endMarqueeSelection(e);
        if (activeState.selectionCaptureTarget && activeState.selectionCaptureTarget.releasePointerCapture) {
          try { activeState.selectionCaptureTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        }
        activeState.selectionPointerId = null;
        activeState.selectionCaptureTarget = null;
      }

      if (activeState.isDrawingLine && activeState.linePointerId === e.pointerId) {
        if (e.type === 'pointercancel') {
          cancelDrawing();
        } else {
          if (activeState.lineCaptureTarget && activeState.lineCaptureTarget.releasePointerCapture) {
            try { activeState.lineCaptureTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
          }
          activeState.linePointerId = null;
          activeState.lineCaptureTarget = null;
        }
      }
    };

    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.ui-panel-left') || e.target.closest('.ui-panel-right')) return;
      e.preventDefault();
      const scaleAmount = -e.deltaY * 0.001;
      const newScale = Math.max(0.1, Math.min(3, canvasState.scale + scaleAmount));
      const mouseX = e.clientX, mouseY = e.clientY;
      canvasState.x = mouseX - (mouseX - canvasState.x) * (newScale / canvasState.scale);
      canvasState.y = mouseY - (mouseY - canvasState.y) * (newScale / canvasState.scale);
      canvasState.scale = newScale;
      updateCanvasTransform();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target.isContentEditable || ['TEXTAREA','INPUT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        if (activeState.isDrawingLine) cancelDrawing();
        if (activeState.isSelecting) endMarqueeSelection();
        if (activeState.isSelectionMode || activeState.isHierarchicalDragMode) {
          activeState.isSelectionMode = false;
          activeState.isHierarchicalDragMode = false;
          updateDragModeButtons();
        }
        clearSelection();
        if (activeState.selectedLine) {
            activeState.selectedLine.element.classList.remove('selected');
            activeState.selectedLine = null;
        }
        const closedNotes = closeAllNoteWindows();
        if (notesDropdownApi?.isOpen()) notesDropdownApi.hide();
        if (closedNotes) updateNotesButtonState();
        hideNumPop();
      }
      if (e.key === 'Delete') deleteSelection();

      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelection(); }
    });
  }

  function setupGuides() {
    if (!toggleGuidesBtn) return;
    toggleGuidesBtn.classList.toggle('active', activeState.guidesEnabled);
    toggleGuidesBtn.addEventListener('click', () => {
        activeState.guidesEnabled = !activeState.guidesEnabled;
        toggleGuidesBtn.classList.toggle('active', activeState.guidesEnabled);
    });
  }

  function setupPanelToggles() {
    if (leftPanel && leftPanelToggle) {
      const updateLeftToggle = () => {
        const collapsed = leftPanel.classList.contains('collapsed');
        leftPanelToggle.textContent = collapsed ? '❯' : '❮';
        leftPanelToggle.setAttribute('aria-expanded', String(!collapsed));
        leftPanelToggle.setAttribute('title', collapsed ? 'Развернуть панель' : 'Свернуть панель');
      };
      leftPanelToggle.addEventListener('click', () => {
        leftPanel.classList.toggle('collapsed');
        updateLeftToggle();
      });
      updateLeftToggle();
    }

    if (rightPanel && rightPanelToggle) {
      const updateRightToggle = () => {
        const collapsed = rightPanel.classList.contains('collapsed');
        rightPanelToggle.textContent = collapsed ? '❮' : '❯';
        rightPanelToggle.setAttribute('aria-expanded', String(!collapsed));
        rightPanelToggle.setAttribute('title', collapsed ? 'Развернуть настройки' : 'Свернуть настройки');
      };
      rightPanelToggle.addEventListener('click', () => {
        rightPanel.classList.toggle('collapsed');
        updateRightToggle();
      });
      updateRightToggle();
    }
  }

  function normalizeColorToHex(color) {
    if (typeof color !== 'string') return null;
    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const value = hexMatch[0].toUpperCase();
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      }
      return value;
    }
    const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgbMatch) return null;
    const toHex = (component) => {
      const num = Math.max(0, Math.min(255, Number(component)));
      return num.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`.toUpperCase();
  }

  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getHeaderBackground(cardData) {
    if (!cardData || !cardData.element) return '';
    const storedValue = cardData.element.dataset.headerColorValue;
    if (storedValue) {
      return storedValue;
    }
    const header = cardData.element.querySelector('.card-header');
    if (!header) return '';
    const rawColor = header.style.background || window.getComputedStyle(header).backgroundColor;
    if (!rawColor) return '';
    const normalized = normalizeColorToHex(rawColor) || rawColor;
    cardData.element.dataset.headerColorValue = normalized;
    return normalized;
  }

  function updateHeaderPreview(color) {
    if (!color) return;
    const hexColor = normalizeColorToHex(color) || color;
    if (headerColorTrigger) headerColorTrigger.style.background = hexColor;
    if (headerColorInput) {
      const normalized = normalizeColorToHex(color);
      if (normalized) headerColorInput.value = normalized;
    }
  }

  function setCardHeaderColor(cardRef, color, colorIndexValue) {
    if (!cardRef) return;
    const element = cardRef.element ? cardRef.element : cardRef;
    if (!element) return;
    const header = element.querySelector('.card-header');
    if (!header) return;
    const normalized = normalizeColorToHex(color) || color;
    header.style.background = normalized;
    element.dataset.colorIndex = String(colorIndexValue);
    element.dataset.headerColorValue = normalized;
  }

  function setLastFocusedCard(cardData) {
    if (cardData && cardData.element && document.body.contains(cardData.element)) {
      activeState.lastFocusedCard = cardData;
      updateHeaderPreview(getHeaderBackground(cardData));
    } else {
      activeState.lastFocusedCard = null;
    }
  }

  function getHeaderTargetCards() {
    if (activeState.selectedCards.size > 0) {
      return Array.from(activeState.selectedCards);
    }
    return activeState.lastFocusedCard ? [activeState.lastFocusedCard] : [];
  }

  function applyPresetHeaderColorToCards(index, targetCards) {
    if (!Array.isArray(targetCards) || targetCards.length === 0) return;
    const normalizedIndex = ((index % cardColors.length) + cardColors.length) % cardColors.length;
    const color = cardColors[normalizedIndex];
    targetCards.forEach(cardData => setCardHeaderColor(cardData, color, normalizedIndex));
    updateHeaderPreview(color);
  }

  function applyCustomHeaderColorToCards(color, targetCards) {
    if (!Array.isArray(targetCards) || targetCards.length === 0) return;
    targetCards.forEach(cardData => setCardHeaderColor(cardData, color, '-1'));
    updateHeaderPreview(color);
  }

  function setupHeaderControls() {
    if (!headerColorTrigger || !headerColorCycleBtn || !headerColorInput) return;

    const initialColor = headerColorInput.value || cardColors[0];
    updateHeaderPreview(initialColor);

    headerColorTrigger.addEventListener('click', () => {
      headerColorInput.click();
    });

    headerColorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      updateHeaderPreview(color);
      const targets = getHeaderTargetCards();
      if (targets.length === 0) return;
      applyCustomHeaderColorToCards(color, targets);
      setLastFocusedCard(targets[targets.length - 1]);
      saveState();
    });

    headerColorCycleBtn.addEventListener('click', () => {
      const targets = getHeaderTargetCards();
      if (targets.length === 0) return;
      const first = targets[0];
      const currentIndex = Number.parseInt(first.element.dataset.colorIndex ?? '0', 10);
      const nextIndex = Number.isFinite(currentIndex) && currentIndex >= 0
        ? (currentIndex + 1) % cardColors.length
        : 0;
      applyPresetHeaderColorToCards(nextIndex, targets);
      setLastFocusedCard(targets[targets.length - 1] ?? first);
      saveState();
    });
  }

  function setupDragModes() {
    if (selectionModeBtn) {
        selectionModeBtn.addEventListener('click', () => {
            activeState.isSelectionMode = !activeState.isSelectionMode;
            if (activeState.isSelectionMode) {
                activeState.isHierarchicalDragMode = false;
            }
            updateDragModeButtons();
        });
    }
    if (hierarchicalDragModeBtn) {
        hierarchicalDragModeBtn.addEventListener('click', () => {
            activeState.isHierarchicalDragMode = !activeState.isHierarchicalDragMode;
            if (activeState.isHierarchicalDragMode) {
                activeState.isSelectionMode = false;
            }
            updateDragModeButtons();
        });
    }
    updateDragModeButtons();
  }

  function updateDragModeButtons() {
      if (selectionModeBtn) {
          selectionModeBtn.classList.toggle('active', activeState.isSelectionMode);
      }
      if (hierarchicalDragModeBtn) {
          hierarchicalDragModeBtn.classList.toggle('active', activeState.isHierarchicalDragMode);
      }
      document.body.style.cursor = activeState.isSelectionMode ? 'crosshair' : 'default';
  }

  function setupLineControls() {
    if (!thicknessSlider || !lineColorTrigger || !hiddenLineColorPicker || !applyAllToggle) return;

    const ensureCurrentColor = () => {
      const color = activeState.currentColor || DEFAULT_LINE_COLOR;
      activeState.currentColor = color;
      return color;
    };

    const initialColor = ensureCurrentColor();
    lineColorTrigger.style.backgroundColor = initialColor;
    hiddenLineColorPicker.value = initialColor;
    thicknessValue.textContent = activeState.currentThickness;
    thicknessSlider.value = activeState.currentThickness;

    const updateSliderTrack = (val) => {
        const currentColor = ensureCurrentColor();
        const min = Number(thicknessSlider.min), max = Number(thicknessSlider.max);
        const percent = Math.round(((val - min) / (max - min)) * 100);
        thicknessSlider.style.background = `linear-gradient(90deg, ${currentColor} 0%, ${currentColor} ${percent}%, #e5e7eb ${percent}%)`;
        thicknessSlider.style.setProperty('--brand', currentColor);
    };
    updateSliderTrack(activeState.currentThickness);

    const updateAnimationControls = () => {
      if (animationDurationInput) {
        const currentDuration = Number.isFinite(animationSettings.durationMs)
          ? Math.min(MAX_ANIMATION_DURATION, Math.max(MIN_ANIMATION_DURATION, animationSettings.durationMs))
          : DEFAULT_ANIMATION_DURATION;
        animationSettings.durationMs = currentDuration;
        const seconds = currentDuration / 1000;
        const formattedSeconds = Math.round(seconds * 1000) / 1000;
        animationDurationInput.value = String(formattedSeconds);
      }
    };
    updateAnimationControls();

    const applyDurationFromInput = (value) => {
      if (typeof value !== 'string') return false;
      const normalized = value.replace(',', '.').trim();
      if (!normalized) return false;
      const seconds = Number.parseFloat(normalized);
      if (!Number.isFinite(seconds) || seconds <= 0) return false;
      const ms = Math.round(seconds * 1000);
      const clamped = Math.min(MAX_ANIMATION_DURATION, Math.max(MIN_ANIMATION_DURATION, ms));
      animationSettings.durationMs = clamped;
      return true;
    };
	  
    if (animationDurationInput) {
      animationDurationInput.addEventListener('change', (e) => {
        if (!applyDurationFromInput(e.target.value)) {
          updateAnimationControls();
          return;
        }
        updateAnimationControls();
      });
    }

    applyAllToggle.addEventListener('click', () => {
      activeState.isGlobalLineMode = !activeState.isGlobalLineMode;
      applyAllToggle.classList.toggle('active', activeState.isGlobalLineMode);
    });

    lineColorTrigger.addEventListener('click', () => hiddenLineColorPicker.click());
    hiddenLineColorPicker.addEventListener('input', (e) => {
      const newColor = e.target.value || DEFAULT_LINE_COLOR;
      activeState.currentColor = newColor;
      lineColorTrigger.style.backgroundColor = newColor;
      updateSliderTrack(thicknessSlider.value);

      if (activeState.isGlobalLineMode) {
        lines.forEach(line => {
          line.color = newColor;
          line.element.setAttribute('stroke', newColor);
          line.element.style.setProperty('--line-color', newColor);
        });
      } else if (activeState.selectedLine) {
        activeState.selectedLine.color = newColor;
        activeState.selectedLine.element.setAttribute('stroke', newColor);
        activeState.selectedLine.element.style.setProperty('--line-color', newColor);
      }
      saveState();
    });

    thicknessSlider.addEventListener('input', (e) => {
      const newThickness = Number(e.target.value);
      activeState.currentThickness = newThickness;
      thicknessValue.textContent = newThickness;
      updateSliderTrack(newThickness);

      if (activeState.isGlobalLineMode) {
        lines.forEach(line => {
          line.thickness = newThickness;
          line.element.setAttribute('stroke-width', newThickness);
        });
      } else if (activeState.selectedLine) {
        activeState.selectedLine.thickness = newThickness;
        activeState.selectedLine.element.setAttribute('stroke-width', newThickness);
      }
    });
    thicknessSlider.addEventListener('change', saveState);
  }

  function updateCanvasTransform() {
    canvas.style.transform = `translate(${canvasState.x}px, ${canvasState.y}px) scale(${canvasState.scale})`;
  }

  function createCard(opts = {}) {
    const cardId = `card_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const card = document.createElement('div');
    card.className = 'card'; card.id = cardId;
    if (opts.isDarkMode) card.classList.add('dark-mode');

    if (opts.isLarge) {
        card.style.width = '494px';
    } else if (opts.width) {
        card.style.width = opts.width;
    }

    const CARD_WIDTH = card.offsetWidth || (opts.isLarge ? 494 : 380);
    const CARD_HEIGHT = 280, PADDING = 50;
    let initialX, initialY;

    if (opts.x != null) { initialX = opts.x; initialY = opts.y; }
    else {
      const viewL = -canvasState.x / canvasState.scale;
      const viewT = -canvasState.y / canvasState.scale;
      const viewR = (window.innerWidth - canvasState.x) / canvasState.scale;
      const viewB = (window.innerHeight - canvasState.y) / canvasState.scale;
      initialX = Math.max(viewL + PADDING, viewR - CARD_WIDTH  - PADDING);
      initialY = Math.max(viewT + PADDING, viewB - CARD_HEIGHT - PADDING);
    }

    if (opts.isTemplate) { card.style.left = `${initialX}px`; card.style.top = `${initialY}px`; }
    else { card.style.left = `${Math.round(initialX / GRID_SIZE) * GRID_SIZE}px`; card.style.top = `${Math.round(initialY / GRID_SIZE) * GRID_SIZE}px`; }

    const titleText = opts.title ?? 'RUY1234567890';
    const bodyHTML = opts.bodyHTML ?? `
        <div class="card-row">
          <svg class="coin-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="#ffd700" stroke="#DAA520" stroke-width="5"/>
          </svg>
          <span class="value" contenteditable="true">30/330pv</span>
        </div>
        <div class="card-row"><span class="label">Баланс:</span><span class="value" contenteditable="true">0 / 0</span></div>
        <div class="card-row"><span class="label">Актив-заказы PV:</span><span class="value" contenteditable="true">0 / 0</span></div>
        <div class="card-row"><span class="label">Цикл:</span><span class="value" contenteditable="true">0</span></div>
    `;

    card.innerHTML = `
      <div class="card-header" style="${opts.headerBg ? `background:${opts.headerBg}` : ''}">
        <div class="slf-badge">SLF</div>
        <span class="card-title" contenteditable="false">${titleText}</span>
        <div class="fendou-badge">FENDOU</div>
        <img class="rank-badge" src="" alt="Rank">
        <button class="card-close-btn" type="button" title="Удалить карточку">×</button>
      </div>
      <div class="card-body ${opts.bodyClass || ''}">${bodyHTML}</div>
      <div class="connection-point top" data-side="top"></div>
      <div class="connection-point right" data-side="right"></div>
      <div class="connection-point bottom" data-side="bottom"></div>
      <div class="connection-point left" data-side="left"></div>
      <div class="card-controls">
        <button class="card-control-btn note-btn" title="Заметка">📝</button>
      </div>
    `;

    canvas.appendChild(card);
	ensureActiveControls(card);

    const cardData = {
        id: cardId,
        element: card,
        locked: false,
        note: opts.note || null,
        badges: opts.badges || { fendou: false, slf: false, rank: null }
    };
    cards.push(cardData);

    if (window.applyCardBadges) {
        applyCardBadges(cardData);
    }

    card.addEventListener('pointerdown', (e) => {
        if (e.ctrlKey) {
            e.stopPropagation();
            toggleCardSelection(cardData);
            if (activeState.selectedCards.size > 0) {
                let last = null;
                activeState.selectedCards.forEach(cd => { last = cd; });
                if (last) setLastFocusedCard(last);
            } else {
                setLastFocusedCard(cardData);
            }
        } else {
            setLastFocusedCard(cardData);
        }
    });
    const titleEl = card.querySelector('.card-title');
    let isTitleEditing = false;
    if (titleEl) {
      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (isTitleEditing) return;
        isTitleEditing = true;
        titleEl.setAttribute('contenteditable', 'true');
        try {
          titleEl.focus({ preventScroll: true });
        } catch (_) {
          titleEl.focus();
        }
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(titleEl);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
      const finishTitleEditing = () => {
        if (!isTitleEditing) return;
        isTitleEditing = false;
        titleEl.setAttribute('contenteditable', 'false');
        saveState();
      };
      titleEl.addEventListener('blur', finishTitleEditing);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          titleEl.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          titleEl.blur();
        }
      });
    }
    makeDraggable(card, cardData);

    const header = card.querySelector('.card-header');
    const savedColorIndex = Number.parseInt(opts.colorIndex ?? '0', 10);
    if (Number.isFinite(savedColorIndex) && savedColorIndex > -1) {
        setCardHeaderColor(cardData, cardColors[savedColorIndex % cardColors.length], String(savedColorIndex));
    } else if (opts.headerBg) {
        setCardHeaderColor(cardData, opts.headerBg, '-1');
    } else if (header) {
        setCardHeaderColor(cardData, cardColors[0], '0');
    }

    setLastFocusedCard(cardData);

    const coin = card.querySelector('.coin-icon circle');
    if (coin) coin.addEventListener('click', () => { coin.setAttribute('fill', coin.getAttribute('fill') === '#ffd700' ? '#3d85c6' : '#ffd700'); saveState(); });

    const closeBtn = card.querySelector('.card-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(cardData);
        saveState();
      });
    }

    const noteBtn = card.querySelector('.note-btn');
    noteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNote(cardData);
      updateNotesButtonState();
    });
    if (cardData.note && cardData.note.visible) createNoteWindow(cardData);

    updateNoteButtonAppearance(cardData);

    setupBalanceManualEditing(card);
    card.querySelectorAll('[contenteditable="true"]').forEach(el => el.addEventListener('blur', () => {
      handleBalanceManualBlur(el);
      saveState();
    }));
    card.querySelectorAll('.connection-point').forEach(point => {
      point.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (pinchState && e.pointerType === 'touch') return;
        if (!activeState.isDrawingLine) {
          activeState.linePointerId = e.pointerId;
          if (point.setPointerCapture) {
            try { point.setPointerCapture(e.pointerId); activeState.lineCaptureTarget = point; } catch (_) { activeState.lineCaptureTarget = null; }
          } else {
            activeState.lineCaptureTarget = null;
          }
          startDrawingLine(cardData, point.dataset.side);
        } else if (!activeState.linePointerId || activeState.linePointerId === e.pointerId) {
          endDrawingLine(cardData, point.dataset.side);
          saveState();
          if (activeState.lineCaptureTarget && activeState.lineCaptureTarget.releasePointerCapture) {
            try { activeState.lineCaptureTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
          }
          activeState.linePointerId = null;
          activeState.lineCaptureTarget = null;
        }
      });
      point.addEventListener('pointerup', (e) => {
        if (activeState.linePointerId === e.pointerId && activeState.lineCaptureTarget === point && point.releasePointerCapture) {
          try { point.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
          activeState.lineCaptureTarget = null;
        }
      });
      point.addEventListener('pointercancel', (e) => {
        if (activeState.linePointerId === e.pointerId) {
          if (activeState.lineCaptureTarget && activeState.lineCaptureTarget.releasePointerCapture) {
            try { activeState.lineCaptureTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
          }
          cancelDrawing();
          activeState.linePointerId = null;
          activeState.lineCaptureTarget = null;
        }
      });
    });
    updateNotesButtonState();
    return cardData;
  }

  function getBranchDescendants(startCard, branchFilter) {
    const descendants = new Set();
    const queue = [startCard];
    const visited = new Set([startCard.id]);

    let head = 0;
    let isInitialCard = true;

    while(head < queue.length) {
      const currentCard = queue[head++];
      const childLines = lines.filter(line => line.startCard.id === currentCard.id);

      for (const line of childLines) {
        if (isInitialCard) {
            const isBranchMatch =
                (branchFilter === 'all' && ['left', 'right', 'bottom'].includes(line.startSide)) ||
                (line.startSide === branchFilter);
            if (!isBranchMatch) continue;
        }

        const childCard = line.endCard;
        if (!visited.has(childCard.id)) {
            visited.add(childCard.id);
            descendants.add(childCard);
            queue.push(childCard);
        }
      }
      isInitialCard = false;
    }
    return descendants;
  }

  function makeDraggable(element, cardData) {
    const interactiveDragBlockSelector = '.card-control-btn, .note-btn, .active-btn, .card-title, [contenteditable="true"], button, input, textarea, select, label, a[href]';    element.addEventListener('pointerdown', (e) => {      if (e.button !== 0 || e.ctrlKey || activeState.isSelectionMode) return;
      if (pinchState && e.pointerType === 'touch') return;
      if (e.target.closest(interactiveDragBlockSelector)) return;

      let dragSet = new Set();

      if (activeState.isHierarchicalDragMode) {
        let dragMode = null;
        const target = e.target;
        if (target.closest('.card-header')) {
            dragMode = 'all';
        } else if (target.closest('.card-body')) {
            const bodyRect = target.closest('.card-body').getBoundingClientRect();
            dragMode = (e.clientX - bodyRect.left < bodyRect.width / 2) ? 'left' : 'right';
        }

        if (!dragMode) return;
        e.stopPropagation();

        dragSet = getBranchDescendants(cardData, dragMode);
        dragSet.add(cardData);

      } else {
        e.stopPropagation();
        if (activeState.selectedCards.has(cardData)) {
            dragSet = new Set(activeState.selectedCards);
        } else {
            clearSelection();
            dragSet.add(cardData);
        }
      }

      setSelectionSet(dragSet);

      const draggedCards = [];
      activeState.selectedCards.forEach(selectedCard => {
        if (selectedCard.locked) return;
        draggedCards.push({
          card: selectedCard,
          element: selectedCard.element,
          startX: parseFloat(selectedCard.element.style.left),
          startY: parseFloat(selectedCard.element.style.top),
          noteStartX: (selectedCard.note && selectedCard.note.window) ? selectedCard.note.window.offsetLeft : 0,
          noteStartY: (selectedCard.note && selectedCard.note.window) ? selectedCard.note.window.offsetTop : 0,
        });
      });

      if (draggedCards.length === 0) {
        clearSelection();
        return;
      }

      const pointerId = e.pointerId;
      const startPointerX = e.clientX;
      const startPointerY = e.clientY;
      const staticCards = cards.filter(c => !activeState.selectedCards.has(c));

      if (element.setPointerCapture) {
        try { element.setPointerCapture(pointerId); } catch (_) { /* noop */ }
      }

      const onPointerMove = (e2) => {
        if (e2.pointerId !== pointerId) return;
        let dx_canvas = (e2.clientX - startPointerX) / canvasState.scale;
        let dy_canvas = (e2.clientY - startPointerY) / canvasState.scale;
        const dx_viewport = e2.clientX - startPointerX;
        const dy_viewport = e2.clientY - startPointerY;

        if (activeState.guidesEnabled) {
          let snapX = null, snapY = null;
          const draggedBounds = {
            left:   Math.min(...draggedCards.map(d => d.startX + dx_canvas)),
            top:    Math.min(...draggedCards.map(d => d.startY + dy_canvas)),
            right:  Math.max(...draggedCards.map(d => d.startX + d.element.offsetWidth + dx_canvas)),
            bottom: Math.max(...draggedCards.map(d => d.startY + d.element.offsetHeight + dy_canvas))
          };
          draggedBounds.centerX = draggedBounds.left + (draggedBounds.right - draggedBounds.left) / 2;
          draggedBounds.centerY = draggedBounds.top + (draggedBounds.bottom - draggedBounds.top) / 2;

          for (const staticCard of staticCards) {
            const sElem = staticCard.element;
            const s = {
              left: parseFloat(sElem.style.left), top: parseFloat(sElem.style.top),
              width: sElem.offsetWidth, height: sElem.offsetHeight
            };
            s.right = s.left + s.width; s.bottom = s.top + s.height;
            s.centerX = s.left + s.width / 2; s.centerY = s.top + s.height / 2;
            if (Math.abs(draggedBounds.top - s.top) < SNAP_TOLERANCE) { snapY = s.top; dy_canvas = s.top - Math.min(...draggedCards.map(d => d.startY)); }
            else if (Math.abs(draggedBounds.bottom - s.bottom) < SNAP_TOLERANCE) { snapY = s.bottom; dy_canvas = s.bottom - Math.max(...draggedCards.map(d => d.startY + d.element.offsetHeight)); }
            else if (Math.abs(draggedBounds.centerY - s.centerY) < SNAP_TOLERANCE) { snapY = s.centerY; dy_canvas = s.centerY - (Math.min(...draggedCards.map(d => d.startY)) + (draggedBounds.bottom - draggedBounds.top) / 2); }
            if (Math.abs(draggedBounds.left - s.left) < SNAP_TOLERANCE) { snapX = s.left; dx_canvas = s.left - Math.min(...draggedCards.map(d => d.startX)); }
            else if (Math.abs(draggedBounds.right - s.right) < SNAP_TOLERANCE) { snapX = s.right; dx_canvas = s.right - Math.max(...draggedCards.map(d => d.startX + d.element.offsetWidth)); }
            else if (Math.abs(draggedBounds.centerX - s.centerX) < SNAP_TOLERANCE) { snapX = s.centerX; dx_canvas = s.centerX - (Math.min(...draggedCards.map(d => d.startX)) + (draggedBounds.right - draggedBounds.left) / 2); }
          }
          if (snapX !== null) { vGuide.style.left = `${(snapX * canvasState.scale) + canvasState.x}px`; vGuide.style.display = 'block'; } else { vGuide.style.display = 'none'; }
          if (snapY !== null) { hGuide.style.top = `${(snapY * canvasState.scale) + canvasState.y}px`; hGuide.style.display = 'block'; } else { hGuide.style.display = 'none'; }
        }

        draggedCards.forEach(dragged => {
          let newX = dragged.startX + dx_canvas;
          let newY = dragged.startY + dy_canvas;
          const snappedX = (activeState.guidesEnabled && vGuide.style.display === 'block') ? newX : Math.round(newX / GRID_SIZE) * GRID_SIZE;
          const snappedY = (activeState.guidesEnabled && hGuide.style.display === 'block') ? newY : Math.round(newY / GRID_SIZE) * GRID_SIZE;
          dragged.element.style.left = `${snappedX}px`;
          dragged.element.style.top  = `${snappedY}px`;
          updateLinesForCard(dragged.element.id);
          if (dragged.card.note && dragged.card.note.window) {
            dragged.card.note.window.style.left = `${dragged.noteStartX + dx_viewport}px`;
            dragged.card.note.window.style.top  = `${dragged.noteStartY + dy_viewport}px`;
          }
        });
      };

      const finishDrag = (e2) => {
        if (e2.pointerId !== pointerId) return;
        if (element.releasePointerCapture) {
          try { element.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
        }
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', finishDrag);
        element.removeEventListener('pointercancel', cancelDrag);
        vGuide.style.display = 'none'; hGuide.style.display = 'none';
        draggedCards.forEach(dragged => {
            if (dragged.card.note && dragged.card.note.window) {
                dragged.card.note.x = parseFloat(dragged.card.note.window.style.left);
                dragged.card.note.y = parseFloat(dragged.card.note.window.style.top);
            }
        });
        saveState();
      };

      const cancelDrag = (e2) => {
        if (e2.pointerId !== pointerId) return;
        if (element.releasePointerCapture) {
          try { element.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
        }
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', finishDrag);
        element.removeEventListener('pointercancel', cancelDrag);
        vGuide.style.display = 'none'; hGuide.style.display = 'none';
      };

      element.addEventListener('pointermove', onPointerMove);
      element.addEventListener('pointerup', finishDrag);
      element.addEventListener('pointercancel', cancelDrag);
    });
  }

  function startDrawingLine(card, side) {
    activeState.isDrawingLine = true;
    activeState.lineStart = { card, side };
    activeState.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    activeState.previewLine.setAttribute('class', 'line');
    const lineColor = activeState.currentColor || DEFAULT_LINE_COLOR;
    activeState.previewLine.setAttribute('stroke', lineColor);
    activeState.previewLine.setAttribute('stroke-dasharray', '5,5');
    activeState.previewLine.setAttribute('stroke-width', activeState.currentThickness);
    activeState.previewLine.style.setProperty('--line-color', lineColor);
    activeState.previewLine.setAttribute('marker-start', 'url(#marker-dot)');
    activeState.previewLine.setAttribute('marker-end', 'url(#marker-dot)');
    svgLayer.appendChild(activeState.previewLine);
  }

  function endDrawingLine(card, side) {
    if (!activeState.lineStart || activeState.lineStart.card.id === card.id) { cancelDrawing(); return; }
    const lineElement = activeState.previewLine;
    lineElement.removeAttribute('stroke-dasharray');

    const lineColor = activeState.currentColor || DEFAULT_LINE_COLOR;
    const lineData = {
      id: `line_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      startCard: activeState.lineStart.card,
      startSide: activeState.lineStart.side,
      endCard: card,
      endSide: side,
      color: lineColor,
      thickness: activeState.currentThickness,
      element: lineElement
    };
    lines.push(lineData);
    lineElement.addEventListener('click', (e) => { e.stopPropagation(); selectLine(lineData); });
    updateAllLines();

    activeState.isDrawingLine = false;
    activeState.lineStart = null;
    activeState.previewLine = null;
    activeState.linePointerId = null;
    activeState.lineCaptureTarget = null;
  }

  function cancelDrawing() {
    if (activeState.previewLine) activeState.previewLine.remove();
    activeState.isDrawingLine = false;
    activeState.lineStart = null;
    activeState.previewLine = null;
    if (activeState.lineCaptureTarget && activeState.linePointerId != null && activeState.lineCaptureTarget.releasePointerCapture) {
      try { activeState.lineCaptureTarget.releasePointerCapture(activeState.linePointerId); } catch (_) { /* noop */ }
    }
    activeState.linePointerId = null;
    activeState.lineCaptureTarget = null;
  }

  function updateLinePath(pathElement, p1, p2, side1, side2) {
    let finalP2 = { ...p2 }, midP1 = { ...p1 };
    if (side1 === 'left' || side1 === 'right') { midP1 = { x: p2.x, y: p1.y }; if (side2) finalP2.y = p2.y + (p2.y > p1.y ? -MARKER_OFFSET : MARKER_OFFSET); }
    else { midP1 = { x: p1.x, y: p2.y }; if (side2) finalP2.x = p2.x + (p2.x > p1.x ? -MARKER_OFFSET : MARKER_OFFSET); }
    pathElement.setAttribute('d', `M ${p1.x} ${p1.y} L ${midP1.x} ${midP1.y} L ${finalP2.x} ${finalP2.y}`);
  }

  function setupGradientSelector() {
    if (!gradientSelector) return;
    gradientSelector.querySelectorAll('.grad-btn[data-gradient]').forEach(btn => {
      if (btn.dataset.gradient && btn.dataset.gradient !== '#ffffff') btn.style.background = btn.dataset.gradient;
      else { btn.style.background = '#f5f7fb'; btn.style.border = '1px solid #ddd'; }
      btn.addEventListener('click', () => { document.body.style.background = btn.dataset.gradient; });
    });

    const customBgBtn = document.getElementById('custom-bg-btn');
    const customBgInput = document.getElementById('custom-bg-input');
    if (customBgBtn && customBgInput) {
        customBgBtn.addEventListener('click', () => customBgInput.click());
        customBgInput.addEventListener('input', (e) => {
            document.body.style.background = e.target.value;
        });
    }

  }

  function deleteCard(cardData) {
    lines = lines.filter(line => {
      if (line.startCard.id === cardData.id || line.endCard.id === cardData.id) {
        clearLineHighlightState(line.element);
        line.element.remove();
        return false;
      }
      return true;
    });
    if (cardData.note && cardData.note.window) cardData.note.window.remove();
    cardData.element.remove();
    cards = cards.filter(c => c.id !== cardData.id);
    activeState.selectedCards.delete(cardData);
    if (activeState.lastFocusedCard && activeState.lastFocusedCard.id === cardData.id) {
      setLastFocusedCard(null);
      if (activeState.selectedCards.size > 0) {
        const next = activeState.selectedCards.values().next().value;
        if (next) setLastFocusedCard(next);
      }
    }
    updateNotesButtonState();
  }

  function deleteLine(lineData) {
    clearLineHighlightState(lineData.element);
    lineData.element.remove();
    lines = lines.filter(l => l.id !== lineData.id);
    if (activeState.selectedLine && activeState.selectedLine.id === lineData.id) activeState.selectedLine = null;
  }

  function deleteSelection() {
    let changed = false;
    if (activeState.selectedCards.size > 0) { activeState.selectedCards.forEach(cardData => deleteCard(cardData)); changed = true; }
    if (activeState.selectedLine) { deleteLine(activeState.selectedLine); changed = true; }
    if (changed) saveState();
  }

  function updateLinesForCard(cardId) {
    lines.forEach(line => {
      if (line.startCard.id === cardId || line.endCard.id === cardId) {
        const startPoint = getPointCoords(line.startCard, line.startSide);
        const endPoint   = getPointCoords(line.endCard, line.endSide);
        updateLinePath(line.element, startPoint, endPoint, line.startSide, line.endSide);
      }
    });
  }
  function updateAllLines() { lines.forEach(line => updateLinesForCard(line.startCard.id)); }

  function getPointCoords(cardData, side) {
    const card = cardData.element;
    const x = parseFloat(card.style.left), y = parseFloat(card.style.top);
    const width = card.offsetWidth, height = card.offsetHeight;
    switch (side) {
      case 'top': return { x: x + width / 2, y: y };
      case 'bottom': return { x: x + width / 2, y: y + height };
      case 'left': return { x: x, y: y + height / 2 };
      case 'right': return { x: x + width, y: y + height / 2 };
    }
  }

  function selectLine(lineData) {
    if (activeState.selectedLine) activeState.selectedLine.element.classList.remove('selected');
    clearSelection();
    activeState.selectedLine = lineData;
    lineData.element.classList.add('selected');

    thicknessSlider.value = lineData.thickness;
    thicknessValue.textContent = lineData.thickness;
    const color = lineData.color || DEFAULT_LINE_COLOR;
    hiddenLineColorPicker.value = color;
    lineColorTrigger.style.backgroundColor = color;
    activeState.currentThickness = lineData.thickness;
    activeState.currentColor = color;
    setupLineControls();
  }

  function toggleCardSelection(cardData) {
    if (activeState.selectedCards.has(cardData)) { activeState.selectedCards.delete(cardData); cardData.element.classList.remove('selected'); }
    else {
      if (activeState.selectedLine) { activeState.selectedLine.element.classList.remove('selected'); activeState.selectedLine = null; }
      activeState.selectedCards.add(cardData); cardData.element.classList.add('selected');
    }
  }

  function setSelectionSet(newSet) {
    activeState.selectedCards.forEach(card => card.element.classList.remove('selected'));
    activeState.selectedCards.clear();
    let lastCard = null;
    newSet.forEach(cd => {
      activeState.selectedCards.add(cd);
      cd.element.classList.add('selected');
      lastCard = cd;
    });
    if (lastCard) {
      setLastFocusedCard(lastCard);
    }
  }

  function clearSelection() { activeState.selectedCards.forEach(card => card.element.classList.remove('selected')); activeState.selectedCards.clear(); }

  let selectionBox = null;
  let marqueeStart = { x: 0, y: 0 };
  let baseSelection = null;

  function startMarqueeSelection(e) {
    if (!e.ctrlKey) clearSelection();
    activeState.isSelecting = true;
    activeState.selectionPointerId = e.pointerId;
    marqueeStart.x = e.clientX; marqueeStart.y = e.clientY;
    baseSelection = e.ctrlKey ? new Set(activeState.selectedCards) : new Set();

    if (!selectionBox) { selectionBox = document.createElement('div'); selectionBox.className = 'selection-box'; document.body.appendChild(selectionBox); }
    selectionBox.style.left = `${marqueeStart.x}px`;
    selectionBox.style.top = `${marqueeStart.y}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  }

  function updateMarqueeSelection(e) {
    if (!activeState.isSelecting) return;
    const x = Math.min(e.clientX, marqueeStart.x);
    const y = Math.min(e.clientY, marqueeStart.y);
    const width  = Math.abs(e.clientX - marqueeStart.x);
    const height = Math.abs(e.clientY - marqueeStart.y);
    selectionBox.style.left   = `${x}px`;
    selectionBox.style.top    = `${y}px`;
    selectionBox.style.width  = `${width}px`;
    selectionBox.style.height = `${height}px`;

    const selectionRect = selectionBox.getBoundingClientRect();
    const newSet = new Set(baseSelection);
    cards.forEach(cardData => {
      const rect = cardData.element.getBoundingClientRect();
      const intersect = rect.left < selectionRect.right && rect.right > selectionRect.left &&
                        rect.top  < selectionRect.bottom && rect.bottom > selectionRect.top;
      if (intersect) newSet.add(cardData);
    });
    setSelectionSet(newSet);
  }

  function endMarqueeSelection() {
    activeState.isSelecting = false;
    if (activeState.selectionCaptureTarget && activeState.selectionPointerId != null && activeState.selectionCaptureTarget.releasePointerCapture) {
      try { activeState.selectionCaptureTarget.releasePointerCapture(activeState.selectionPointerId); } catch (_) { /* noop */ }
    }
    activeState.selectionPointerId = null;
    activeState.selectionCaptureTarget = null;
    if (selectionBox) {
        selectionBox.style.display = 'none';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
    }

    if (activeState.selectedCards.size > 0) {
        activeState.isSelectionMode = false;
        updateDragModeButtons();
    }
  }

  function getCanvasCoordinates(clientX, clientY) {
    return { x: (clientX - canvasState.x) / canvasState.scale, y: (clientY - canvasState.y) / canvasState.scale };
  }

  function loadTemplate() {
    const templateCards = [
        { key: 'lena', x: 2240, y: -770, title: 'Елена', pv: '330/330pv', coinFill: '#ffd700', isLarge: true },
        { key: 'a',    x: 1750, y: -420, title: 'A',     pv: '30/330pv', coinFill: '#ffd700' },
        { key: 'c',    x: 1470, y:  -70, title: 'C',     pv: '30/330pv', coinFill: '#ffd700' },
        { key: 'd',    x: 2030, y:  -70, title: 'D',     pv: '30/330pv', coinFill: '#ffd700' },
        { key: 'b',    x: 2870, y: -420, title: 'B',     pv: '30/330pv', coinFill: '#ffd700' },
        { key: 'e',    x: 2590, y:  -70, title: 'E',     pv: '30/330pv', coinFill: '#ffd700' },
        { key: 'f',    x: 3150, y:  -70, title: 'F',     pv: '30/330pv', coinFill: '#ffd700' },
    ];

    const templateLines = [
        { startKey: 'b', startSide: 'right', endKey: 'f', endSide: 'top', thickness: 4 },
        { startKey: 'b', startSide: 'left',  endKey: 'e', endSide: 'top', thickness: 4 },
        { startKey: 'a', startSide: 'right', endKey: 'd', endSide: 'top', thickness: 4 },
        { startKey: 'a', startSide: 'left',  endKey: 'c', endSide: 'top', thickness: 4 },
        { startKey: 'lena', startSide: 'left',  endKey: 'a', endSide: 'top', thickness: 4 },
        { startKey: 'lena', startSide: 'right', endKey: 'b', endSide: 'top', thickness: 4 },
    ];

    const CARD_WIDTH = 380, LARGE_CARD_WIDTH = 494, CARD_HEIGHT = 280, PADDING = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    templateCards.forEach(c => {
        const width = c.isLarge ? LARGE_CARD_WIDTH : CARD_WIDTH;
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x + width); maxY = Math.max(maxY, c.y + CARD_HEIGHT);
    });
    const templateWidth = maxX - minX, templateHeight = maxY - minY;

    const canvasViewLeft = -canvasState.x / canvasState.scale;
    const canvasViewTop  = -canvasState.y / canvasState.scale;
    const canvasViewRight = (window.innerWidth - canvasState.x) / canvasState.scale;
    const canvasViewBottom = (window.innerHeight - canvasState.y) / canvasState.scale;

    const targetX = Math.max(canvasViewLeft + PADDING,  canvasViewRight  - templateWidth  - PADDING);
    const targetY = Math.max(canvasViewTop  + PADDING,  canvasViewBottom - templateHeight - PADDING);

    const offsetX = targetX - minX, offsetY = targetY - minY;

    const createdCardsMap = new Map();

    templateCards.forEach(cardDef => {
      const bodyHTML = `
        <div class="card-row">
          <svg class="coin-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="${cardDef.coinFill}" stroke="#DAA520" stroke-width="5"/>
          </svg>
          <span class="value" contenteditable="true">${cardDef.pv}</span>
        </div>
        <div class="card-row"><span class="label">Баланс:</span><span class="value" contenteditable="true">0 / 0</span></div>
        <div class="card-row"><span class="label">Актив-заказы PV:</span><span class="value" contenteditable="true">0 / 0</span></div>
        <div class="card-row"><span class="label">Цикл:</span><span class="value" contenteditable="true">0</span></div>
      `;
      const cardData = createCard({
        x: cardDef.x + offsetX, y: cardDef.y + offsetY, title: cardDef.title,
        bodyHTML, headerBg: 'rgb(93, 139, 244)', colorIndex: 0, isTemplate: true, isLarge: cardDef.isLarge
      });
      createdCardsMap.set(cardDef.key, cardData);
    });

    templateLines.forEach(lineDef => {
      const startCard = createdCardsMap.get(lineDef.startKey);
      const endCard   = createdCardsMap.get(lineDef.endKey);
      if (!startCard || !endCard) return;

      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lineElement.setAttribute('class', 'line');
      const color = '#3d85c6', thickness = lineDef.thickness;
      lineElement.setAttribute('stroke', color);
      lineElement.setAttribute('stroke-width', thickness);
      lineElement.style.setProperty('--line-color', color);
      lineElement.setAttribute('marker-start', 'url(#marker-dot)');
      lineElement.setAttribute('marker-end', 'url(#marker-dot)');
      svgLayer.appendChild(lineElement);

      const lineData = {
        id: `line_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        startCard, startSide: lineDef.startSide,
        endCard,   endSide: lineDef.endSide,
        color, thickness, element: lineElement
      };
      lines.push(lineData);
      lineElement.addEventListener('click', (e) => { e.stopPropagation(); selectLine(lineData); });
    });

    updateAllLines();
    saveState();
  }

  function setupHistoryButtons() { if (undoBtn) undoBtn.addEventListener('click', undo); if (redoBtn) redoBtn.addEventListener('click', redo); }

  function serializeState() {
    return {
      cards: cards.map(c => ({
        id: c.id,
        x: parseFloat(c.element.style.left),
        y: parseFloat(c.element.style.top),
        width: c.element.style.width || null,
        title: c.element.querySelector('.card-title')?.innerText ?? '',
        bodyHTML: c.element.querySelector('.card-body')?.innerHTML ?? '',
        isDarkMode: c.element.classList.contains('dark-mode'),
        bodyClass: c.element.querySelector('.card-body')?.className.replace('card-body', '').trim() ?? '',
        headerBg: c.element.querySelector('.card-header')?.style.background ?? '',
        colorIndex: parseInt(c.element.querySelector('.color-changer')?.dataset.colorIndex || '0', 10),
        note: c.note ? { ...c.note, window: null } : null,
        badges: c.badges,
      })),
      lines: lines.map(l => ({
        startId: l.startCard.id,
        startSide: l.startSide,
        endId: l.endCard.id,
        endSide: l.endSide,
        color: l.color,
        thickness: l.thickness
      }))
    };
  }

  function loadState(state, pushHistory = false) {
    lines.forEach(l => { clearLineHighlightState(l.element); l.element.remove(); }); lines = [];
    cards.forEach(c => { if (c.note && c.note.window) c.note.window.remove(); c.element.remove(); });
    cards = [];
    activeState.selectedCards.clear(); activeState.selectedLine = null;

    const idMap = new Map();
    state.cards.forEach(cd => {
      const cardData = createCard({
        ...cd,
        isLarge: (parseInt(cd.width, 10) === 494),
        isTemplate: true
      });
      idMap.set(cd.id, cardData);
    });

    state.lines.forEach(ld => {
      const startCard = idMap.get(ld.startId);
      const endCard   = idMap.get(ld.endId);
      if (!startCard || !endCard) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'line');
      const color = ld.color || DEFAULT_LINE_COLOR;
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', ld.thickness);
      path.style.setProperty('--line-color', color);
      path.setAttribute('marker-start', 'url(#marker-dot)');
      path.setAttribute('marker-end', 'url(#marker-dot)');
      svgLayer.appendChild(path);

      const lineData = {
        id: `line_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        startCard, startSide: ld.startSide,
        endCard,   endSide: ld.endSide,
        color, thickness: ld.thickness, element: path
      };
      lines.push(lineData);
      path.addEventListener('click', (e) => { e.stopPropagation(); selectLine(lineData); });
      const p1 = getPointCoords(startCard, ld.startSide);
      const p2 = getPointCoords(endCard, ld.endSide);
      updateLinePath(path, p1, p2, ld.startSide, ld.endSide);
    });

    updateNotesButtonState();
    const currentState = serializeState();
    if (pushHistory) {
      saveState(currentState);
    } else {
      recalculateAndRender(currentState);
      lastSavedSnapshot = JSON.stringify(currentState);
    }
  }

  function saveState(precomputedState = null) {
    const snapshot = precomputedState ?? serializeState();
    if (undoStack.length === 0 && snapshot.cards.length === 0 && snapshot.lines.length === 0) {
      recalculateAndRender(snapshot);
      return;
    }
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedSnapshot) {
      recalculateAndRender(snapshot);
      return;
    }
    undoStack.push(serialized);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    lastSavedSnapshot = serialized;
    recalculateAndRender(snapshot);
  }

  function undo() {
    if (undoStack.length < 2) return;
    const current = undoStack.pop(); redoStack.push(current);
    const prev = JSON.parse(undoStack[undoStack.length - 1]);
    loadState(prev, false);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const snapshot = redoStack.pop();
    undoStack.push(snapshot);
    loadState(JSON.parse(snapshot), false);
  }

  function copySelection() {
    if (activeState.selectedCards.size === 0) return;
    const selectedIds = new Set([...activeState.selectedCards].map(c => c.id));

    const copiedCards = [];
    activeState.selectedCards.forEach(cd => {
      const state = serializeState().cards.find(c => c.id === cd.id);
      if (state) copiedCards.push(state);
    });

    const copiedLines = [];
    lines.forEach(l => {
      if (selectedIds.has(l.startCard.id) && selectedIds.has(l.endCard.id)) {
        copiedLines.push({ startId: l.startCard.id, startSide: l.startSide, endId: l.endCard.id, endSide: l.endSide, color: l.color || DEFAULT_LINE_COLOR, thickness: l.thickness });
	  }
    });
    clipboard = { cards: copiedCards, lines: copiedLines };
  }

  function pasteSelection() {
    if (!clipboard || !clipboard.cards || clipboard.cards.length === 0) return;

    const OFFSET = GRID_SIZE;
    const idMap = new Map();
    const newSelection = new Set();

    clipboard.cards.forEach(cd => {
      const newCard = createCard({
        ...cd,
        x: cd.x + OFFSET,
        y: cd.y + OFFSET,
        isLarge: (parseInt(cd.width, 10) === 494),
        note: cd.note ? { ...cd.note, x: cd.note.x + OFFSET, y: cd.note.y + OFFSET, visible: false } : null,
      });
      idMap.set(cd.id, newCard);
      newSelection.add(newCard);
    });
    setSelectionSet(newSelection);

    setTimeout(() => {
      clipboard.lines.forEach(ld => {
        const startCard = idMap.get(ld.startId);
        const endCard = idMap.get(ld.endId);
        if (!startCard || !endCard) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'line');
        const color = ld.color || DEFAULT_LINE_COLOR;
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', ld.thickness);
        path.style.setProperty('--line-color', color);
        path.setAttribute('marker-start', 'url(#marker-dot)');
        path.setAttribute('marker-end', 'url(#marker-dot)');
        svgLayer.appendChild(path);

        const lineData = {
          id: `line_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          startCard, startSide: ld.startSide,
          endCard,   endSide: ld.endSide,
          color, thickness: ld.thickness, element: path
        };
        lines.push(lineData);
        path.addEventListener('click', (e) => { e.stopPropagation(); selectLine(lineData); });
        const p1 = getPointCoords(startCard, ld.startSide);
        const p2 = getPointCoords(endCard, ld.endSide);
        updateLinePath(path, p1, p2, ld.startSide, ld.endSide);
      });
      saveState();
    }, 0);
  }

  function setupSaveButtons() {
    if (saveProjectBtn) {
      saveProjectBtn.addEventListener('click', () => {
        const data = serializeState();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (loadProjectBtn && loadProjectInput) {
      loadProjectBtn.addEventListener('click', () => loadProjectInput.click());
      loadProjectInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const isHtml = /^\s*<!doctype html|<html[\s>]/i.test(text);
          if (isHtml) throw new Error('html-file');
          const state = JSON.parse(text);
          const ok = state && typeof state === 'object' && Array.isArray(state.cards) && Array.isArray(state.lines);
          if (!ok) throw new Error('bad-structure');
          loadState(state, true);
        } catch (err) {
          console.error('Не удалось загрузить проект:', err);
          if (String(err.message) === 'html-file') {
            alert('Вы выбрали HTML-файл из «Экспорт HTML». Для продолжения выберите JSON, сохранённый кнопкой «💾 Сохранить проект».');
          } else if (String(err.message) === 'bad-structure') {
            alert('Файл прочитан, но структура не похожа на проект (нет полей cards/lines). Проверьте, что это JSON из «💾 Сохранить проект».');
          } else {
            alert('Файл повреждён или имеет неверный формат JSON.');
          }
        } finally {
          loadProjectInput.value = '';
        }
      });
    }

    if (exportHtmlBtn) {
      exportHtmlBtn.addEventListener('click', async () => {
        try {
          const bodyStyle = getComputedStyle(document.body);
          const viewOnlyScript = `<script>
document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('canvas');
  if (!c) return;
  let x = ${canvasState.x}, y = ${canvasState.y}, s = ${canvasState.scale};
  let pan = false, panId = null, lastX = 0, lastY = 0;
  const pointers = new Map();
  let pinch = null;
  const clamp = (v) => Math.max(0.1, Math.min(5, v));
  const update = () => {
    c.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
  };
  const tryPinch = () => {
    if (pinch) return;
    const touches = [...pointers.entries()].filter(([, info]) => info.type === 'touch');
    if (touches.length < 2) return;
    const [a, b] = touches;
    const dist = Math.hypot(b[1].x - a[1].x, b[1].y - a[1].y);
    if (!dist) return;
    if (pan && panId != null) {
      if (c.releasePointerCapture) {
        try { c.releasePointerCapture(panId); } catch (err) {}
      }
      document.body.style.cursor = 'default';
    }
    pan = false;
    panId = null;
    pinch = {
      a: a[0],
      b: b[0],
      d: dist,
      scale: s,
      midX: (a[1].x + b[1].x) / 2,
      midY: (a[1].y + b[1].y) / 2
    };
  };
  const handlePinch = () => {
    if (!pinch) return;
    const a = pointers.get(pinch.a);
    const b = pointers.get(pinch.b);
    if (!a || !b) return;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    x += midX - pinch.midX;
    y += midY - pinch.midY;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist) {
      const nextScale = clamp(pinch.scale * dist / pinch.d);
      const ratio = nextScale / s;
      x = midX - (midX - x) * ratio;
      y = midY - (midY - y) * ratio;
      s = nextScale;
    }
    pinch.midX = midX;
    pinch.midY = midY;
    update();
  };
  const endPinch = (id) => {
    if (pinch && (id === pinch.a || id === pinch.b)) {
      pinch = null;
    }
  };
  c.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (e.pointerType === 'touch') {
      tryPinch();
      if (!pinch && !pan) {
        pan = true;
        panId = e.pointerId;
        lastX = e.clientX;
        lastY = e.clientY;
        if (c.setPointerCapture) {
          try { c.setPointerCapture(e.pointerId); } catch (err) {}
        }
        document.body.style.cursor = 'move';
      }
    } else if (e.button === 1) {
      e.preventDefault();
      pan = true;
      panId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      if (c.setPointerCapture) {
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
      }
      document.body.style.cursor = 'move';
    }
  });
  c.addEventListener('pointermove', (e) => {
    const info = pointers.get(e.pointerId);
    if (info) {
      info.x = e.clientX;
      info.y = e.clientY;
    }
    if (pinch && (e.pointerId === pinch.a || e.pointerId === pinch.b)) {
      handlePinch();
      return;
    }
    if (pan && e.pointerId === panId) {
      e.preventDefault();
      x += e.clientX - lastX;
      y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      update();
    }
  });
  const stop = (e) => {
    pointers.delete(e.pointerId);
    endPinch(e.pointerId);
    if (pan && e.pointerId === panId) {
      pan = false;
      panId = null;
      document.body.style.cursor = 'default';
      if (c.releasePointerCapture) {
        try { c.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }
  };
  c.addEventListener('pointerup', stop);
  c.addEventListener('pointercancel', stop);
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const nextScale = clamp(s - 0.001 * e.deltaY);
    const ratio = nextScale / s;
    const fx = e.clientX;
    const fy = e.clientY;
    x = fx - (fx - x) * ratio;
    y = fy - (fy - y) * ratio;
    s = nextScale;
    update();
  }, { passive: false });
  update();
});
<\/script>`;
          const canvasClone = canvas.cloneNode(true);

          const selectorsToRemove = [
            '.note-resize-handle',
            '.note-close-btn',
            '.card-controls',
            '.close-btn',
            '.connection-point',
            '.active-pv-controls'
          ];

          canvasClone.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => el.remove());

          canvasClone.querySelectorAll('[contenteditable]').forEach(el => {
            el.setAttribute('contenteditable', 'false');
            el.style.pointerEvents = 'none';
          });

          const inferMimeFromSrc = (src) => {
            const clean = src.split('?')[0] || '';
            const ext = clean.split('.').pop()?.toLowerCase();
            switch (ext) {
              case 'svg': return 'image/svg+xml';
              case 'jpg':
              case 'jpeg': return 'image/jpeg';
              case 'gif': return 'image/gif';
              case 'webp': return 'image/webp';
              default: return 'image/png';
            }
          };

          const arrayBufferToBase64 = (buffer) => {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            }
            return window.btoa(binary);
          };

          const inlineImages = async (root) => {
            const images = Array.from(root.querySelectorAll('img'));
            await Promise.all(images.map(async (img) => {
              const src = img.getAttribute('src');
              if (!src || src.startsWith('data:') || /^(https?:)?\/\//i.test(src)) return;
              try {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const buffer = await response.arrayBuffer();
                const mime = response.headers.get('Content-Type') || inferMimeFromSrc(src);
                const base64 = arrayBufferToBase64(buffer);
                img.setAttribute('src', `data:${mime};base64,${base64}`);
              } catch (err) {
                console.warn('Не удалось встроить изображение в экспортируемый HTML:', src, err);
              }
            }));
          };

          await inlineImages(canvasClone);

          const buildAndDownload = (cssText) => {
            const serializeVoidTags = (html) =>
              html.replace(/<(img|meta)([^>]*?)(\s*\/)?>(?=<|$)/gi, (_, tag, attrs) => {
                const trimmedAttrs = (attrs || '').trim().replace(/\s*\/?$/, '');
                const spacer = trimmedAttrs ? ` ${trimmedAttrs}` : '';
                return `<${tag}${spacer} />`;
              });

            const rawHtmlContent = `<!DOCTYPE html><html lang=\"ru\"><head><meta charset=\"UTF-8\"><title>Просмотр Схемы</title><style>${cssText}body{overflow:hidden}.card:hover{transform:none;box-shadow:0 8px 20px rgba(0,0,0,.15)}.card.selected{box-shadow:0 8px 20px rgba(0,0,0,.15)}</style></head><body style=\"background:${bodyStyle.background};\">${canvasClone.outerHTML}${viewOnlyScript}</body></html>`;
            const htmlContent = serializeVoidTags(rawHtmlContent);
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scheme-${Date.now()}.html`;
            a.click();
            URL.revokeObjectURL(url);
          };

          try {
            const response = await fetch('style.css');
            if (!response.ok) throw new Error('style-missing');
            const cssText = await response.text();
            buildAndDownload(cssText);
          } catch (err) {
            const minimalCss = `html,body{margin:0;height:100%}body{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;}#canvas{position:relative;width:100%;height:100%;transform-origin:0 0}#svg-layer{position:absolute;inset:0;pointer-events:none;overflow:visible}.line{fill:none;stroke:currentColor;stroke-linecap:round}.card{position:absolute;width:var(--card-width, 380px);background:#fff;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.15);overflow:hidden}.card-header{background:#4facfe;color:#fff;height:52px;padding:10px 12px;display:grid;grid-template-columns:28px 28px 1fr 28px 28px;align-items:center;gap:6px;border-radius:16px 16px 0 0}.card-title{grid-column:3/4;text-align:center;font-weight:700;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-body{padding:14px 16px;}.card-row{display:flex;align-items:center;gap:10px;margin:8px 0}.label{color:#6b7280;font-weight:600;}.value{color:#111827;}.coin-icon{width:28px;height:28px;}`;
            buildAndDownload(minimalCss);
          }
        } catch (err) {
          console.error('Не удалось выполнить экспорт HTML:', err);
          alert('Экспорт в HTML завершился ошибкой. Подробности см. в консоли.');
        }
      });
    }
  }

  function normalizeBranchSide(side) {
    const s = String(side || '').toLowerCase();
    return s === 'right' || s === 'r' ? 'R' : 'L';
  }

  function getCardTop(cardData) {
    if (!cardData || !cardData.element) return 0;
    const parsed = parseFloat(cardData.element.style.top);
    if (Number.isFinite(parsed)) return parsed;
    const rect = cardData.element.getBoundingClientRect();
    return rect ? rect.top + window.scrollY : 0;
  }

  function getLineRelation(line) {
    if (!line || !line.startCard || !line.endCard) return null;
    const startTop = getCardTop(line.startCard);
    const endTop = getCardTop(line.endCard);
    if (!Number.isFinite(startTop) || !Number.isFinite(endTop)) return null;
    if (startTop <= endTop) {
      return {
        parent: line.startCard,
        child: line.endCard,
        side: normalizeBranchSide(line.startSide)
      };
    }
    return {
      parent: line.endCard,
      child: line.startCard,
      side: normalizeBranchSide(line.endSide)
    };
  }

  function getHighlightTimingConfig() {
    const base = Number.isFinite(animationSettings.durationMs)
      ? animationSettings.durationMs
      : DEFAULT_ANIMATION_DURATION;
    const sanitizedDuration = Math.min(MAX_ANIMATION_DURATION, Math.max(MIN_ANIMATION_DURATION, base));
    const cssDuration = Math.min(MAX_ANIMATION_LOOP_DURATION, sanitizedDuration);
    return {
      cssDuration,
      autoRemoveDuration: sanitizedDuration
    };
  }

  function clearLineHighlightState(lineEl) {
    const timers = lineHighlightTimers.get(lineEl);
    if (timers) {
      timers.forEach((timer) => clearTimeout(timer));
      lineHighlightTimers.delete(lineEl);
    }
    if (lineEl) {
      lineEl.classList.remove('line--balance-highlight', 'line--pv-highlight');
    }
  }

  function applyLineHighlight(lineEl, type) {
    if (!lineEl) return;

    // Перед запуском новой анимации обязательно сбрасываем предыдущую,
    // чтобы не оставалось одновременно двух классов подсветки.
    clearLineHighlightState(lineEl);

    const { cssDuration, autoRemoveDuration } = getHighlightTimingConfig();
    const className = type === 'pv' ? 'line--pv-highlight' : 'line--balance-highlight';
    lineEl.classList.remove(className);
    try {
      void lineEl.getBBox();
    } catch (_) {
      try { lineEl.getBoundingClientRect(); } catch (__) { /* noop */ }
    }
    lineEl.style.setProperty('--line-animation-duration', `${cssDuration}ms`);
    lineEl.classList.add(className);
    let perLine = lineHighlightTimers.get(lineEl);
    if (perLine && perLine.has(className)) {
      clearTimeout(perLine.get(className));
      perLine.delete(className);
      if (perLine.size === 0) {
        lineHighlightTimers.delete(lineEl);
        perLine = null;
      }
    }
    if (autoRemoveDuration == null) return;

    if (!perLine) {
      perLine = new Map();
      lineHighlightTimers.set(lineEl, perLine);
    }
    const timer = setTimeout(() => {
      lineEl.classList.remove(className);
      const stored = lineHighlightTimers.get(lineEl);
      if (stored) {
        stored.delete(className);
        if (stored.size === 0) lineHighlightTimers.delete(lineEl);
      }
    }, autoRemoveDuration);
    perLine.set(className, timer);
  }

  function highlightLinesForParentSide(parentId, side, type) {
    if (!parentId) return;
    const normalizedSide = normalizeBranchSide(side);
    lines.forEach((line) => {
      const relation = getLineRelation(line);
      if (!relation) return;
      if (relation.parent.id !== parentId) return;
      if (relation.side !== normalizedSide) return;
      applyLineHighlight(line.element, type);
    });
  }

  function highlightLineBetween(parentId, childId, side, type) {
    if (!parentId || !childId) return;
    const normalizedSide = normalizeBranchSide(side);
    for (const line of lines) {
      const relation = getLineRelation(line);
      if (!relation) continue;
      if (relation.parent.id !== parentId) continue;
      if (relation.child.id !== childId) continue;
      if (relation.side !== normalizedSide) continue;
      applyLineHighlight(line.element, type);
      break;
    }
  }

  function applyBalanceHighlights(highlightCandidates, idToElementMap) {
    const previous = new Map();
    highlightedBalanceParts.forEach((sides, id) => {
      if (idToElementMap.has(id)) {
        previous.set(id, { left: !!sides.left, right: !!sides.right });
      }
    });

    const timing = getHighlightTimingConfig();
    const highlightOptions = {
      autoRemoveDuration: timing.autoRemoveDuration,
      animationDuration: timing.cssDuration
    };

    if (!highlightCandidates || highlightCandidates.size === 0) {
      previous.forEach((_, id) => {
        const cardEl = idToElementMap.get(id);
        const valueEl = cardEl ? getBalanceValueElement(cardEl) : null;
        if (!valueEl) return;
        setPartHighlight(valueEl, 'L', false);
        setPartHighlight(valueEl, 'R', false);
      });
      highlightedBalanceParts = new Map();
      return;
    }

    previous.forEach((_, id) => {
      if (highlightCandidates.has(id)) return;
      const cardEl = idToElementMap.get(id);
      const valueEl = cardEl ? getBalanceValueElement(cardEl) : null;
      if (!valueEl) return;
      setPartHighlight(valueEl, 'L', false);
      setPartHighlight(valueEl, 'R', false);
    });

      const applied = new Map();
      highlightCandidates.forEach((sides, id) => {
        const cardEl = idToElementMap.get(id);
        const valueEl = cardEl ? getBalanceValueElement(cardEl) : null;
        if (!valueEl) return;
        if (valueEl.dataset.manualBalance === 'true') {
          setPartHighlight(valueEl, 'L', false);
          setPartHighlight(valueEl, 'R', false);
          return;
        }
        const appliedSides = { left: false, right: false };
        if (sides.left) {
          if (setPartHighlight(valueEl, 'L', true, highlightOptions)) appliedSides.left = true;
        } else {
          setPartHighlight(valueEl, 'L', false);
        }
        if (sides.right) {
          if (setPartHighlight(valueEl, 'R', true, highlightOptions)) appliedSides.right = true;
        } else {
          setPartHighlight(valueEl, 'R', false);
        }
        if (appliedSides.left || appliedSides.right) {
        applied.set(id, appliedSides);
      }
    });

    highlightedBalanceParts = applied;

    applied.forEach((sides, id) => {
      if (sides.left) highlightLinesForParentSide(id, 'L', 'balance');
      if (sides.right) highlightLinesForParentSide(id, 'R', 'balance');
    });
  }

  function renderSplitValue(valueEl, leftValue, rightValue) {
    if (!valueEl) return;
    const leftText = escapeHtml(String(leftValue ?? '0'));
    const rightText = escapeHtml(String(rightValue ?? '0'));
    valueEl.innerHTML = `<span class="value-part value-left">${leftText}</span> <span class="value-separator">/</span> <span class="value-part value-right">${rightText}</span>`;
  }

  function ensureSplitValueStructure(valueEl) {
    if (!valueEl) return false;
    const hasLeft = valueEl.querySelector('.value-left');
    const hasRight = valueEl.querySelector('.value-right');
    if (hasLeft && hasRight) return true;
    const text = (valueEl.textContent || '').trim();
    const match = /^(\d+)\s*\/\s*(\d+)/.exec(text);
    if (!match) return false;
    renderSplitValue(valueEl, match[1], match[2]);
    return true;
  }

  function getValuePart(valueEl, side) {
    if (!valueEl) return null;
    if (!ensureSplitValueStructure(valueEl)) return null;
    const selector = side === 'L' ? '.value-left' : '.value-right';
    return valueEl.querySelector(selector);
  }

  function setPartHighlight(valueEl, side, shouldHighlight, options = {}) {
    let part = null;
    const selector = side === 'L' ? '.value-left' : '.value-right';
    if (valueEl.dataset.manualBalance === 'true') {
      part = valueEl.querySelector(selector);
    } else {
      part = getValuePart(valueEl, side);
    }
    if (!part) return false;
    const { autoRemoveDuration, animationDuration } = options;
    if (!shouldHighlight) {
      part.classList.remove('balance-highlight');
      const timer = partHighlightTimers.get(part);
      if (timer) {
        clearTimeout(timer);
        partHighlightTimers.delete(part);
      }
      return false;
    }
    if (Number.isFinite(animationDuration)) {
      const sanitizedDuration = Math.min(MAX_ANIMATION_DURATION, Math.max(MIN_ANIMATION_DURATION, animationDuration));
      part.style.setProperty('--balance-animation-duration', `${sanitizedDuration}ms`);
    }
    part.classList.remove('balance-highlight');
    void part.offsetWidth;
    part.classList.add('balance-highlight');
    if (autoRemoveDuration == null || autoRemoveDuration <= 0) {
      const prevTimer = partHighlightTimers.get(part);
      if (prevTimer) {
        clearTimeout(prevTimer);
        partHighlightTimers.delete(part);
      }
      return true;
    }
    const prevTimer = partHighlightTimers.get(part);
    if (prevTimer) clearTimeout(prevTimer);
    const newTimer = setTimeout(() => {
      part.classList.remove('balance-highlight');
      partHighlightTimers.delete(part);
    }, autoRemoveDuration);
    partHighlightTimers.set(part, newTimer);
    return true;
  }

  function recalculateAndRender(stateOverride = null) {
    try {
      if (!window.Engine) {
        lastEngineMeta = null;
        return;
      }
      const state = stateOverride ?? serializeState();
      const { result, meta } = Engine.recalc(state);
      lastEngineMeta = meta;

      const id2el = new Map(cards.map(c => [c.id, c.element]));
      const highlightCandidates = new Map();
      cards.forEach(cd => {
        const el = cd.element;
        const cardResult = result[cd.id];

        ensureActiveControls(el);

        const circle = el.querySelector('.coin-icon circle');
        if (circle) {
          const full = meta.isFull[cd.id];
          circle.setAttribute('fill', full ? '#ffd700' : '#3d85c6');
        }

        const hidden = el.querySelector('.active-pv-hidden');
        const aBonusL = hidden ? parseInt(hidden.dataset.abonusl || '0', 10) : 0;
        const aBonusR = hidden ? parseInt(hidden.dataset.abonusr || '0', 10) : 0;

        const rows = el.querySelectorAll('.card-row');
        rows.forEach(row => {
          const label = row.querySelector('.label');
          const value = row.querySelector('.value');
          if (!label || !value) return;
          const name = (label.textContent || '').trim().toLowerCase();

          if (name.startsWith('баланс')) {
            const manual = value.dataset.manualBalance ? readStoredManualBalance(el) : null;
            let manualLeft = 0;
            let manualRight = 0;
            let hasManualNumbers = false;

            if (manual) {
              if (Number.isFinite(manual.left) && Number.isFinite(manual.right)) {
                manualLeft = manual.left;
                manualRight = manual.right;
                hasManualNumbers = true;
              } else if (manual.raw) {
                value.textContent = manual.raw;
                return;
              } else {
                delete value.dataset.manualBalance;
              }
            }

            const r = cardResult || { L: 0, R: 0, total: 0 };
            let localL = hidden ? parseInt(hidden.dataset.locall || '0', 10) : 0;
            let localR = hidden ? parseInt(hidden.dataset.localr || '0', 10) : 0;
            if (!Number.isFinite(localL)) localL = 0;
            if (!Number.isFinite(localR)) localR = 0;
            if (localL < 0) localL = 0;
            if (localR < 0) localR = 0;
            const leftBalance = Math.max(0, (r.L || 0) + aBonusL + localL);
            const rightBalance = Math.max(0, (r.R || 0) + aBonusR + localR);
            if (!hasManualNumbers && cardResult) {
              const prev = lastCalculatedBalances.get(cd.id);
              const prevL = prev && Number.isFinite(prev.L) ? prev.L : null;
              const prevR = prev && Number.isFinite(prev.R) ? prev.R : null;
              const nextL = Number.isFinite(cardResult.L) ? cardResult.L : 0;
              const nextR = Number.isFinite(cardResult.R) ? cardResult.R : 0;
              if (prevL !== null && nextL > prevL) {
                const entry = highlightCandidates.get(cd.id) || { left: false, right: false };
                entry.left = true;
                highlightCandidates.set(cd.id, entry);
              }
              if (prevR !== null && nextR > prevR) {
                const entry = highlightCandidates.get(cd.id) || { left: false, right: false };
                entry.right = true;
                highlightCandidates.set(cd.id, entry);
              }
            }
            if (hasManualNumbers) {
              value.textContent = formatManualBalance({ left: manualLeft, right: manualRight });
            } else {
              renderSplitValue(value, leftBalance, rightBalance);
            }
          }
        });
      });

      applyBalanceHighlights(highlightCandidates, id2el);

      Object.entries(result || {}).forEach(([cardId, data]) => {
        const nextL = data && Number.isFinite(data.L) ? data.L : 0;
        const nextR = data && Number.isFinite(data.R) ? data.R : 0;
        lastCalculatedBalances.set(cardId, { L: nextL, R: nextR });
      });

      Array.from(lastCalculatedBalances.keys()).forEach((cardId) => {
        if (!result[cardId]) {
          lastCalculatedBalances.delete(cardId);
        }
      });
    } catch (e) {
      console.warn('Recalc/render error:', e);
    }
  }

  function ensureActiveControls(cardEl) {
    const rows = cardEl.querySelectorAll('.card-row');
    let activeRow = null;
    rows.forEach(r => {
      const lab = r.querySelector('.label');
      if (lab && (lab.textContent || '').trim().toLowerCase().startsWith('актив-заказы')) activeRow = r;
    });
    if (!activeRow) return;

    activeRow.classList.add('active-pv-row');

    if (!cardEl.querySelector('.active-pv-controls')) {
      const controls = document.createElement('div');
      controls.className = 'active-pv-controls';
      controls.innerHTML = `
        <div class="left-controls">
          <button class="active-btn" data-dir="L" data-step="1">+1</button>
          <button class="active-btn" data-dir="L" data-step="10">+10</button>
          <button class="active-btn" data-dir="L" data-step="-10">-10</button>
          <button class="active-btn" data-dir="L" data-step="-1">-1</button>
        </div>
        <div class="mid-controls">
          <button class="active-btn active-clear">Очистить</button>
        </div>
        <div class="right-controls">
          <button class="active-btn" data-dir="R" data-step="-1">-1</button>
          <button class="active-btn" data-dir="R" data-step="-10">-10</button>
          <button class="active-btn" data-dir="R" data-step="10">+10</button>
          <button class="active-btn" data-dir="R" data-step="1">+1</button>
        </div>`;
      activeRow.insertAdjacentElement('afterend', controls);
    }

    let hidden = cardEl.querySelector('.active-pv-hidden');
    if (!hidden) {
      hidden = document.createElement('span');
      hidden.className = 'active-pv-hidden';
      hidden.style.display = 'none';
      hidden.dataset.btnL    = '0';
      hidden.dataset.btnR    = '0';
      hidden.dataset.abonusl = '0';
      hidden.dataset.abonusr = '0';
      hidden.dataset.locall  = '0';
      hidden.dataset.localr  = '0';
      activeRow.insertAdjacentElement('afterend', hidden);
    } else {
      hidden.dataset.btnL    = hidden.dataset.btnL    || '0';
      hidden.dataset.btnR    = hidden.dataset.btnR    || '0';
      hidden.dataset.abonusl = hidden.dataset.abonusl || '0';
      hidden.dataset.abonusr = hidden.dataset.abonusr || '0';
      hidden.dataset.locall  = hidden.dataset.locall  || '0';
      hidden.dataset.localr  = hidden.dataset.localr  || '0';
    }
    hidden.dataset.manualBalanceLeft = hidden.dataset.manualBalanceLeft || '';
    hidden.dataset.manualBalanceRight = hidden.dataset.manualBalanceRight || '';
    hidden.dataset.manualBalanceRaw = hidden.dataset.manualBalanceRaw || '';

    const valEl = activeRow.querySelector('.value');
    if (valEl) {
      valEl.setAttribute('contenteditable', 'false');
      ['beforeinput', 'input', 'keydown', 'paste'].forEach(ev =>
        valEl.addEventListener(ev, (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true })
      );
    }
  }

  function getBalanceValueElement(cardEl) {
    const balanceRow = Array.from(cardEl.querySelectorAll('.card-row')).find(row => {
      const label = row.querySelector('.label');
      return label && (label.textContent || '').trim().toLowerCase().startsWith('баланс');
    });
    return balanceRow ? balanceRow.querySelector('.value') : null;
  }

  function parseManualBalanceInput(text) {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, '');
    if (!cleaned) return null;
    const parts = cleaned.split('/');
    if (parts.length === 0 || parts.length > 2) return null;
    const left = parseInt(parts[0], 10);
    const right = parts.length === 2 ? parseInt(parts[1], 10) : 0;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    return { left, right };
  }

  function formatManualBalance({ left, right }) {
    return `${left} / ${right}`;
  }

  function readStoredManualBalance(cardEl) {
    const hidden = cardEl?.querySelector('.active-pv-hidden');
    if (!hidden) return null;
    const left = parseInt(hidden.dataset.manualBalanceLeft || '', 10);
    const right = parseInt(hidden.dataset.manualBalanceRight || '', 10);
    const raw = hidden.dataset.manualBalanceRaw || '';
    if (!Number.isFinite(left) || !Number.isFinite(right)) return raw ? { raw } : null;
    return { left, right, raw: raw || formatManualBalance({ left, right }) };
  }

  function storeManualBalance(cardEl, valueEl, balance) {
    const hidden = cardEl?.querySelector('.active-pv-hidden');
    if (!hidden) return;
    hidden.dataset.manualBalanceLeft = Number.isFinite(balance.left) ? String(balance.left) : '';
    hidden.dataset.manualBalanceRight = Number.isFinite(balance.right) ? String(balance.right) : '';
    const raw = formatManualBalance(balance);
    hidden.dataset.manualBalanceRaw = raw;
    valueEl.dataset.manualBalance = 'true';
    valueEl.dataset.manualBalanceRaw = raw;
    valueEl.textContent = raw;
  }

  function clearManualBalance(cardEl, valueEl) {
    const hidden = cardEl?.querySelector('.active-pv-hidden');
    if (hidden) {
      delete hidden.dataset.manualBalanceLeft;
      delete hidden.dataset.manualBalanceRight;
      delete hidden.dataset.manualBalanceRaw;
    }
    delete valueEl.dataset.manualBalance;
    delete valueEl.dataset.manualBalanceRaw;
  }

  function setupBalanceManualEditing(cardEl) {
    const valueEl = getBalanceValueElement(cardEl);
    if (!valueEl || valueEl.__balanceHandlersAttached) return;
    valueEl.__balanceHandlersAttached = true;
    valueEl.__balanceDirty = false;

    valueEl.addEventListener('input', () => {
      valueEl.dataset.manualBalance = 'true';
      valueEl.__balanceDirty = true;
    });

    valueEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        const cardElLocal = valueEl.closest('.card');
        if (!cardElLocal) return;
        clearManualBalance(cardElLocal, valueEl);
        valueEl.textContent = '';
        valueEl.__balanceDirty = false;
        recalculateAndRender();
        saveState();
      }
    });
  }

  function handleBalanceManualBlur(el) {
    if (!el || !el.__balanceHandlersAttached || !el.closest('.card')) return;
    if (!el.__balanceDirty && !el.dataset.manualBalance) return;

    const cardEl = el.closest('.card');
    if (!cardEl) { el.__balanceDirty = false; return; }

    const text = (el.textContent || '').trim();
    if (!text) {
      clearManualBalance(cardEl, el);
      el.textContent = '';
      el.__balanceDirty = false;
      recalculateAndRender();
      return;
    }

    const parsed = parseManualBalanceInput(text);
    if (parsed) {
      storeManualBalance(cardEl, el, parsed);
    } else {
      const stored = readStoredManualBalance(cardEl);
      if (stored && stored.raw) {
        el.textContent = stored.raw;
        el.dataset.manualBalance = 'true';
      } else {
        clearManualBalance(cardEl, el);
        recalculateAndRender();
      }
    }
    el.__balanceDirty = false;
  }

  function parseActivePV(cardEl) {
    const row = Array.from(cardEl.querySelectorAll('.card-row')).find(r => {
      const lab = r.querySelector('.label');
      return lab && (lab.textContent || '').trim().toLowerCase().startsWith('актив-заказы');
    });
    if (!row) return { L: 0, R: 0, row: null, valEl: null };
    const valEl = row.querySelector('.value');
    const txt = (valEl?.textContent || '').trim();
    const m = /^(\d+)\s*\/\s*(\d+)/.exec(txt);
    const L = m ? parseInt(m[1], 10) : 0;
    const R = m ? parseInt(m[2], 10) : 0;
    return { L, R, row, valEl };
  }

  function findCardByElement(el) {
    const obj = cards.find(c => c.element === el);
    return obj || null;
  }

  function findCardElementById(id) {
    const obj = cards.find(c => c.id === id);
    return obj ? obj.element : null;
  }

  function getParentInfo(childId) {
    if (!window.Engine) return null;
    if (!lastEngineMeta || !lastEngineMeta.parentOf) {
      const recalculated = Engine.recalc(serializeState());
      lastEngineMeta = recalculated.meta;
    }
    const p = lastEngineMeta.parentOf?.[childId];
    if (!p) return null;
    return { parentId: p.parentId, side: (p.side === 'right' ? 'R' : 'L') };
  }

  function propagateActivePvUp(cardEl, side, amount) {
    if (!amount) return;
    const BASE = ACTIVE_PV_BASE;
    let curEl = cardEl;
    let curSide = side;
    let carry = amount;
    while (curEl) {
      ensureActiveControls(curEl);
      const apv = parseActivePV(curEl);
      let L = apv.L, R = apv.R;
      const prev = (curSide === 'L') ? L : R;
      const curCard = findCardByElement(curEl);
      const parentInfo = curCard ? getParentInfo(curCard.id) : null;

      const hidden = curEl.querySelector('.active-pv-hidden');
      const localKey = curSide === 'L' ? 'locall' : 'localr';
      let storedUnits = hidden ? parseInt(hidden.dataset[localKey] || '0', 10) : 0;
      if (!Number.isFinite(storedUnits)) storedUnits = 0;
      if (storedUnits < 0) storedUnits = 0;


      const beforeRem = prev;
      const beforeUnits = storedUnits;
      const beforeTotal = beforeRem + beforeUnits * BASE;

      let delta = carry;
      if (delta < 0) {
        const minDelta = -beforeRem;
        if (delta < minDelta) delta = minDelta;
      }

      let remTotal = beforeRem + delta;
      if (remTotal < 0) remTotal = 0;

      let newUnits = beforeUnits;
      if (remTotal >= BASE) {
        const extraUnits = Math.floor(remTotal / BASE);
        newUnits += extraUnits;
        remTotal -= extraUnits * BASE;
      }

      const afterTotal = remTotal + newUnits * BASE;
      const applied = afterTotal - beforeTotal;

      if (curSide === 'L') L = remTotal; else R = remTotal;
      setActivePV(curEl, L, R);

      if (hidden) {
        hidden.dataset[localKey] = String(newUnits);
      }

      if (newUnits > beforeUnits) {
        const balanceValueEl = getBalanceValueElement(curEl);
        if (balanceValueEl) {
          const timing = getHighlightTimingConfig();
          setPartHighlight(balanceValueEl, curSide === 'L' ? 'L' : 'R', true, {
            autoRemoveDuration: timing.autoRemoveDuration,
            animationDuration: timing.cssDuration
          });
        }
      }

      if (applied > 0 && parentInfo && curCard?.id) {
        highlightLineBetween(parentInfo.parentId, curCard.id, parentInfo.side, 'pv');
      }

      if (!parentInfo || applied === 0) break;

      const parentEl = findCardElementById(parentInfo.parentId);
      if (!parentEl) break;
      curEl = parentEl;
      curSide = parentInfo.side;
      carry = applied;
    }
  }
  function setActivePV(cardEl, L, R) {
    const { valEl } = parseActivePV(cardEl);
    if (!valEl) return;

    renderSplitValue(valEl, L, R);

    const cardData = findCardByElement(cardEl);
    const cardId = cardData?.id;
    if (!cardId) return;

    const prev = lastActivePvValues.get(cardId);
    const highlightLeft = prev ? L > prev.L : L > 0;
    const highlightRight = prev ? R > prev.R : R > 0;

    const timing = getHighlightTimingConfig();
    const highlightOptions = {
      autoRemoveDuration: timing.autoRemoveDuration,
      animationDuration: timing.cssDuration
    };

    if (highlightLeft) {
      setPartHighlight(valEl, 'L', true, highlightOptions);
    } else {
      setPartHighlight(valEl, 'L', false);
    }

    if (highlightRight) {
      setPartHighlight(valEl, 'R', true, highlightOptions);
    } else {
      setPartHighlight(valEl, 'R', false);
    }

    lastActivePvValues.set(cardId, { L, R });
  }

  canvas.addEventListener('click', (e) => {
    const btn = e.target.closest('.active-btn');
    if (!btn) return;
    const cardEl = btn.closest('.card');
    if (!cardEl) return;
    ensureActiveControls(cardEl);
    if (btn.classList.contains('active-clear')) {
      setActivePV(cardEl, 0, 0);
      const hidden = cardEl.querySelector('.active-pv-hidden');
      if (hidden) {
        hidden.dataset.btnL   = '0';
        hidden.dataset.btnR   = '0';
        hidden.dataset.locall = '0';
        hidden.dataset.localr = '0';
      }
      saveState();
      return;
    }
    const dir = btn.dataset.dir;
    const rawStep = parseInt(btn.dataset.step, 10);
    if (!dir || Number.isNaN(rawStep)) return;

    const apv = parseActivePV(cardEl);
    const hidden = cardEl.querySelector('.active-pv-hidden');

    let step = rawStep;
    if (step < 0) {
      const current = dir === 'L' ? apv.L : apv.R;
      const totalAvailable = Math.max(0, current);
      if (-step > totalAvailable) step = -totalAvailable;
    }

    if (step === 0) return;

    if (hidden) {
      if (dir === 'L') hidden.dataset.btnL = String((parseInt(hidden.dataset.btnL || '0', 10) + step));
      else             hidden.dataset.btnR = String((parseInt(hidden.dataset.btnR || '0', 10) + step));
    }
    propagateActivePvUp(cardEl, dir, step);
    saveState();
  });

  function formatLocalYMD(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeYMD(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatLocalYMD(parsed);
  }

  function parseYMDToDate(value) {
    const normalized = normalizeYMD(value);
    if (!normalized) return null;
    const parts = normalized.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }

  function getNoteEntryInfo(entry) {
    if (!entry) return { text: '', updatedAt: null };
    if (typeof entry === 'string') return { text: entry, updatedAt: null };
    if (typeof entry === 'object') {
      const text = typeof entry.text === 'string' ? entry.text : '';
      const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : null;
      return { text, updatedAt };
    }
    return { text: '', updatedAt: null };
  }

  function setNoteEntryValue(note, date, value) {
    if (!note.entries) note.entries = {};
    const key = normalizeYMD(date);
    if (!key) return;
    const raw = value ?? '';
    const trimmed = raw.trim();
    if (trimmed) {
      note.entries[key] = { text: raw, updatedAt: new Date().toISOString() };
    } else {
      delete note.entries[key];
    }
  }

  function formatNoteDateTime(dateStr, updatedAt) {
    let datePart = dateStr;
    if (typeof dateStr === 'string') {
      const segments = dateStr.split('-');
      if (segments.length === 3) {
        datePart = `${segments[2]}.${segments[1]}.${segments[0]}`;
      }
    }
    let timePart = '--:--';
    if (updatedAt) {
      const dt = new Date(updatedAt);
      if (!Number.isNaN(dt.getTime())) {
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        timePart = `${hours}.${minutes}`;
      }
    }
    return { datePart, timePart };
  }

  function hasAnyEntry(note) {
    if (!note) return false;
    if (note.entries && typeof note.entries === 'object') {
      return Object.values(note.entries).some((entry) => {
        const info = getNoteEntryInfo(entry);
        return info.text.trim().length > 0;
      });
    }
    return false;
  }

  function ensureNoteStructure(note) {
    if (!note.entries || typeof note.entries !== 'object') note.entries = {};
    if (!note.colors)  note.colors  = {};
    else {
      const normalizedColors = {};
      Object.entries(note.colors).forEach(([date, color]) => {
        const normalizedDate = normalizeYMD(date);
        if (normalizedDate) normalizedColors[normalizedDate] = color;
      });
      note.colors = normalizedColors;
    }
    if (!note.selectedDate) note.selectedDate = formatLocalYMD(new Date());
    else note.selectedDate = normalizeYMD(note.selectedDate) || formatLocalYMD(new Date());
    if (!note.highlightColor) note.highlightColor = '#f44336';
    Object.entries({ ...note.entries }).forEach(([date, entry]) => {
      const info = getNoteEntryInfo(entry);
      if (!info.text.trim()) {
        delete note.entries[date];
      } else {
        const normalizedDate = normalizeYMD(date);
        if (!normalizedDate) {
          delete note.entries[date];
          return;
        }
        if (normalizedDate !== date) {
          delete note.entries[date];
          note.entries[normalizedDate] = { text: info.text, updatedAt: info.updatedAt || null };
        } else {
          note.entries[date] = { text: info.text, updatedAt: info.updatedAt || null };
        }
      }
    });
    if (note.text && !note.entries[note.selectedDate]) {
      note.entries[note.selectedDate] = { text: note.text, updatedAt: null };
      note.text = '';
    }
  }

  function getNoteIndicatorColor(note) {
    if (!note) return '';
    ensureNoteStructure(note);
    if (note.selectedDate) {
      const selectedColor = note.colors?.[note.selectedDate];
      if (selectedColor) return selectedColor;
    }
    if (note.highlightColor) return note.highlightColor;
    if (note.colors) {
      const firstColor = Object.values(note.colors).find((c) => typeof c === 'string' && c.trim());
      if (firstColor) return firstColor;
    }
    return '';
  }

  function updateNoteButtonAppearance(cardData) {
    if (!cardData || !cardData.element) return;
    const noteBtn = cardData.element.querySelector('.note-btn');
    if (!noteBtn) return;

    const note = cardData.note;
    const hasText = hasAnyEntry(note);
    noteBtn.classList.toggle('has-text', hasText);
    noteBtn.textContent = hasText ? '❗' : '📝';

    const color = getNoteIndicatorColor(note);
    if (color && hasText) {
      noteBtn.dataset.noteColor = color;
      noteBtn.style.setProperty('--note-indicator-color', color);
      noteBtn.classList.add('has-color');
    } else {
      delete noteBtn.dataset.noteColor;
      noteBtn.style.removeProperty('--note-indicator-color');
      noteBtn.classList.remove('has-color');
    }
  }

  function setCardNoteHighlight(cardData, isActive) {
    if (!cardData || !cardData.element) return;
    cardData.element.classList.toggle('note-active', !!isActive);
  }

  function toggleNote(cardData) {
    if (cardData.note && cardData.note.window) {
      cardData.note.window.remove();
      cardData.note.window = null;
      cardData.note.visible = false;
      setCardNoteHighlight(cardData, false);
    } else {
      if (!cardData.note) {
        const cardRect = cardData.element.getBoundingClientRect();
        cardData.note = {
          text: '', entries: {}, colors: {},
          selectedDate: formatLocalYMD(new Date()),
          highlightColor: '#f44336',
          width: 260, height: 380, visible: false, window: null,
          x: cardRect.right + 15, y: cardRect.top
        };
      }
      cardData.note.visible = true;
      createNoteWindow(cardData);
      setCardNoteHighlight(cardData, true);
    }
    updateNoteButtonAppearance(cardData);
    saveState();
    updateNotesButtonState();
  }

  function createNoteWindow(cardData) {
    const note = cardData.note;
    ensureNoteStructure(note);

    const noteWindow = document.createElement('div');
    noteWindow.className = 'note-window';
    noteWindow.style.left = `${note.x}px`;
    noteWindow.style.top  = `${note.y}px`;

    if (Number.isFinite(note.width)  && note.width  >= 200) noteWindow.style.width  = `${note.width}px`;
    if (Number.isFinite(note.height) && note.height >= 200) noteWindow.style.height = `${note.height}px`;

    noteWindow.innerHTML = `
      <style>
        .note-header .note-close-btn { font-size: 20px; cursor: pointer; padding: 0 8px; border: none; background: transparent; }
        .note-header{display:flex;align-items:center;gap:8px;justify-content:space-between}
        .note-cal-wrap{padding:6px 8px 0 8px}
        .cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-weight:700}
        .cal-month{font-size:12px}
        .cal-nav{display:flex;gap:6px}
        .cal-btn{border:none;border-radius:6px;padding:2px 6px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2);background:#fff}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px}
        .cal-dow{opacity:.7;text-align:center}
        .cal-cell{height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;background:#fff}
        .cal-cell.out{opacity:.35}
        .cal-cell.selected{outline:2px solid #4caf50}
        .cal-cell.has-entry{box-shadow: inset 0 0 0 2px rgba(0,0,0,.08)}
        .note-tools{display:flex;gap:6px;align-items:center;margin-left:auto;margin-right:6px}
        .clr-dot{width:18px;height:18px;border-radius:50%;border:2px solid #333;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .clr-dot.active{box-shadow:0 0 0 2px rgba(0,0,0,.25), inset 0 0 0 2px #fff}
      </style>
      <div class="note-header">
        <button class="note-close-btn" type="button" title="Закрыть">×</button>
        <div class="note-tools">
          <div class="clr-dot" data-color="#f44336" title="Красный" style="background:#f44336"></div>
          <div class="clr-dot" data-color="#4caf50" title="Зелёный" style="background:#4caf50"></div>
          <div class="clr-dot" data-color="#42a5f5" title="Синий"   style="background:#42a5f5"></div>
        </div>
      </div>
      <div class="note-content-scroller">
        <div class="note-cal-wrap">
          <div class="cal-head">
            <button class="cal-btn prev">‹</button>
            <div class="cal-month"></div>
            <button class="cal-btn next">›</button>
          </div>
          <div class="cal-grid">
            <div class="cal-dow">Пн</div><div class="cal-dow">Вт</div><div class="cal-dow">Ср</div>
            <div class="cal-dow">Чт</div><div class="cal-dow">Пт</div><div class="cal-dow">Сб</div><div class="cal-dow">Вс</div>
          </div>
        </div>
        <textarea class="note-textarea" placeholder="Введите текст заметки..."></textarea>
      </div>
      <div class="note-resize-handle"></div>
    `;

    document.body.appendChild(noteWindow);
    note.window = noteWindow;
    setCardNoteHighlight(cardData, true);

    const header = noteWindow.querySelector('.note-header');
    const textarea = noteWindow.querySelector('.note-textarea');
    const noteBtn  = cardData.element.querySelector('.note-btn');
    const colorDots = noteWindow.querySelectorAll('.clr-dot');

    const applyAccent = () => {
      const accent = note.colors[note.selectedDate] || note.highlightColor;
      if (accent) {
        note.highlightColor = accent;
        noteWindow.style.setProperty('--note-accent', accent);
      } else {
        noteWindow.style.removeProperty('--note-accent');
      }
    };

    function updateColorDotsActive() {
      const currentColor = note.colors[note.selectedDate] || note.highlightColor;
      colorDots.forEach((d) => d.classList.toggle('active', d.getAttribute('data-color') === currentColor));
      applyAccent();
    }
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const c = dot.getAttribute('data-color');
        if (!c) return;
        note.colors[note.selectedDate] = c;
        note.highlightColor = c;
        updateColorDotsActive();
        renderCalendar();
        saveState();
        if (notesDropdownApi?.isOpen()) notesDropdownApi.refresh?.();
        updateNoteButtonAppearance(cardData);
      });
    });

    const calMonthEl = noteWindow.querySelector('.cal-month');
    const calGrid    = noteWindow.querySelector('.cal-grid');
    const prevBtn    = noteWindow.querySelector('.prev');
    const nextBtn    = noteWindow.querySelector('.next');
    let viewDate     = parseYMDToDate(note.selectedDate) || new Date();

    function ymd(d) { return formatLocalYMD(d); }
    function formatMonthYear(d) { return d.toLocaleDateString('ru-RU',{month:'long', year:'numeric'}); }

    const updateTextareaValue = () => {
      const info = getNoteEntryInfo(note.entries[note.selectedDate]);
      textarea.value = info.text;
    };

    function renderCalendar() {
      calGrid.innerHTML = `
        <div class="cal-dow">Пн</div><div class="cal-dow">Вт</div><div class="cal-dow">Ср</div>
        <div class="cal-dow">Чт</div><div class="cal-dow">Пт</div><div class="cal-dow">Сб</div><div class="cal-dow">Вс</div>
      `;
      const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const last  = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 0);
      const startIndex = (first.getDay() + 6) % 7;
      calMonthEl.textContent = formatMonthYear(viewDate);
      const daysInPrev = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0).getDate();
      for (let i=0;i<startIndex;i++){
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth()-1, daysInPrev - startIndex + 1 + i);
        calGrid.appendChild(makeCell(d, true));
      }
      for (let day=1; day<=last.getDate(); day++){
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        calGrid.appendChild(makeCell(d, false));
      }
      const totalCells = calGrid.querySelectorAll('.cal-cell').length;
      if (totalCells < 42) {
          for (let i=1; i<=42 - totalCells; i++){
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, i);
            calGrid.appendChild(makeCell(d, true));
          }
      }
    }

    function makeCell(dateObj, outMonth) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (outMonth ? ' out' : '');
      const dateStr = ymd(dateObj);
      cell.textContent = String(dateObj.getDate());
      if (dateStr === note.selectedDate) cell.classList.add('selected');
      const entryInfo = getNoteEntryInfo(note.entries[dateStr]);
      const hasEntry = entryInfo.text.trim().length > 0;
      if (hasEntry) {
        cell.classList.add('has-entry');
        const dayColor = note.colors[dateStr] || note.highlightColor;
        cell.style.background = dayColor;
        cell.style.color = '#fff';
      } else {
        cell.style.background = '';
        cell.style.color = '';
      }
      cell.addEventListener('click', () => {
        note.selectedDate = normalizeYMD(dateStr) || dateStr;
        renderCalendar();
        updateTextareaValue();
        updateColorDotsActive();
      });
      return cell;
    }

    prevBtn.addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      renderCalendar();
      updateColorDotsActive();
      updateTextareaValue();
    });
    nextBtn.addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      renderCalendar();
      updateColorDotsActive();
      updateTextareaValue();
    });
    renderCalendar();
    updateColorDotsActive();
    updateTextareaValue();

    textarea.addEventListener('input', () => {
      const val = textarea.value;
      setNoteEntryValue(note, note.selectedDate, val);
      updateNoteButtonAppearance(cardData);
      renderCalendar();
      updateNotesButtonState();
      if (notesDropdownApi?.isOpen()) notesDropdownApi.refresh?.();
    });
    textarea.addEventListener('blur', () => {
      saveState();
      if (notesDropdownApi?.isOpen()) notesDropdownApi.refresh?.();
    });

    const closeBtn = noteWindow.querySelector('.note-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        note.visible = false;
        noteWindow.remove();
        note.window = null;
        setCardNoteHighlight(cardData, false);
        saveState();
        updateNotesButtonState();
        updateNoteButtonAppearance(cardData);
      });
    }

    if (header) {
      header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.note-close-btn')) return;
        if (e.target.closest('.note-tools')) return;
        e.preventDefault();
        e.preventDefault();
        if (pinchState && e.pointerType === 'touch') return;
        const pointerId = e.pointerId;
        const startX = e.clientX, startY = e.clientY;
        const startNoteX = note.x, startNoteY = note.y;

        if (header.setPointerCapture) {
          try { header.setPointerCapture(pointerId); } catch (_) { /* noop */ }
        }

        const onMove = (e2) => {
          if (e2.pointerId !== pointerId) return;
          const dx = e2.clientX - startX; const dy = e2.clientY - startY;
          note.x = startNoteX + dx; note.y = startNoteY + dy;
          noteWindow.style.left = `${note.x}px`; noteWindow.style.top = `${note.y}px`;
        };

        const finish = (e2) => {
          if (e2.pointerId !== pointerId) return;
          if (header.releasePointerCapture) {
            try { header.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
          }
          header.removeEventListener('pointermove', onMove);
          header.removeEventListener('pointerup', finish);
          header.removeEventListener('pointercancel', cancel);
          saveState();
        };

        const cancel = (e2) => {
          if (e2.pointerId !== pointerId) return;
          if (header.releasePointerCapture) {
            try { header.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
          }
          header.removeEventListener('pointermove', onMove);
          header.removeEventListener('pointerup', finish);
          header.removeEventListener('pointercancel', cancel);
        };

        header.addEventListener('pointermove', onMove);
        header.addEventListener('pointerup', finish);
        header.addEventListener('pointercancel', cancel);
      });
    }

    new ResizeObserver(() => {
      const w = noteWindow.offsetWidth; const h = noteWindow.offsetHeight;
      if (w >= 200) note.width  = w;
      if (h >= 200) note.height = h;
    }).observe(noteWindow);
  }

  function setupNoteAutoClose() {
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.note-window') || e.target.closest('.note-btn')) return;
      let changed = false;
      cards.forEach(cd => {
        const n = cd.note;
        if (n && n.window && !hasAnyEntry(n)) {
          n.visible = false; n.window.remove(); n.window = null;
          setCardNoteHighlight(cd, false);
          updateNoteButtonAppearance(cd);
          changed = true;
        }
      });
      if (changed) {
        saveState();
        updateNotesButtonState();
      }
    });
  }

  function closeAllNoteWindows() {
    let closed = false;
    cards.forEach(cd => {
      const note = cd.note;
      if (note && note.window) {
        note.visible = false;
        note.window.remove();
        note.window = null;
        setCardNoteHighlight(cd, false);
        updateNoteButtonAppearance(cd);
        closed = true;
      }
    });
    if (closed) {
      saveState();
      updateNotesButtonState();
    }
    return closed;
  }

  function setupNotesDropdown() {
    if (!notesListBtn) return;
    let dropdown = document.querySelector('#notes-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'notes-dropdown';
      dropdown.id = 'notes-dropdown';
      document.body.appendChild(dropdown);
    }

    function buildList() {
      const items = [];
      cards.forEach(cd => {
        if (!cd.note) return;
        const note = cd.note;
        ensureNoteStructure(note);
        Object.entries(note.entries).forEach(([date, entry]) => {
          const info = getNoteEntryInfo(entry);
          const pure = info.text.trim();
          if (!pure) return;
          const firstLine = pure.split('\n')[0];
          const color = (note.colors && note.colors[date]) || note.highlightColor || '#f44336';
          items.push({ card: cd, date, color, firstLine, updatedAt: info.updatedAt });
        });
      });
      items.sort((a, b) => {
        const baseA = parseYMDToDate(a.date)?.getTime() ?? Number.POSITIVE_INFINITY;
        const baseB = parseYMDToDate(b.date)?.getTime() ?? Number.POSITIVE_INFINITY;
        if (baseA !== baseB) return baseA - baseB;
        const updA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const updB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (!Number.isNaN(updA) && !Number.isNaN(updB) && updA !== updB) return updA - updB;
        return a.firstLine.localeCompare(b.firstLine);
      });


      if (items.length === 0) {
        dropdown.innerHTML = `<div class="note-item" style="cursor:default;opacity:.7">Заметок нет</div>`;
        return;
      }

      dropdown.innerHTML = items.map(it => {
        const { datePart, timePart } = formatNoteDateTime(it.date, it.updatedAt);
        return `
        <div class="note-item" data-card="${it.card.id}" data-date="${it.date}">
          <div class="note-item-content">
            <div class="note-dot" style="background:${it.color}"></div>
            <div class="note-meta">
              <div class="note-date">${datePart} - ${timePart}</div>
              <div class="note-text-preview">${escapeHtml(it.firstLine).slice(0,80)}</div>
            </div>
          </div>
          <button class="note-delete-btn" title="Удалить">×</button>
        </div>
      `; }).join('');

        dropdown.querySelectorAll('.note-item').forEach(el => {
          const contentBtn = el.querySelector('.note-item-content');
          if (contentBtn) {
            contentBtn.addEventListener('click', () => {
              const cardData = cards.find(c => c.id === el.dataset.card);
              if (!cardData) return;
              if (cardData.note && cardData.note.window) {
                cardData.note.window.remove(); cardData.note.window = null;
              }
              const cardRect = cardData.element.getBoundingClientRect();
              if (!cardData.note) toggleNote(cardData);
              const note = cardData.note;
              ensureNoteStructure(note);
              note.selectedDate = normalizeYMD(el.dataset.date) || el.dataset.date;
              note.x = cardRect.right + 15; note.y = cardRect.top;
              note.visible = true;
              createNoteWindow(cardData);
              saveState();
              hide();
            });
          }

          const deleteBtn = el.querySelector('.note-delete-btn');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (event) => {
              event.stopPropagation();
              const cardData = cards.find(c => c.id === el.dataset.card);
              if (cardData && cardData.note && cardData.note.entries[el.dataset.date]) {
                delete cardData.note.entries[el.dataset.date];
                if (!hasAnyEntry(cardData.note) && cardData.note.window) {
                  cardData.note.window.remove();
                  cardData.note.window = null;
                  cardData.note.visible = false;
                  setCardNoteHighlight(cardData, false);
                }
                updateNoteButtonAppearance(cardData);
                saveState();
                buildList();
                updateNotesButtonState();
              }
            });
          }
        });
    }

    function escapeHtml(s) {
      const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return s.replace(/[&<>"']/g, (m) => replacements[m]);
    }
    function show() {
      buildList();
      const r = notesListBtn.getBoundingClientRect();
      dropdown.style.left = `${r.left}px`;
      dropdown.style.top  = `${r.bottom + 6}px`;
      dropdown.style.display = 'block';
    }
    function hide(){ dropdown.style.display = 'none'; }

    notesListBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notesListBtn.disabled) return;
      if (dropdown.style.display === 'block') hide(); else show();
    });

    document.addEventListener('pointerdown', (e) => {
      if (e.target === notesListBtn || e.target.closest('#notes-dropdown')) return;
      hide();
    });

    notesDropdownApi = {
      hide,
      isOpen: () => dropdown.style.display === 'block',
      refresh: buildList
    };
  }

  function updateNotesButtonState() {
    cards.forEach((cardData) => {
      updateNoteButtonAppearance(cardData);
    });
    if (notesListBtn) {
      const hasAnyNoteWithText = cards.some((c) => c.note && hasAnyEntry(c.note));
      notesListBtn.disabled = !hasAnyNoteWithText;
    }
  }
  const imageToDataUri = (url) => {
    if (!url) return Promise.resolve(null);
    const cached = imageDataUriCache.get(url);
    if (cached) {
      return cached instanceof Promise ? cached : Promise.resolve(cached);
    }
    const loader = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUri = canvas.toDataURL('image/png');
          imageDataUriCache.set(url, dataUri);
          resolve(dataUri);
        } catch (err) {
          imageDataUriCache.delete(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        imageDataUriCache.delete(url);
        resolve(null);
      };
      img.src = url;
    });
    imageDataUriCache.set(url, loader);
    return loader;
  };

  async function exportToSvg() {
    if (cards.length === 0) {
        alert("На доске нет элементов для экспорта.");
        return;
    }

    const PADDING = 100;
    const state = serializeState();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.cards.forEach(card => {
        const cardWidth = parseInt(card.width, 10) || 380;
        const cardHeight = 280;
        minX = Math.min(minX, card.x);
        minY = Math.min(minY, card.y);
        maxX = Math.max(maxX, card.x + cardWidth);
        maxY = Math.max(maxY, card.y + cardHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const viewBox = `0 0 ${contentWidth + PADDING * 2} ${contentHeight + PADDING * 2}`;

const getCleanedCardHtml = async (cardData) => {
        const tempBody = document.createElement('div');
        tempBody.innerHTML = cardData.bodyHTML;
        const pvControls = tempBody.querySelector('.active-pv-controls');
        if (pvControls) pvControls.remove();

        const badges = cardData.badges || { fendou: false, slf: false, rank: null };
        const slfClass = `slf-badge${badges.slf ? ' visible' : ''}`;
        const fendouClass = `fendou-badge${badges.fendou ? ' visible' : ''}`;
        const rankClass = `rank-badge${badges.rank ? ' visible' : ''}`;
        
        let rankSrc = '';
        if (badges.rank) {
            const dataUri = await imageToDataUri(`rank-${badges.rank}.png`);
            if (dataUri) {
                rankSrc = dataUri;
            }
        }

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        if (cardData.headerBg) {
            cardHeader.style.background = cardData.headerBg;
        }
        cardHeader.innerHTML = `
            <div class="${slfClass}">SLF</div>
            <span class="card-title">${cardData.title}</span>
            <div class="${fendouClass}">FENDOU</div>
            <img class="${rankClass}" src="${rankSrc}" alt="Rank" />
        `;

        const finalCard = document.createElement('div');
        finalCard.className = 'card';
        if (cardData.isDarkMode) finalCard.classList.add('dark-mode');
        finalCard.style.width = cardData.width || '380px';
        finalCard.appendChild(cardHeader);
        const cardBody = document.createElement('div');
        cardBody.className = `card-body ${cardData.bodyClass || ''}`;
        cardBody.innerHTML = tempBody.innerHTML;
        finalCard.appendChild(cardBody);

        const rawHtml = finalCard.outerHTML;
        return rawHtml.replace(/(<img[^>]+)>/g, '$1 />');
    };

 // Определяем дополнительное пространство вокруг карточки для предотвращения обрезки
    const EXTRA_PADDING_TOP = 60;  // Запас высоты сверху для надписи "FENDOU"
    const EXTRA_PADDING_SIDE = 50; // Запас ширины сбоку для значка ранга

    const cardHtmlPromises = state.cards.map(card => getCleanedCardHtml(card));
    const resolvedCardHtmls = await Promise.all(cardHtmlPromises);

    const cardObjects = state.cards.map((card, index) => {
        const cardWidth = parseInt(card.width, 10) || 380;
        // Увеличиваем общую ширину и высоту контейнера
        const totalWidth = cardWidth + (EXTRA_PADDING_SIDE * 2);
        const totalHeight = 280 + EXTRA_PADDING_TOP;

        return `<foreignObject
            x="${card.x - minX + PADDING - EXTRA_PADDING_SIDE}"
            y="${card.y - minY + PADDING - EXTRA_PADDING_TOP}"
            width="${totalWidth}"
            height="${totalHeight}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; top: ${EXTRA_PADDING_TOP}px; left: ${EXTRA_PADDING_SIDE}px;">
                ${resolvedCardHtmls[index]}
            </div>
        </foreignObject>`;
    }).join('\n');

    const lineObjects = state.lines.map(line => {
        const startCard = state.cards.find(c => c.id === line.startId);
        const endCard = state.cards.find(c => c.id === line.endId);
        if (!startCard || !endCard) return '';

        const getCoords = (c, side) => {
            const x = c.x - minX + PADDING;
            const y = c.y - minY + PADDING;
            const w = parseInt(c.width, 10) || 380, h = 280;
            switch(side) {
                case 'top': return { x: x + w / 2, y: y };
                case 'bottom': return { x: x + w / 2, y: y + h };
                case 'left': return { x: x, y: y + h / 2 };
                case 'right': return { x: x + w, y: y + h / 2 };
            }
        };

        const p1 = getCoords(startCard, line.startSide);
        const p2 = getCoords(endCard, line.endSide);
        const midP1 = (line.startSide === 'left' || line.startSide === 'right') ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
        const d = `M ${p1.x} ${p1.y} L ${midP1.x} ${midP1.y} L ${p2.x} ${p2.y}`;

        const color = line.color || DEFAULT_LINE_COLOR;
        return `<path d="${d}" stroke="${color}" stroke-width="${line.thickness}" fill="none" class="line" marker-start="url(#marker-dot)" marker-end="url(#marker-dot)" />`;    }).join('\n');


    const panScript = `<script><![CDATA[(function(){const svg=document.documentElement;const content=document.getElementById&&document.getElementById('svg-pan-content');if(!svg||!content||!svg.addEventListener)return;let isPanning=false,panId=null,lastX=0,lastY=0,offsetX=0,offsetY=0;const update=()=>content.setAttribute('transform','translate('+offsetX+' '+offsetY+')');const endPan=(e)=>{if(!isPanning||e.pointerId!==panId)return;isPanning=false;panId=null;svg.style.cursor='grab';if(svg.releasePointerCapture){try{svg.releasePointerCapture(e.pointerId);}catch(err){}}};svg.addEventListener('pointerdown',function(e){if(e.button!==1)return;e.preventDefault();isPanning=true;panId=e.pointerId;lastX=e.clientX;lastY=e.clientY;svg.style.cursor='grabbing';if(svg.setPointerCapture){try{svg.setPointerCapture(e.pointerId);}catch(err){}}});svg.addEventListener('pointermove',function(e){if(!isPanning||e.pointerId!==panId)return;e.preventDefault();offsetX+=e.clientX-lastX;offsetY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;update();});svg.addEventListener('pointerup',endPan);svg.addEventListener('pointercancel',endPan);svg.addEventListener('wheel',function(e){if(isPanning)e.preventDefault();},{passive:false});svg.style.cursor='grab';update();})();]]></script>`;

    const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${contentWidth + PADDING * 2}" height="${contentHeight + PADDING * 2}" style="touch-action:none;cursor:grab;">
            <defs>
                <style>
                    .card { position: relative; display:inline-block; box-sizing: border-box; width: var(--card-width, 380px); background: #ffffff; border-radius: 16px; box-shadow: 0 4px 10px rgba(0,0,0,.1); overflow: visible; font-family: Inter, system-ui, sans-serif; border: 1px solid #e5e7eb; }                    .card-header { background: #0f62fe; color: #fff; padding: 10px; height: 52px; box-sizing: border-box; border-radius: 16px 16px 0 0; position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 6px; }
                    .card-title { grid-column: 2 / 3; text-align: center; font-size: 20px; line-height: 1; font-weight: 800; }
                    .card-body { padding: 15px; text-align: center; }
                    .card-row { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 12px; }
                    .label { font-weight: 700; color: #374151; font-size: 16px; }
                    .value { color: #111827; font-weight: 800; font-size: 20px; }
                    .coin-icon { width: 28px; height: 28px; }
                    .slf-badge, .fendou-badge, .rank-badge { position: absolute; display: none; user-select: none; pointer-events: none; }
                    .slf-badge.visible, .fendou-badge.visible, .rank-badge.visible { display: block; }
                    .slf-badge { top: 15px; left: 15px; color: #ffc700; font-weight: 900; font-size: 24px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
                    .fendou-badge { top: -25px; left: 50%; transform: translateX(-50%); color: red; font-weight: 900; font-size: 36px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
                    .rank-badge { top: -15px; right: 15px; width: 80px; height: auto; transform: rotate(15deg); }
                    .card.dark-mode, .card.dark-mode .card-body { background: #2b2b2b; }
                    .card.dark-mode .label { color: #e5e7eb; }
                    .card.dark-mode .value { color: #f9fafb; }
                    .card.dark-mode .card-header { background: #1f2937 !important; }
                    .card.dark-mode .card-title { color: #f3f4f6; }
                    .card.dark-mode .coin-icon { visibility: hidden; }
                    .line { fill:none; }
                </style>
                <marker id="marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" fill="currentColor">
                  <circle cx="5" cy="5" r="4"/>
                </marker>
            </defs>
            <g id="svg-pan-content">
                <g style="color: black;">${lineObjects}</g>
                ${cardObjects}
            </g>
            ${panScript}
        </svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scheme-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============== НАЧАЛО НОВОГО БЛОКА ДЛЯ ПЕЧАТИ (ФИНАЛЬНАЯ ВЕРСИЯ 4.0) ==============

// Константы с размерами бумаги в миллиметрах
const PAPER_SIZES = {
    a4: { width: 210, height: 297 },
    a3: { width: 297, height: 420 },
    a2: { width: 420, height: 594 },
    a1: { width: 594, height: 841 },
};
const ORIGINAL_FORMAT_KEY = 'original';
const DEFAULT_DPI = 96;
const MAX_CANVAS_DIMENSION = 16384;
const MAX_EXPORT_DIMENSION = 16384;

const PNG_PPM_FACTOR = 39.37007874015748; // Inches in a meter
const PNG_SIGNATURE_LENGTH = 8;

const PNG_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = PNG_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
    const chunk = new Uint8Array(8 + data.length + 4);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) {
        chunk[4 + i] = type.charCodeAt(i);
    }
    chunk.set(data, 8);
    const crc = crc32(chunk.subarray(4, 8 + data.length));
    view.setUint32(8 + data.length, crc, false);
    return chunk;
}

function readUint32BE(bytes, offset) {
    return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function injectDpiIntoPngBytes(bytes, dpi) {
    if (!bytes || bytes.length < PNG_SIGNATURE_LENGTH) return bytes;
    const signature = bytes.subarray(0, PNG_SIGNATURE_LENGTH);
    const pxPerMeter = Math.max(1, Math.round(dpi * PNG_PPM_FACTOR));
    const physData = new Uint8Array(9);
    const physView = new DataView(physData.buffer);
    physView.setUint32(0, pxPerMeter, false);
    physView.setUint32(4, pxPerMeter, false);
    physData[8] = 1; // unit specifier: meters

    const physChunk = createPngChunk('pHYs', physData);
    const chunks = [signature];
    let offset = PNG_SIGNATURE_LENGTH;
    let physInserted = false;

    while (offset < bytes.length) {
        const length = readUint32BE(bytes, offset);
        const typeStart = offset + 4;
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        const chunkEnd = dataEnd + 4;
        const type = String.fromCharCode(
            bytes[typeStart],
            bytes[typeStart + 1],
            bytes[typeStart + 2],
            bytes[typeStart + 3]
        );

        if (type === 'pHYs') {
            chunks.push(physChunk);
            physInserted = true;
        } else {
            chunks.push(bytes.subarray(offset, chunkEnd));
            if (type === 'IHDR' && !physInserted) {
                chunks.push(physChunk);
                physInserted = true;
            }
        }

        offset = chunkEnd;
    }

    if (!physInserted) {
        chunks.splice(1, 0, physChunk);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
        result.set(chunk, position);
        position += chunk.length;
    }
    return result;
}

async function canvasToPngWithDpi(canvas, dpi) {
    const safeDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : DEFAULT_DPI;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    const arrayBuffer = await blob.arrayBuffer();
    const updatedBytes = injectDpiIntoPngBytes(new Uint8Array(arrayBuffer), safeDpi);
    return new Blob([updatedBytes], { type: 'image/png' });
}

// Главная функция, которая будет вызываться кнопкой "Печать"
async function prepareForPrint() {
    if (cards.length === 0) {
        alert("На доске нет элементов для печати.");
        return;
    }
    // Создаем и показываем модальное окно с настройками
    createPrintModal();
}

// Функция для создания модального окна, его элементов и логики
function createPrintModal() {
    if (document.getElementById('print-modal-overlay')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'print-modal-overlay';
    modalOverlay.className = 'print-modal-overlay';

    modalOverlay.innerHTML = `
        <div class="print-modal-content">
            <div class="print-modal-header">
                <h2>Настройки печати</h2>
                <button id="print-modal-close" class="print-modal-close-btn">&times;</button>
            </div>
            <div class="print-modal-body">
                <div class="print-controls">
                    <div class="print-control-group">
                        <label for="print-format">Формат:</label>
                        <select id="print-format">
                            <option value="a4" selected>A4</option>
                            <option value="a3">A3</option>
                            <option value="a2">A2</option>
                            <option value="a1">A1</option>
                            <option value="original">Оригинальный размер</option>
                        </select>
                    </div>
                    <div class="print-control-group">
                        <label>Ориентация:</label>
                        <div class="orientation-buttons">
                           <button data-orientation="portrait" class="orientation-btn" title="Книжная">
                                <svg width="24" height="24" viewBox="0 0 16 16"><path fill="currentColor" d="M3.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-9zM4 3h8v10H4V3z"/></svg>
                           </button>
                           <button data-orientation="landscape" class="orientation-btn" title="Альбомная">
                                <svg width="24" height="24" viewBox="0 0 16 16"><path fill="currentColor" d="M14 4.5a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-7zM3 5h10v6H3V5z"/></svg>
                           </button>
                        </div>
                    </div>
                    <div class="print-control-group">
                        <label for="print-dpi">Разрешение (DPI):</label>
                        <select id="print-dpi">
                            <option value="96">96</option>
                            <option value="150">150</option>
                            <option value="300" selected>300</option>
                            <option value="600">600</option>
                        </select>
                    </div>
                    <div class="print-control-group">
                        <label class="checkbox-label"><input type="checkbox" id="print-tile-a4" disabled>Разбить на страницы A4</label>
                    </div>
                     <div class="print-control-group">
                        <label class="checkbox-label"><input type="checkbox" id="print-toggle-content">Скрыть содержимое</label>
                    </div>
                     <div class="print-control-group">
                        <label class="checkbox-label"><input type="checkbox" id="print-toggle-color">Ч/Б (контур)</label>
                    </div>
                    <div class="print-actions">
                        <button id="print-export-pdf" class="print-action-btn">Сохранить PDF</button>
                        <button id="print-export-png" class="print-action-btn">Сохранить PNG</button>
                    </div>
                </div>
                <div class="print-preview-container">
                    <div id="print-preview-area"></div>
                    <div id="print-status-label"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeBtn = document.getElementById('print-modal-close');
    const formatSelect = document.getElementById('print-format');
    const tileCheckbox = document.getElementById('print-tile-a4');
    const contentCheckbox = document.getElementById('print-toggle-content');
    const colorCheckbox = document.getElementById('print-toggle-color');
    const orientationBtns = document.querySelectorAll('.orientation-btn');
    const pdfBtn = document.getElementById('print-export-pdf');
    const pngBtn = document.getElementById('print-export-png');
    const dpiSelect = document.getElementById('print-dpi');
    const previewArea = document.getElementById('print-preview-area');
    const statusLabel = document.getElementById('print-status-label');

    tileCheckbox.checked = false;
    tileCheckbox.disabled = true;

    pdfBtn.disabled = true;
    pdfBtn.title = 'Функция временно недоступна';
    pdfBtn.setAttribute('aria-disabled', 'true');

    let currentOrientation;
    let selectedDpi = parseInt(dpiSelect.value, 10) || DEFAULT_DPI;

    closeBtn.addEventListener('click', () => modalOverlay.remove());
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.remove();
    });

    orientationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            orientationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrientation = btn.dataset.orientation;
            updatePreview();
        });
    });

    dpiSelect.addEventListener('change', () => {
        const parsed = parseInt(dpiSelect.value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            selectedDpi = parsed;
        } else {
            selectedDpi = DEFAULT_DPI;
        }
    });

    [formatSelect, tileCheckbox, contentCheckbox, colorCheckbox].forEach(el => el.addEventListener('change', updatePreview));

    pdfBtn.addEventListener('click', () => processPrint('pdf'));
    pngBtn.addEventListener('click', () => processPrint('png'));
    
    function getSchemeBounds() {
        if (cards.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        cards.forEach(cardData => {
            const card = cardData.element;
            const x = parseFloat(card.style.left);
            const y = parseFloat(card.style.top);
            const cardWidth = card.offsetWidth;
            const cardHeight = card.offsetHeight;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + cardWidth);
            maxY = Math.max(maxY, y + cardHeight);
        });
        return { minX, minY, width: maxX - minX, height: maxY - minY };
    }

    function autoSelectOrientation() {
        const bounds = getSchemeBounds();
        if (bounds.width === 0 || bounds.height === 0) {
            currentOrientation = 'portrait';
        } else {
            const schemaAspectRatio = bounds.width / bounds.height;
            currentOrientation = schemaAspectRatio > 1 ? 'landscape' : 'portrait';
        }
        orientationBtns.forEach(b => b.classList.toggle('active', b.dataset.orientation === currentOrientation));
    }

    async function updatePreview() {
        const selectedFormat = formatSelect.value;
        tileCheckbox.checked = false;
        tileCheckbox.disabled = true;

        const bounds = getSchemeBounds();
        if (bounds.width === 0 || bounds.height === 0) return;

        const PADDING = 100;
        const contentTotalWidth = bounds.width + PADDING * 2;
        const contentTotalHeight = bounds.height + PADDING * 2;

        let previewWidthMm;
        let previewHeightMm;

        if (selectedFormat === ORIGINAL_FORMAT_KEY) {
            previewWidthMm = contentTotalWidth;
            previewHeightMm = contentTotalHeight;
        } else {
            const paperSize = PAPER_SIZES[selectedFormat];
            if (!paperSize) return;
            const isLandscape = currentOrientation === 'landscape';
            previewWidthMm = isLandscape ? paperSize.height : paperSize.width;
            previewHeightMm = isLandscape ? paperSize.width : paperSize.height;
        }

        const previewAspectRatio = previewHeightMm === 0 ? 1 : previewWidthMm / previewHeightMm;
        const previewContainer = document.querySelector('.print-preview-container');
        const containerWidth = previewContainer.clientWidth - 30;
        const containerHeight = previewContainer.clientHeight - 60;

        let previewWidth = containerWidth;
        let previewHeight = containerWidth / previewAspectRatio;

        if (previewHeight > containerHeight) {
            previewHeight = containerHeight;
            previewWidth = containerHeight * previewAspectRatio;
        }

        previewArea.style.width = `${previewWidth}px`;
        previewArea.style.height = `${previewHeight}px`;

        previewArea.innerHTML = '';
        const { printCanvas } = await createPrintableHtml(serializeState(), bounds, PADDING);
        
        if (contentCheckbox.checked) printCanvas.classList.add('content-hidden');
        if (colorCheckbox.checked) printCanvas.classList.add('outline-mode');
        
        printCanvas.id = 'canvas-clone-preview';
        
        const scale = Math.min(previewWidth / contentTotalWidth, previewHeight / contentTotalHeight);
        const scaledWidth = contentTotalWidth * scale;
        const scaledHeight = contentTotalHeight * scale;
        const translateX = (previewWidth - scaledWidth) / 2;
        const translateY = (previewHeight - scaledHeight) / 2;
        
        printCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        
        previewArea.appendChild(printCanvas);
    }
    
async function processPrint(exportType) {
        statusLabel.textContent = 'Подготовка рендера...';
        pngBtn.disabled = true;
        pdfBtn.disabled = true;

        const state = serializeState();
        const PADDING = 100;

        const bounds = getSchemeBounds();
        const contentWidth = bounds.width + PADDING * 2;
        const contentHeight = bounds.height + PADDING * 2;
        
        const renderContainer = document.createElement('div');
        renderContainer.style.position = 'fixed';
        renderContainer.style.left = '-9999px';
        renderContainer.style.top = '-9999px';
        renderContainer.style.width = `${contentWidth}px`;
        renderContainer.style.height = `${contentHeight}px`;
        renderContainer.style.background = getComputedStyle(document.body).background;

        const { printCanvas } = await createPrintableHtml(state, bounds, PADDING);
        renderContainer.appendChild(printCanvas);
        document.body.appendChild(renderContainer);

        if (exportType === 'png') {
            renderContainer.querySelectorAll('.card').forEach((cardEl) => {
                cardEl.style.boxSizing = 'border-box';
                cardEl.style.backgroundClip = 'padding-box';
                cardEl.style.border = '2px solid rgba(17, 24, 39, 0.2)';
                cardEl.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.18)';
            });
        }

        if (contentCheckbox.checked) renderContainer.classList.add('content-hidden');
        if (colorCheckbox.checked) {
            renderContainer.classList.add('outline-mode');
            renderContainer.style.background = '#fff';
        }

        const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
        if (exportType === 'pdf' && !jsPDFLib) {
            console.error('jsPDF library is not available on the page.');
            statusLabel.textContent = 'Не удалось загрузить модуль PDF.';
            pngBtn.disabled = false;
            pdfBtn.disabled = true;
            return;
        }

        try {
            statusLabel.textContent = 'Создание изображения...';
            await new Promise(resolve => setTimeout(resolve, 100));

            // --- НОВАЯ ЛОГИКА МАСШТАБИРОВАНИЯ ---
            const dpiScale = selectedDpi / DEFAULT_DPI;
            const originalScale = Math.max(dpiScale, 2);
            let finalScale = originalScale;

            const requiredWidth = renderContainer.offsetWidth * originalScale;
            const requiredHeight = renderContainer.offsetHeight * originalScale;

            if (requiredWidth > MAX_CANVAS_DIMENSION || requiredHeight > MAX_CANVAS_DIMENSION) {
                const downscaleFactor = Math.min(MAX_CANVAS_DIMENSION / requiredWidth, MAX_CANVAS_DIMENSION / requiredHeight);
                finalScale = originalScale * downscaleFactor;
                console.warn(`Схема слишком велика. Разрешение рендера снижено с ${originalScale}x до ${finalScale.toFixed(2)}x, чтобы избежать ошибки браузера.`);
                statusLabel.textContent = 'Схема очень большая, разрешение снижено...';
            }
            // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

            const canvas = await html2canvas(renderContainer, { scale: finalScale, useCORS: true, logging: false });

            const selectedFormat = formatSelect.value;
            const isOriginalFormat = selectedFormat === ORIGINAL_FORMAT_KEY;
            const isLandscape = currentOrientation === 'landscape';
            const pxPerMm = selectedDpi / 25.4;

            let targetWidthPx;
            let targetHeightPx;

            if (isOriginalFormat) {
                targetWidthPx = canvas.width;
                targetHeightPx = canvas.height;
            } else {
                const paper = PAPER_SIZES[selectedFormat];
                const targetWidthMm = isLandscape ? paper.height : paper.width;
                const targetHeightMm = isLandscape ? paper.width : paper.height;
                targetWidthPx = Math.round(targetWidthMm * pxPerMm);
                targetHeightPx = Math.round(targetHeightMm * pxPerMm);
            }

            let exportWidth = Math.max(1, Math.round(targetWidthPx));
            let exportHeight = Math.max(1, Math.round(targetHeightPx));

            const exportLimitRatio = Math.min(
                exportWidth > 0 ? MAX_EXPORT_DIMENSION / exportWidth : 1,
                exportHeight > 0 ? MAX_EXPORT_DIMENSION / exportHeight : 1,
                1
            );

            if (exportLimitRatio < 1) {
                exportWidth = Math.max(1, Math.floor(exportWidth * exportLimitRatio));
                exportHeight = Math.max(1, Math.floor(exportHeight * exportLimitRatio));
                if (statusLabel.textContent === 'Создание изображения...') {
                    statusLabel.textContent = 'Схема очень большая, разрешение снижено...';
                }
            }

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = exportWidth;
            exportCanvas.height = exportHeight;
            const exportCtx = exportCanvas.getContext('2d');
            const backgroundColor = getComputedStyle(renderContainer).backgroundColor || '#ffffff';
            exportCtx.fillStyle = backgroundColor;
            exportCtx.fillRect(0, 0, exportWidth, exportHeight);
            exportCtx.imageSmoothingEnabled = true;
            exportCtx.imageSmoothingQuality = 'high';

            const fitScale = Math.min(exportWidth / canvas.width, exportHeight / canvas.height);
            const drawWidth = canvas.width * fitScale;
            const drawHeight = canvas.height * fitScale;
            const offsetX = (exportWidth - drawWidth) / 2;
            const offsetY = (exportHeight - drawHeight) / 2;
            exportCtx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);

            const sourceCanvas = exportCanvas;
            const sourceDataUrl = sourceCanvas.toDataURL('image/png');

            const effectiveDpiX = targetWidthPx > 0 ? selectedDpi * (exportWidth / targetWidthPx) : selectedDpi;
            const effectiveDpiY = targetHeightPx > 0 ? selectedDpi * (exportHeight / targetHeightPx) : selectedDpi;
            const effectiveDpi = Math.max(1, Math.round(Math.min(effectiveDpiX, effectiveDpiY)));

            if (exportType === 'png') {
                statusLabel.textContent = 'Сохранение PNG...';
                const pngBlob = await canvasToPngWithDpi(sourceCanvas, effectiveDpi);
                if (pngBlob) {
                    const link = document.createElement('a');
                    const objectUrl = URL.createObjectURL(pngBlob);
                    link.download = `scheme-${selectedFormat}.png`;
                    link.href = objectUrl;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                } else {
                    const linkFallback = document.createElement('a');
                    linkFallback.download = `scheme-${selectedFormat}.png`;
                    linkFallback.href = sourceDataUrl;
                    linkFallback.click();
                }
            } else if (exportType === 'pdf') {
                statusLabel.textContent = 'Создание PDF...';

                if (isOriginalFormat) {
                    const pxPerMmEffective = effectiveDpi / 25.4;
                    const paperWidth = exportWidth / pxPerMmEffective;
                    const paperHeight = exportHeight / pxPerMmEffective;
                    const doc = new jsPDFLib({
                        orientation: paperWidth >= paperHeight ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [paperWidth, paperHeight]
                    });
                    doc.addImage(sourceDataUrl, 'PNG', 0, 0, paperWidth, paperHeight, undefined, 'FAST');
                    doc.save(`scheme-${selectedFormat}.pdf`);
                } else {
                    const paper = PAPER_SIZES[selectedFormat];
                    const paperWidth = isLandscape ? paper.height : paper.width;
                    const paperHeight = isLandscape ? paper.width : paper.height;

                    if (tileCheckbox.checked && selectedFormat !== 'a4') {
                        const a4 = PAPER_SIZES['a4'];
                        const tiledDoc = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4'});
                        const cols = Math.ceil(paperWidth / a4.width);
                        const rows = Math.ceil(paperHeight / a4.height);

                        const sliceWidthPx = sourceCanvas.width / cols;
                        const sliceHeightPx = sourceCanvas.height / rows;

                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                 if (r > 0 || c > 0) tiledDoc.addPage();
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = sliceWidthPx;
                                tempCanvas.height = sliceHeightPx;
                                const tempCtx = tempCanvas.getContext('2d');
                                tempCtx.drawImage(canvas, c * sliceWidthPx, r * sliceHeightPx, sliceWidthPx, sliceHeightPx, 0, 0, sliceWidthPx, sliceHeightPx);
                                tiledDoc.addImage(tempCanvas.toDataURL('image/png'), 'PNG', 0, 0, a4.width, a4.height, undefined, 'FAST');
                            }
                        }
                        tiledDoc.save(`scheme-${selectedFormat}-tiled.pdf`);
                    } else {
                        const doc = new jsPDFLib({
                            orientation: isLandscape ? 'landscape' : 'portrait',
                            unit: 'mm',
                            format: selectedFormat
                        });
                        const canvasAspectRatio = sourceCanvas.width / sourceCanvas.height;
                        const paperAspectRatio = paperWidth / paperHeight;
                        let imgWidth, imgHeight;
                        if (canvasAspectRatio > paperAspectRatio) {
                            imgWidth = paperWidth;
                            imgHeight = paperWidth / canvasAspectRatio;
                        } else {
                            imgHeight = paperHeight;
                            imgWidth = paperHeight * canvasAspectRatio;
                        }
                        doc.addImage(sourceDataUrl, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
                        doc.save(`scheme-${selectedFormat}.pdf`);
                    }
                }
            }
            statusLabel.textContent = 'Готово!';
        } catch (err) {
            console.error("Ошибка при создании файла:", err);
            statusLabel.textContent = 'Произошла ошибка!';
        } finally {
            document.body.removeChild(renderContainer);
            setTimeout(() => {
                statusLabel.textContent = '';
                pngBtn.disabled = false;
                pdfBtn.disabled = true;
            }, 3000);
        }
    }
    
    async function createPrintableHtml(state, bounds, PADDING) {
        const printCanvas = document.createElement('div');
        printCanvas.id = 'canvas-render';
        printCanvas.style.position = 'relative';
        printCanvas.style.width = `${bounds.width + PADDING * 2}px`;
        printCanvas.style.height = `${bounds.height + PADDING * 2}px`;

        const printSvgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        printSvgLayer.id = 'svg-layer-render';
        printSvgLayer.style.position = 'absolute';
        printSvgLayer.style.top = '0';
        printSvgLayer.style.left = '0';
        printSvgLayer.style.width = '100%';
        printSvgLayer.style.height = '100%';
        printSvgLayer.innerHTML = `<defs><marker id="marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6"><circle cx="5" cy="5" r="4" fill="currentColor"/></marker></defs>`;
        printCanvas.appendChild(printSvgLayer);

        const cardElements = new Map();
        const EXTRA_PADDING_TOP = 60;
        const EXTRA_PADDING_SIDE = 50;

        for (const cardData of state.cards) {
             const tempBody = document.createElement('div');
             tempBody.innerHTML = cardData.bodyHTML;
             tempBody.querySelector('.active-pv-controls')?.remove();
             const cleanedBodyHTML = tempBody.innerHTML;

             const cardWidth = parseInt(cardData.width, 10) || 380;
             const cardHeight = 280;

             const wrapper = document.createElement('div');
             wrapper.className = 'print-card-wrapper';
             wrapper.style.position = 'absolute';
             wrapper.style.left = `${cardData.x - bounds.minX + PADDING - EXTRA_PADDING_SIDE}px`;
             wrapper.style.top  = `${cardData.y - bounds.minY + PADDING - EXTRA_PADDING_TOP}px`;
             wrapper.style.width = `${cardWidth + EXTRA_PADDING_SIDE * 2}px`;
             wrapper.style.height = `${cardHeight + EXTRA_PADDING_TOP}px`;

             const cardEl = document.createElement('div');
             cardEl.className = 'card';
             if (cardData.isDarkMode) cardEl.classList.add('dark-mode');
             cardEl.style.width = `${cardWidth}px`;
             cardEl.style.left = `${EXTRA_PADDING_SIDE}px`;
             cardEl.style.top = `${EXTRA_PADDING_TOP}px`;
             cardEl.style.borderColor = cardData.headerBg;

             let rankSrc = '';
             if (cardData.badges?.rank) {
                const dataUri = await imageToDataUri(`rank-${cardData.badges.rank}.png`);
                if(dataUri) rankSrc = dataUri;
             }

             cardEl.innerHTML = `
                 <div class="card-header" style="background:${cardData.headerBg};">
                     <div class="slf-badge ${cardData.badges?.slf ? 'visible' : ''}">SLF</div>
                     <span class="card-title">${cardData.title}</span>
                     <div class="fendou-badge ${cardData.badges?.fendou ? 'visible' : ''}">FENDOU</div>
                     <img class="rank-badge ${cardData.badges?.rank ? 'visible' : ''}" src="${rankSrc}" alt="Rank">
                 </div>
                 <div class="card-body ${cardData.bodyClass || ''}">${cleanedBodyHTML}</div>
             `;
             wrapper.appendChild(cardEl);
             printCanvas.appendChild(wrapper);
             cardElements.set(cardData.id, { wrapper, width: cardWidth, height: cardHeight });
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        state.lines.forEach(lineData => {
            const startEl = cardElements.get(lineData.startId);
            const endEl = cardElements.get(lineData.endId);
            if (!startEl || !endEl) return;

            const getPrintCoords = (info, side) => {
              const x = parseFloat(info.wrapper.style.left) + EXTRA_PADDING_SIDE;
              const y = parseFloat(info.wrapper.style.top) + EXTRA_PADDING_TOP;
              const w = info.width;
              const h = info.height;
              switch (side) {
                case 'top': return { x: x + w / 2, y: y };
                case 'bottom': return { x: x + w / 2, y: y + h };
                case 'left': return { x: x, y: y + h / 2 };
                case 'right': return { x: x + w, y: y + h / 2 };
              }
            };
            const p1 = getPrintCoords(startEl, lineData.startSide);
            const p2 = getPrintCoords(endEl, lineData.endSide);
            if(!p1 || !p2) return;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'line');
            const color = lineData.color || DEFAULT_LINE_COLOR;
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', lineData.thickness);
            path.style.setProperty('--line-color', color);
            path.setAttribute('marker-start', 'url(#marker-dot)');
            path.setAttribute('marker-end', 'url(#marker-dot)');
            let midP1 = (lineData.startSide === 'left' || lineData.startSide === 'right') ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
            path.setAttribute('d', `M ${p1.x} ${p1.y} L ${midP1.x} ${midP1.y} L ${p2.x} ${p2.y}`);
            printSvgLayer.appendChild(path);
        });

        return {printCanvas, printSvgLayer};
    }
    
    autoSelectOrientation();
    updatePreview();
}
// ============== КОНЕЦ НОВОГО БЛОКА ДЛЯ ПЕЧАТИ ==============

});




















