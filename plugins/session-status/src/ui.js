/**
 * session-status 前端 UI 控制器：
 * 在 Antigravity 输入框下方渲染会话状态栏，并在收起后于右下角工具栏提供上下文环入口。
 */
import {
  buildStatusSnapshot,
  formatCachePercent,
  formatCompactTokens,
  formatDurationMs,
  formatNumber,
  formatUsd,
} from './stats-core.js';

const EXPANDED_STORAGE_KEY = 'my_antigravity:session-status:expanded';

const COPY = {
  'zh-CN': {
    turns: '回合',
    steps: '步',
    speed: 'TPS',
    cache: '缓存',
    cacheDetail: '缓存命中',
    statistics: '会话统计',
    usage: 'Token 用量',
    context: '上下文详情',
    modelSteps: '模型响应步数',
    trajectorySteps: '轨迹总步数',
    firstToken: '平均首字延迟',
    averageSpeed: '平均 TPS（近 10 轮）',
    latestSpeed: '最近 TPS',
    model: '模型',
    total: '总用量',
    output: '输出',
    thinking: '思考',
    response: '正文',
    uncachedInput: '未缓存输入',
    cachedInput: '缓存读取',
    estimatedCost: '预估 API 费用',
    subagentCost: '含子智能体费用',
    contextShare: '上下文占用',
    systemAndTools: '系统与工具',
    messages: '对话消息',
    subagents: '子智能体',
    other: '其他未分类',
    sum: '已用合计',
    capacity: '窗口容量',
    compactions: '压缩次数',
    collapseAria: '收起会话状态栏',
    expandAria: '展开会话状态栏',
    speedHelpAria: '关于 TPS',
    speedTipOk: '使用 Antigravity 原生模型流式生成耗时计算（输出 Token ÷ 流式耗时），取最近一次有输出的响应，仅供参考。',
    speedTipStepTiming: '根据模型响应输出与请求/步骤时间戳估算，包含首字等待，取最近一次有输出的响应，仅供参考。',
    speedTipEmpty: '当前会话尚无带有效计时的已完成模型响应。',
    ctxWindowTitle: '上下文窗口：',
    ctxUsedTpl: (pct) => (pct >= 50 ? `已占用 ${pct}%` : `已使用 ${pct}%（剩余 ${100 - pct}%）`),
    ctxTokensTpl: (used, max) => `已使用 ${used} / ${max} Token`,
  },
  en: {
    turns: 'turns',
    steps: 'steps',
    speed: 'TPS',
    cache: 'Cache',
    cacheDetail: 'Cache hit',
    statistics: 'Session stats',
    usage: 'Token usage',
    context: 'Context',
    modelSteps: 'Model steps',
    trajectorySteps: 'Trajectory steps',
    firstToken: 'Avg first token',
    averageSpeed: 'Avg TPS (last 10 turns)',
    latestSpeed: 'Latest TPS',
    model: 'Model',
    total: 'Total',
    output: 'Output',
    thinking: 'Thinking',
    response: 'Response',
    uncachedInput: 'Uncached input',
    cachedInput: 'Cached input',
    estimatedCost: 'Estimated API cost',
    subagentCost: 'Subagent cost',
    contextShare: 'Context used',
    systemAndTools: 'System & tools',
    messages: 'Messages',
    subagents: 'Subagents',
    other: 'Other',
    sum: 'Used total',
    capacity: 'Window size',
    compactions: 'Compactions',
    collapseAria: 'Collapse session status bar',
    expandAria: 'Expand session status bar',
    speedHelpAria: 'About TPS',
    speedTipOk: 'Calculated from native model streamingDuration (output tokens / streaming duration) for the latest output response.',
    speedTipStepTiming: 'Estimated from model output tokens and request/step timestamps (includes waiting time), for reference only.',
    speedTipEmpty: 'No completed model response with valid timing data yet.',
    ctxWindowTitle: 'Context window:',
    ctxUsedTpl: (pct) => (pct >= 50 ? `${pct}% full` : `${pct}% used (${100 - pct}% left)`),
    ctxTokensTpl: (used, max) => `${used} / ${max} tokens used`,
  },
};

