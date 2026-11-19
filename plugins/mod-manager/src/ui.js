/**
 * mod-manager 前端 UI 控制器：
 * - 精准识别左上角 Antigravity 图标按钮并拦截左键点击，映射为插件管理菜单；
 * - 保留 Alt + 点击透传原按钮行为；
 * - 渲染原生 .surface-glass 风格的插件开关浮层并支持一键重载窗口。
 */
import {
  MIN_LOGO_SCORE,
  computePendingReloadIds,
  filterDisplayMods,
  getShortSummary,
  scoreLogoButtonCandidate,
  sortCatalogMods,
} from './manager-core.js';

const ANCHOR_TITLE = 'My Antigravity 插件管理 (Alt + 点击触发原功能)';

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
export function findLogoButton(doc) {
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

export function createModManagerController(win, doc, { bridge = null } = {}) {
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
  let bootEnabledIds = Array.isArray(bridge?.bootEnabledIds) ? [...bridge.bootEnabledIds] : null;
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

  function syncAnchorDecorations() {
    const found = findLogoButton(doc);
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
        currentAnchor.setAttribute?.('title', ANCHOR_TITLE);
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
        createEl(
          doc,
          'div',
          { class: 'ag-mm-empty' },
          '当前 app.asar 加载器版本尚未接入开关桥接接口。请完全退出 Antigravity 后运行一次 install.cmd（或 npm run install-loader）即可启用独立开关管理。',
        ),
      );
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = '提示：Alt + 点击图标可执行原按钮功能';
      reloadBtnEl.hidden = true;
      return;
    }

    if (isLoading && sorted.length === 0) {
      listEl.replaceChildren(createEl(doc, 'div', { class: 'ag-mm-empty' }, '正在加载插件列表...'));
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = '';
      reloadBtnEl.hidden = true;
      return;
    }

    if (sorted.length === 0) {
      listEl.replaceChildren(createEl(doc, 'div', { class: 'ag-mm-empty' }, '暂无其它已同步的小插件。'));
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = '请运行 npm run sync 同步插件';
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
          createEl(doc, 'span', { class: 'ag-mm-badge', 'data-tone': 'pending' }, '待重载'),
        );
      }

      const desc = createEl(doc, 'p', { class: 'ag-mm-item-desc' }, getShortSummary(mod));

      info.appendChild(head);
      info.appendChild(desc);

      const isToggling = togglingIds.has(mod.id);
      const switchBtn = createEl(doc, 'button', {
        type: 'button',
        class: 'ag-mm-switch',
        role: 'switch',
        'aria-checked': mod.enabled ? 'true' : 'false',
        'aria-label': `切换 ${mod.id}`,
      });
      if (mod.protected || isToggling) {
        switchBtn.disabled = true;
        switchBtn.setAttribute('aria-disabled', 'true');
        if (mod.protected) {
          switchBtn.setAttribute('title', '核心管理入口不可关闭');
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
      footerTextEl.textContent = `已保存 ${pendingIds.length} 项变更，重载窗口后生效`;
      reloadBtnEl.hidden = false;
      reloadBtnEl.disabled = isReloading;
      reloadBtnEl.textContent = isReloading ? '正在重载...' : '立即重载';
    } else {
      footerEl.setAttribute('data-pending', 'false');
      footerTextEl.textContent = '状态已持久化 · Alt + 点击图标可触发原功能';
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
        errorMessage = res?.error || '读取插件列表失败';
      }
    } catch (err) {
      errorMessage = err?.message || '读取插件列表失败';
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
        errorMessage = res?.error || `更新 ${mod.id} 状态失败`;
      }
    } catch (err) {
      errorMessage = err?.message || `更新 ${mod.id} 状态失败`;
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
