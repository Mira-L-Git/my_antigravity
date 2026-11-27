// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/taskbar-badge/src/*.js, then run `npm run sync`.

(function registerTaskbarBadgeMod(win, doc) {
// --- badge-core.js ---
/**
 * taskbar-badge 纯函数状态机（无 DOM / Node / Electron 依赖）：
 * - 按 conversationId 去重记录待查看事件；
 * - 支持「报错 >> 提问审批 >> 完成」优先级；
 * - 正在聚焦查看的会话不计入，切回查看对应会话时自动消减。
 */
const LEVEL_PRIORITY = {
  none: 0,
  completed: 1,
  approval: 2,
  error: 3,
};

const SOURCE_PRIORITY = { trajectory: 0, manager: 1, stream: 2 };

/**
 * 规范化 CascadeRunStatus（兼容数字枚举与字符串枚举）。
 * @returns {'running' | 'approval' | 'error' | 'cancelled' | 'idle' | null}
 */
function classifyRunStatus(status) {
  if (typeof status === 'number') {
    if (status === 2) return 'running';
    if (status === 3) return 'approval';
    if (status === 1) return 'idle';
    return null;
  }
  if (typeof status === 'string') {
    const upper = status.trim().toUpperCase();
    if (!upper) return null;
    if (upper.includes('ERROR') || upper.includes('FAIL')) return 'error';
    if (
      upper.includes('WAITING') ||
      upper.includes('APPROVAL') ||
      upper.includes('CONFIRM') ||
      upper.includes('INPUT_REQUIRED')
    ) {
      return 'approval';
    }
    if (upper.includes('CANCEL') || upper.includes('ABORT')) return 'cancelled';
    if (upper.includes('RUNNING') && !upper.includes('IDLE')) return 'running';
    if (
      upper.includes('IDLE') ||
      upper.includes('DONE') ||
      upper.includes('COMPLETED') ||
      upper.includes('FINISHED')
    ) {
      return 'idle';
    }
  }
  return null;
}

/**
 * 从单条步骤中提取状态信号（用于捕获顶层 status 回到 IDLE 时残留的末尾报错或等待确认）。
 */
function classifyStepStatus(step) {
  if (!step || typeof step !== 'object') return null;
  const rawError = step.error ?? step.metadata?.error;
  if (rawError && (typeof rawError !== 'object' || Object.keys(rawError).length > 0)) {
    return 'error';
  }
  const st = step.status;
  if (typeof st === 'string') {
    const upper = st.trim().toUpperCase();
    if (!upper) return null;
    if (upper.includes('ERROR') || upper.includes('FAIL')) return 'error';
    if (
      upper.includes('WAITING') ||
      upper.includes('APPROVAL') ||
      upper.includes('PENDING_USER') ||
      upper.includes('CONFIRM')
    ) {
      return 'approval';
    }
    if (upper.includes('CANCEL') || upper.includes('ABORT')) return 'cancelled';
    if (upper.includes('RUNNING')) return 'running';
  }
  return null;
}

/**
 * 从 AgentStateUpdate 或 Trajectory 对象提取当前有效状态信号。
 */
function extractUpdateSignal(update) {
  if (!update || typeof update !== 'object') return null;

  const topError = update.error ?? update.trajectoryError ?? update.lastError ?? update.errorMessage;
  if (topError && (typeof topError !== 'object' || Object.keys(topError).length > 0)) {
    return 'error';
  }

  const runKind = classifyRunStatus(update.status);
  if (runKind === 'error' || runKind === 'approval' || runKind === 'cancelled') {
    return runKind;
  }

  const steps =
    update.mainTrajectoryUpdate?.stepsUpdate?.steps ||
    update.stepsUpdate?.steps ||
    update.trajectory?.steps;

  let stepSignal = null;
  if (Array.isArray(steps) && steps.length > 0) {
    // 仅检查末尾最近几步，避免历史已处理报错一直遮蔽后续正常回合
    const start = Math.max(0, steps.length - 3);
    for (let i = steps.length - 1; i >= start; i -= 1) {
      const sig = classifyStepStatus(steps[i]);
      if (sig === 'error' || sig === 'approval') {
        stepSignal = sig;
        break;
      }
      if (!stepSignal && sig) {
        stepSignal = sig;
      }
    }
  }

  if (stepSignal === 'error' || stepSignal === 'approval') {
    return stepSignal;
  }
  if (runKind === 'running') {
    return 'running';
  }
  if (update.fullyIdle === false) {
    return 'running';
  }
  if (stepSignal === 'cancelled') {
    return 'cancelled';
  }
  if (runKind === 'idle' || update.fullyIdle === true) {
    return 'idle';
  }
  return stepSignal;
}

/**
 * 创建会话角标状态追踪器。
 */
function createBadgeTracker(initialViewing = {}) {
  const sessions = new Map();
  const unread = new Map();

  let activeConversationId = initialViewing.activeConversationId || null;
  let windowFocused =
    typeof initialViewing.windowFocused === 'boolean' ? initialViewing.windowFocused : true;
  let clock = 0;

  function isViewing(conversationId) {
    return Boolean(windowFocused && activeConversationId && activeConversationId === conversationId);
  }

  function getSnapshot() {
    let highestLevel = 'none';
    let highestRank = 0;
    const countsByLevel = { completed: 0, approval: 0, error: 0 };

    for (const item of unread.values()) {
      if (!item || !item.level) continue;
      if (Object.prototype.hasOwnProperty.call(countsByLevel, item.level)) {
        countsByLevel[item.level] += 1;
      }
      const rank = LEVEL_PRIORITY[item.level] || 0;
      if (rank > highestRank) {
        highestRank = rank;
        highestLevel = item.level;
      }
    }

    return {
      count: unread.size,
      level: highestLevel,
      countsByLevel,
      unreadConversationIds: [...unread.keys()],
      activeConversationId,
      windowFocused,
    };
  }

  function triggerUnread(conversationId, level) {
    if (!conversationId || !LEVEL_PRIORITY[level]) {
      return false;
    }
    if (isViewing(conversationId)) {
      return unread.delete(conversationId);
    }
    const existing = unread.get(conversationId);
    const nextRank = LEVEL_PRIORITY[level];
    if (existing && LEVEL_PRIORITY[existing.level] >= nextRank) {
      return false;
    }
    clock += 1;
    unread.set(conversationId, { level, updatedAt: clock });
    return true;
  }

  function setViewingContext(next = {}) {
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(next, 'activeConversationId')) {
      const nextCid = next.activeConversationId || null;
      if (nextCid !== activeConversationId) {
        activeConversationId = nextCid;
      }
    }
    if (typeof next.windowFocused === 'boolean' && next.windowFocused !== windowFocused) {
      windowFocused = next.windowFocused;
    }
    if (windowFocused && activeConversationId && unread.has(activeConversationId)) {
      unread.delete(activeConversationId);
      changed = true;
    }
    return { changed, snapshot: getSnapshot() };
  }

  function markConversationViewed(conversationId) {
    if (!conversationId) {
      return { changed: false, snapshot: getSnapshot() };
    }
    const changed = unread.delete(conversationId);
    return { changed, snapshot: getSnapshot() };
  }

  function applyUpdate(update, { isInitialHydration = false, source = 'stream', generation = 0 } = {}) {
    if (!update || typeof update !== 'object') {
      return { changed: false, snapshot: getSnapshot() };
    }
    const conversationId = update.conversationId || update.cascadeId;
    if (!conversationId || typeof conversationId !== 'string') {
      return { changed: false, snapshot: getSnapshot() };
    }

    const signal = extractUpdateSignal(update);
    if (!signal) {
      return { changed: false, snapshot: getSnapshot() };
    }

    let sess = sessions.get(conversationId);
    if (!sess) {
      sess = { wasActive: false, lastKind: null, source, generation };
      sessions.set(conversationId, sess);
    }
    // 拉取的旧轨迹和轮询快照不能覆盖实时更新。重连后忽略旧订阅的帧。
    if (SOURCE_PRIORITY[source] < SOURCE_PRIORITY[sess.source] ||
        (source === sess.source && generation < sess.generation)) {
      return { changed: false, snapshot: getSnapshot() };
    }
    const baseline = isInitialHydration && (sess.lastKind === null ||
      (sess.source === 'trajectory' && source !== 'trajectory' && !sess.wasActive));
    sess.source = source;
    sess.generation = generation;

    let changed = false;
    if (signal === 'running') {
      sess.wasActive = true;
      sess.lastKind = 'running';
    } else if (signal === 'error') {
      // 避免用户已点开消掉同一报错后，后续无状态变化的心跳重复加回角标
      if (!baseline && (sess.wasActive || sess.lastKind !== 'error')) {
        changed = triggerUnread(conversationId, 'error');
      }
      sess.wasActive = false;
      sess.lastKind = 'error';
    } else if (signal === 'approval') {
      if (!baseline && (sess.wasActive || sess.lastKind !== 'approval')) {
        changed = triggerUnread(conversationId, 'approval');
      }
      sess.wasActive = false;
      sess.lastKind = 'approval';
    } else if (signal === 'cancelled') {
      sess.wasActive = false;
      sess.lastKind = 'cancelled';
    } else if (signal === 'idle') {
      if (!baseline && sess.wasActive) {
        changed = triggerUnread(conversationId, 'completed');
      }
      sess.wasActive = false;
      sess.lastKind = 'idle';
    }

    return { changed, snapshot: getSnapshot() };
  }

  function clearAll() {
    const changed = unread.size > 0;
    unread.clear();
    return { changed, snapshot: getSnapshot() };
  }

  return {
    setViewingContext,
    markConversationViewed,
    applyUpdate,
    clearAll,
    getSnapshot,
  };
}

// --- transport-tap.js ---
/**
 * transport-tap：只读旁路监听 WebSocket (/connect-websocket) 与 fetch (GetCascadeTrajectory)，
 * 提取会话运行状态跃迁事件，绝不修改请求参数或响应流。
 */

const STREAM_AGENT_STATE_PROC = 'StreamAgentStateUpdates';
const GET_CASCADE_TRAJECTORY_PROC = 'GetCascadeTrajectory';
function createConnectEnvelopeParser(onMessage) {
  let buffer = new Uint8Array(0);
  const decoder = new TextDecoder();

  function append(chunk) {
    if (!chunk || chunk.byteLength === 0) return;
    const next = new Uint8Array(buffer.byteLength + chunk.byteLength);
    next.set(buffer, 0);
    next.set(chunk, buffer.byteLength);
    buffer = next;
  }

  return {
    push(chunk) {
      append(chunk);
      while (buffer.byteLength >= 5) {
        const flags = buffer[0];
        const len =
          ((buffer[1] << 24) >>> 0) |
          (buffer[2] << 16) |
          (buffer[3] << 8) |
          buffer[4];
        const total = 5 + len;
        if (len > 32 * 1024 * 1024) {
          buffer = new Uint8Array(0);
          return;
        }
        if (buffer.byteLength < total) {
          return;
        }
        const payloadBytes = buffer.subarray(5, total);
        buffer = buffer.subarray(total);

        if ((flags & 128) !== 0 || (flags & 1) !== 0) {
          continue;
        }
        try {
          const text = decoder.decode(payloadBytes);
          if (text && text[0] === '{') {
            onMessage(JSON.parse(text));
          }
        } catch {
          // 忽略非 JSON 或损坏帧
        }
      }
    },
    reset() {
      buffer = new Uint8Array(0);
    },
  };
}

function extractRequestConversationId(initBody) {
  if (!initBody) return null;
  try {
    let text = '';
    if (typeof initBody === 'string') {
      text = initBody;
    } else if (initBody instanceof Uint8Array) {
      const slice =
        initBody.byteLength > 5 && (initBody[0] === 0 || initBody[0] === 1)
          ? initBody.subarray(5)
          : initBody;
      text = new TextDecoder().decode(slice);
    }
    if (!text || text[0] !== '{') return null;
    const obj = JSON.parse(text);
    return obj.conversationId || obj.cascadeId || null;
  } catch {
    return null;
  }
}
function installAttentionTransportTap(win, handlers = {}) {
  const { onAgentStateUpdate, onTrajectory } = handlers;
  if (!win || win.__myAntigravityTaskbarBadgeTapInstalled) {
    return () => {};
  }
  win.__myAntigravityTaskbarBadgeTapInstalled = true;

  const streamsBySocket = new WeakMap();
  let requestGeneration = 0;
  let stopped = false;
  const OrigWebSocket = win.WebSocket;
  const origFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;

  function handleOutboundText(raw, activeStreams) {
    if (typeof raw !== 'string' || raw[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.streamId !== 'string') return;
    if (msg.type === 'cancel') {
      activeStreams.delete(msg.streamId);
      return;
    }
    if (msg.type === 'start' && typeof msg.procedure === 'string') {
      if (msg.procedure.includes(STREAM_AGENT_STATE_PROC)) {
        const cid = msg.payload?.conversationId || msg.payload?.cascadeId || null;
        activeStreams.set(msg.streamId, {
          kind: 'state',
          conversationId: cid,
          generation: ++requestGeneration,
          receivedFirstFrame: false,
        });
      } else if (
        msg.procedure.includes(GET_CASCADE_TRAJECTORY_PROC) &&
        !msg.procedure.includes('GeneratorMetadata') &&
        !msg.procedure.includes('Steps')
      ) {
        const cid = msg.payload?.cascadeId || msg.payload?.conversationId || null;
        activeStreams.set(msg.streamId, {
          kind: 'trajectory',
          conversationId: cid,
          generation: ++requestGeneration,
          receivedFirstFrame: false,
        });
      }
    }
  }

  function handleInboundText(raw, activeStreams) {
    if (typeof raw !== 'string' || raw[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.streamId !== 'string') return;
    const meta = activeStreams.get(msg.streamId);
    if (!meta) return;

    if (msg.type === 'end') {
      activeStreams.delete(msg.streamId);
      return;
    }
    if (msg.type !== 'data' || !msg.payload || typeof msg.payload !== 'object') {
      return;
    }

    if (meta.kind === 'state' && msg.payload.update) {
      onAgentStateUpdate?.(msg.payload.update, {
        isInitialHydration: !meta.receivedFirstFrame,
        source: 'stream',
        generation: meta.generation,
      });
      meta.receivedFirstFrame = true;
    } else if (meta.kind === 'trajectory' && msg.payload.trajectory) {
      const cid = meta.conversationId || msg.payload.trajectory?.cascadeId || null;
      if (cid) {
        onTrajectory?.(cid, msg.payload, {
          isInitialHydration: !meta.receivedFirstFrame,
          source: 'trajectory',
          generation: meta.generation,
        });
        meta.receivedFirstFrame = true;
      }
    }
  }

  if (typeof OrigWebSocket === 'function') {
    class BadgeTapWebSocket extends OrigWebSocket {
      constructor(url, protocols) {
        if (protocols !== undefined) {
          super(url, protocols);
        } else {
          super(url);
        }
        try {
          const urlStr = String(url || '');
          if (urlStr.includes('/connect-websocket')) {
            const activeStreams = new Map();
            streamsBySocket.set(this, activeStreams);
            this.addEventListener('message', (event) => {
              if (!stopped) handleInboundText(event?.data, activeStreams);
            });
            this.addEventListener('close', () => {
              activeStreams.clear();
              streamsBySocket.delete(this);
            });
          }
        } catch {
          // 忽略监听器异常，不影响原生 WebSocket
        }
      }

      send(data) {
        try {
          const activeStreams = streamsBySocket.get(this);
          if (!stopped && activeStreams) handleOutboundText(data, activeStreams);
        } catch {
          // 旁路失败绝不阻断原发送
        }
        return super.send(data);
      }
    }
    try {
      win.WebSocket = BadgeTapWebSocket;
    } catch {
      // 严禁在不可覆写环境崩溃
    }
  }

  if (origFetch) {
    win.fetch = function patchedFetch(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isStateStream = url.includes(STREAM_AGENT_STATE_PROC);
      const isTrajectory =
        url.includes(GET_CASCADE_TRAJECTORY_PROC) &&
        !url.includes('GeneratorMetadata') &&
        !url.includes('Steps');
      const fallbackCid = isTrajectory ? extractRequestConversationId(init?.body) : null;

      const resPromise = origFetch(input, init);
      if (stopped || (!isStateStream && !isTrajectory)) {
        return resPromise;
      }
      const generation = ++requestGeneration;

      function observeMessage(obj, isInitialHydration) {
        if (stopped) return false;
        if (isStateStream && obj?.update) {
          onAgentStateUpdate?.(obj.update, { isInitialHydration, source: 'stream', generation });
          return true;
        }
        if (isTrajectory && obj?.trajectory) {
          const cid = fallbackCid || obj.trajectory.cascadeId;
          if (cid) {
            onTrajectory?.(cid, obj, { isInitialHydration, source: 'trajectory', generation });
            return true;
          }
        }
        return false;
      }

      resPromise
        .then((response) => {
          try {
            if (stopped || !response || !response.ok || typeof response.clone !== 'function') {
              return;
            }
            const cloned = response.clone();
            const ct = String(cloned.headers?.get?.('content-type') || '').toLowerCase();

            if (ct.includes('application/json') && !ct.includes('connect')) {
              void cloned
                .json()
                .then((obj) => observeMessage(obj, true))
                .catch(() => {});
              return;
            }

            if (cloned.body?.getReader) {
              let first = true;
              const reader = cloned.body.getReader();
              const parser = createConnectEnvelopeParser((obj) => {
                if (observeMessage(obj, first)) first = false;
              });
              (async () => {
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) parser.push(value);
                  }
                } catch {
                  // 忽略流读取中断
                }
              })();
            }
          } catch {
            // 旁路 clone 失败不影响原响应
          }
        })
        .catch(() => {});

      return resPromise;
    };
  }

  return () => {
    stopped = true;
  };
}