const ICONS = {
  // Lucide Gauge
  statistics:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  // Phosphor Database
  usage:
    '<svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>',
  // Lucide ChevronUp
  chevronUp:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  // Lucide Info
  info:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};

function selectCopy(win, doc) {
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  const hasZhCnMod = Boolean(win && win.__myAntigravityZhCnInstalled);
  if (hasZhCnMod || htmlLang.startsWith('zh')) {
    return COPY['zh-CN'];
  }
  return COPY.en;
}

function createContextRing(doc) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ag-ss-ring');

  const track = doc.createElementNS(ns, 'circle');
  for (const [k, v] of Object.entries({
    cx: '6',
    cy: '6',
    r: '4.75',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    opacity: '0.2',
  })) {
    track.setAttribute(k, v);
  }

  const prog = doc.createElementNS(ns, 'circle');
  for (const [k, v] of Object.entries({
    cx: '6',
    cy: '6',
    r: '4.75',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    pathLength: '100',
    'stroke-dasharray': '100',
    'stroke-dashoffset': '100',
    'stroke-linecap': 'round',
    transform: 'rotate(-90 6 6)',
    'data-ag-ss-ring-progress': 'true',
  })) {
    prog.setAttribute(k, v);
  }

  svg.append(track, prog);
  return svg;
}

function updateRing(svgEl, percent) {
  const prog = svgEl?.querySelector?.('[data-ag-ss-ring-progress]');
  if (!prog) return;
  const clamped = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  prog.setAttribute('stroke-dashoffset', String(100 - clamped));
}

/**
 * 从 DOM 元素沿 React Fiber 树只读提取 cascadeId、inExistingConversation 及可选的 AgentStateManager (S2a)。
 */
export function inspectComposerFiber(el) {
  if (!el || typeof el !== 'object') {
    return { conversationId: null, inExistingConversation: true, stateManager: null };
  }
  const keys = Object.keys(el);
  const fiberKey = keys.find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  let fiber = fiberKey ? el[fiberKey] : null;
  let conversationId = null;
  let inExistingConversation = true;
  let foundExistingFlag = false;
  let stateManager = null;

  for (let steps = 0; fiber && steps < 60; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object') {
      if (!conversationId) {
        const cid = props.cascadeId || props.conversationId;
        if (typeof cid === 'string' && cid.trim() !== '') {
          conversationId = cid;
        }
      }
      if (!foundExistingFlag && typeof props.inExistingConversation === 'boolean') {
        inExistingConversation = props.inExistingConversation;
        foundExistingFlag = true;
      }
      const val = props.value;
      if (
        !stateManager &&
        val &&
        typeof val === 'object' &&
        typeof val.peek === 'function' &&
        typeof val.getAgentStates === 'function'
      ) {
        stateManager = val;
      }
    }
    if (conversationId && stateManager && foundExistingFlag) break;
  }

  return { conversationId, inExistingConversation, stateManager };
}

