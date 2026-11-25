/**
 * model-enhancer 前端 UI 控制器：
 * 1) 为模型选择列表中的每个模型项注入品牌 SVG 图标；
 * 2) 将模型选择器改造为 Codex 风格的二段式单面板（首屏思考深度拉条 <-> 带图标的模型列表）。
 */
import {
  createBrandSvgElement,
  formatEffortLabel,
  getAvailableEfforts,
  getDefaultEffort,
  resolveBaseAndEffort,
  resolveBrandId,
} from './model-core.js';

const COPY = {
  'zh-CN': {
    modelTitle: '模型',
    bestOfNTitle: 'Best of N 模型',
    fixedDepth: '该模型为固定思考深度',
    resetAria: '恢复默认思考深度',
    switchModelAria: '切换模型',
    backAria: '返回思考深度调节',
    sliderAria: '思考深度',
  },
  en: {
    modelTitle: 'Model',
    bestOfNTitle: 'Best of N Models',
    fixedDepth: 'Fixed thinking depth',
    resetAria: 'Reset to default effort',
    switchModelAria: 'Switch model',
    backAria: 'Back to thinking slider',
    sliderAria: 'Thinking depth',
  },
};

const CHEVRON_RIGHT_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const CHEVRON_LEFT_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

const RESET_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';

