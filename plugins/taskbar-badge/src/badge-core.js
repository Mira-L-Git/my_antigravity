/**
 * taskbar-badge 纯函数状态机（无 DOM / Node / Electron 依赖）：
 * - 按 conversationId 去重记录待查看事件；
 * - 支持「报错 >> 提问审批 >> 完成」优先级；
 * - 正在聚焦查看的会话不计入，切回查看对应会话时自动消减。
 */

export const LEVEL_PRIORITY = {
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
export function classifyRunStatus(status) {
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
export function classifyStepStatus(step) {
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
export function extractUpdateSignal(update) {
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
export function createBadgeTracker(initialViewing = {}) {
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
