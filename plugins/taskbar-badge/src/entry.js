/**
 * taskbar-badge 运行时入口：
 * - 旁路监听会话状态跃迁，追踪后台/非当前会话的 完成 / 提问审批 / 报错；
 * - 结合 React Fiber 读取当前正在查看的 conversationId 与窗口聚焦状态，点开对应会话自动消减；
 * - 通过 __myAntigravityAttention IPC 同步更新 Windows 任务栏数字角标与托盘圆点。
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

/**
 * 沿聊天输入框 React Fiber 树只读提取当前展示的 cascadeId 及可选 stateManager。
 */
export function inspectActiveConversation(doc, win = null) {
  if (!doc?.querySelectorAll) {
    return { conversationId: null, stateManager: null };
  }
  const boxes = [
    ...doc.querySelectorAll('[data-testid="agent-input-box"]'),
    ...doc.querySelectorAll('[contenteditable="true"][data-lexical-editor="true"]'),
  ];
  // 优先扫描当前可见的输入框，避免后台/分栏隐藏容器干扰当前会话判定
  boxes.sort((a, b) => Number(isElementVisible(win, b)) - Number(isElementVisible(win, a)));

  let fallbackStateManager = null;
  for (const el of boxes) {
    if (!el || typeof el !== 'object') continue;
    const keys = Object.keys(el);
    const fiberKey = keys.find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
    );
    let fiber = fiberKey ? el[fiberKey] : null;
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
    if (conversationId && inExistingConversation && isElementVisible(win, el)) {
      return { conversationId, stateManager: stateManager || fallbackStateManager };
    }
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
  let lastPushedSig = '';
  let pushSeq = 0;
  let stopped = false;

  async function pushIconState(count, level) {
    if (!bridge || typeof bridge.setAttentionState !== 'function') {
      return { ok: false, reason: 'no-bridge' };
    }
    const mySeq = ++pushSeq;
    if (count <= 0 || level === 'none') {
      return await bridge.setAttentionState({
        count: 0,
        level: 'none',
        windowPngDataUrl: null,
        windowReps: null,
        trayPngDataUrl: null,
      });
    }
    const { windowPngDataUrl, windowReps, trayPngDataUrl } = await renderer.renderIcons(
      count,
      level,
    );
    if (stopped || mySeq !== pushSeq) {
      return { ok: false, reason: 'superseded' };
    }
    return await bridge.setAttentionState({
      count,
      level,
      windowPngDataUrl,
      windowReps,
      trayPngDataUrl,
    });
  }

  async function flushIconsNow() {
    if (stopped || !bridge || typeof bridge.setAttentionState !== 'function') {
      return;
    }
    const snap = tracker.getSnapshot();
    const sig = `${snap.count}:${snap.level}`;
    if (sig === lastPushedSig) {
      return;
    }
    lastPushedSig = sig;
    try {
      await pushIconState(snap.count, snap.level);
    } catch {
      // 忽略偶发 IPC 错误，避免影响聊天界面
    }
  }

  function scheduleIconSync() {
    if (stopped) return;
    if (pushTimer) {
      win.clearTimeout?.(pushTimer);
    }
    pushTimer = win.setTimeout?.(() => {
      pushTimer = null;
      void flushIconsNow();
    }, 60);
  }

  let hydratedFromStateManager = false;
  let lastKnownStateManager = null;

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
            { isInitialHydration },
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
    const info = inspectActiveConversation(doc, win);
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

  // 兜底轮询 stateManager：防止页面早期已建立的连接遗漏个别跃迁
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
  const onFocusOrInteraction = () => {
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
    void bridge?.setAttentionState?.({
      count: 0,
      level: 'none',
      windowPngDataUrl: null,
      trayPngDataUrl: null,
    });
  };

  win.addEventListener?.('focus', onFocusOrInteraction);
  win.addEventListener?.('blur', onFocusOrInteraction);
  win.addEventListener?.('pointerdown', onFocusOrInteraction, true);
  win.addEventListener?.('click', onFocusOrInteraction, true);
  win.addEventListener?.('keydown', onFocusOrInteraction, true);
  win.addEventListener?.('pagehide', onPageHide);
  doc.addEventListener?.('visibilitychange', onFocusOrInteraction);

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
    testIcon: (count = 1, level = 'completed') => pushIconState(count, level),
    clearIcon: () => {
      tracker.clearAll();
      lastPushedSig = '0:none';
      return pushIconState(0, 'none');
    },
  };

  return {
    tracker,
    syncViewingContext,
    flushIconsNow,
    dispose() {
      stopped = true;
      stopTap();
      observer?.disconnect?.();
      if (statePollTimer) {
        win.clearInterval?.(statePollTimer);
      }
      win.removeEventListener?.('focus', onFocusOrInteraction);
      win.removeEventListener?.('blur', onFocusOrInteraction);
      win.removeEventListener?.('pointerdown', onFocusOrInteraction, true);
      win.removeEventListener?.('click', onFocusOrInteraction, true);
      win.removeEventListener?.('keydown', onFocusOrInteraction, true);
      win.removeEventListener?.('pagehide', onPageHide);
      doc.removeEventListener?.('visibilitychange', onFocusOrInteraction);
    },
  };
}
