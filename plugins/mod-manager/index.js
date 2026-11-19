// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/mod-manager/src/*.js, then run `npm run sync`.

(function registerModManagerMod(win, doc) {
// --- manager-core.js ---
/**
 * mod-manager 纯函数核心模块：
 * - 左上角 Antigravity 图标按钮候选项评分与防误判；
 * - 插件列表过滤、排序、双语精简功能摘要与待重载状态比对。
 */

const NON_LOGO_CONTROL_RE =
  /\b(?:sidebar|toggle[-_\s]?sidebar|collapse|expand|back|forward|search|close|minimize|maximize|settings)\b|侧边栏|折叠|展开|后退|前进|搜索|关闭|最小化|最大化|设置/i;

const LOGO_HINT_RE = /\b(?:antigravity|home|logo|brand)\b|首页/i;

const SHORT_SUMMARY_BY_ID = {
  'enter-newline': {
    'zh-CN': 'Enter 换行，Shift+Enter 发送',
    en: 'Enter for newline, Shift+Enter to send',
  },
  'model-enhancer': {
    'zh-CN': '模型品牌图标与思考深度拉条',
    en: 'Model brand icons & effort slider',
  },
  'quota-rings': {
    'zh-CN': '左下角模型剩余额度双环',
    en: 'Bottom-left dual model quota rings',
  },
  'session-status': {
    'zh-CN': '输入框下方会话与 Token 状态栏',
    en: 'Session & token status bar below input',
  },
  'zh-cn': {
    'zh-CN': '桌面端界面简体中文化',
    en: 'Simplified Chinese desktop UI translation',
  },
};
const MIN_LOGO_SCORE = 4;

/**
 * 判断当前是否使用中文界面：
 * 优先依据 zh-cn 运行标记 / 启动基线中是否包含 zh-cn / <html lang>。
 */
function resolveLocale(win, doc, bootEnabledIds = null) {
  if (win && win.__myAntigravityZhCnInstalled) {
    return 'zh-CN';
  }
  if (Array.isArray(bootEnabledIds) && bootEnabledIds.includes('zh-cn')) {
    return 'zh-CN';
  }
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if (htmlLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 对候选元素特征进行打分；返回 -1 表示硬排除，不作为目标按钮。
 */
function scoreLogoButtonCandidate(info) {
  if (!info || info.inIgnoredContainer || info.inMenubarOrMenu) {
    return -1;
  }
  const text = String(info.text || '').replace(/\s+/g, ' ').trim();
  if (text.length > 0) {
    return -1;
  }
  if (!info.hasSvg) {
    return -1;
  }

  const rect = info.rect;
  if (
    !rect ||
    rect.width < 16 ||
    rect.width > 56 ||
    rect.height < 16 ||
    rect.height > 56
  ) {
    return -1;
  }
  if (rect.left < 0 || rect.left > 120 || rect.top < 24 || rect.top > 120) {
    return -1;
  }

  const hintText = [info.testId, info.ariaLabel, info.title].filter(Boolean).join(' ');
  if (hintText && NON_LOGO_CONTROL_RE.test(hintText)) {
    return -1;
  }

  let score = 1;
  if (hintText && LOGO_HINT_RE.test(hintText)) {
    score += 10;
  }
  if (
    info.rowHasSiblingIconButtons &&
    typeof info.rowMinLeft === 'number' &&
    Math.abs(rect.left - info.rowMinLeft) <= 2
  ) {
    score += 6;
  }
  if (rect.left <= 48) {
    score += 2;
  }
  if (rect.top <= 84) {
    score += 1;
  }
  return score;
}

/**
 * 过滤掉不应在开关列表中展示的管理插件自身或受保护核心项。
 */
function filterDisplayMods(mods) {
  if (!Array.isArray(mods)) {
    return [];
  }
  return mods.filter((mod) => mod && !mod.protected && mod.id !== 'mod-manager');
}

/**
 * 排序插件目录：按原英文 ID 字母序展示。
 */
function sortCatalogMods(mods) {
  if (!Array.isArray(mods)) {
    return [];
  }
  return [...mods].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
}

/**
 * 提取精简的一句话功能说明（按当前语言返回）：
 * 优先使用 mod.json 的语言专属 summary / summaryEn -> 内置双语映射 -> description 去冗余首句 -> name。
 */
function getShortSummary(mod, locale = 'zh-CN') {
  const isZh = locale === 'zh-CN';
  if (!mod) {
    return '';
  }

  if (mod.summary && typeof mod.summary === 'object') {
    const localized = String(
      isZh ? mod.summary['zh-CN'] || mod.summary.zh || mod.summary.en || '' : mod.summary.en || mod.summary['zh-CN'] || '',
    ).trim();
    if (localized) {
      return localized;
    }
  }

  if (!isZh) {
    const explicitEn = String(mod.summaryEn || '').trim();
    if (explicitEn) {
      return explicitEn;
    }
  }

  const explicit = typeof mod.summary === 'string' ? mod.summary.trim() : '';
  if (explicit && (isZh || !/[\u4e00-\u9fff]/.test(explicit))) {
    return explicit;
  }

  const id = String(mod.id || '').trim();
  if (id && Object.prototype.hasOwnProperty.call(SHORT_SUMMARY_BY_ID, id)) {
    const entry = SHORT_SUMMARY_BY_ID[id];
    return isZh ? entry['zh-CN'] : entry.en;
  }

  if (explicit) {
    return explicit;
  }

  const desc = String(mod.description || '').trim();
  if (desc) {
    const stripped = desc.replace(/[（(][^）)]*[）)]/g, '').trim();
    const firstSentence = stripped.split(/[。；;\n]/)[0]?.trim();
    return firstSentence || stripped || desc;
  }

  return String(mod.name || (isZh ? '暂无功能说明' : 'No description'));
}

/**
 * 计算与当前窗口启动基线不一致、需要重载窗口才能生效的插件 ID 列表。
 */
function computePendingReloadIds(mods, bootEnabledIds) {
  if (!Array.isArray(mods) || !Array.isArray(bootEnabledIds)) {
    return [];
  }
  const bootSet = new Set(bootEnabledIds.map((id) => String(id)));
  const pending = [];
  for (const mod of mods) {
    const id = String(mod?.id || '');
    if (!id) continue;
    const nowEnabled = Boolean(mod.enabled);
    const wasEnabled = bootSet.has(id);
    if (nowEnabled !== wasEnabled) {
      pending.push(id);
    }
  }
  return pending;
}

// --- ui.js ---
/**
 * mod-manager 前端 UI 控制器：
 * - 精准识别左上角 Antigravity 图标按钮并拦截左键点击，映射为插件管理菜单；
 * - 保留 Alt + 点击透传原按钮行为；
 * - 渲染原生 .surface-glass 风格的插件开关浮层并支持一键重载窗口。
 */

const COPY = {
  'zh-CN': {
    anchorTitle: 'My Antigravity 插件管理 (Alt + 点击触发原功能)',
    dialogLabel: 'My Antigravity 插件管理',
    pendingBadge: '待重载',
    reloadBtn: '立即重载',
    reloadingBtn: '正在重载...',
    footerPending: (n) => `已保存 ${n} 项变更，重载窗口后生效`,
    footerIdle: '状态已持久化 · Alt + 点击图标可触发原功能',
    noBridgeHint:
      '当前 app.asar 加载器版本尚未接入开关桥接接口。请完全退出 Antigravity 后运行一次 install.cmd（或 npm run install-loader）即可启用独立开关管理。',
    noBridgeFooter: '提示：Alt + 点击图标可执行原按钮功能',
    loading: '正在加载插件列表...',
    empty: '暂无其它已同步的小插件。',
    emptyFooter: '请运行 npm run sync 同步插件',
    loadError: '读取插件列表失败',
    toggleError: (id) => `更新 ${id} 状态失败`,
    switchAria: (id) => `切换 ${id}`,
    protectedTitle: '核心管理入口不可关闭',
  },
  en: {
    anchorTitle: 'My Antigravity Mods (Alt+Click for original action)',
    dialogLabel: 'My Antigravity Mod Manager',
    pendingBadge: 'Restart',
    reloadBtn: 'Reload',
    reloadingBtn: 'Reloading...',
    footerPending: (n) => `${n} ${n === 1 ? 'change' : 'changes'} saved — reload to apply`,
    footerIdle: 'Saved · Alt+Click logo for original action',
    noBridgeHint:
      'The app.asar loader is outdated and lacks the mod manager bridge. Fully quit Antigravity and run install.cmd (or npm run install-loader) once.',
    noBridgeFooter: 'Tip: Alt+Click logo for original action',
    loading: 'Loading mods...',
    empty: 'No other synced mods found.',
    emptyFooter: 'Run npm run sync to sync mods',
    loadError: 'Failed to load mod list',
    toggleError: (id) => `Failed to update ${id}`,
    switchAria: (id) => `Toggle ${id}`,
    protectedTitle: 'Core manager cannot be disabled',
  },
};

function getNormalizedText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function getButtonRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return null;
  }
  const r = el.getBoundingClientRect();
  if (!r || typeof r.width !== 'number' || typeof r.height !== 'number') {
    return null;
  }
  return {
    left: Number(r.left) || 0,
    top: Number(r.top) || 0,
    right: Number(r.right) || (Number(r.left) || 0) + (Number(r.width) || 0),
    bottom: Number(r.bottom) || (Number(r.top) || 0) + (Number(r.height) || 0),
    width: Number(r.width) || 0,
    height: Number(r.height) || 0,
  };
}

function isInIgnoredContainer(el) {
  return Boolean(
    el?.closest?.(
      '[data-ag-mm-root], [data-ag-qr-root], [data-ag-qr-tooltip], [role="dialog"], [data-testid="agent-input-box"]',
    ),
  );
}

function isInMenubarOrMenu(el) {
  return Boolean(
    el?.closest?.('[role="menubar"], [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'),
  );
}

/**
 * 查找左侧边栏顶部的 Antigravity 图标按钮（非顶部文字菜单）。
 */
function findLogoButton(doc) {
  if (!doc?.querySelectorAll) {
    return null;
  }
  const rawButtons = [...doc.querySelectorAll('button, [role="button"], a')];
  const compactLeft = [];

  for (const el of rawButtons) {
    if (isInIgnoredContainer(el) || isInMenubarOrMenu(el)) {
      continue;
    }
    const text = getNormalizedText(el);
    if (text.length > 0) {
      continue;
    }
    const hasSvg = Boolean(el.querySelector?.('svg'));
    if (!hasSvg) {
      continue;
    }
    const rect = getButtonRect(el);
    if (
      !rect ||
      rect.width < 16 ||
      rect.width > 56 ||
      rect.height < 16 ||
      rect.height > 56 ||
      rect.left < 0 ||
      rect.left > 120 ||
      rect.top < 24 ||
      rect.top > 120
    ) {
      continue;
    }
    compactLeft.push({
      el,
      rect,
      text,
      hasSvg,
      ariaLabel: String(el.getAttribute?.('aria-label') || '').trim(),
      title: String(el.getAttribute?.('data-ag-mm-orig-title') ?? el.getAttribute?.('title') ?? '').trim(),
      testId: String(el.getAttribute?.('data-testid') || '').trim(),
    });
  }

  let bestEl = null;
  let bestScore = -1;

  for (const item of compactLeft) {
    const rowPeers = compactLeft.filter((other) => Math.abs(other.rect.top - item.rect.top) <= 10);
    const rowHasSiblingIconButtons = rowPeers.length >= 2;
    const rowMinLeft = rowPeers.reduce((min, cur) => Math.min(min, cur.rect.left), Infinity);

    const score = scoreLogoButtonCandidate({
      ...item,
      inIgnoredContainer: false,
      inMenubarOrMenu: false,
      rowHasSiblingIconButtons,
      rowMinLeft,
    });
    if (score >= MIN_LOGO_SCORE && score > bestScore) {
      bestScore = score;
      bestEl = item.el;
    }
  }

  return bestEl;
}

function createEl(doc, tag, attrs = {}, text = '') {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    el.setAttribute(k, String(v));
  }
  if (text) {
    el.textContent = text;
  }
  return el;
}
function createModManagerController(win, doc, { bridge = null } = {}) {
  let root = null;
  let listEl = null;
  let errorEl = null;
  let footerEl = null;
  let footerTextEl = null;
  let reloadBtnEl = null;

  let isOpen = false;
  let isLoading = false;
  let isReloading = false;
  let errorMessage = '';
  let mods = [];
  const initialBridge = bridge || win.__myAntigravityManager || null;
  let bootEnabledIds = Array.isArray(initialBridge?.bootEnabledIds)
    ? [...initialBridge.bootEnabledIds]
    : null;
  let currentAnchor = null;
  let activeAnim = null;
  let animEpoch = 0;
  const togglingIds = new Set();

  function prefersReducedMotion() {
    try {
      return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    } catch {
      return false;
    }
  }

  function cancelActiveAnimation() {
    animEpoch += 1;
    if (activeAnim) {
      try {
        activeAnim.cancel?.();
      } catch {
        // ignore
      }
      activeAnim = null;
    }
    if (root) {
      root.style.pointerEvents = '';
    }
  }

  function playOpenAnimation() {
    cancelActiveAnimation();
    if (!root || prefersReducedMotion() || typeof root.animate !== 'function') {
      return;
    }
    const myEpoch = animEpoch;
    try {
      activeAnim = root.animate(
        [
          { opacity: 0, transform: 'translateY(-6px) scale(0.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 160,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
      if (activeAnim) {
        const done = () => {
          if (animEpoch === myEpoch) {
            activeAnim = null;
          }
        };
        activeAnim.onfinish = done;
        activeAnim.oncancel = done;
      }
    } catch {
      activeAnim = null;
    }
  }

  function playCloseAnimation() {
    cancelActiveAnimation();
    if (!root) {
      return;
    }
    if (prefersReducedMotion() || typeof root.animate !== 'function') {
      root.hidden = true;
      return;
    }
    const myEpoch = animEpoch;
    root.style.pointerEvents = 'none';
    try {
      activeAnim = root.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-4px) scale(0.97)' },
        ],
        {
          duration: 130,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'forwards',
        },
      );
      if (activeAnim) {
        activeAnim.onfinish = () => {
          if (animEpoch !== myEpoch || isOpen) {
            return;
          }
          try {
            activeAnim?.cancel?.();
          } catch {
            // ignore
          }
          activeAnim = null;
          if (root) {
            root.hidden = true;
            root.style.pointerEvents = '';
          }
        };
        activeAnim.oncancel = () => {
          if (animEpoch === myEpoch) {
            activeAnim = null;
          }
        };
      } else {
        root.hidden = true;
        root.style.pointerEvents = '';
      }
    } catch {
      activeAnim = null;
      root.hidden = true;
      root.style.pointerEvents = '';
    }
  }

  function getBridge() {
    return bridge || win.__myAntigravityManager || null;
  }

  function getLocale() {
    const activeBridge = getBridge();
    const ids = bootEnabledIds || activeBridge?.bootEnabledIds || null;
    return resolveLocale(win, doc, ids);
  }

  function getCopy() {
    return COPY[getLocale()] || COPY.en;
  }

  function syncAnchorDecorations() {
    const found = findLogoButton(doc);
    const copy = getCopy();
    if (currentAnchor && currentAnchor !== found) {
      currentAnchor.removeAttribute?.('data-ag-mm-anchor');
      currentAnchor.removeAttribute?.('data-ag-mm-open');
      if (currentAnchor.getAttribute?.('data-ag-mm-orig-title') !== null) {
        const orig = currentAnchor.getAttribute('data-ag-mm-orig-title');
        if (orig) {
          currentAnchor.setAttribute('title', orig);
        } else {
          currentAnchor.removeAttribute('title');
        }
        currentAnchor.removeAttribute('data-ag-mm-orig-title');
      }
    }
    currentAnchor = found;
    if (currentAnchor) {
      currentAnchor.setAttribute?.('data-ag-mm-anchor', 'true');
      currentAnchor.setAttribute?.('data-ag-mm-open', isOpen ? 'true' : 'false');
      if (currentAnchor.getAttribute?.('data-ag-mm-orig-title') === null) {
        const origTitle = currentAnchor.getAttribute?.('title') || '';
        currentAnchor.setAttribute?.('data-ag-mm-orig-title', origTitle);
      }
      if (currentAnchor.getAttribute?.('title') !== copy.anchorTitle) {
        currentAnchor.setAttribute?.('title', copy.anchorTitle);
      }
    }
    return currentAnchor;
  }

  function positionPopup() {
    if (!root) return;
    const anchor = syncAnchorDecorations();
    const rect = anchor ? getButtonRect(anchor) : null;
    const top = rect ? Math.round(rect.bottom + 8) : 52;
    const left = rect ? Math.max(8, Math.round(rect.left)) : 12;
    root.style.top = `${top}px`;
    root.style.left = `${left}px`;
  }

  function ensurePopupDom() {
    if (root && root.isConnected) {
      return root;
    }
    if (!doc.body) {
      return null;
    }

    root = createEl(doc, 'div', {
      'data-ag-mm-root': 'true',
      'data-my-antigravity-no-i18n': 'true',
      class: 'surface-glass ag-mm-popover',
      role: 'dialog',
      'aria-label': 'My Antigravity 插件管理',
    });
    root.hidden = true;

    const header = createEl(doc, 'div', { class: 'ag-mm-header' });
    const title = createEl(doc, 'h2', { class: 'ag-mm-title' }, 'My Antigravity');
    header.appendChild(title);

    errorEl = createEl(doc, 'div', { class: 'ag-mm-error' });
    errorEl.hidden = true;

    listEl = createEl(doc, 'div', { class: 'ag-mm-list', role: 'list' });

    footerEl = createEl(doc, 'div', { class: 'ag-mm-footer', 'data-pending': 'false' });
    footerTextEl = createEl(doc, 'span', { class: 'ag-mm-footer-text' }, '');
    reloadBtnEl = createEl(
      doc,
      'button',
      { type: 'button', class: 'ag-mm-reload-btn' },
      '立即重载',
    );
    reloadBtnEl.hidden = true;
    reloadBtnEl.addEventListener('click', () => {
      void handleReload();
    });

    footerEl.appendChild(footerTextEl);
    footerEl.appendChild(reloadBtnEl);

    root.appendChild(header);
    root.appendChild(errorEl);
    root.appendChild(listEl);
    root.appendChild(footerEl);

    doc.body.appendChild(root);
    return root;
  }

  function render() {
    const popup = ensurePopupDom();
    if (!popup) return;

    if (currentAnchor) {
      currentAnchor.setAttribute?.('data-ag-mm-open', isOpen ? 'true' : 'false');
    }
    if (!isOpen) {
      if (!activeAnim) {
        popup.hidden = true;
      }
      return;
    }
    popup.hidden = false;

    positionPopup();

    const locale = getLocale();
    const copy = COPY[locale] || COPY.en;
    popup.setAttribute('aria-label', copy.dialogLabel);

    const activeBridge = getBridge();
    const sorted = sortCatalogMods(filterDisplayMods(mods));

    if (errorMessage) {
      errorEl.hidden = false;
      errorEl.textContent = errorMessage;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    if (!activeBridge) {
      listEl.replaceChildren(
        createEl(doc, 'div', { class: 'ag-mm-empty' }, copy.noBridgeHint),
      );
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = copy.noBridgeFooter;
      reloadBtnEl.hidden = true;
      return;
    }

    if (isLoading && sorted.length === 0) {
      listEl.replaceChildren(createEl(doc, 'div', { class: 'ag-mm-empty' }, copy.loading));
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = '';
      reloadBtnEl.hidden = true;
      return;
    }

    if (sorted.length === 0) {
      listEl.replaceChildren(createEl(doc, 'div', { class: 'ag-mm-empty' }, copy.empty));
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = copy.emptyFooter;
      reloadBtnEl.hidden = true;
      return;
    }

    const pendingIds = computePendingReloadIds(sorted, bootEnabledIds);
    const pendingSet = new Set(pendingIds);

    const rows = sorted.map((mod) => {
      const row = createEl(doc, 'div', {
        class: 'ag-mm-item',
        role: 'listitem',
        'data-mod-id': mod.id,
        'data-enabled': mod.enabled ? 'true' : 'false',
      });

      const info = createEl(doc, 'div', { class: 'ag-mm-item-info' });
      const head = createEl(doc, 'div', { class: 'ag-mm-item-head' });

      head.appendChild(createEl(doc, 'span', { class: 'ag-mm-item-name' }, mod.id));
      if (pendingSet.has(mod.id)) {
        head.appendChild(
          createEl(doc, 'span', { class: 'ag-mm-badge', 'data-tone': 'pending' }, copy.pendingBadge),
        );
      }

      const desc = createEl(doc, 'p', { class: 'ag-mm-item-desc' }, getShortSummary(mod, locale));

      info.appendChild(head);
      info.appendChild(desc);

      const isToggling = togglingIds.has(mod.id);
      const switchBtn = createEl(doc, 'button', {
        type: 'button',
        class: 'ag-mm-switch',
        role: 'switch',
        'aria-checked': mod.enabled ? 'true' : 'false',
        'aria-label': copy.switchAria(mod.id),
      });
      if (mod.protected || isToggling) {
        switchBtn.disabled = true;
        switchBtn.setAttribute('aria-disabled', 'true');
        if (mod.protected) {
          switchBtn.setAttribute('title', copy.protectedTitle);
        }
      }
      switchBtn.appendChild(createEl(doc, 'span', { class: 'ag-mm-switch-thumb' }));
      switchBtn.addEventListener('click', () => {
        void handleToggle(mod);
      });

      row.appendChild(info);
      row.appendChild(switchBtn);
      return row;
    });

    listEl.replaceChildren(...rows);

    if (pendingIds.length > 0) {
      footerEl.setAttribute('data-pending', 'true');
      footerTextEl.textContent = copy.footerPending(pendingIds.length);
      reloadBtnEl.hidden = false;
      reloadBtnEl.disabled = isReloading;
      reloadBtnEl.textContent = isReloading ? copy.reloadingBtn : copy.reloadBtn;
    } else {
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = copy.footerIdle;
      reloadBtnEl.hidden = true;
    }
  }

  async function refreshCatalog() {
    const activeBridge = getBridge();
    if (!activeBridge || typeof activeBridge.getCatalog !== 'function') {
      errorMessage = '';
      render();
      return;
    }
    isLoading = true;
    errorMessage = '';
    render();
    try {
      const res = await activeBridge.getCatalog();
      if (res && res.ok !== false && Array.isArray(res.mods)) {
        mods = res.mods;
        if (Array.isArray(res.bootEnabledIds)) {
          bootEnabledIds = [...res.bootEnabledIds];
        } else if (!bootEnabledIds) {
          bootEnabledIds = mods.filter((m) => m.enabled).map((m) => m.id);
        }
      } else {
        errorMessage = res?.error || getCopy().loadError;
      }
    } catch (err) {
      errorMessage = err?.message || getCopy().loadError;
    } finally {
      isLoading = false;
      render();
    }
  }

  async function handleToggle(mod) {
    if (mod.protected || togglingIds.has(mod.id)) {
      return;
    }
    const activeBridge = getBridge();
    if (!activeBridge || typeof activeBridge.setModEnabled !== 'function') {
      return;
    }
    const nextEnabled = !mod.enabled;
    togglingIds.add(mod.id);
    errorMessage = '';
    render();
    try {
      const res = await activeBridge.setModEnabled(mod.id, nextEnabled);
      if (res && res.ok && Array.isArray(res.mods)) {
        mods = res.mods;
      } else {
        errorMessage = res?.error || getCopy().toggleError(mod.id);
      }
    } catch (err) {
      errorMessage = err?.message || getCopy().toggleError(mod.id);
    } finally {
      togglingIds.delete(mod.id);
      render();
    }
  }

  async function handleReload() {
    if (isReloading) return;
    isReloading = true;
    render();
    const activeBridge = getBridge();
    try {
      if (activeBridge && typeof activeBridge.reloadWindow === 'function') {
        const res = await activeBridge.reloadWindow();
        if (res && res.ok) {
          return;
        }
      }
      win.location?.reload?.();
    } catch {
      win.location?.reload?.();
    } finally {
      isReloading = false;
      render();
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    cancelActiveAnimation();
    render();
    playOpenAnimation();
    void refreshCatalog();
  }

  function close({ restoreFocus = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    if (currentAnchor) {
      currentAnchor.setAttribute?.('data-ag-mm-open', 'false');
    }
    playCloseAnimation();
    if (restoreFocus && currentAnchor && typeof currentAnchor.focus === 'function') {
      currentAnchor.focus();
    }
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function isEventOnAnchor(target) {
    const anchor = syncAnchorDecorations();
    if (!anchor || !target) return null;
    if (target === anchor || anchor.contains?.(target)) {
      return anchor;
    }
    return null;
  }

  function onClickCapture(event) {
    const anchor = isEventOnAnchor(event.target);
    if (!anchor) {
      if (isOpen && !(root && (event.target === root || root.contains?.(event.target)))) {
        close();
      }
      return;
    }
    // Alt + 左键透传原生图标功能（回到首页/新建对话）
    if (event.altKey) {
      close();
      return;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    toggle();
  }

  function onPointerDownCapture(event) {
    if (!isOpen) return;
    const target = event.target;
    if (root && (target === root || root.contains?.(target))) {
      return;
    }
    if (isEventOnAnchor(target)) {
      return;
    }
    close();
  }

  function onKeyDownCapture(event) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault?.();
      event.stopPropagation?.();
      close({ restoreFocus: true });
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !event.altKey) {
      const anchor = isEventOnAnchor(event.target);
      if (anchor) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        toggle();
      }
    }
  }

  function onResize() {
    if (isOpen) {
      positionPopup();
    } else {
      syncAnchorDecorations();
    }
  }

  doc.addEventListener?.('click', onClickCapture, true);
  doc.addEventListener?.('pointerdown', onPointerDownCapture, true);
  doc.addEventListener?.('keydown', onKeyDownCapture, true);
  win.addEventListener?.('resize', onResize);

  syncAnchorDecorations();

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    syncAnchor: syncAnchorDecorations,
    refreshCatalog,
    dispose() {
      cancelActiveAnimation();
      doc.removeEventListener?.('click', onClickCapture, true);
      doc.removeEventListener?.('pointerdown', onPointerDownCapture, true);
      doc.removeEventListener?.('keydown', onKeyDownCapture, true);
      win.removeEventListener?.('resize', onResize);
      root?.remove?.();
      root = null;
    },
  };
}

// --- entry.js ---
/**
 * mod-manager 运行时入口：
 * 等待 DOM 就绪后挂载左上角图标拦截与插件管理浮层控制器，并监听侧边栏重渲染保持锚点同步。
 */
function installModManagerPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityModManagerInstalled) {
    return null;
  }
  win.__myAntigravityModManagerInstalled = true;

  let controller = null;
  let observer = null;
  let scheduled = false;

  function scheduleSyncAnchor() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.syncAnchor();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(node.closest?.('[data-ag-mm-root]'));
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createModManagerController(win, doc);

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (!isOwnUiNode(m.target)) {
            scheduleSyncAnchor();
            return;
          }
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initDom, { once: true });
  } else {
    initDom();
  }

  return {
    getController: () => controller,
    dispose() {
      observer?.disconnect();
      controller?.dispose();
    },
  };
}

  installModManagerPlugin(win, doc);
})(window, document);