function isElementVisible(win, el) {
  if (!el || !el.isConnected) return false;
  if (el.closest?.('[data-split-overlaid="true"], [inert], [aria-hidden="true"]')) return false;
  if (typeof el.getClientRects === 'function') {
    const rects = el.getClientRects();
    if (!rects || rects.length === 0) return false;
  }
  if (typeof win.getComputedStyle === 'function') {
    const style = win.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function createRow(doc, labelText, valueText, opts = {}) {
  const dt = doc.createElement('dt');
  if (opts.tone) dt.dataset.tone = opts.tone;
  if (opts.labelNode) {
    dt.append(opts.labelNode);
  } else {
    dt.textContent = labelText;
  }
  const dd = doc.createElement('dd');
  dd.textContent = valueText;
  return [dt, dd];
}

function positionFloating(win, el, anchorRect, preferAbove = true) {
  const vw = win.innerWidth || 1280;
  const vh = win.innerHeight || 800;
  const width = el.offsetWidth || 280;
  const height = el.offsetHeight || 160;
  const left = Math.max(8, Math.min(vw - width - 8, anchorRect.left + (anchorRect.width - width) / 2));
  let top = preferAbove ? anchorRect.top - height - 8 : anchorRect.bottom + 8;
  if (preferAbove && top < 8) {
    top = Math.min(vh - height - 8, anchorRect.bottom + 8);
  } else if (!preferAbove && top + height > vh - 8) {
    top = Math.max(8, anchorRect.top - height - 8);
  }
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function createSessionStatusController(win, doc, store, onHydrateState, onNeedBackfill) {
  const instances = new Map();
  let globalExpanded = true;
  try {
    globalExpanded = win.localStorage?.getItem(EXPANDED_STORAGE_KEY) !== 'false';
  } catch {
    globalExpanded = true;
  }

  // 共用 Tooltip（用于收起后的小环与 TPS Info 按钮）
  const tooltip = doc.createElement('div');
  tooltip.className = 'surface-glass';
  tooltip.setAttribute('data-ag-ss-tooltip', 'true');
  tooltip.setAttribute('data-my-antigravity-no-i18n', 'true');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;

  let tooltipOwner = null;
  function hideTooltip() {
    tooltip.hidden = true;
    tooltipOwner = null;
  }
  function showTooltip(anchor, lines) {
    if (!doc.body) return;
    if (!tooltip.isConnected) doc.body.append(tooltip);
    tooltip.replaceChildren();
    for (const [text, muted] of lines) {
      if (!text) continue;
      const div = doc.createElement('div');
      div.textContent = text;
      if (muted) div.className = 'ag-ss-tip-muted';
      tooltip.append(div);
    }
    tooltip.hidden = false;
    tooltipOwner = anchor;
    if (typeof anchor.getBoundingClientRect === 'function') {
      positionFloating(win, tooltip, anchor.getBoundingClientRect(), true);
    }
  }

  function setGlobalExpanded(value) {
    const next = Boolean(value);
    const changed = next !== globalExpanded;
    globalExpanded = next;
    try {
      win.localStorage?.setItem(EXPANDED_STORAGE_KEY, String(globalExpanded));
    } catch {
      // 忽略存储限制
    }
    for (const inst of instances.values()) {
      inst.syncExpanded(changed);
    }
  }

  function createInstance(inputBoxEl) {
    let copy = selectCopy(win, doc);
    let conversationId = null;
    let openKind = null;
    let panel = null;
    let collapseTimer = null;
    let collapsing = false;
    const activeAnimations = new Set();

    function prefersReducedMotion() {
      try {
        return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }

    function clearMotion() {
      if (collapseTimer != null) {
        win.clearTimeout?.(collapseTimer);
        collapseTimer = null;
      }
      for (const anim of activeAnimations) {
        try {
          anim.cancel();
        } catch {
          // ignore
        }
      }
      activeAnimations.clear();
      for (const prop of ['position', 'left', 'top', 'width', 'pointerEvents']) {
        bar.style[prop] = '';
      }
    }

    function playAnim(node, keyframes, options) {
      if (!node || typeof node.animate !== 'function') return null;
      try {
        const anim = node.animate(keyframes, options);
        if (anim) activeAnimations.add(anim);
        return anim;
      } catch {
        return null;
      }
    }

    const bar = doc.createElement('div');
    bar.setAttribute('data-ag-ss-bar', 'true');
    bar.setAttribute('data-my-antigravity-no-i18n', 'true');
    bar.hidden = true;

    const buttons = {};
    for (const kind of ['statistics', 'usage', 'context']) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-ag-ss-kind', kind);
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      if (kind === 'context') {
        btn.append(createContextRing(doc));
      } else {
        btn.insertAdjacentHTML('beforeend', ICONS[kind]);
      }
      const label = doc.createElement('span');
      label.className = 'ag-ss-label';
      btn.append(label);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(kind, btn);
      });
      buttons[kind] = { btn, label };
      bar.append(btn);
    }

    const collapseBtn = doc.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.setAttribute('data-ag-ss-action', 'collapse');
    collapseBtn.setAttribute('aria-label', copy.collapseAria);
    collapseBtn.innerHTML = ICONS.chevronUp;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopover();
      hideTooltip();
      setGlobalExpanded(false);
    });
    bar.append(collapseBtn);

    const triggerBtn = doc.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.setAttribute('data-ag-ss-trigger', 'true');
    triggerBtn.setAttribute('data-my-antigravity-no-i18n', 'true');
    triggerBtn.setAttribute('aria-label', copy.expandAria);
    triggerBtn.hidden = true;
    triggerBtn.append(createContextRing(doc));

    function showTriggerTooltip() {
      const snap = getSnapshot();
      const pct = snap.contextPercent;
      const lines = [
        [copy.ctxWindowTitle, true],
        [pct == null ? '—' : copy.ctxUsedTpl(pct), false],
      ];
      if (snap.contextUsedTokens != null && snap.contextWindow != null) {
        lines.push([
          copy.ctxTokensTpl(
            formatCompactTokens(snap.contextUsedTokens),
            formatCompactTokens(snap.contextWindow),
          ),
          false,
        ]);
      }
      showTooltip(triggerBtn, lines);
    }

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideTooltip();
      setGlobalExpanded(true);
    });
    triggerBtn.addEventListener('pointerenter', showTriggerTooltip);
    triggerBtn.addEventListener('focus', showTriggerTooltip);
    triggerBtn.addEventListener('pointerleave', hideTooltip);
    triggerBtn.addEventListener('blur', hideTooltip);

    // 复用 TPS Info 按钮，避免刷新浮窗时丢失鼠标悬停态
    const tpsInfoBtn = doc.createElement('button');
    tpsInfoBtn.type = 'button';
    tpsInfoBtn.className = 'ag-ss-tps-info';
    tpsInfoBtn.setAttribute('aria-label', copy.speedHelpAria);
    tpsInfoBtn.innerHTML = ICONS.info;

    function showTpsTooltip() {
      const snap = getSnapshot();
      const text =
        snap.observedTps == null
          ? copy.speedTipEmpty
          : snap.speedSource === 'step-timing'
            ? copy.speedTipStepTiming
            : copy.speedTipOk;
      showTooltip(tpsInfoBtn, [[text, false]]);
    }
    tpsInfoBtn.addEventListener('pointerenter', showTpsTooltip);
    tpsInfoBtn.addEventListener('focus', showTpsTooltip);
    tpsInfoBtn.addEventListener('pointerleave', hideTooltip);
    tpsInfoBtn.addEventListener('blur', hideTooltip);

    function getSnapshot() {
      return buildStatusSnapshot(conversationId ? store.get(conversationId) : null);
    }

    function mountAnchors() {
      if (!bar.isConnected || bar.parentElement !== inputBoxEl) {
        const card = inputBoxEl.querySelector('#antigravity\\.agentSidePanelInputBox, .surface-composer');
        if (card && card.parentElement === inputBoxEl) {
          card.insertAdjacentElement('afterend', bar);
        } else {
          inputBoxEl.append(bar);
        }
      }
      const footerRight = inputBoxEl.querySelector('.agy-composer-footer > div:last-child');
      if (footerRight && (!triggerBtn.isConnected || triggerBtn.parentElement !== footerRight)) {
        footerRight.insertBefore(triggerBtn, footerRight.firstChild);
      }
    }

    function closePopover(animateExit = false) {
      openKind = null;
      if (tooltipOwner === tpsInfoBtn) hideTooltip();
      if (panel) {
        const closingPanel = panel;
        panel = null;
        if (animateExit && typeof closingPanel.animate === 'function' && !prefersReducedMotion()) {
          try {
            const anim = closingPanel.animate(
              [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(4px) scale(0.98)' },
              ],
              { duration: 110, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
            );
            const done = () => closingPanel.remove();
            if (anim && typeof anim.finished?.then === 'function') {
              anim.finished.then(done, done);
            } else {
              win.setTimeout ? win.setTimeout(done, 110) : done();
            }
          } catch {
            closingPanel.remove();
          }
        } else {
          closingPanel.remove();
        }
      }
      for (const k of Object.keys(buttons)) {
        buttons[k].btn.setAttribute('aria-expanded', 'false');
      }
    }

    function renderPopoverContent() {
      if (!panel || !openKind) return;
      const snap = getSnapshot();
      panel.replaceChildren();

      const h3 = doc.createElement('h3');
      if (openKind === 'context') {
        const ring = createContextRing(doc);
        updateRing(ring, snap.contextPercent);
        h3.append(ring);
      } else {
        h3.insertAdjacentHTML('beforeend', ICONS[openKind]);
      }
      const titleSpan = doc.createElement('span');
      titleSpan.textContent = copy[openKind];
      h3.append(titleSpan);
      panel.append(h3);

      const dl = doc.createElement('dl');
      if (openKind === 'statistics') {
        dl.append(
          ...createRow(doc, copy.turns, snap.turns == null ? '—' : formatNumber(snap.turns)),
          ...createRow(doc, copy.modelSteps, snap.steps == null ? '—' : formatNumber(snap.steps)),
        );
        if (snap.trajectorySteps != null && snap.trajectorySteps !== snap.steps) {
          dl.append(...createRow(doc, copy.trajectorySteps, formatNumber(snap.trajectorySteps)));
        }
        dl.append(
          ...createRow(doc, copy.firstToken, formatDurationMs(snap.averageFirstTokenMs)),
          ...createRow(
            doc,
            copy.averageSpeed,
            snap.averageTps == null ? '—' : `${formatNumber(snap.averageTps)} tok/s`,
          ),
        );
        const tpsWrap = doc.createElement('span');
        tpsWrap.textContent = copy.latestSpeed;
        const labelSpan = doc.createElement('span');
        labelSpan.style.display = 'inline-flex';
        labelSpan.style.alignItems = 'center';
        labelSpan.style.gap = '5px';
        labelSpan.append(tpsWrap, tpsInfoBtn);
        dl.append(
          ...createRow(
            doc,
            '',
            snap.observedTps == null ? '—' : `${formatNumber(snap.observedTps)} tok/s`,
            { labelNode: labelSpan },
          ),
        );
        if (snap.modelName) {
          const divider = doc.createElement('div');
          divider.className = 'ag-ss-divider';
          dl.append(divider, ...createRow(doc, copy.model, snap.modelName));
        }
      } else if (openKind === 'usage') {
        dl.append(...createRow(doc, copy.total, formatCompactTokens(snap.totalTokens)));

        const mixBar = doc.createElement('div');
        mixBar.className = 'ag-ss-bar ag-ss-mix-bar';
        const total = snap.totalTokens || 0;
        if (total > 0) {
          for (const [val, tone] of [
            [snap.outputTokens || 0, 'purple'],
            [snap.inputTokens || 0, 'blue'],
            [snap.cachedInputTokens || 0, 'green'],
          ]) {
            if (val <= 0) continue;
            const seg = doc.createElement('span');
            seg.dataset.tone = tone;
            seg.style.width = `${(val / total) * 100}%`;
            mixBar.append(seg);
          }
        }
        dl.append(mixBar);

        dl.append(
          ...createRow(doc, copy.output, formatCompactTokens(snap.outputTokens), { tone: 'purple' }),
          ...createRow(doc, copy.uncachedInput, formatCompactTokens(snap.inputTokens), { tone: 'blue' }),
          ...createRow(doc, copy.cachedInput, formatCompactTokens(snap.cachedInputTokens), { tone: 'green' }),
        );
        if (snap.thinkingTokens > 0 || snap.responseTokens > 0) {
          dl.append(
            ...createRow(
              doc,
              `  ${copy.thinking} / ${copy.response}`,
              `${formatCompactTokens(snap.thinkingTokens)} / ${formatCompactTokens(snap.responseTokens)}`,
            ),
          );
        }

        const divider = doc.createElement('div');
        divider.className = 'ag-ss-divider';
        dl.append(divider, ...createRow(doc, copy.cacheDetail, formatCachePercent(snap.cacheHitPercent)));

        const costStr = formatUsd(snap.estimatedCostUsd);
        if (costStr) {
          dl.append(...createRow(doc, copy.estimatedCost, costStr));
        }
        const subCostStr = formatUsd(snap.subagentCostUsd);
        if (subCostStr) {
          dl.append(...createRow(doc, copy.subagentCost, subCostStr));
        }
      } else if (openKind === 'context') {
        const head = doc.createElement('div');
        head.className = 'ag-ss-bar-head';
        const headL = doc.createElement('span');
        headL.textContent = copy.contextShare;
        const headR = doc.createElement('span');
        headR.textContent = snap.contextPercent == null ? '—' : `${snap.contextPercent}%`;
        head.append(headL, headR);
        panel.append(head);

        const barEl = doc.createElement('div');
        barEl.className = 'ag-ss-bar';
        const max = snap.contextWindow || 0;
        const used = snap.contextUsedTokens || 0;
        if (max > 0 && used > 0) {
          const totalPct = Math.min(100, (used / max) * 100);
          if (snap.contextGroups) {
            const g = snap.contextGroups;
            const sum = g.systemAndTools + g.messages + g.subagents + g.other;
            const denom = sum > 0 ? sum : used;
            for (const [val, tone] of [
              [g.systemAndTools, 'purple'],
              [g.messages, 'blue'],
              [g.subagents, 'green'],
              [g.other, 'muted'],
            ]) {
              if (val <= 0) continue;
              const seg = doc.createElement('span');
              seg.dataset.tone = tone;
              seg.style.width = `${(val / denom) * totalPct}%`;
              barEl.append(seg);
            }
          } else {
            const seg = doc.createElement('span');
            seg.dataset.tone = 'blue';
            seg.style.width = `${totalPct}%`;
            barEl.append(seg);
          }
        }
        panel.append(barEl);

        if (snap.contextGroups) {
          const g = snap.contextGroups;
          if (g.systemAndTools > 0) {
            dl.append(...createRow(doc, copy.systemAndTools, formatCompactTokens(g.systemAndTools), { tone: 'purple' }));
          }
          if (g.messages > 0) {
            dl.append(...createRow(doc, copy.messages, formatCompactTokens(g.messages), { tone: 'blue' }));
          }
          if (g.subagents > 0) {
            dl.append(...createRow(doc, copy.subagents, formatCompactTokens(g.subagents), { tone: 'green' }));
          }
          if (g.other > 0) {
            dl.append(...createRow(doc, copy.other, formatCompactTokens(g.other), { tone: 'muted' }));
          }
          const divider = doc.createElement('div');
          divider.className = 'ag-ss-divider';
          dl.append(divider);
        }

        dl.append(
          ...createRow(doc, copy.sum, formatCompactTokens(snap.contextUsedTokens)),
          ...createRow(doc, copy.capacity, formatCompactTokens(snap.contextWindow)),
          ...createRow(doc, copy.compactions, formatNumber(snap.compactions)),
        );
      }

      panel.append(dl);
      const anchor = buttons[openKind]?.btn;
      if (anchor && typeof anchor.getBoundingClientRect === 'function') {
        positionFloating(win, panel, anchor.getBoundingClientRect(), true);
      }
    }

    function togglePopover(kind, btn) {
      if (openKind === kind && panel) {
        closePopover();
        return;
      }
      closePopover();
      if (!doc.body) return;
      openKind = kind;
      btn.setAttribute('aria-expanded', 'true');
      panel = doc.createElement('div');
      panel.className = 'surface-glass';
      panel.setAttribute('data-ag-ss-popover', 'true');
      panel.setAttribute('data-my-antigravity-no-i18n', 'true');
      panel.setAttribute('role', 'dialog');
      panel.addEventListener('click', (e) => e.stopPropagation());
      doc.body.append(panel);
      renderPopoverContent();
      if (typeof panel.animate === 'function' && !prefersReducedMotion()) {
        try {
          panel.animate(
            [
              { opacity: 0, transform: 'translateY(5px) scale(0.98)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            { duration: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
          );
        } catch {
          // ignore
        }
      }
    }

    function syncExpanded(animateChange = false) {
      const visible = isElementVisible(win, inputBoxEl);
      const hasSession = Boolean(conversationId);
      const active = visible && hasSession;

      const shouldAnimate =
        animateChange &&
        active &&
        typeof bar.animate === 'function' &&
        !prefersReducedMotion();

      if (!shouldAnimate) {
        if (active && !animateChange && collapseTimer != null) {
          // 展开/收起动画进行中收到数据刷新时，不打断当前动画
          return;
        }
        collapsing = false;
        clearMotion();
        bar.hidden = !(active && globalExpanded);
        triggerBtn.hidden = !(active && !globalExpanded);
      } else {
        const card = inputBoxEl.querySelector('#antigravity\\.agentSidePanelInputBox, .surface-composer');
        const footerRight = inputBoxEl.querySelector('.agy-composer-footer > div:last-child');
        const cardBefore = card?.getBoundingClientRect?.();
        const controlsBefore = footerRight?.getBoundingClientRect?.();
        const barBefore = bar.getBoundingClientRect?.();
        let currentOpacity = globalExpanded ? 0 : 1;
        if (!bar.hidden && typeof win.getComputedStyle === 'function') {
          const parsed = Number.parseFloat(win.getComputedStyle(bar).opacity);
          if (Number.isFinite(parsed)) currentOpacity = parsed;
        }

        clearMotion();
        collapsing = !globalExpanded;

        if (collapsing && barBefore && barBefore.width > 0) {
          // 收起时先把状态栏临时抽离文档流，让输入卡片一次到位并记录目标坐标，再做 FLIP 位移衔接
          bar.style.position = 'fixed';
          bar.style.left = `${barBefore.left}px`;
          bar.style.top = `${barBefore.top}px`;
          bar.style.width = `${barBefore.width}px`;
          bar.style.pointerEvents = 'none';
          bar.hidden = false;
        } else {
          bar.hidden = !globalExpanded;
        }
        triggerBtn.hidden = globalExpanded;

        const duration = globalExpanded ? 220 : 160;
        const animOpts = { duration, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' };

        if (card && cardBefore && typeof card.getBoundingClientRect === 'function') {
          const cardAfter = card.getBoundingClientRect();
          const dy = cardBefore.top - cardAfter.top;
          if (Math.abs(dy) > 0.5) {
            playAnim(card, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], animOpts);
          }
        }

        if (footerRight && controlsBefore && typeof footerRight.getBoundingClientRect === 'function') {
          const controlsAfter = footerRight.getBoundingClientRect();
          const dx = controlsBefore.left - controlsAfter.left;
          if (Math.abs(dx) > 0.5) {
            playAnim(footerRight, [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], animOpts);
          }
        }

        const barAfter = bar.getBoundingClientRect?.();
        const startOffset =
          globalExpanded && barBefore && barBefore.height > 0 && barAfter
            ? barBefore.top - barAfter.top
            : globalExpanded
              ? -4
              : 0;
        playAnim(
          bar,
          [
            { opacity: currentOpacity, transform: `translateY(${startOffset}px)` },
            { opacity: globalExpanded ? 1 : 0, transform: `translateY(${globalExpanded ? 0 : -4}px)` },
          ],
          animOpts,
        );

        if (!globalExpanded) {
          playAnim(
            triggerBtn,
            [
              { opacity: 0, transform: 'scale(0.84)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            animOpts,
          );
        }

        const settle = () => {
          collapsing = false;
          const stillActive = isElementVisible(win, inputBoxEl) && Boolean(conversationId);
          bar.hidden = !(stillActive && globalExpanded);
          triggerBtn.hidden = !(stillActive && !globalExpanded);
          clearMotion();
        };
        if (typeof win.setTimeout === 'function') {
          collapseTimer = win.setTimeout(settle, duration);
        } else {
          settle();
        }
      }

      if (!active || !globalExpanded) {
        closePopover(!active ? false : animateChange);
      }
      if (!active && tooltipOwner === triggerBtn) {
        hideTooltip();
      }
    }

    function update() {
      copy = selectCopy(win, doc);
      collapseBtn.setAttribute('aria-label', copy.collapseAria);
      triggerBtn.setAttribute('aria-label', copy.expandAria);
      tpsInfoBtn.setAttribute('aria-label', copy.speedHelpAria);

      mountAnchors();

      const info = inspectComposerFiber(inputBoxEl);
      const nextCid = info.inExistingConversation && info.conversationId ? info.conversationId : null;
      if (nextCid !== conversationId) {
        conversationId = nextCid;
        closePopover();
      }

      if (conversationId && !store.has(conversationId) && info.stateManager) {
        try {
          const raw = info.stateManager.peek(conversationId)?.getState?.();
          if (raw) {
            onHydrateState?.(raw);
          }
        } catch {
          // 忽略 Fiber 读取异常
        }
      }

      if (conversationId) {
        onNeedBackfill?.(conversationId, store.get(conversationId));
      }

      const snap = getSnapshot();
      const turnsTxt = snap.turns == null ? '—' : formatNumber(snap.turns);
      const stepsTxt = snap.steps == null ? '—' : formatNumber(snap.steps);
      const tpsTxt = snap.observedTps == null ? '—' : `${formatNumber(snap.observedTps)} tok/s`;
      buttons.statistics.label.textContent = `${turnsTxt} ${copy.turns} ${stepsTxt} ${copy.steps} · ${tpsTxt}`;

      const tokTxt = formatCompactTokens(snap.totalTokens);
      const cacheTxt = formatCachePercent(snap.cacheHitPercent);
      buttons.usage.label.textContent = `${tokTxt} · ${copy.cache} ${cacheTxt}`;

      const ctxPct = snap.contextPercent;
      buttons.context.label.textContent = ctxPct == null ? '—' : `${ctxPct}%`;
      updateRing(buttons.context.btn.querySelector('svg'), ctxPct);
      updateRing(triggerBtn.querySelector('svg'), ctxPct);

      syncExpanded();
      if (panel && openKind) {
        renderPopoverContent();
      }
      if (!tooltip.hidden && tooltipOwner === triggerBtn) {
        showTriggerTooltip();
      }
    }

    function destroy() {
      clearMotion();
      closePopover(false);
      if (tooltipOwner === triggerBtn) hideTooltip();
      bar.remove();
      triggerBtn.remove();
    }

    return {
      getConversationId: () => conversationId,
      syncExpanded,
      update,
      destroy,
      closePopover,
    };
  }

  function scanComposers() {
    const boxes = doc.querySelectorAll('[data-testid="agent-input-box"]');
    const seen = new Set();
    for (const box of boxes) {
      seen.add(box);
      let inst = instances.get(box);
      if (!inst) {
        inst = createInstance(box);
        instances.set(box, inst);
      }
      inst.update();
    }
    for (const [box, inst] of instances.entries()) {
      if (!seen.has(box) || !box.isConnected) {
        inst.destroy();
        instances.delete(box);
      }
    }
  }

  function refreshConversation(_conversationId) {
    for (const inst of instances.values()) {
      inst.update();
    }
  }

  function handleDocPointerDown(event) {
    const target = event.target;
    if (target && typeof target.closest === 'function') {
      if (target.closest('[data-ag-ss-popover], [data-ag-ss-bar] button, [data-ag-ss-trigger]')) {
        return;
      }
    }
    for (const inst of instances.values()) {
      inst.closePopover(true);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      for (const inst of instances.values()) {
        inst.closePopover(true);
      }
      hideTooltip();
    }
  }

  function handleStorage(event) {
    if (event.key !== EXPANDED_STORAGE_KEY) return;
    globalExpanded = event.newValue !== 'false';
    for (const inst of instances.values()) {
      inst.syncExpanded();
    }
  }

  doc.addEventListener('pointerdown', handleDocPointerDown, true);
  win.addEventListener('keydown', handleKeyDown, true);
  win.addEventListener('storage', handleStorage);

  return {
    scanComposers,
    refreshConversation,
    getInstances: () => instances,
    destroy() {
      doc.removeEventListener('pointerdown', handleDocPointerDown, true);
      win.removeEventListener('keydown', handleKeyDown, true);
      win.removeEventListener('storage', handleStorage);
      for (const inst of instances.values()) inst.destroy();
      instances.clear();
      tooltip.remove();
    },
  };
}
