/**
 * quota-rings 前端 UI 控制器：
 * 在左下角原生「设置 (Settings)」右侧渲染两个 22×22px 中性灰额度环
 * （左：其它模型圆角方形；右：Gemini 圆形），支持 1:3 双窗分段、悬停摘要与点击直达模型配额设置。
 */
import { formatResetTime } from './quota-core.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const COPY = {
  'zh-CN': {
    geminiLabel: 'Gemini 配额',
    otherLabel: '其它模型配额',
    fiveHour: '5 小时额度',
    weekly: '周额度',
    resetIn: '重置时间',
    openSettingsDesc: '点击打开设置中的模型配额页面',
    morePools: (n) => `另有 ${n} 组模型`,
  },
  en: {
    geminiLabel: 'Gemini Quota',
    otherLabel: 'Other Models',
    fiveHour: '5h Limit',
    weekly: 'Weekly Limit',
    resetIn: 'Reset in',
    openSettingsDesc: 'Open Models & Quota settings',
    morePools: (n) => `+${n} more model pools`,
  },
};

const SETTINGS_TEXT_RE = /^(?:open\s+)?settings$|^设置$|^打开设置$/i;
const MODELS_TAB_RE = /^(?:models|models\s*&\s*usage|模型|模型与用量)$/i;
const SETTINGS_SIBLING_TAB_RE =
  /^(?:general|appearance|account|browser|agents|notifications|customizations|app|shortcuts|developer|running|通用|外观|账号|浏览器|通知|自定义扩展|应用|快捷键|开发者|运行中)$/i;
const QUOTA_HEADING_RE = /^(?:model\s+quota|models\s*&\s*usage|模型配额|模型与用量)$/i;

function selectCopy(win, doc) {
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if ((win && win.__myAntigravityZhCnInstalled) || htmlLang.startsWith('zh')) {
    return COPY['zh-CN'];
  }
  return COPY.en;
}

function getNormalizedText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function isInIgnoredContainer(el) {
  return Boolean(
    el?.closest?.(
      '[data-ag-qr-root], [data-ag-qr-tooltip], [role="menu"], [role="dialog"], [role="tabpanel"], [data-testid="agent-input-box"]',
    ),
  );
}

/**
 * 在左侧边栏底部定位原生「Settings / 设置」按钮。
 */
export function findSettingsButton(doc, win) {
  if (!doc?.querySelectorAll) return null;
  const direct = doc.querySelector?.('[data-testid="settings-button"]');
  if (direct && !isInIgnoredContainer(direct)) {
    return direct;
  }
  const candidates = [...doc.querySelectorAll('button, [role="button"], a')];
  const innerH = Number(win?.innerHeight) || 800;

  let best = null;
  let bestScore = -1;

  for (const el of candidates) {
    if (isInIgnoredContainer(el)) continue;
    const text = getNormalizedText(el);
    const aria = String(el.getAttribute?.('aria-label') || '').trim();
    if (!SETTINGS_TEXT_RE.test(text) && !SETTINGS_TEXT_RE.test(aria)) continue;

    let score = 1;
    // Antigravity 新版图标可能渲染为 <span class="google-symbols"> 或 <svg>
    if (el.querySelector?.('svg, .google-symbols')) score += 3;
    if (el.closest?.('aside, nav, [data-testid*="sidebar"]')) score += 2;

    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        if (rect.left >= 0 && rect.left < 360) score += 2;
        if (rect.top >= innerH * 0.45) score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function findModelsTabElement(doc) {
  if (!doc?.querySelectorAll) return null;
  const direct = doc.querySelector?.('[data-testid="settings-nav-item-Models"]');
  if (direct && !direct.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip], [data-testid="agent-input-box"]')) {
    return direct;
  }
  const items = [...doc.querySelectorAll('button, [role="tab"], [role="menuitem"], a')];
  for (const el of items) {
    if (el.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip], [data-testid="agent-input-box"]')) {
      continue;
    }
    const text = getNormalizedText(el);
    if (!MODELS_TAB_RE.test(text)) continue;
    // 确认附近同一导航容器内存在其它设置分类标签（General/Account 等），避免误点聊天区模型选择按钮
    const navParent = el.parentElement?.parentElement || el.parentElement;
    const siblings = navParent ? [...navParent.querySelectorAll('button, [role="tab"], a')] : [];
    const looksLikeSettingsNav = siblings.some((s) => SETTINGS_SIBLING_TAB_RE.test(getNormalizedText(s)));
    if (looksLikeSettingsNav) {
      return el;
    }
  }
  return null;
}

