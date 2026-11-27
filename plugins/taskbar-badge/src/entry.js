/**
 * taskbar-badge 运行时入口：
 * - 旁路监听会话状态跃迁，追踪后台/非当前会话的 完成 / 提问审批 / 报错；
 * - 结合 React Fiber 读取当前正在查看的 conversationId 与窗口聚焦状态，点开对应会话自动消减；
 * - 通过 __myAntigravityAttention IPC 同步更新任务栏状态与托盘圆点。
 */
import { createBadgeTracker } from './badge-core.js';
import { createIconRenderer } from './icon-renderer.js';
import { installAttentionTransportTap } from './transport-tap.js';

function isElementVisible(win, el) {
  if (!el) return false;
  if ('isConnected' in el && el.isConnected === false) return false;
  if (el.closest?.('[data-split-overlaid="true"], [inert], [aria-hidden="true"]')) return false;
  if (typeof el.getClientRects === 'function') {
    const rects = el.getClientRects();
    if (!rects || rects.length === 0) return false;
  }
  if (typeof win?.getComputedStyle === 'function') {
    const style = win.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function getElementFiber(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  return key ? el[key] : null;
}

/**
 * 沿聊天输入框 React Fiber 树只读提取当前展示的 cascadeId 及可选 stateManager。
 */
export function inspectActiveConversation(doc, win = null, interactionTarget = null) {
  if (!doc?.querySelectorAll) {
    return { conversationId: null, stateManager: null };
  }
  const boxes = [
    ...doc.querySelectorAll('[data-testid="agent-input-box"]'),
    ...doc.querySelectorAll('[contenteditable="true"][data-lexical-editor="true"]'),
  ];
  const visibleConversations = new Map();
  const inputs = new Map();
  let fallbackStateManager = null;
  for (const el of boxes) {
    if (!el || typeof el !== 'object') continue;
    let fiber = getElementFiber(el);
    let conversationId = null;
    let inExistingConversation = true;
    let foundExisting = false;
    let stateManager = null;

    for (let steps = 0; fiber && steps < 60; steps += 1, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (!props || typeof props !== 'object') continue;
      if (!conversationId) {
        const cid = props.cascadeId || props.conversationId;
        if (typeof cid === 'string' && cid.trim() !== '') {
          conversationId = cid;
        }
      }
      if (!foundExisting && typeof props.inExistingConversation === 'boolean') {
        inExistingConversation = props.inExistingConversation;
        foundExisting = true;
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
      if (conversationId && stateManager && foundExisting) break;
    }

    if (stateManager && !fallbackStateManager) {
      fallbackStateManager = stateManager;
    }
    if (isElementVisible(win, el)) {
      const cid = inExistingConversation ? conversationId : null;
      inputs.set(el, cid);
      if (cid) visibleConversations.set(cid, stateManager || visibleConversations.get(cid));
    }
  }

  for (const target of [interactionTarget, doc.activeElement]) {
    if (!target || target.isConnected === false) continue;
    for (const [input, cid] of inputs) {
      if (input === target || input.contains?.(target)) {
        return { conversationId: cid, stateManager: visibleConversations.get(cid) || fallbackStateManager };
      }
    }
    for (let node = target; node && node.isConnected !== false; node = node.parentElement) {
      let fiber = getElementFiber(node);
      for (let steps = 0; fiber && steps < 60; steps += 1, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        const cid = props?.cascadeId || props?.conversationId;
        if (visibleConversations.has(cid)) {
          return { conversationId: cid, stateManager: visibleConversations.get(cid) || fallbackStateManager };
        }
      }
    }
  }
  if (visibleConversations.size === 1 && ![...inputs.values()].includes(null)) {
    const [[conversationId, stateManager]] = visibleConversations;
    return { conversationId, stateManager: stateManager || fallbackStateManager };
  }
  return { conversationId: null, stateManager: fallbackStateManager };
}

export function installTaskbarBadgePlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityTaskbarBadgeInstalled) {
    return null;
  }
  win.__myAntigravityTaskbarBadgeInstalled = true;

  const bridge = win.__myAntigravityAttention || null;
  if (!bridge && !win.__myAntigravityTaskbarBadgeWarned) {
    win.__myAntigravityTaskbarBadgeWarned = true;
    console.warn(
      '[my_antigravity][taskbar-badge] 缺少主进程窗口图标桥接 (__myAntigravityAttention)，请退出 Antigravity 后运行一次 npm run install-loader 更新 app.asar。',
    );
  }

  const initialFocused =
    typeof doc.hasFocus === 'function' ? Boolean(doc.hasFocus()) : true;
  const tracker = createBadgeTracker({ windowFocused: initialFocused });
  const renderer = createIconRenderer(win, doc, bridge);

  let pushTimer = null;
  let pushDelay = 0;
  let lastPushedSig = '';
  let retryDelay = 500;
  let flushing = false;
  let trayRenderPending = false;
  let stopped = false;

  async function pushIconState(count, level, trayPngDataUrl = null, conversationIds = []) {
    if (!bridge || typeof bridge.setAttentionState !== 'function') {
      return { ok: false, reason: 'no-bridge' };
    }
    let overlay = {};
    try {
      overlay = renderer.renderTaskbarIcon(count, level);
    } catch {
      // 角标绘制失败时托盘仍可更新，主进程报告失败后重试。
    }
    return bridge.setAttentionState({ count, level, ...overlay, trayPngDataUrl, conversationIds });
  }

  async function flushIconsNow() {
    if (stopped || flushing || typeof bridge?.setAttentionState !== 'function') return;
    const snap = tracker.getSnapshot();
    const trayIcon = snap.count > 0 ? renderer.getCachedTrayIcon(snap.level) : null;
    const needsTray = snap.count > 0 && !trayIcon;
    if (needsTray && !trayRenderPending) {
      trayRenderPending = true;
      void renderer.renderTrayIcon(snap.level).catch(() => null).then((icon) => {
        trayRenderPending = false;
        if (icon || tracker.getSnapshot().level !== snap.level) scheduleIconSync();
      });
    }

    const sig = JSON.stringify([snap.level, snap.unreadConversationIds, Boolean(trayIcon)]);
    let retry = needsTray;
    flushing = true;
    try {
      if (sig !== lastPushedSig) {
        const result = await pushIconState(snap.count, snap.level, trayIcon, snap.unreadConversationIds);
        if (result?.ok && result.updatedWindow !== false && result.updatedTray !== false) {
          lastPushedSig = sig;
        } else {
          retry = true;
        }
      }
    } catch {
      retry = true;
    } finally {
      flushing = false;
      const current = tracker.getSnapshot();
      if (current.level !== snap.level || current.unreadConversationIds.join('\0') !== snap.unreadConversationIds.join('\0')) {
        scheduleIconSync();
      } else if (retry) {
        scheduleIconSync(retryDelay);
        retryDelay = Math.min(10000, retryDelay * 2);
      } else {
        retryDelay = 500;
      }
    }
  }

  function scheduleIconSync(delay = 60) {
    if (stopped) return;
    if (pushTimer && pushDelay <= delay) return;
    if (pushTimer) {
      win.clearTimeout?.(pushTimer);
    }
    pushDelay = delay;
    pushTimer = win.setTimeout?.(() => {
      pushTimer = null;
      void flushIconsNow();
    }, delay);
  }

  let hydratedFromStateManager = false;
  let lastKnownStateManager = null;
  let interactionTarget = null;

  function syncStatesFromManager(stateManager, { isInitialHydration = false } = {}) {
    if (!stateManager) return false;
    let changedAny = false;
    try {
      const states = stateManager.getAgentStates?.();
      if (states && typeof states === 'object') {
        const entries =
          states instanceof Map ? [...states.entries()] : Object.entries(states);
        for (const [cid, entry] of entries) {
          const raw = typeof entry?.getState === 'function' ? entry.getState() : entry;
          if (!raw || typeof raw !== 'object') continue;
          const convId = raw.conversationId || raw.cascadeId || cid;
          if (!convId || typeof convId !== 'string') continue;
          const res = tracker.applyUpdate(
            { ...raw, conversationId: convId },
            { isInitialHydration, source: 'manager' },
          );
          if (res.changed) {
            changedAny = true;
          }
        }
      }
    } catch {
      // 忽略 stateManager 读取异常
    }
    return changedAny;
  }

  function syncViewingContext() {
    if (stopped) return;
    const info = inspectActiveConversation(doc, win, interactionTarget);
    if (info.stateManager) {
      lastKnownStateManager = info.stateManager;
    }
    const windowFocused =
      typeof doc.hasFocus === 'function'
        ? Boolean(doc.hasFocus()) && doc.visibilityState !== 'hidden'
        : doc.visibilityState !== 'hidden';

    const res = tracker.setViewingContext({
      activeConversationId: info.conversationId,
      windowFocused,
    });
    let stateChanged = res.changed;

    if (!hydratedFromStateManager && lastKnownStateManager) {
      hydratedFromStateManager = true;
      if (syncStatesFromManager(lastKnownStateManager, { isInitialHydration: true })) {
        stateChanged = true;
      }
    }

    if (stateChanged) {
      scheduleIconSync();
    }
  }

  const stopTap = installAttentionTransportTap(win, {
    onAgentStateUpdate(update, meta) {
      syncViewingContext();
      const res = tracker.applyUpdate(update, meta);
      if (res.changed) {
        scheduleIconSync();
      }
    },
    onTrajectory(cid, payload, meta) {
      const traj = payload?.trajectory;
      if (!traj) return;
      syncViewingContext();
      const res = tracker.applyUpdate(
        {
          conversationId: cid,
          status: payload?.status,
          mainTrajectoryUpdate: { stepsUpdate: { steps: traj.steps } },
          error: payload?.error || traj?.error,
        },
        meta,
      );
      if (res.changed) {
        scheduleIconSync();
      }
    },
  });

  // 补读插件挂载前已建立连接的会话。实时流接管后优先使用实时状态。
  const statePollTimer = win.setInterval?.(() => {
    if (stopped) return;
    syncViewingContext();
    if (hydratedFromStateManager && lastKnownStateManager) {
      if (syncStatesFromManager(lastKnownStateManager, { isInitialHydration: false })) {
        scheduleIconSync();
      }
    }
  }, 1000);

  let scanRaf = false;
  function scheduleContextScan() {
    if (stopped || scanRaf) return;
    scanRaf = true;
    const run = () => {
      scanRaf = false;
      syncViewingContext();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(run);
    } else {
      win.setTimeout?.(run, 16);
    }
  }

  let followUpTimer = null;
  const onFocusOrInteraction = (event) => {
    if (event?.type === 'pointerdown' || event?.type === 'click') {
      interactionTarget = event.target;
    } else if (event?.type === 'focusin' || event?.type === 'keydown') {
      interactionTarget = null;
    }
    scheduleContextScan();
    if (followUpTimer) {
      win.clearTimeout?.(followUpTimer);
    }
    followUpTimer = win.setTimeout?.(() => {
      followUpTimer = null;
      scheduleContextScan();
    }, 120);
  };
  const onPageHide = () => {
    stopped = true;
    stopTap();
    if (pushTimer) {
      win.clearTimeout?.(pushTimer);
      pushTimer = null;
    }
    if (followUpTimer) {
      win.clearTimeout?.(followUpTimer);
      followUpTimer = null;
    }
    if (statePollTimer) {
      win.clearInterval?.(statePollTimer);
    }
    void pushIconState(0, 'none').catch(() => {});
  };

  win.addEventListener?.('focus', onFocusOrInteraction);
  win.addEventListener?.('blur', onFocusOrInteraction);
  win.addEventListener?.('pointerdown', onFocusOrInteraction, true);
  win.addEventListener?.('click', onFocusOrInteraction, true);
  win.addEventListener?.('keydown', onFocusOrInteraction, true);
  win.addEventListener?.('pagehide', onPageHide);
  doc.addEventListener?.('visibilitychange', onFocusOrInteraction);
  doc.addEventListener?.('focusin', onFocusOrInteraction);

  let observer = null;
  if (typeof win.MutationObserver === 'function' && doc.body) {
    observer = new win.MutationObserver(() => {
      scheduleContextScan();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  } else if (doc.addEventListener) {
    doc.addEventListener('DOMContentLoaded', () => {
      if (stopped || !doc.body || typeof win.MutationObserver !== 'function') return;
      observer = new win.MutationObserver(() => scheduleContextScan());
      observer.observe(doc.body, { childList: true, subtree: true });
      syncViewingContext();
    });
  }

  syncViewingContext();

  win.__myAntigravityTaskbarBadgeDebug = {
    getSnapshot: () => tracker.getSnapshot(),
    async testIcon(count = 1, level = 'completed') {
      const result = await pushIconState(count, level);
      if (count <= 0) return result;
      const trayIcon = await renderer.renderTrayIcon(level).catch(() => null);
      return trayIcon && !stopped ? pushIconState(count, level, trayIcon) : result;
    },
    clearIcon: () => {
      tracker.clearAll();
      lastPushedSig = '';
      scheduleIconSync();
      return flushIconsNow();
    },
  };

  return {
    tracker,
    syncViewingContext,
    flushIconsNow,
    dispose() {
      onPageHide();
      observer?.disconnect?.();
      win.removeEventListener?.('focus', onFocusOrInteraction);
      win.removeEventListener?.('blur', onFocusOrInteraction);
      win.removeEventListener?.('pointerdown', onFocusOrInteraction, true);
      win.removeEventListener?.('click', onFocusOrInteraction, true);
      win.removeEventListener?.('keydown', onFocusOrInteraction, true);
      win.removeEventListener?.('pagehide', onPageHide);
      doc.removeEventListener?.('visibilitychange', onFocusOrInteraction);
      doc.removeEventListener?.('focusin', onFocusOrInteraction);
    },
  };
}