function selectLocale(win, doc) {
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if ((win && win.__myAntigravityZhCnInstalled) || htmlLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

function getReactFiber(el) {
  if (!el || typeof el !== 'object') return null;
  const keys = Object.keys(el);
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  return fiberKey ? el[fiberKey] : null;
}

/**
 * 沿 React Fiber 树只读提取 ModelSelectorProvider 上下文与 XQc 非关闭式选中回调。
 */
export function inspectModelSelectorPanel(panelEl) {
  let fiber = getReactFiber(panelEl);
  let ctx = null;
  let topmostXqcSetSelectedModel = null;
  let setIsOpen = null;

  for (let steps = 0; fiber && steps < 55; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (!props || typeof props !== 'object') continue;

    const val = props.value;
    if (
      !ctx &&
      val &&
      typeof val === 'object' &&
      val.effortIndex instanceof Map &&
      Array.isArray(val.groups)
    ) {
      ctx = val;
    }

    if (
      typeof props.setSelectedModel === 'function' &&
      typeof props.setIsOpen === 'function' &&
      Array.isArray(props.modelSorts)
    ) {
      // LQc 在内层、XQc 在外层；持续向上覆盖可拿到外层 XQc 不关弹窗的 setSelectedModel
      topmostXqcSetSelectedModel = props.setSelectedModel;
      setIsOpen = props.setIsOpen;
    }
  }

  const rawSetSelectedModel =
    (typeof ctx?.contextWindow?.select === 'function' ? ctx.contextWindow.select : null) ||
    (topmostXqcSetSelectedModel && topmostXqcSetSelectedModel !== ctx?.setSelectedModel
      ? topmostXqcSetSelectedModel
      : null);

  return {
    ctx,
    rawSetSelectedModel,
    canStayOpen: Boolean(rawSetSelectedModel),
    setIsOpen,
  };
}

/**
 * 从模型行 DOM 只读提取其对应的 ClientModelConfig 选项对象。
 */
export function inspectModelItemFiber(itemEl) {
  let fiber = getReactFiber(itemEl);
  for (let steps = 0; fiber && steps < 18; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object' && props.model && typeof props.model.label === 'string') {
      return props.model;
    }
  }
  return null;
}

function isOwnUiNode(node) {
  if (!node || node.nodeType !== 1) return false;
  return Boolean(
    node.closest?.('[data-ag-me-slider-view], [data-ag-me-list-header], [data-ag-me-icon]'),
  );
}

export function createModelEnhancerController(win, doc, iconsMap = {}) {
  const panels = new Map();
  let suppressOutsideClick = false;
  let suppressOutsideTimer = null;

  function suppressOutsideClickOnce() {
    suppressOutsideClick = true;
    if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
      win.clearTimeout(suppressOutsideTimer);
    }
    if (typeof win.setTimeout === 'function') {
      suppressOutsideTimer = win.setTimeout(() => {
        suppressOutsideClick = false;
        suppressOutsideTimer = null;
      }, 80);
    }
  }

  function handleDocClickCapture(event) {
    if (!suppressOutsideClick) return;
    suppressOutsideClick = false;
    if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
      win.clearTimeout(suppressOutsideTimer);
      suppressOutsideTimer = null;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  doc.addEventListener?.('click', handleDocClickCapture, true);

  function syncActiveAttribute() {
    if (!doc?.documentElement) return;
    if (panels.size > 0) {
      doc.documentElement.setAttribute('data-ag-me-active', 'true');
    } else {
      doc.documentElement.removeAttribute('data-ag-me-active');
    }
  }

  function createPanelInstance(panelEl) {
    let stage = 'slider';
    let userChoseList = false;
    let canReturnToSlider = false;
    let dragging = false;
    let isActiveDrag = false;
    let dragStartX = 0;
    let dragRect = null;
    let previewIndexValue = 0;
    let currentEfforts = [];
    let currentBaseName = '';
    let currentOption = null;
    let currentActiveIndex = 0;
    let currentDefaultEffort = null;
    let currentCwSelected = undefined;
    let transitionEpoch = 0;
    let activeAnimations = [];

    function cancelTransitionAnimations() {
      for (const anim of activeAnimations) {
        try {
          anim.cancel();
        } catch {
          // ignore
        }
      }
      activeAnimations = [];
      panelEl.removeAttribute('data-ag-me-animating');
    }

    function prefersReducedMotion() {
      try {
        return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }

    function switchStageAnimated(nextStage, { beforeUpdate, afterSwitch } = {}) {
      const canAnimate =
        !prefersReducedMotion() &&
        typeof panelEl.animate === 'function' &&
        typeof panelEl.getBoundingClientRect === 'function';

      if (!canAnimate) {
        cancelTransitionAnimations();
        stage = nextStage;
        beforeUpdate?.();
        update();
        afterSwitch?.();
        return;
      }

      const fromRect = panelEl.getBoundingClientRect();
      cancelTransitionAnimations();

      stage = nextStage;
      beforeUpdate?.();
      update();

      const toRect = panelEl.getBoundingClientRect();
      const fromW = Math.round(fromRect?.width || 0);
      const fromH = Math.round(fromRect?.height || 0);
      const toW = Math.round(toRect?.width || 0);
      const toH = Math.round(toRect?.height || 0);

      if (fromW > 0 && fromH > 0 && toW > 0 && toH > 0 && (fromW !== toW || fromH !== toH)) {
        transitionEpoch += 1;
        const myEpoch = transitionEpoch;
        panelEl.setAttribute('data-ag-me-animating', 'true');

        const sizeAnim = panelEl.animate(
          [
            { width: `${fromW}px`, height: `${fromH}px` },
            { width: `${toW}px`, height: `${toH}px` },
          ],
          {
            duration: 240,
            easing: 'cubic-bezier(0.19, 1, 0.22, 1)',
          },
        );
        if (sizeAnim) {
          activeAnimations.push(sizeAnim);
          const cleanup = () => {
            if (transitionEpoch === myEpoch) {
              panelEl.removeAttribute('data-ag-me-animating');
            }
          };
          sizeAnim.onfinish = cleanup;
          sizeAnim.oncancel = cleanup;
        } else {
          panelEl.removeAttribute('data-ag-me-animating');
        }
      }

      const contentTargets =
        nextStage === 'slider'
          ? [sliderView]
          : Array.from(panelEl.children || []).filter(
              (el) => el !== sliderView && typeof el.animate === 'function' && !el.hidden,
            );
      const yOffset = nextStage === 'slider' ? -4 : 6;

      for (const el of contentTargets) {
        if (typeof el.animate !== 'function') continue;
        const contentAnim = el.animate(
          [
            { opacity: 0, transform: `translateY(${yOffset}px)` },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 190,
            delay: nextStage === 'list' ? 25 : 0,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
            fill: 'backwards',
          },
        );
        if (contentAnim) {
          activeAnimations.push(contentAnim);
        }
      }

      afterSwitch?.();
    }

    // --- Stage 1: Codex 风格思考深度拉条视图 ---
    const sliderView = doc.createElement('div');
    sliderView.setAttribute('data-ag-me-slider-view', 'true');
    sliderView.setAttribute('data-my-antigravity-no-i18n', 'true');

    const sliderHeader = doc.createElement('div');
    sliderHeader.setAttribute('data-ag-me-slider-header', 'true');

    const headerSpacer = doc.createElement('div');
    headerSpacer.setAttribute('aria-hidden', 'true');

    const headerCenter = doc.createElement('div');
    headerCenter.setAttribute('data-ag-me-header-center', 'true');

    const effortTitle = doc.createElement('div');
    effortTitle.setAttribute('data-ag-me-effort-title', 'true');

    const modelSwitchBtn = doc.createElement('button');
    modelSwitchBtn.type = 'button';
    modelSwitchBtn.setAttribute('data-ag-me-model-switch', 'true');
    const modelSwitchName = doc.createElement('span');
    modelSwitchName.setAttribute('data-ag-me-model-switch-name', 'true');
    modelSwitchBtn.append(modelSwitchName);
    modelSwitchBtn.insertAdjacentHTML('beforeend', CHEVRON_RIGHT_SVG);

    headerCenter.append(effortTitle, modelSwitchBtn);

    const resetBtn = doc.createElement('button');
    resetBtn.type = 'button';
    resetBtn.setAttribute('data-ag-me-reset', 'true');
    resetBtn.innerHTML = RESET_SVG;

    sliderHeader.append(headerSpacer, headerCenter, resetBtn);

    const rail = doc.createElement('div');
    rail.setAttribute('data-ag-me-rail', 'true');
    rail.setAttribute('role', 'slider');
    rail.setAttribute('tabindex', '0');

    const rangeEl = doc.createElement('div');
    rangeEl.setAttribute('data-ag-me-range', 'true');

    const ticksEl = doc.createElement('div');
    ticksEl.setAttribute('data-ag-me-ticks', 'true');

    const thumbEl = doc.createElement('div');
    thumbEl.setAttribute('data-ag-me-thumb', 'true');

    rail.append(rangeEl, ticksEl, thumbEl);

    const fixedNote = doc.createElement('div');
    fixedNote.setAttribute('data-ag-me-fixed-note', 'true');
    fixedNote.hidden = true;

    const cwRow = doc.createElement('div');
    cwRow.setAttribute('data-ag-me-cw-row', 'true');
    cwRow.hidden = true;

    sliderView.append(sliderHeader, rail, fixedNote, cwRow);

    // --- Stage 2: 带返回入口的模型列表顶部头 ---
    const listHeader = doc.createElement('div');
    listHeader.setAttribute('data-ag-me-list-header', 'true');
    listHeader.setAttribute('data-my-antigravity-no-i18n', 'true');

    const backBtn = doc.createElement('button');
    backBtn.type = 'button';
    backBtn.setAttribute('data-ag-me-back-btn', 'true');
    backBtn.insertAdjacentHTML('beforeend', CHEVRON_LEFT_SVG);
    const backBtnLabel = doc.createElement('span');
    backBtn.append(backBtnLabel);

    const listTitle = doc.createElement('div');
    listTitle.setAttribute('data-ag-me-list-title', 'true');

    listHeader.append(backBtn, listTitle);

    function getLocaleAndCopy() {
      const locale = selectLocale(win, doc);
      return { locale, copy: COPY[locale] || COPY.en };
    }

    function applySliderVisual(index, totalCount, effortKey, locale, overrideRatio = null) {
      const count = Math.max(1, totalCount);
      const safeIndex = Math.max(0, Math.min(count - 1, index));
      const snappedRatio = count <= 1 ? 0 : safeIndex / (count - 1);
      const ratio =
        typeof overrideRatio === 'number'
          ? Math.min(1, Math.max(0, overrideRatio))
          : snappedRatio;

      sliderView.style.setProperty('--ag-me-p', String(ratio));
      rail.setAttribute('aria-valuemin', '0');
      rail.setAttribute('aria-valuemax', String(count - 1));
      rail.setAttribute('aria-valuenow', String(safeIndex));
      rail.setAttribute('aria-valuetext', formatEffortLabel(effortKey, locale));

      effortTitle.textContent = formatEffortLabel(effortKey, locale);

      const tickEls = ticksEl.children;
      for (let i = 0; i < tickEls.length; i += 1) {
        const tickRatio = count <= 1 ? 0 : i / (count - 1);
        tickEls[i].setAttribute('data-passed', String(tickRatio <= ratio + 0.015));
      }
    }

    function ensureTicks(count) {
      if (ticksEl.children.length === count) return;
      ticksEl.replaceChildren();
      for (let i = 0; i < count; i += 1) {
        const tick = doc.createElement('span');
        tick.setAttribute('data-ag-me-tick', 'true');
        const p = count <= 1 ? 0 : i / (count - 1);
        tick.style.left = `calc(var(--ag-me-thumb-r) + (100% - 2 * var(--ag-me-thumb-r)) * ${p})`;
        ticksEl.append(tick);
      }
    }

    function commitModelSelection(option, cwName) {
      if (!option) return;
      const fiberInfo = inspectModelSelectorPanel(panelEl);
      const setter = fiberInfo.rawSetSelectedModel || fiberInfo.ctx?.setSelectedModel;
      if (typeof setter !== 'function') return;

      setter(option, cwName);
      // XQc 内部可能把焦点拉回编辑器；若仍停留在拉条视图且菜单未关，立刻恢复焦点到滑轨
      if (fiberInfo.canStayOpen && stage === 'slider' && panelEl.isConnected && !rail.hidden) {
        try {
          rail.focus({ preventScroll: true });
        } catch {
          // 忽略测试环境无 focus 选项的情况
        }
      }
    }

    function ratioFromClientX(clientX) {
      const rect = dragRect || rail.getBoundingClientRect();
      const width = Math.max(1, rect.width || 1);
      const halfTrack = rect.height ? rect.height / 2 : 11;
      const inset = Math.min(Math.max(8, halfTrack), width / 4);
      const usable = Math.max(1, width - inset * 2);
      return Math.min(1, Math.max(0, (clientX - rect.left - inset) / usable));
    }

    function indexFromClientX(clientX) {
      const count = currentEfforts.length;
      if (count <= 1) return 0;
      return Math.round(ratioFromClientX(clientX) * (count - 1));
    }

    function previewAtIndex(idx, overrideRatio = null) {
      if (!currentEfforts.length) return;
      const safe = Math.max(0, Math.min(currentEfforts.length - 1, idx));
      previewIndexValue = safe;
      const entry = currentEfforts[safe];
      const { locale } = getLocaleAndCopy();
      applySliderVisual(safe, currentEfforts.length, entry.effort, locale, overrideRatio);
      resetBtn.disabled = !currentDefaultEffort || entry.effort === currentDefaultEffort;
    }

    rail.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || currentEfforts.length < 2) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      isActiveDrag = false;
      dragStartX = event.clientX;
      dragRect = rail.getBoundingClientRect();
      // 点击时不立即关闭 CSS transition，等产生明显位移后再进入无延迟跟手拖拽
      try {
        rail.setPointerCapture?.(event.pointerId);
      } catch {
        // 忽略不支持 pointerCapture 的环境
      }
      try {
        rail.focus({ preventScroll: true });
      } catch {
        // ignore
      }
      previewAtIndex(indexFromClientX(event.clientX));
    });

    rail.addEventListener('pointermove', (event) => {
      if (!dragging || currentEfforts.length < 2) return;
      if (!isActiveDrag && Math.abs(event.clientX - dragStartX) > 3) {
        isActiveDrag = true;
        rail.setAttribute('data-dragging', 'true');
      }
      if (isActiveDrag) {
        const rawRatio = ratioFromClientX(event.clientX);
        const snappedIdx = Math.round(rawRatio * (currentEfforts.length - 1));
        previewAtIndex(snappedIdx, rawRatio);
      }
    });

    function finishDrag(clientX, commit, target) {
      if (!dragging) return;
      const wasActiveDrag = isActiveDrag;
      dragging = false;
      isActiveDrag = false;
      if (wasActiveDrag || rail.hasAttribute('data-dragging')) {
        rail.removeAttribute('data-dragging');
        // 强制刷新一次样式计算，确保松手回弹刻度时 CSS 过渡稳定生效
        void rail.offsetWidth;
      }
      if (commit && clientX != null) {
        previewAtIndex(indexFromClientX(clientX));
      }
      dragRect = null;
      if (target && !panelEl.contains(target)) {
        suppressOutsideClickOnce();
      }
      if (commit && currentEfforts[previewIndexValue]) {
        const chosen = currentEfforts[previewIndexValue];
        if (previewIndexValue !== currentActiveIndex) {
          currentActiveIndex = previewIndexValue;
          commitModelSelection(chosen.option, currentCwSelected);
        }
      } else {
        previewAtIndex(currentActiveIndex);
      }
    }

    rail.addEventListener('pointerup', (event) => {
      finishDrag(event.clientX, true, event.target);
    });

    rail.addEventListener('pointercancel', (event) => {
      finishDrag(null, false, event.target);
    });

    rail.addEventListener('keydown', (event) => {
      if (currentEfforts.length < 2) return;
      let nextIdx = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        nextIdx = Math.max(0, currentActiveIndex - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        nextIdx = Math.min(currentEfforts.length - 1, currentActiveIndex + 1);
      } else if (event.key === 'Home') {
        nextIdx = 0;
      } else if (event.key === 'End') {
        nextIdx = currentEfforts.length - 1;
      }
      if (nextIdx === null) return;
      event.preventDefault();
      event.stopPropagation();
      previewAtIndex(nextIdx);
      if (nextIdx !== currentActiveIndex && currentEfforts[nextIdx]) {
        currentActiveIndex = nextIdx;
        commitModelSelection(currentEfforts[nextIdx].option, currentCwSelected);
      }
    });

    modelSwitchBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      userChoseList = true;
      switchStageAnimated('list');
    });

    resetBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!currentDefaultEffort) return;
      const targetIdx = currentEfforts.findIndex((item) => item.effort === currentDefaultEffort);
      if (targetIdx < 0 || targetIdx === currentActiveIndex) return;
      currentActiveIndex = targetIdx;
      previewAtIndex(targetIdx);
      commitModelSelection(currentEfforts[targetIdx].option, currentCwSelected);
    });

    backBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canReturnToSlider) return;
      userChoseList = false;
      switchStageAnimated('slider', {
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
    });

    // Stage 2：点击多思考档位模型行时切换模型并切回 Stage 1（拉条面板）
    function handlePanelClickCapture(event) {
      if (stage !== 'list') return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (
        target.closest(
          '[data-ag-me-slider-view], [data-ag-me-list-header], [data-testid="model-selector-refresh"], [role="menuitemcheckbox"]',
        )
      ) {
        return;
      }
      const item = target.closest('[role="menuitem"]');
      if (!item || !panelEl.contains(item)) return;
      if (item.getAttribute('aria-disabled') === 'true' || item.hasAttribute('disabled')) {
        return;
      }

      const effortGroupEl = item.querySelector('[data-testid="model-selector-effort-group"]');
      if (!effortGroupEl) {
        // 单变体模型或 View Usage 等其他菜单项：保留原生点击行为
        return;
      }

      const fiberInfo = inspectModelSelectorPanel(panelEl);
      if (!fiberInfo.canStayOpen || !fiberInfo.ctx) return;

      const baseName =
        effortGroupEl.getAttribute('data-model-base') || effortGroupEl.textContent?.trim() || '';
      const groupedModels = fiberInfo.ctx.userStatus?.cascadeModelConfigData?.groupedModels;
      const efforts = getAvailableEfforts(baseName, fiberInfo.ctx.effortIndex, groupedModels);
      if (efforts.length < 2) return;

      const currentParsed = resolveBaseAndEffort(
        fiberInfo.ctx.selectedModel,
        fiberInfo.ctx.effortIndex,
        groupedModels,
      );
      const preferredEffort =
        currentParsed?.base === baseName ? currentParsed.effort : getDefaultEffort(efforts);
      const targetEntry =
        efforts.find((entry) => entry.effort === preferredEffort) || efforts[0];
      if (!targetEntry?.option) return;

      event.preventDefault();
      event.stopPropagation();
      userChoseList = false;
      switchStageAnimated('slider', {
        beforeUpdate() {
          commitModelSelection(targetEntry.option);
        },
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
    }

    panelEl.addEventListener('click', handlePanelClickCapture, true);

    // Stage 2：拦截多档位模型行的悬停事件，阻止 Base UI SubmenuTrigger 打开隐藏子菜单
    // （避免 safePolygon / blockPointerEvents 抢占指针导致悬停闪烁或关闭）
    function handlePanelHoverCapture(event) {
      if (stage !== 'list') return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const item = target.closest('[role="menuitem"]');
      if (!item || !panelEl.contains(item)) return;
      if (!item.querySelector('[data-testid="model-selector-effort-group"]')) {
        return;
      }
      event.stopPropagation();
      if (event.type === 'mousemove' && doc.activeElement !== item) {
        if (
          item.getAttribute('aria-disabled') !== 'true' &&
          !item.hasAttribute('disabled') &&
          doc.hasFocus?.() !== false
        ) {
          try {
            item.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        }
      }
    }

    for (const hoverType of ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover']) {
      panelEl.addEventListener(hoverType, handlePanelHoverCapture, true);
    }

    function buildRowMeta(modelObj, fallback = {}) {
      return {
        base: fallback.base,
        label: modelObj?.label || fallback.label || '',
        displayName: modelObj?.displayName,
        modelId: modelObj?.modelId,
        modelAlias: modelObj?.modelAlias,
        modelOrAlias: modelObj?.modelOrAlias,
        provider: modelObj?.provider,
      };
    }

    function injectRowIcon(container, meta) {
      if (!container) return;
      const brandId = resolveBrandId(meta);
      const existing = container.querySelector(':scope > [data-ag-me-icon]');
      if (!brandId) {
        if (existing) existing.remove();
        return;
      }
      if (existing) {
        if (existing.getAttribute('data-ag-me-icon') === brandId) {
          return;
        }
        existing.remove();
      }
      const svg = createBrandSvgElement(doc, iconsMap, brandId);
      if (svg) {
        container.prepend(svg);
      }
    }

    function enhanceModelRows() {
      // 1. 多档位模型组（位于 HW 的内部 flex span 中）
      for (const groupEl of panelEl.querySelectorAll('[data-testid="model-selector-effort-group"]')) {
        const container = groupEl.parentElement;
        const item = groupEl.closest('[role="menuitem"]');
        const modelObj = inspectModelItemFiber(item || groupEl);
        const base = groupEl.getAttribute('data-model-base') || groupEl.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { base, label: base }));
      }

      // 2. 单变体模型、自定义模型与新版 Orchestrator 协调器行
      for (const itemEl of panelEl.querySelectorAll(
        '[data-testid="model-selector-item"], [data-testid="model-selector-custom-item"], [data-testid="model-selector-orchestrator"]',
      )) {
        const container = itemEl.querySelector(':scope > span') || itemEl;
        const modelObj = inspectModelItemFiber(itemEl);
        const label = itemEl.getAttribute('data-model-label') || itemEl.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { label }));
      }

      // 3. Best of N 模式下的复选模型行
      for (const checkItem of panelEl.querySelectorAll('[role="menuitemcheckbox"]')) {
        const container = checkItem.querySelector(':scope > span') || checkItem;
        const modelObj = inspectModelItemFiber(checkItem);
        const label = checkItem.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { label }));
      }

      // 4. Orchestrator 右侧规划器子菜单行（Portal 挂载于 document 内）
      for (const pickerRow of doc.querySelectorAll('[data-testid="orchestrator-picker-row"]')) {
        const container = pickerRow.querySelector(':scope > span') || pickerRow;
        const modelObj = inspectModelItemFiber(pickerRow);
        const base = pickerRow.getAttribute('data-model-base') || '';
        const label =
          pickerRow.getAttribute('data-model-label') || base || pickerRow.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { base, label }));
      }
    }

    function renderContextWindowRow(option, ctx) {
      const cwList = option?.contextWindowOptions;
      if (!Array.isArray(cwList) || cwList.length === 0 || !ctx?.contextWindow) {
        cwRow.hidden = true;
        cwRow.replaceChildren();
        currentCwSelected = undefined;
        return;
      }
      currentCwSelected = ctx.contextWindow.selected;
      cwRow.hidden = false;
      cwRow.replaceChildren();
      for (const cw of cwList) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-ag-me-cw-btn', 'true');
        const active = currentCwSelected === cw.name;
        btn.setAttribute('data-selected', String(active));
        btn.textContent = cw.name;
        if (cw.description) btn.title = cw.description;
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          currentCwSelected = cw.name;
          commitModelSelection(option, cw.name);
          update();
        });
        cwRow.append(btn);
      }
    }

    function mountAnchors() {
      if (!listHeader.isConnected || listHeader.parentElement !== panelEl) {
        panelEl.append(listHeader);
      }
      if (!sliderView.isConnected || sliderView.parentElement !== panelEl) {
        panelEl.append(sliderView);
      }
    }

    function update() {
      if (!panelEl.isConnected) return;
      mountAnchors();

      const { locale, copy } = getLocaleAndCopy();
      const fiberInfo = inspectModelSelectorPanel(panelEl);
      const ctx = fiberInfo.ctx;

      const isBestOfN = Boolean(ctx?.bestOfNConfig?.isBestOfNEnabled);
      const isLoading = Boolean(ctx?.isModelListLoading);
      const selectedModel = ctx?.selectedModel || null;

      canReturnToSlider = Boolean(ctx && !isBestOfN && !isLoading && selectedModel);

      if (!canReturnToSlider) {
        stage = 'list';
      } else if (!userChoseList) {
        stage = 'slider';
      }

      panelEl.setAttribute('data-ag-me-stage', stage);
      panelEl.setAttribute('data-ag-me-has-list-header', 'true');

      if (stage === 'slider' && selectedModel) {
        sliderView.hidden = false;
        listHeader.hidden = true;

        const groupedModels = ctx.userStatus?.cascadeModelConfigData?.groupedModels;
        const parsed = resolveBaseAndEffort(selectedModel, ctx.effortIndex, groupedModels);
        currentBaseName = parsed?.base || selectedModel.label || '';
        currentEfforts = parsed
          ? getAvailableEfforts(parsed.groupKey || parsed.base, ctx.effortIndex, groupedModels)
          : [];

        modelSwitchName.textContent = currentBaseName;
        modelSwitchBtn.setAttribute('aria-label', copy.switchModelAria);
        resetBtn.setAttribute('aria-label', copy.resetAria);
        resetBtn.title = copy.resetAria;
        rail.setAttribute('aria-label', copy.sliderAria);

        if (currentEfforts.length >= 2) {
          rail.hidden = false;
          fixedNote.hidden = true;
          resetBtn.hidden = false;

          const activeIdx = Math.max(
            0,
            currentEfforts.findIndex((item) => item.effort === parsed?.effort),
          );
          currentActiveIndex = activeIdx;
          currentOption = currentEfforts[activeIdx]?.option || selectedModel;
          currentDefaultEffort = getDefaultEffort(currentEfforts);

          ensureTicks(currentEfforts.length);
          if (!dragging) {
            previewIndexValue = activeIdx;
            const effortKey = currentEfforts[activeIdx]?.effort || parsed?.effort || 'medium';
            applySliderVisual(activeIdx, currentEfforts.length, effortKey, locale);
            resetBtn.disabled = !currentDefaultEffort || effortKey === currentDefaultEffort;
          }
          renderContextWindowRow(currentOption, ctx);
        } else {
          // 固定思考深度模型：保留切换模型入口并显示清晰提示
          rail.hidden = true;
          resetBtn.hidden = true;
          fixedNote.hidden = false;
          fixedNote.textContent = copy.fixedDepth;
          effortTitle.textContent = currentBaseName;
          modelSwitchName.textContent = copy.switchModelAria;
          currentOption = selectedModel;
          currentDefaultEffort = null;
          renderContextWindowRow(selectedModel, ctx);
        }
      } else {
        sliderView.hidden = true;
        listHeader.hidden = false;

        backBtn.hidden = !canReturnToSlider;
        backBtn.setAttribute('aria-label', copy.backAria);
        backBtnLabel.textContent = copy.modelTitle;

        listTitle.hidden = canReturnToSlider;
        listTitle.textContent = isBestOfN ? copy.bestOfNTitle : copy.modelTitle;

        enhanceModelRows();
      }
    }

    function returnFromListToSlider() {
      if (stage !== 'list' || !canReturnToSlider) return false;
      userChoseList = false;
      switchStageAnimated('slider', {
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
      return true;
    }

    function destroy() {
      cancelTransitionAnimations();
      panelEl.removeEventListener('click', handlePanelClickCapture, true);
      for (const hoverType of ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover']) {
        panelEl.removeEventListener(hoverType, handlePanelHoverCapture, true);
      }
      panelEl.removeAttribute('data-ag-me-stage');
      panelEl.removeAttribute('data-ag-me-has-list-header');
      sliderView.remove();
      listHeader.remove();
    }

    return {
      update,
      destroy,
      returnFromListToSlider,
      isInListStage: () => stage === 'list' && canReturnToSlider,
    };
  }

  let scanning = false;

  function scanPanels() {
    if (scanning) return;
    scanning = true;
    try {
      const found = doc.querySelectorAll('[data-testid="model-selector-panel"]');
      const seen = new Set();
      for (const panelEl of found) {
        seen.add(panelEl);
        let inst = panels.get(panelEl);
        if (!inst) {
          inst = createPanelInstance(panelEl);
          panels.set(panelEl, inst);
        }
        inst.update();
      }
      for (const [panelEl, inst] of panels.entries()) {
        if (!seen.has(panelEl) || !panelEl.isConnected) {
          inst.destroy();
          panels.delete(panelEl);
        }
      }
      syncActiveAttribute();
    } finally {
      scanning = false;
    }
  }

  function handleWindowKeyDown(event) {
    if (event.key !== 'Escape') return;
    for (const [panelEl, inst] of panels.entries()) {
      if (panelEl.isConnected && inst.isInListStage()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        inst.returnFromListToSlider();
        return;
      }
    }
  }

  win.addEventListener('keydown', handleWindowKeyDown, true);

  return {
    scanPanels,
    isOwnUiNode,
    getPanels: () => panels,
    destroy() {
      win.removeEventListener('keydown', handleWindowKeyDown, true);
      doc.removeEventListener?.('click', handleDocClickCapture, true);
      if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
        win.clearTimeout(suppressOutsideTimer);
      }
      for (const inst of panels.values()) inst.destroy();
      panels.clear();
      syncActiveAttribute();
    },
  };
}