function scrollQuotaSectionIntoView(doc) {
  if (!doc?.querySelectorAll) return;
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, div, span')];
  for (const el of headings) {
    if (el.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip]')) continue;
    if (el.children?.length > 2) continue;
    const text = getNormalizedText(el);
    if (QUOTA_HEADING_RE.test(text)) {
      el.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      return;
    }
  }
}

function createSvgNode(doc, tag, attrs = {}) {
  const node = doc.createElementNS ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  if (tag === 'path' || tag === 'circle' || tag === 'rect') {
    node.setAttribute('vector-effect', 'non-scaling-stroke');
  }
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

function describeCircleArc(startDeg, endDeg, clockwise) {
  const r = 14;
  const toPt = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [16 + r * Math.cos(rad), 16 + r * Math.sin(rad)];
  };
  const from = toPt(startDeg);
  const to = toPt(endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${from[0].toFixed(3)} ${from[1].toFixed(3)} A ${r} ${r} 0 ${largeArc} ${clockwise ? 1 : 0} ${to[0].toFixed(3)} ${to[1].toFixed(3)}`;
}

// 圆角方形路径（viewBox 32×32，中心盒 [2..30]×[2..30]，圆角半径 7）
const SQUARE_FULL_TRACK_D =
  'M 16 2 H 23 A 7 7 0 0 1 30 9 V 23 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 2 23 V 9 A 7 7 0 0 1 9 2 Z';
// 1:3 分割（切割点上移至底角 52° 处，左右各退让 24°）：
// 上方 3/4 弧从右下角侧逆时针绕至左下角侧（配合真实弧长切片从左下切口开始扣减，避免 non-scaling-stroke + pathLength 缩放偏差）
const SQUARE_TOP_THREE_QUARTER_D =
  'M 29.79 24.69 A 7 7 0 0 0 30 23 V 9 A 7 7 0 0 0 23 2 H 9 A 7 7 0 0 0 2 9 V 23 A 7 7 0 0 0 2.21 24.69';
// 下方 1/4 弧顺着左右底角自然弯曲（约 20.8 单位长，与上方 67.4 单位形成 1:3 比例），从右向左绘制
const SQUARE_BOTTOM_LINE_D =
  'M 26.29 29.18 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 5.71 29.18';

function segLine(x1, y1, x2, y2) {
  return { type: 'line', x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) };
}

function segArc(cx, cy, r, a1Deg, a2Deg, sweep) {
  return {
    type: 'arc',
    cx,
    cy,
    r,
    a1Deg,
    a2Deg,
    sweep,
    len: (r * Math.abs(a2Deg - a1Deg) * Math.PI) / 180,
  };
}

function pointOnArc(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/**
 * 按真实弧长百分比截取分段路径（直线 + 圆弧），彻底规避 Chromium 下
 * `vector-effect="non-scaling-stroke"` 与 `pathLength` 叠加造成的虚线长度缩放偏差。
 */
export function sliceSegmentedPath(segments, percent) {
  if (!Array.isArray(segments) || segments.length === 0 || !(percent > 0)) return '';
  const frac = Math.max(0, Math.min(1, percent / 100));
  const totalLen = segments.reduce((sum, s) => sum + s.len, 0);
  if (!(totalLen > 0)) return '';

  let remaining = totalLen * frac;
  const first = segments[0];
  const [startX, startY] =
    first.type === 'line' ? [first.x1, first.y1] : pointOnArc(first.cx, first.cy, first.r, first.a1Deg);
  const parts = [`M ${startX.toFixed(2)} ${startY.toFixed(2)}`];

  for (const seg of segments) {
    if (remaining <= 1e-6) break;
    const take = Math.min(remaining, seg.len);
    const t = take / seg.len;
    if (seg.type === 'line') {
      const ex = seg.x1 + (seg.x2 - seg.x1) * t;
      const ey = seg.y1 + (seg.y2 - seg.y1) * t;
      parts.push(`L ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    } else {
      const endDeg = seg.a1Deg + (seg.a2Deg - seg.a1Deg) * t;
      const [ex, ey] = pointOnArc(seg.cx, seg.cy, seg.r, endDeg);
      const largeArc = Math.abs(endDeg - seg.a1Deg) > 180 ? 1 : 0;
      parts.push(`A ${seg.r} ${seg.r} 0 ${largeArc} ${seg.sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    }
    remaining -= take;
  }
  return parts.join(' ');
}

const SQUARE_TOP_SEGMENTS = [
  segArc(23, 23, 7, 14, 0, 0),
  segLine(30, 23, 30, 9),
  segArc(23, 9, 7, 0, -90, 0),
  segLine(23, 2, 9, 2),
  segArc(9, 9, 7, -90, -180, 0),
  segLine(2, 9, 2, 23),
  segArc(9, 23, 7, 180, 166, 0),
];

const SQUARE_BOTTOM_SEGMENTS = [
  segArc(23, 23, 7, 62, 90, 1),
  segLine(23, 30, 9, 30),
  segArc(9, 23, 7, 90, 118, 1),
];

const SQUARE_FULL_SEGMENTS = [
  segLine(16, 2, 23, 2),
  segArc(23, 9, 7, -90, 0, 1),
  segLine(30, 9, 30, 23),
  segArc(23, 23, 7, 0, 90, 1),
  segLine(23, 30, 9, 30),
  segArc(9, 23, 7, 90, 180, 1),
  segLine(2, 23, 2, 9),
  segArc(9, 9, 7, 180, 270, 1),
  segLine(9, 2, 16, 2),
];

/**
 * 为指定分组（'other' 圆角方形 / 'gemini' 圆形）绘制 22×22px SVG 环与居中数字。
 */
export function buildRingContent(doc, shape, data) {
  const svg = createSvgNode(doc, 'svg', {
    viewBox: '0 0 32 32',
    class: 'ag-qr-svg',
    'aria-hidden': 'true',
  });

  const isDual = data.mode === 'dual' && data.fiveHour != null && data.weekly != null;

  if (shape === 'square') {
    if (isDual) {
      // 上方 3/4（5 小时额度）
      const gTop = createSvgNode(doc, 'g', {
        'data-window': 'fiveHour',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gTop.appendChild(createSvgNode(doc, 'path', { d: SQUARE_TOP_THREE_QUARTER_D, class: 'ag-qr-track' }));
      if (data.fiveHour > 0) {
        const d = data.fiveHour >= 100 ? SQUARE_TOP_THREE_QUARTER_D : sliceSegmentedPath(SQUARE_TOP_SEGMENTS, data.fiveHour);
        gTop.appendChild(createSvgNode(doc, 'path', { d, class: 'ag-qr-fill' }));
      }
      svg.appendChild(gTop);

      // 下方 1/4 底边线（周额度）
      const gBottom = createSvgNode(doc, 'g', {
        'data-window': 'weekly',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gBottom.appendChild(createSvgNode(doc, 'path', { d: SQUARE_BOTTOM_LINE_D, class: 'ag-qr-track' }));
      if (data.weekly > 0) {
        const d = data.weekly >= 100 ? SQUARE_BOTTOM_LINE_D : sliceSegmentedPath(SQUARE_BOTTOM_SEGMENTS, data.weekly);
        gBottom.appendChild(createSvgNode(doc, 'path', { d, class: 'ag-qr-fill' }));
      }
      svg.appendChild(gBottom);
    } else {
      const gSingle = createSvgNode(doc, 'g', {
        'data-window': 'single',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gSingle.appendChild(createSvgNode(doc, 'path', { d: SQUARE_FULL_TRACK_D, class: 'ag-qr-track' }));
      if (data.primary > 0) {
        const d = data.primary >= 100 ? SQUARE_FULL_TRACK_D : sliceSegmentedPath(SQUARE_FULL_SEGMENTS, data.primary);
        gSingle.appendChild(createSvgNode(doc, 'path', { d, class: 'ag-qr-fill' }));
      }
      svg.appendChild(gSingle);
    }
  } else {
    // 圆形（Gemini）
    if (isDual) {
      // 上方 3/4 扇区：237° -> 483° 顺时针（5 小时）
      const gTop = createSvgNode(doc, 'g', {
        'data-window': 'fiveHour',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gTop.appendChild(
        createSvgNode(doc, 'path', { d: describeCircleArc(237, 483, true), class: 'ag-qr-track' }),
      );
      if (data.fiveHour > 0) {
        const start = 237 + (483 - 237) * (1 - data.fiveHour / 100);
        gTop.appendChild(
          createSvgNode(doc, 'path', { d: describeCircleArc(start, 483, true), class: 'ag-qr-fill' }),
        );
      }
      svg.appendChild(gTop);

      // 下方约 90° 扇区：213° -> 147° 逆时针（周额度）
      const gBottom = createSvgNode(doc, 'g', {
        'data-window': 'weekly',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gBottom.appendChild(
        createSvgNode(doc, 'path', { d: describeCircleArc(213, 147, false), class: 'ag-qr-track' }),
      );
      if (data.weekly > 0) {
        const start = 213 + (147 - 213) * (1 - data.weekly / 100);
        gBottom.appendChild(
          createSvgNode(doc, 'path', { d: describeCircleArc(start, 147, false), class: 'ag-qr-fill' }),
        );
      }
      svg.appendChild(gBottom);
    } else {
      const gSingle = createSvgNode(doc, 'g', {
        'data-window': 'single',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gSingle.appendChild(createSvgNode(doc, 'circle', { cx: 16, cy: 16, r: 14, class: 'ag-qr-track' }));
      if (data.primary >= 100) {
        gSingle.appendChild(createSvgNode(doc, 'circle', { cx: 16, cy: 16, r: 14, class: 'ag-qr-fill' }));
      } else if (data.primary > 0) {
        gSingle.appendChild(
          createSvgNode(doc, 'path', {
            d: describeCircleArc(0, (360 * data.primary) / 100, true),
            class: 'ag-qr-fill',
          }),
        );
      }
      svg.appendChild(gSingle);
    }
  }

  const num = doc.createElement('span');
  num.className = 'ag-qr-number';
  const numText = String(data.primary);
  num.textContent = numText;
  num.setAttribute('data-digits', String(numText.length));
  return [svg, num];
}

function appendTooltipRow(doc, parent, label, value, isMuted = false) {
  const dt = doc.createElement('dt');
  dt.textContent = label;
  if (isMuted) dt.className = 'ag-qr-tip-muted';
  const dd = doc.createElement('dd');
  dd.textContent = value;
  if (isMuted) dd.className = 'ag-qr-tip-muted';
  parent.appendChild(dt);
  parent.appendChild(dd);
}

function renderTooltipContent(doc, tooltipEl, groupKey, data, copy) {
  const dl = doc.createElement('dl');
  const title = groupKey === 'gemini' ? copy.geminiLabel : copy.otherLabel;

  if (data.mode === 'dual' && data.fiveHour != null && data.weekly != null) {
    const gTitle = doc.createElement('div');
    gTitle.className = 'ag-qr-tip-group';
    appendTooltipRow(doc, gTitle, title, '');
    dl.appendChild(gTitle);

    const gFive = doc.createElement('div');
    gFive.className = 'ag-qr-tip-group ag-qr-tip-sep';
    appendTooltipRow(doc, gFive, copy.fiveHour, `${data.fiveHour}%`);
    const fhReset = formatResetTime(data.resetAt?.fiveHour);
    if (fhReset) appendTooltipRow(doc, gFive, copy.resetIn, fhReset, true);
    dl.appendChild(gFive);

    const gWeek = doc.createElement('div');
    gWeek.className = 'ag-qr-tip-group ag-qr-tip-sep';
    appendTooltipRow(doc, gWeek, copy.weekly, `${data.weekly}%`);
    const wkReset = formatResetTime(data.resetAt?.weekly);
    if (wkReset) appendTooltipRow(doc, gWeek, copy.resetIn, wkReset, true);
    dl.appendChild(gWeek);
  } else {
    const gMain = doc.createElement('div');
    gMain.className = 'ag-qr-tip-group';
    appendTooltipRow(doc, gMain, title, `${data.primary}%`);
    const singleReset = formatResetTime(data.resetAt?.single);
    if (singleReset) appendTooltipRow(doc, gMain, copy.resetIn, singleReset, true);
    dl.appendChild(gMain);

    // 若组内存在多个不同配额子池（如 Pro 与 Flash 比例不同），补充精简明细
    if (Array.isArray(data.buckets) && data.buckets.length > 1) {
      const gSub = doc.createElement('div');
      gSub.className = 'ag-qr-tip-group ag-qr-tip-sep';
      const maxRows = 4;
      const shown = data.buckets.slice(0, maxRows);
      for (const b of shown) {
        const names = b.models.slice(0, 2).join(' / ') + (b.models.length > 2 ? '…' : '');
        appendTooltipRow(doc, gSub, names || title, `${b.remainingPercent}%`, true);
      }
      if (data.buckets.length > maxRows) {
        appendTooltipRow(doc, gSub, copy.morePools(data.buckets.length - maxRows), '', true);
      }
      dl.appendChild(gSub);
    }
  }

  tooltipEl.replaceChildren(dl);
}

export function createQuotaRingsController(win, doc, { onRefreshRequested } = {}) {
  let snapshot = { gemini: null, other: null, available: false };
  let rootEl = null;
  let otherBtn = null;
  let geminiBtn = null;
  let tooltipEl = null;
  let currentHostEl = null;
  let currentSettingsBtn = null;
  let currentMountMode = null;
  let hoverTimer = null;
  let activeTipGroup = null;
  let resizeObserver = null;
  let navObserver = null;
  let navTimer = null;
  let lastRenderSig = '';

  function ensureElements() {
    if (rootEl) return;
    rootEl = doc.createElement('div');
    rootEl.setAttribute('data-ag-qr-root', 'true');
    rootEl.setAttribute('data-my-antigravity-no-i18n', 'true');

    const createBtn = (groupKey, shape) => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'ag-qr-btn';
      btn.setAttribute('data-ag-qr-group', groupKey);
      btn.setAttribute('data-ag-qr-shape', shape);
      btn.setAttribute('data-my-antigravity-no-i18n', 'true');

      btn.addEventListener('pointerenter', () => {
        if (hoverTimer != null) win.clearTimeout?.(hoverTimer);
        hoverTimer = win.setTimeout?.(() => showTooltip(groupKey), 350) ?? null;
      });
      btn.addEventListener('pointerleave', () => hideTooltip());
      btn.addEventListener('focus', () => showTooltip(groupKey));
      btn.addEventListener('blur', () => hideTooltip());
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          hideTooltip();
        }
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        openModelsSettings();
      });
      return btn;
    };

    otherBtn = createBtn('other', 'square');
    geminiBtn = createBtn('gemini', 'circle');
    rootEl.appendChild(otherBtn);
    rootEl.appendChild(geminiBtn);

    tooltipEl = doc.createElement('div');
    tooltipEl.id = 'ag-qr-tooltip';
    tooltipEl.className = 'surface-glass';
    tooltipEl.setAttribute('data-ag-qr-tooltip', 'true');
    tooltipEl.setAttribute('data-my-antigravity-no-i18n', 'true');
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.hidden = true;
    doc.body?.appendChild(tooltipEl);
  }

  function clearNavWatch() {
    if (navObserver) {
      navObserver.disconnect();
      navObserver = null;
    }
    if (navTimer != null) {
      win.clearTimeout?.(navTimer);
      navTimer = null;
    }
  }

  function openModelsSettings() {
    onRefreshRequested?.({ force: true });
    clearNavWatch();

    const existingTab = findModelsTabElement(doc);
    if (existingTab) {
      existingTab.click();
      win.setTimeout?.(() => scrollQuotaSectionIntoView(doc), 80);
      return;
    }

    const settingsBtn = currentSettingsBtn || findSettingsButton(doc, win);
    if (!settingsBtn) return;

    settingsBtn.click();

    const trySelectModels = () => {
      const tab = findModelsTabElement(doc);
      if (!tab) return false;
      clearNavWatch();
      tab.click();
      win.setTimeout?.(() => scrollQuotaSectionIntoView(doc), 90);
      return true;
    };

    if (trySelectModels()) return;

    if (typeof win.MutationObserver === 'function' && doc.body) {
      navObserver = new win.MutationObserver(() => {
        trySelectModels();
      });
      navObserver.observe(doc.body, { childList: true, subtree: true });
      navTimer = win.setTimeout?.(() => clearNavWatch(), 1500) ?? null;
    }
  }

  function positionTooltip(btn) {
    if (!tooltipEl || !btn || typeof btn.getBoundingClientRect !== 'function') return;
    const rect = btn.getBoundingClientRect();
    const w = tooltipEl.offsetWidth || 180;
    const h = tooltipEl.offsetHeight || 64;
    const vw = Number(win.innerWidth) || 1280;
    const vh = Number(win.innerHeight) || 800;

    let left = rect.right + 8;
    if (left + w > vw - 8) {
      left = Math.max(8, rect.left - w - 8);
    }
    const top = Math.max(8, Math.min(rect.top + (rect.height - h) / 2, vh - h - 8));
    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(groupKey) {
    if (hoverTimer != null) {
      win.clearTimeout?.(hoverTimer);
      hoverTimer = null;
    }
    const data = snapshot[groupKey];
    const btn = groupKey === 'gemini' ? geminiBtn : otherBtn;
    if (!data || !btn || !tooltipEl) return;

    if (tooltipEl.parentElement !== doc.body && doc.body) {
      doc.body.appendChild(tooltipEl);
    }
    activeTipGroup = groupKey;
    const copy = selectCopy(win, doc);
    renderTooltipContent(doc, tooltipEl, groupKey, data, copy);
    tooltipEl.hidden = false;
    btn.setAttribute('aria-describedby', tooltipEl.id);
    positionTooltip(btn);
  }

  function hideTooltip() {
    if (hoverTimer != null) {
      win.clearTimeout?.(hoverTimer);
      hoverTimer = null;
    }
    activeTipGroup = null;
    if (tooltipEl) tooltipEl.hidden = true;
    otherBtn?.removeAttribute('aria-describedby');
    geminiBtn?.removeAttribute('aria-describedby');
  }

  function getVerticalCenterAnchor(settingsBtn) {
    const icon = settingsBtn?.querySelector?.('svg, .google-symbols');
    if (icon && typeof icon.getBoundingClientRect === 'function') {
      const iconRect = icon.getBoundingClientRect();
      if (iconRect && iconRect.height > 0) {
        return iconRect;
      }
    }
    return typeof settingsBtn?.getBoundingClientRect === 'function' ? settingsBtn.getBoundingClientRect() : null;
  }

  function updateAlignedPosition() {
    if (!rootEl || !currentSettingsBtn) return;
    if (typeof currentSettingsBtn.getBoundingClientRect !== 'function') return;
    const btnRect = currentSettingsBtn.getBoundingClientRect();
    const anchorRect = getVerticalCenterAnchor(currentSettingsBtn);

    if (currentMountMode === 'inline') {
      if (btnRect && btnRect.height > 0 && anchorRect && anchorRect.height > 0) {
        const delta =
          anchorRect.top + anchorRect.height / 2 - (btnRect.top + btnRect.height / 2);
        rootEl.style.transform =
          Math.abs(delta) >= 0.25 && Math.abs(delta) <= 12
            ? `translateY(${delta.toFixed(2)}px)`
            : '';
      } else {
        rootEl.style.transform = '';
      }
      return;
    }

    if (currentMountMode !== 'aligned') return;
    if (!btnRect || btnRect.width < 130 || btnRect.height <= 0) {
      rootEl.setAttribute('data-ag-qr-collapsed', 'true');
      return;
    }
    rootEl.removeAttribute('data-ag-qr-collapsed');
    const rootRect = typeof rootEl.getBoundingClientRect === 'function' ? rootEl.getBoundingClientRect() : null;
    const rootH = rootRect && rootRect.height > 0 ? rootRect.height : 26;
    const vRect = anchorRect && anchorRect.height > 0 ? anchorRect : btnRect;
    const top = vRect.top + (vRect.height - rootH) / 2;
    const right = Math.max(8, (Number(win.innerWidth) || 1280) - btnRect.right + 8);
    rootEl.style.top = `${top.toFixed(2)}px`;
    rootEl.style.right = `${Math.round(right)}px`;
  }

  function clearHostMarkers() {
    if (currentHostEl) {
      currentHostEl.removeAttribute('data-ag-qr-host');
      currentHostEl = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  function unmount() {
    hideTooltip();
    clearHostMarkers();
    rootEl?.remove();
    currentSettingsBtn = null;
    currentMountMode = null;
  }

  function renderRings() {
    if (!rootEl) return;
    const copy = selectCopy(win, doc);
    const sig = JSON.stringify({
      lang: copy === COPY['zh-CN'] ? 'zh' : 'en',
      other: snapshot.other,
      gemini: snapshot.gemini,
    });
    if (sig === lastRenderSig && otherBtn.childElementCount > 0 === Boolean(snapshot.other)) {
      return;
    }
    lastRenderSig = sig;

    const syncOne = (btn, shape, data, title) => {
      if (!data) {
        btn.hidden = true;
        btn.replaceChildren();
        return;
      }
      btn.hidden = false;
      btn.replaceChildren(...buildRingContent(doc, shape, data));
      const summaryText =
        data.mode === 'dual'
          ? `${title}: ${copy.fiveHour} ${data.fiveHour}%, ${copy.weekly} ${data.weekly}%`
          : `${title}: ${data.primary}%`;
      btn.setAttribute('aria-label', summaryText);
      btn.setAttribute('aria-description', copy.openSettingsDesc);
    };

    syncOne(otherBtn, 'square', snapshot.other, copy.otherLabel);
    syncOne(geminiBtn, 'circle', snapshot.gemini, copy.geminiLabel);

    if (activeTipGroup) {
      if (snapshot[activeTipGroup]) {
        showTooltip(activeTipGroup);
      } else {
        hideTooltip();
      }
    }
  }

  function syncMount() {
    if (!snapshot.available) {
      unmount();
      return;
    }

    const settingsBtn = findSettingsButton(doc, win);
    if (!settingsBtn || !settingsBtn.parentElement) {
      unmount();
      return;
    }

    ensureElements();
    const parent = settingsBtn.parentElement;
    const otherSiblings = [...parent.children].filter((el) => el !== settingsBtn && el !== rootEl);
    let computedDir = '';
    try {
      computedDir = win.getComputedStyle?.(parent)?.flexDirection || '';
    } catch {
      computedDir = '';
    }

    const useInline = otherSiblings.length === 0 || computedDir === 'row';
    const nextMode = useInline ? 'inline' : 'aligned';

    if (currentSettingsBtn !== settingsBtn || currentMountMode !== nextMode || !rootEl.isConnected) {
      clearHostMarkers();
      currentSettingsBtn = settingsBtn;
      currentMountMode = nextMode;
      rootEl.setAttribute('data-ag-qr-mode', nextMode);
      rootEl.style.top = '';
      rootEl.style.right = '';
      rootEl.style.transform = '';
      rootEl.removeAttribute('data-ag-qr-collapsed');

      if (useInline) {
        currentHostEl = parent;
        parent.setAttribute('data-ag-qr-host', 'inline');
        settingsBtn.after(rootEl);
      } else if (doc.body) {
        doc.body.appendChild(rootEl);
      }
      if (typeof win.ResizeObserver === 'function') {
        resizeObserver = new win.ResizeObserver(() => updateAlignedPosition());
        resizeObserver.observe(settingsBtn);
        resizeObserver.observe(parent);
      }
    }

    renderRings();
    updateAlignedPosition();
  }

  function setSnapshot(nextSnapshot) {
    snapshot = nextSnapshot || { gemini: null, other: null, available: false };
    syncMount();
  }

  function handleResize() {
    updateAlignedPosition();
    if (activeTipGroup) {
      const btn = activeTipGroup === 'gemini' ? geminiBtn : otherBtn;
      if (btn) positionTooltip(btn);
    }
  }

  win.addEventListener?.('resize', handleResize);

  return {
    setSnapshot,
    syncMount,
    openModelsSettings,
    destroy() {
      clearNavWatch();
      unmount();
      tooltipEl?.remove();
      win.removeEventListener?.('resize', handleResize);
    },
  };
}