// --- icon-renderer.js ---
const TASKBAR_BADGE_STYLES = {
  completed: {
    fill: '#27272A',
    text: '#FFFFFF',
  },
  approval: {
    fill: '#FACC15',
    text: '#111827',
  },
  error: {
    fill: '#EF4444',
    text: '#FFFFFF',
  },
};
const OVERLAY_DPI_SPECS = [
  { scaleFactor: 1.0, size: 16 },
  { scaleFactor: 1.25, size: 20 },
  { scaleFactor: 1.5, size: 24 },
  { scaleFactor: 2.0, size: 32 },
  { scaleFactor: 2.5, size: 40 },
];
function formatBadgeCount(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 绘制高对比、无细边发糊的 Windows setOverlayIcon 独立角标（按目标 DPI 物理尺寸逐档绘制）。
 */
function drawTaskbarOverlayIcon(ctx, count, level, size = 32) {
  const label = formatBadgeCount(count);
  const style = TASKBAR_BADGE_STYLES[level] || TASKBAR_BADGE_STYLES.completed;

  ctx.clearRect(0, 0, size, size);
  if (!label) {
    return;
  }

  ctx.save();
  const isThreeChars = label.length >= 3;

  if (isThreeChars) {
    const h = Math.round(size * 0.8);
    const y = Math.round((size - h) / 2);
    drawRoundedRectPath(ctx, 0, y, size, h, h / 2);
  } else {
    const r = size / 2 - 0.5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = style.fill;
  ctx.fill();

  const fontSize =
    label.length === 1
      ? Math.round(size * 0.72)
      : label.length === 2
        ? Math.round(size * 0.56)
        : Math.round(size * 0.42);

  ctx.fillStyle = style.text;
  ctx.font = `800 ${fontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + Math.max(0.5, size * 0.03));
  ctx.restore();
}
const TRAY_DOT_COLORS = {
  completed: '#22C55E',
  approval: '#FACC15',
  error: '#EF4444',
};

/**
 * 绘制系统托盘图标：圆点直径约占画布 50%，底图微向左下偏移，
 * 使圆点圆心依然精准落在白色圆角方框右上边角且不被画布裁剪。
 */
function drawTrayDottedIcon(ctx, baseImg, level, size = 64) {
  ctx.clearRect(0, 0, size, size);
  const color = TRAY_DOT_COLORS[level];
  if (!color) {
    if (baseImg) {
      ctx.drawImage(baseImg, 0, 0, size, size);
    }
    return;
  }

  if (baseImg) {
    const offsetX = -size * 0.05;
    const offsetY = size * 0.12;
    const drawSize = size * 0.92;
    ctx.drawImage(baseImg, offsetX, offsetY, drawSize, drawSize);
  }

  ctx.save();
  const radius = Math.max(6, Math.round(size * 0.25));
  const cx = Math.round(size * 0.725);
  const cy = Math.round(size * 0.275);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.lineWidth = Math.max(2, Math.round(size * 0.04));
  ctx.strokeStyle = '#18181B';
  ctx.stroke();
  ctx.restore();
}
function createIconRenderer(win, doc, bridge) {
  let baseImgPromise = null;
  let cachedOverlay = null;
  const cache = new Map();

  function renderTaskbarIcon(count, level) {
    const label = formatBadgeCount(count);
    if (!label || !Object.hasOwn(TASKBAR_BADGE_STYLES, level)) return {};
    if (cachedOverlay?.label === label && cachedOverlay.level === level) return cachedOverlay.icons;

    const windowReps = [];
    for (const { scaleFactor, size } of OVERLAY_DPI_SPECS) {
      const canvas = doc.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext?.('2d');
      if (!ctx) continue;
      drawTaskbarOverlayIcon(ctx, count, level, size);
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl) windowReps.push({ scaleFactor, width: size, height: size, dataUrl });
    }
    const windowPngDataUrl = windowReps.find((rep) => rep.scaleFactor === 2)?.dataUrl || windowReps.at(-1)?.dataUrl;
    const icons = { windowReps, windowPngDataUrl };
    if (windowPngDataUrl) cachedOverlay = { label, level, icons };
    return icons;
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof win.Image !== 'function') {
        resolve(null);
        return;
      }
      const img = new win.Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function ensureBaseImage() {
    if (!baseImgPromise) {
      baseImgPromise = (async () => {
        if (!bridge || typeof bridge.getBaseIcon !== 'function') {
          return null;
        }
        const res = await bridge.getBaseIcon();
        if (!res?.ok || !res.dataUrl) {
          return null;
        }
        return loadImageFromDataUrl(res.dataUrl);
      })().catch(() => null).then((img) => {
        if (!img) baseImgPromise = null;
        return img;
      });
    }
    return baseImgPromise;
  }

  async function renderTrayIcon(level) {
    if (cache.has(level)) return cache.get(level);
    if (!TRAY_DOT_COLORS[level] || typeof doc?.createElement !== 'function') return null;
    const baseImg = await ensureBaseImage();
    if (!baseImg) return null;
    if (cache.has(level)) return cache.get(level);
    const canvas = doc.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    drawTrayDottedIcon(ctx, baseImg, level, 64);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl) cache.set(level, dataUrl);
    return dataUrl;
  }

  return {
    renderTaskbarIcon,
    renderTrayIcon,
    getCachedTrayIcon: (level) => cache.get(level) || null,
  };
}

// --- entry.js ---
/**
 * taskbar-badge 运行时入口：
 * - 旁路监听会话状态跃迁，追踪后台/非当前会话的 完成 / 提问审批 / 报错；
 * - 结合 React Fiber 读取当前正在查看的 conversationId 与窗口聚焦状态，点开对应会话自动消减；
 * - 通过 __myAntigravityAttention IPC 同步更新任务栏状态与托盘圆点。
 */



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
function inspectActiveConversation(doc, win = null, interactionTarget = null) {
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
function installTaskbarBadgePlugin(win = window, doc = document) {
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

  installTaskbarBadgePlugin(win, doc);
})(window, document);
