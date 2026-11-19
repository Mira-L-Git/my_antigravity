// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/session-status/src/*.js, then run `npm run sync`.

(function registerSessionStatusMod(win, doc) {
// --- stats-core.js ---
/**
 * session-status 纯函数统计核心（无 DOM / Node 依赖，可同时在浏览器与测试中运行）。
 */
function toNum(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 解析 protobuf Duration JSON（如 "1.234s" 或 { seconds, nanos }）为毫秒数。
 */
function parseDurationMs(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = /^(-?\d+(?:\.\d+)?)s$/i.exec(value.trim());
    if (!match) return null;
    const ms = Number(match[1]) * 1000;
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  }
  if (typeof value === 'object') {
    const sec = toNum(value.seconds) ?? 0;
    const nanos = toNum(value.nanos) ?? 0;
    const ms = sec * 1000 + nanos / 1e6;
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  }
  return null;
}

/**
 * 解析 protobuf Timestamp JSON（ISO 字符串或 { seconds, nanos }）为毫秒时间戳。
 */
function parseTimestampMs(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'object') {
    const sec = toNum(value.seconds);
    if (sec == null) return null;
    const nanos = toNum(value.nanos) ?? 0;
    return sec * 1000 + nanos / 1e6;
  }
  return null;
}

/**
 * 规范化 TokenType（兼容数字枚举与字符串枚举）。
 */
function normalizeTokenType(type) {
  if (typeof type === 'number') {
    switch (type) {
      case 7:
        return 'CHAT_MESSAGES';
      case 6:
        return 'SUBAGENTS';
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 8:
      case 9:
      case 10:
        return 'SYSTEM_AND_TOOLS';
      default:
        return 'OTHER';
    }
  }
  if (typeof type === 'string') {
    const upper = type.toUpperCase();
    if (upper.includes('CHAT_MESSAGES')) return 'CHAT_MESSAGES';
    if (upper.includes('SUBAGENTS')) return 'SUBAGENTS';
    if (
      upper.includes('SYSTEM_PROMPT') ||
      upper.includes('TOOLS') ||
      upper.includes('RULES') ||
      upper.includes('SKILLS') ||
      upper.includes('WORKFLOWS') ||
      upper.includes('PLUGINS') ||
      upper.includes('FLOWS')
    ) {
      return 'SYSTEM_AND_TOOLS';
    }
  }
  return 'OTHER';
}

function isRunStatusActive(status) {
  if (typeof status === 'number') {
    // CascadeRunStatus: RUNNING=2, WAITING_FOR_USER=3 等；IDLE=1, UNSPECIFIED=0
    return status === 2;
  }
  if (typeof status === 'string') {
    const u = status.toUpperCase();
    return u.includes('RUNNING') && !u.includes('IDLE');
  }
  return false;
}
function createConversationState(conversationId = '') {
  return {
    conversationId,
    status: null,
    fullyIdle: true,
    turnsByIndex: new Map(),
    turnsTotal: 0,
    totalStepsLength: 0,
    stepsByIndex: new Map(),
    generatorMetadatasByIndex: new Map(),
    totalGeneratorMetadataLength: 0,
    generatorMetadataHydrated: false,
    stepsHydrated: false,
    compactedAtStepIndices: [],
    contextWindowUsage: null,
    costSummary: null,
    updatedAt: null,
  };
}
function createConversationStore() {
  const map = new Map();
  return {
    get(conversationId) {
      return conversationId ? map.get(conversationId) || null : null;
    },
    ensure(conversationId) {
      let state = map.get(conversationId);
      if (!state) {
        state = createConversationState(conversationId);
        map.set(conversationId, state);
      }
      return state;
    },
    has(conversationId) {
      return Boolean(conversationId && map.has(conversationId));
    },
    clear() {
      map.clear();
    },
  };
}

function trimMapAbove(map, limit) {
  if (!Number.isFinite(limit) || limit < 0) return;
  for (const key of map.keys()) {
    if (key >= limit) {
      map.delete(key);
    }
  }
}

function applyTurnsUpdate(state, turnsUpdate) {
  if (!turnsUpdate || typeof turnsUpdate !== 'object') return;
  const total = toNum(turnsUpdate.totalLength);
  if (total != null && total >= 0) {
    state.turnsTotal = total;
    trimMapAbove(state.turnsByIndex, total);
  }
  if (Array.isArray(turnsUpdate.turns)) {
    for (const turn of turnsUpdate.turns) {
      if (!turn || typeof turn !== 'object') continue;
      const idx = toNum(turn.index);
      const startStepIndex = toNum(turn.startStepIndex);
      if (idx == null || startStepIndex == null) continue;
      if (total != null && idx >= total) continue;
      state.turnsByIndex.set(idx, {
        index: idx,
        startStepIndex,
        startTimeMs: parseTimestampMs(turn.startTime),
      });
    }
  }
}

function extractGeneratorEntry(meta, index) {
  if (!meta || typeof meta !== 'object') return null;
  // 兼容 protojson 扁平字段 (meta.chatModel) 与 @bufbuild/protobuf 解码后的 oneof (meta.metadata.case === 'chatModel')
  const chatModel =
    meta.chatModel ||
    (meta.metadata?.case === 'chatModel' ? meta.metadata.value : null);
  if (!chatModel || typeof chatModel !== 'object') {
    return {
      index,
      stepIndices: Array.isArray(meta.stepIndices)
        ? meta.stepIndices.map(toNum).filter((n) => n != null)
        : [],
      executionId: meta.executionId || null,
      hasChatModel: false,
    };
  }
  const usage = chatModel.usage || {};
  const inputTokens = toNum(usage.inputTokens) ?? 0;
  const cacheReadTokens = toNum(usage.cacheReadTokens) ?? 0;
  const cacheWriteTokens = toNum(usage.cacheWriteTokens) ?? 0;
  const thinkingOutputTokens = toNum(usage.thinkingOutputTokens);
  const responseOutputTokens = toNum(usage.responseOutputTokens);
  let outputTokens = toNum(usage.outputTokens);
  if (outputTokens == null && (thinkingOutputTokens != null || responseOutputTokens != null)) {
    outputTokens = (thinkingOutputTokens ?? 0) + (responseOutputTokens ?? 0);
  }
  const streamingMs = parseDurationMs(chatModel.streamingDuration);
  const ttftMs = parseDurationMs(chatModel.timeToFirstToken);
  const csm = chatModel.chatStartMetadata || {};
  const stepIndices = Array.isArray(meta.stepIndices)
    ? meta.stepIndices.map(toNum).filter((n) => n != null)
    : [];

  return {
    index,
    stepIndices,
    startStepIndex: toNum(csm.startStepIndex) ?? (stepIndices.length ? stepIndices[0] : null),
    createdAtMs: parseTimestampMs(csm.createdAt),
    executionId: meta.executionId || null,
    modelName: chatModel.modelDisplayName || usage.model || chatModel.model || null,
    hasChatModel: true,
    inputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: outputTokens ?? 0,
    thinkingOutputTokens: thinkingOutputTokens ?? 0,
    responseOutputTokens: responseOutputTokens ?? 0,
    streamingMs,
    ttftMs,
    contextWindowMetadata: csm.contextWindowMetadata || null,
  };
}

function extractStepEntry(step, idx) {
  if (!step || typeof step !== 'object') return null;
  const md = step.metadata || {};
  const mu = md.modelUsage || null;
  const inputTokens = mu ? toNum(mu.inputTokens) : null;
  const cacheReadTokens = mu ? toNum(mu.cacheReadTokens) : null;
  const outputTokens = mu ? toNum(mu.outputTokens) : null;
  return {
    index: idx,
    type: step.type ?? null,
    status: step.status ?? null,
    createdAtMs: parseTimestampMs(md.createdAt),
    startedAtMs: parseTimestampMs(md.startedAt),
    finishedGeneratingAtMs: parseTimestampMs(md.finishedGeneratingAt),
    lastCompletedChunkAtMs: parseTimestampMs(md.lastCompletedChunkAt),
    completedAtMs: parseTimestampMs(md.completedAt),
    viewableAtMs: parseTimestampMs(md.viewableAt),
    modelUsage:
      inputTokens != null || cacheReadTokens != null || outputTokens != null
        ? {
            inputTokens: inputTokens ?? 0,
            cacheReadTokens: cacheReadTokens ?? 0,
            outputTokens: outputTokens ?? 0,
            thinkingOutputTokens: toNum(mu.thinkingOutputTokens) ?? 0,
            responseOutputTokens: toNum(mu.responseOutputTokens) ?? 0,
          }
        : null,
  };
}

function applyTrajectoryUpdate(state, trajUpdate) {
  if (!trajUpdate || typeof trajUpdate !== 'object') return;

  if (trajUpdate.stepsUpdate && typeof trajUpdate.stepsUpdate === 'object') {
    const su = trajUpdate.stepsUpdate;
    const total = toNum(su.totalLength);
    if (total != null && total >= 0) {
      state.totalStepsLength = total;
      trimMapAbove(state.stepsByIndex, total);
    }
    if (Array.isArray(su.steps)) {
      const startIdx = toNum(su.pageBounds?.startIndex) ?? 0;
      const indices = Array.isArray(su.indices) ? su.indices : null;
      for (let i = 0; i < su.steps.length; i++) {
        const idx = indices ? toNum(indices[i]) : startIdx + i;
        if (idx == null) continue;
        const entry = extractStepEntry(su.steps[i], idx);
        if (entry) {
          state.stepsByIndex.set(idx, entry);
        }
      }
      if (state.stepsByIndex.size > 2000) {
        const sortedKeys = [...state.stepsByIndex.keys()].sort((a, b) => a - b);
        for (let i = 0; i < sortedKeys.length - 1500; i++) {
          state.stepsByIndex.delete(sortedKeys[i]);
        }
      }
    }
  }

  if (trajUpdate.generatorMetadatasUpdate && typeof trajUpdate.generatorMetadatasUpdate === 'object') {
    const gu = trajUpdate.generatorMetadatasUpdate;
    const total = toNum(gu.totalLength);
    if (total != null && total >= 0) {
      state.totalGeneratorMetadataLength = total;
      trimMapAbove(state.generatorMetadatasByIndex, total);
    }
    if (Array.isArray(gu.generatorMetadatas)) {
      const startIdx = toNum(gu.pageBounds?.startIndex) ?? 0;
      const indices = Array.isArray(gu.indices) ? gu.indices : null;
      for (let i = 0; i < gu.generatorMetadatas.length; i++) {
        const idx = indices ? toNum(indices[i]) : startIdx + i;
        if (idx == null) continue;
        const entry = extractGeneratorEntry(gu.generatorMetadatas[i], idx);
        if (entry) {
          state.generatorMetadatasByIndex.set(idx, entry);
        }
      }
    }
  }
}

/**
 * 将单条 AgentStateUpdate 应用到会话状态中。
 */
function applyAgentStateUpdate(store, update) {
  if (!update || typeof update !== 'object') return null;
  const conversationId = update.conversationId;
  if (!conversationId || typeof conversationId !== 'string') return null;

  const state = store.ensure(conversationId);
  if (update.status !== undefined) state.status = update.status;
  if (typeof update.fullyIdle === 'boolean') state.fullyIdle = update.fullyIdle;
  if (update.turnsUpdate) applyTurnsUpdate(state, update.turnsUpdate);
  if (Array.isArray(update.compactionInfo?.compactedAtStepIndices)) {
    state.compactedAtStepIndices = update.compactionInfo.compactedAtStepIndices
      .map(toNum)
      .filter((n) => n != null);
  }
  if (update.contextWindowUsage !== undefined) {
    state.contextWindowUsage = update.contextWindowUsage;
  }
  if (update.costSummary !== undefined) {
    state.costSummary = update.costSummary;
  }
  if (update.mainTrajectoryUpdate) {
    applyTrajectoryUpdate(state, update.mainTrajectoryUpdate);
  }
  state.updatedAt = Date.now();
  return state;
}

/**
 * 合并分页拉取的 GetCascadeTrajectoryGeneratorMetadata 结果。
 */
function applyGeneratorMetadataList(store, conversationId, list, offset = 0, markHydrated = false) {
  if (!conversationId || !Array.isArray(list)) return null;
  const state = store.ensure(conversationId);
  for (let i = 0; i < list.length; i++) {
    const idx = offset + i;
    const entry = extractGeneratorEntry(list[i], idx);
    if (entry) {
      state.generatorMetadatasByIndex.set(idx, entry);
    }
  }
  state.totalGeneratorMetadataLength = Math.max(
    state.totalGeneratorMetadataLength,
    offset + list.length,
  );
  if (markHydrated) state.generatorMetadataHydrated = true;
  state.updatedAt = Date.now();
  return state;
}

/**
 * 合并分页拉取的 GetCascadeTrajectorySteps 结果（仅提取时间戳与 modelUsage 标量）。
 */
function applyStepsList(store, conversationId, steps, offset = 0, markHydrated = false) {
  if (!conversationId || !Array.isArray(steps)) return null;
  const state = store.ensure(conversationId);
  for (let i = 0; i < steps.length; i++) {
    const idx = offset + i;
    const entry = extractStepEntry(steps[i], idx);
    if (entry) {
      state.stepsByIndex.set(idx, entry);
    }
  }
  state.totalStepsLength = Math.max(state.totalStepsLength, offset + steps.length);
  if (markHydrated) state.stepsHydrated = true;
  state.updatedAt = Date.now();
  return state;
}

/**
 * 将 GetCascadeTrajectory 响应（全量轨迹）合并到会话状态（主要作为初始补充）。
 */
function applyTrajectoryResponse(store, conversationId, response) {
  if (!conversationId || !response || typeof response !== 'object') return null;
  const trajectory = response.trajectory || response;
  if (!trajectory || typeof trajectory !== 'object') return null;
  const state = store.ensure(conversationId);
  if (Array.isArray(trajectory.steps)) {
    applyStepsList(store, conversationId, trajectory.steps, 0, true);
  }
  if (Array.isArray(trajectory.generatorMetadata)) {
    applyGeneratorMetadataList(store, conversationId, trajectory.generatorMetadata, 0, true);
  }
  state.updatedAt = Date.now();
  return state;
}

/**
 * 从 Antigravity 前端内存态 (S2a.peek(id).getState()) 恢复初始快照。
 */
function hydrateFromClientState(store, clientState) {
  if (!clientState || typeof clientState !== 'object') return null;
  const cid = clientState.conversationId;
  if (!cid || typeof cid !== 'string') return null;
  const state = store.ensure(cid);
  if (clientState.status !== undefined) state.status = clientState.status;
  if (typeof clientState.fullyIdle === 'boolean') state.fullyIdle = clientState.fullyIdle;
  if (Array.isArray(clientState.compactedAtStepIndices)) {
    state.compactedAtStepIndices = clientState.compactedAtStepIndices
      .map(toNum)
      .filter((n) => n != null);
  }
  if (clientState.contextWindowUsage !== undefined) {
    state.contextWindowUsage = clientState.contextWindowUsage;
  }
  if (clientState.costSummary !== undefined) {
    state.costSummary = clientState.costSummary;
  }
  if (clientState.turns && typeof clientState.turns === 'object') {
    const entries = Array.isArray(clientState.turns)
      ? clientState.turns.map((t, i) => [i, t])
      : Object.entries(clientState.turns);
    state.turnsTotal = Math.max(state.turnsTotal, entries.length);
    for (const [k, t] of entries) {
      if (!t || typeof t !== 'object') continue;
      const idx = toNum(k);
      const startStepIndex = toNum(t.startStepIndex);
      if (idx == null || startStepIndex == null) continue;
      state.turnsByIndex.set(idx, {
        index: idx,
        startStepIndex,
        startTimeMs: toNum(t.startTimeMs) ?? parseTimestampMs(t.startTime),
      });
    }
  }
  const slice = clientState.trajectorySlice;
  if (slice && typeof slice === 'object') {
    const totalSteps = toNum(slice.totalStepsLength);
    if (totalSteps != null) state.totalStepsLength = Math.max(state.totalStepsLength, totalSteps);
    const totalGen = toNum(slice.totalGeneratorMetadataLength);
    if (totalGen != null) {
      state.totalGeneratorMetadataLength = Math.max(state.totalGeneratorMetadataLength, totalGen);
    }
    if (Array.isArray(slice.stepsInSlice)) {
      const startStep = toNum(slice.stepsSlice?.startIndex) ?? 0;
      const baseStep =
        startStep < 0 && totalSteps != null ? Math.max(0, totalSteps + startStep) : Math.max(0, startStep);
      for (let i = 0; i < slice.stepsInSlice.length; i++) {
        const entry = extractStepEntry(slice.stepsInSlice[i], baseStep + i);
        if (entry) {
          state.stepsByIndex.set(baseStep + i, entry);
        }
      }
    }
    if (Array.isArray(slice.generatorMetadatasInSlice)) {
      const startIdx = toNum(slice.generatorMetadataSlice?.startIndex) ?? 0;
      const base = startIdx < 0 && totalGen != null ? Math.max(0, totalGen + startIdx) : Math.max(0, startIdx);
      for (let i = 0; i < slice.generatorMetadatasInSlice.length; i++) {
        const entry = extractGeneratorEntry(slice.generatorMetadatasInSlice[i], base + i);
        if (entry) {
          state.generatorMetadatasByIndex.set(base + i, entry);
        }
      }
    }
  }
  state.updatedAt = Date.now();
  return state;
}

function findTurnIndexForStep(sortedTurns, stepIndex) {
  if (!sortedTurns.length || stepIndex == null) return null;
  let lo = 0;
  let hi = sortedTurns.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTurns[mid].startStepIndex <= stepIndex) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? sortedTurns[ans].index : null;
}

function parseCostSection(section) {
  if (!section || typeof section !== 'object') return null;
  const input = toNum(section.input?.tokens) ?? 0;
  const cacheRead = toNum(section.cacheRead?.tokens) ?? 0;
  const output = toNum(section.output?.tokens) ?? 0;
  const thinking = toNum(section.thinking?.tokens) ?? 0;
  const response = toNum(section.response?.tokens) ?? 0;
  const tools = toNum(section.tools?.tokens) ?? 0;
  const generationCount = toNum(section.generationCount) ?? 0;
  const estimatedCostUsd = toNum(section.estimatedCostUsd);
  const pricing = section.pricing || null;
  return {
    input,
    cacheRead,
    output,
    thinking,
    response,
    tools,
    generationCount,
    estimatedCostUsd,
    pricing,
  };
}

function computeContextBreakdown(cwu) {
  if (!cwu || typeof cwu !== 'object') {
    return { used: null, max: null, percent: null, groups: null, afterCompaction: false };
  }
  const used = toNum(cwu.estimatedTokensUsed);
  const max = toNum(cwu.maxContextTokens);
  const percent =
    used != null && max != null && max > 0
      ? Math.min(100, Math.max(0, Math.round((used / max) * 100)))
      : null;

  const rawGroups = Array.isArray(cwu.tokenGroups)
    ? cwu.tokenGroups
    : Array.isArray(cwu.tokenBreakdown?.groups)
      ? cwu.tokenBreakdown.groups
      : null;

  let groups = null;
  if (rawGroups && rawGroups.length > 0) {
    let systemAndTools = 0;
    let messages = 0;
    let subagents = 0;
    let classifiedOther = 0;
    for (const g of rawGroups) {
      if (!g || typeof g !== 'object') continue;
      const tokens = toNum(g.numTokens) ?? 0;
      if (tokens <= 0) continue;
      const bucket = normalizeTokenType(g.type);
      if (bucket === 'SYSTEM_AND_TOOLS') systemAndTools += tokens;
      else if (bucket === 'CHAT_MESSAGES') messages += tokens;
      else if (bucket === 'SUBAGENTS') subagents += tokens;
      else classifiedOther += tokens;
    }
    const baseUsed = used != null && used > 0 ? used : systemAndTools + messages + subagents + classifiedOther;
    const sum = systemAndTools + messages + subagents + classifiedOther;
    const other = Math.max(0, baseUsed - (systemAndTools + messages + subagents));
    if (sum > 0 || baseUsed > 0) {
      groups = { systemAndTools, messages, subagents, other };
    }
  }

  return {
    used,
    max,
    percent,
    groups,
    afterCompaction: Boolean(cwu.estimatedAfterCompaction),
  };
}

function resolveGenerationDuration(gen, state) {
  if (!gen || gen.outputTokens <= 0) {
    return { ms: null, source: 'none' };
  }
  if (gen.streamingMs != null && gen.streamingMs > 0) {
    return { ms: gen.streamingMs, source: 'generator' };
  }
  const refIdx = gen.stepIndices?.length ? gen.stepIndices[0] : gen.startStepIndex;
  const step = refIdx != null ? state.stepsByIndex.get(refIdx) : null;
  const endMs =
    step?.finishedGeneratingAtMs ??
    step?.lastCompletedChunkAtMs ??
    step?.completedAtMs ??
    step?.createdAtMs ??
    step?.viewableAtMs ??
    null;

  if (step?.startedAtMs != null && endMs != null && endMs > step.startedAtMs) {
    const ms = endMs - step.startedAtMs;
    if (ms > 0 && ms < 600_000) {
      return { ms, source: 'step-timing' };
    }
  }
  if (gen.createdAtMs != null && endMs != null && endMs > gen.createdAtMs) {
    const ms = endMs - gen.createdAtMs;
    if (ms >= 200 && ms < 600_000) {
      return { ms, source: 'step-timing' };
    }
  }
  if (refIdx != null && refIdx > 0 && endMs != null) {
    const prev = state.stepsByIndex.get(refIdx - 1);
    const prevEndMs =
      prev?.completedAtMs ??
      prev?.finishedGeneratingAtMs ??
      prev?.createdAtMs ??
      null;
    if (prevEndMs != null && endMs > prevEndMs) {
      const ms = endMs - prevEndMs;
      if (ms >= 500 && ms < 600_000) {
        return { ms, source: 'step-timing' };
      }
    }
  }
  return { ms: null, source: 'none' };
}

/**
 * 将当前会话状态归约为 UI 直接渲染的快照对象。
 */
function buildStatusSnapshot(state) {
  if (!state) {
    return {
      conversationId: null,
      isRunning: false,
      turns: null,
      steps: null,
      trajectorySteps: null,
      observedTps: null,
      observedModelMs: 0,
      observedOutputTokens: null,
      speedSource: 'none',
      speedUnavailableReason: 'timing_missing',
      averageTps: null,
      averageTpsTurns: 0,
      averageFirstTokenMs: null,
      totalTokens: null,
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      thinkingTokens: null,
      responseTokens: null,
      cacheHitPercent: null,
      estimatedCostUsd: null,
      subagentCostUsd: null,
      modelName: null,
      pricing: null,
      contextUsedTokens: null,
      contextWindow: null,
      contextPercent: null,
      contextGroups: null,
      estimatedAfterCompaction: false,
      compactions: 0,
    };
  }

  const isRunning = !state.fullyIdle || isRunStatusActive(state.status);
  const sortedTurns = [...state.turnsByIndex.values()].sort((a, b) => a.index - b.index);
  const turns = Math.max(state.turnsTotal, sortedTurns.length);

  const sortedGen = [...state.generatorMetadatasByIndex.values()]
    .filter((g) => g.hasChatModel)
    .sort((a, b) => a.index - b.index);

  // 最新一次有输出的模型响应；运行中若当前响应尚未结算流式时长，暂沿用上一次已完成响应避免闪烁
  const latestWithOutput = [...sortedGen].reverse().find((g) => g.outputTokens > 0) || sortedGen.at(-1) || null;
  const latestDur = latestWithOutput ? resolveGenerationDuration(latestWithOutput, state) : { ms: null, source: 'none' };
  let speedCandidate = latestWithOutput;
  let speedDur = latestDur;
  if (isRunning && (!latestDur.ms || latestDur.ms <= 0)) {
    for (let i = sortedGen.length - 1; i >= 0; i--) {
      const cand = sortedGen[i];
      if (cand.outputTokens <= 0) continue;
      const dur = resolveGenerationDuration(cand, state);
      if (dur.ms > 0) {
        speedCandidate = cand;
        speedDur = dur;
        break;
      }
    }
  }

  let observedTps = null;
  let observedModelMs = 0;
  let observedOutputTokens = null;
  let speedSource = 'none';
  let speedUnavailableReason = 'timing_missing';

  if (speedCandidate) {
    observedOutputTokens = speedCandidate.outputTokens > 0 ? speedCandidate.outputTokens : null;
    if (speedCandidate.outputTokens > 0 && speedDur.ms != null && speedDur.ms > 0) {
      observedModelMs = speedDur.ms;
      observedTps = Math.round(speedCandidate.outputTokens / (speedDur.ms / 1000));
      speedSource = speedDur.source;
      speedUnavailableReason = null;
    } else if (speedCandidate.outputTokens > 0) {
      speedUnavailableReason = 'streaming_duration_missing';
    }
  } else {
    // 极端情况下无 generatorMetadata，尝试从最近带 modelUsage 的步骤兜底计算 TPS
    const stepList = [...state.stepsByIndex.values()].sort((a, b) => a.index - b.index);
    for (let i = stepList.length - 1; i >= 0; i--) {
      const st = stepList[i];
      if (!st.modelUsage || st.modelUsage.outputTokens <= 0) continue;
      const syntheticGen = {
        outputTokens: st.modelUsage.outputTokens,
        streamingMs: null,
        stepIndices: [st.index],
        startStepIndex: st.index,
        createdAtMs: null,
      };
      const dur = resolveGenerationDuration(syntheticGen, state);
      if (dur.ms > 0) {
        observedOutputTokens = st.modelUsage.outputTokens;
        observedModelMs = dur.ms;
        observedTps = Math.round(st.modelUsage.outputTokens / (dur.ms / 1000));
        speedSource = dur.source;
        speedUnavailableReason = null;
        break;
      }
    }
  }

  // 最近 10 个已完成回合的 Avg TPS（与 minecodex 口径对齐：按回合总输出 / 回合总耗时后再取平均）
  const activeTurnIndex = isRunning && sortedTurns.length > 0 ? sortedTurns[sortedTurns.length - 1].index : null;
  const completedTurns =
    activeTurnIndex == null ? sortedTurns : sortedTurns.filter((t) => t.index !== activeTurnIndex);
  const recentTurnWindow = completedTurns.slice(-10);
  const turnAgg = new Map(recentTurnWindow.map((t) => [t.index, { output: 0, ms: 0 }]));

  let ttftSum = 0;
  let ttftCount = 0;
  for (const gen of sortedGen) {
    if (gen.ttftMs != null && gen.ttftMs > 0) {
      ttftSum += gen.ttftMs;
      ttftCount += 1;
    }
    const dur = resolveGenerationDuration(gen, state);
    if (gen.outputTokens > 0 && dur.ms != null && dur.ms > 0) {
      const refStep = gen.startStepIndex ?? (gen.stepIndices.length ? gen.stepIndices[0] : null);
      const tIdx = findTurnIndexForStep(sortedTurns, refStep);
      if (tIdx != null && turnAgg.has(tIdx)) {
        const bucket = turnAgg.get(tIdx);
        bucket.output += gen.outputTokens;
        bucket.ms += dur.ms;
      }
    }
  }

  const validTurnSpeeds = [...turnAgg.values()]
    .filter((b) => b.ms > 0 && b.output > 0)
    .map((b) => b.output / (b.ms / 1000));
  const averageTps = validTurnSpeeds.length
    ? Math.round(validTurnSpeeds.reduce((acc, s) => acc + s, 0) / validTurnSpeeds.length)
    : null;
  const averageFirstTokenMs = ttftCount > 0 ? Math.round(ttftSum / ttftCount) : null;

  // Token 用量与缓存命中率：优先原生 costSummary；若未启用计费实验开关，则汇总全量 generatorMetadata / steps
  const cum = parseCostSection(state.costSummary?.total?.cumulativeTotal);
  const sub = parseCostSection(state.costSummary?.total?.subagent);
  let inputTokens = null;
  let cachedInputTokens = null;
  let outputTokens = null;
  let thinkingTokens = null;
  let responseTokens = null;
  let totalTokens = null;
  let cacheHitPercent = null;
  let estimatedCostUsd = null;
  let subagentCostUsd = null;
  let pricing = state.costSummary?.pricing || cum?.pricing || null;

  if (cum && (cum.input > 0 || cum.cacheRead > 0 || cum.output > 0 || cum.generationCount > 0)) {
    inputTokens = cum.input;
    cachedInputTokens = cum.cacheRead;
    outputTokens = cum.output;
    thinkingTokens = cum.thinking;
    responseTokens = cum.response;
    const totalInput = cum.input + cum.cacheRead;
    totalTokens = totalInput + cum.output;
    cacheHitPercent = totalInput > 0 ? Math.min(100, Math.max(0, (cum.cacheRead / totalInput) * 100)) : null;
    estimatedCostUsd = cum.estimatedCostUsd;
    subagentCostUsd = sub?.estimatedCostUsd ?? null;
  } else {
    const hasFullGenCoverage =
      state.generatorMetadataHydrated ||
      (state.totalGeneratorMetadataLength > 0 &&
        state.generatorMetadatasByIndex.size >= state.totalGeneratorMetadataLength) ||
      (state.totalGeneratorMetadataLength === 0 && sortedGen.length > 0);

    if (hasFullGenCoverage && sortedGen.length > 0) {
      let sumIn = 0;
      let sumCache = 0;
      let sumOut = 0;
      let sumThink = 0;
      let sumResp = 0;
      for (const gen of sortedGen) {
        sumIn += gen.inputTokens;
        sumCache += gen.cacheReadTokens;
        sumOut += gen.outputTokens;
        sumThink += gen.thinkingOutputTokens;
        sumResp += gen.responseOutputTokens;
      }
      if (sumIn > 0 || sumCache > 0 || sumOut > 0) {
        inputTokens = sumIn;
        cachedInputTokens = sumCache;
        outputTokens = sumOut;
        thinkingTokens = sumThink;
        responseTokens = sumResp;
        const totalInput = sumIn + sumCache;
        totalTokens = totalInput + sumOut;
        cacheHitPercent = totalInput > 0 ? Math.min(100, Math.max(0, (sumCache / totalInput) * 100)) : null;
      }
    } else if (state.stepsHydrated && state.stepsByIndex.size > 0) {
      let sumIn = 0;
      let sumCache = 0;
      let sumOut = 0;
      let sumThink = 0;
      let sumResp = 0;
      for (const st of state.stepsByIndex.values()) {
        if (!st.modelUsage) continue;
        sumIn += st.modelUsage.inputTokens;
        sumCache += st.modelUsage.cacheReadTokens;
        sumOut += st.modelUsage.outputTokens;
        sumThink += st.modelUsage.thinkingOutputTokens;
        sumResp += st.modelUsage.responseOutputTokens;
      }
      if (sumIn > 0 || sumCache > 0 || sumOut > 0) {
        inputTokens = sumIn;
        cachedInputTokens = sumCache;
        outputTokens = sumOut;
        thinkingTokens = sumThink;
        responseTokens = sumResp;
        const totalInput = sumIn + sumCache;
        totalTokens = totalInput + sumOut;
        cacheHitPercent = totalInput > 0 ? Math.min(100, Math.max(0, (sumCache / totalInput) * 100)) : null;
      }
    }
  }

  // 模型响应步数：优先使用总生成次数，其次是观测到的 generatorMetadata 长度
  const generationSteps = Math.max(
    cum?.generationCount ?? 0,
    state.totalGeneratorMetadataLength,
    sortedGen.length,
  );
  const steps = generationSteps > 0 ? generationSteps : state.totalStepsLength > 0 ? state.totalStepsLength : null;
  const trajectorySteps = state.totalStepsLength > 0 ? state.totalStepsLength : null;

  // 上下文占用：优先 top-level contextWindowUsage，回退到最近一次 generatorMetadata 的 contextWindowMetadata
  const rawCwu = state.contextWindowUsage || sortedGen.at(-1)?.contextWindowMetadata || null;
  const ctx = computeContextBreakdown(rawCwu);

  const modelName =
    pricing?.modelName || sortedGen.at(-1)?.modelName || null;

  return {
    conversationId: state.conversationId,
    isRunning,
    turns: turns > 0 ? turns : null,
    steps,
    trajectorySteps,
    observedTps,
    observedModelMs,
    observedOutputTokens,
    speedSource,
    speedUnavailableReason,
    averageTps,
    averageTpsTurns: validTurnSpeeds.length,
    averageFirstTokenMs,
    totalTokens,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    thinkingTokens,
    responseTokens,
    cacheHitPercent,
    estimatedCostUsd,
    subagentCostUsd,
    modelName,
    pricing,
    contextUsedTokens: ctx.used,
    contextWindow: ctx.max,
    contextPercent: ctx.percent,
    contextGroups: ctx.groups,
    estimatedAfterCompaction: ctx.afterCompaction,
    compactions: state.compactedAtStepIndices.length,
  };
}
function formatCompactTokens(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1000) return new Intl.NumberFormat().format(Math.round(value));
  const useMillions = value >= 999_950;
  const scaled = value / (useMillions ? 1e6 : 1e3);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(scaled)}${useMillions ? 'M' : 'K'}`;
}
function formatNumber(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat().format(Math.round(value));
}
function formatCachePercent(percent) {
  if (percent == null || !Number.isFinite(percent)) return '—';
  return `${percent > 99 && percent < 100 ? percent.toFixed(1) : Math.round(percent)}%`;
}
function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s`;
}
function formatUsd(usd) {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

// --- transport-tap.js ---
/**
 * transport-tap：对 Antigravity 的 WebSocket (/connect-websocket) 与 fetch (Connect-JSON)
 * 进行只读旁路监听，提取 StreamAgentStateUpdates / GetCascadeTrajectory 数据。
 * 绝不修改请求参数或响应流，所有解析均做好防御性隔离。
 */

const STREAM_AGENT_STATE_PROC = 'StreamAgentStateUpdates';
const GET_CASCADE_TRAJECTORY_PROC = 'GetCascadeTrajectory';
const GET_GENERATOR_METADATA_PROC = '/exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata';
const GET_STEPS_PROC = '/exa.language_server_pb.LanguageServerService/GetCascadeTrajectorySteps';

/**
 * 解析 Connect-RPC 流式帧：[1 字节 flags][4 字节大端长度][UTF-8 JSON]
 * 支持跨分片拼接，遇到压缩帧或 trailer 帧安全跳过。
 */
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
          // 异常帧长度保护，放弃后续缓冲
          buffer = new Uint8Array(0);
          return;
        }
        if (buffer.byteLength < total) {
          return;
        }
        const payloadBytes = buffer.subarray(5, total);
        buffer = buffer.subarray(total);

        // flags & 128 为 trailer；flags & 1 为压缩帧
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
      const slice = initBody.byteLength > 5 && (initBody[0] === 0 || initBody[0] === 1)
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
function installTransportTap(win, handlers = {}) {
  const { onAgentStateUpdate, onTrajectory, onGeneratorMetadata, onSteps } = handlers;
  if (!win || win.__myAntigravitySessionStatusTapInstalled) {
    const noop = () => {};
    noop.backfillConversation = async () => false;
    return noop;
  }
  win.__myAntigravitySessionStatusTapInstalled = true;

  const activeStreams = new Map();
  const inflightBackfills = new Map();
  const attemptedBackfills = new Map();
  let capturedCsrfToken = null;
  let capturedHostClient = null;
  const OrigWebSocket = win.WebSocket;
  const origFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;

  function captureAuthHeaders(headersObj) {
    if (!headersObj || typeof headersObj !== 'object') return;
    const readVal = (v) => (Array.isArray(v) ? v[0] : v);
    const csrf =
      typeof headersObj.get === 'function'
        ? headersObj.get('x-codeium-csrf-token')
        : readVal(headersObj['x-codeium-csrf-token'] ?? headersObj['X-Codeium-Csrf-Token']);
    if (typeof csrf === 'string' && csrf) capturedCsrfToken = csrf;
    const hostClient =
      typeof headersObj.get === 'function'
        ? headersObj.get('x-host-client')
        : readVal(headersObj['x-host-client'] ?? headersObj['X-Host-Client']);
    if (typeof hostClient === 'string' && hostClient) capturedHostClient = hostClient;
  }

  function resolveCsrfToken() {
    if (capturedCsrfToken) return capturedCsrfToken;
    const cfg = win.__APP_CONFIG__?.csrfToken;
    if (typeof cfg === 'string' && cfg) return cfg;
    try {
      const ls = win.localStorage?.getItem?.('agy_session_csrf_token');
      if (ls) return ls;
    } catch {
      // ignore
    }
    return null;
  }

  function handleOutboundText(raw, socket) {
    if (typeof raw !== 'string' || raw[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.streamId !== 'string') return;
    if (msg.headers) captureAuthHeaders(msg.headers);
    if (msg.type === 'cancel') {
      activeStreams.delete(msg.streamId);
      return;
    }
    if (msg.type === 'start' && typeof msg.procedure === 'string') {
      if (msg.procedure.includes(STREAM_AGENT_STATE_PROC)) {
        const cid = msg.payload?.conversationId || msg.payload?.cascadeId || null;
        activeStreams.set(msg.streamId, { kind: 'state', conversationId: cid, socket });
      } else if (msg.procedure.includes(GET_CASCADE_TRAJECTORY_PROC) && !msg.procedure.includes('GeneratorMetadata') && !msg.procedure.includes('Steps')) {
        const cid = msg.payload?.cascadeId || msg.payload?.conversationId || null;
        activeStreams.set(msg.streamId, { kind: 'trajectory', conversationId: cid, socket });
      }
    }
  }

  function handleInboundText(raw) {
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
    if (msg.type === 'data' && msg.payload) {
      if (meta.kind === 'state' && msg.payload.update) {
        onAgentStateUpdate?.(msg.payload.update);
      } else if (meta.kind === 'trajectory') {
        const cid = meta.conversationId || msg.payload.trajectory?.cascadeId || null;
        if (cid) {
          onTrajectory?.(cid, msg.payload);
        }
      }
    }
  }

  if (typeof OrigWebSocket === 'function') {
    class TapWebSocket extends OrigWebSocket {
      constructor(url, protocols) {
        if (protocols !== undefined) {
          super(url, protocols);
        } else {
          super(url);
        }
        try {
          const urlStr = String(url || '');
          if (urlStr.includes('/connect-websocket')) {
            this.addEventListener('message', (event) => {
              handleInboundText(event?.data);
            });
            this.addEventListener('close', () => {
              for (const [sid, meta] of activeStreams.entries()) {
                if (meta.socket === this) {
                  activeStreams.delete(sid);
                }
              }
            });
          }
        } catch {
          // 忽略监听器异常，不影响原生 WebSocket
        }
      }

      send(data) {
        try {
          handleOutboundText(data, this);
        } catch {
          // 忽略旁路解析异常
        }
        return super.send(data);
      }
    }
    try {
      win.WebSocket = TapWebSocket;
    } catch {
      // 某些严格受限环境不可覆写时静默降级
    }
  }

  if (origFetch) {
    win.fetch = function tappedFetch(input, init) {
      if (init?.headers) captureAuthHeaders(init.headers);
      const url = typeof input === 'string' ? input : input?.url || '';
      const isStateStream = url.includes(STREAM_AGENT_STATE_PROC);
      const isTrajectory =
        url.includes(GET_CASCADE_TRAJECTORY_PROC) &&
        !url.includes('GeneratorMetadata') &&
        !url.includes('Steps');
      const promise = origFetch(input, init);

      if (!isStateStream && !isTrajectory) {
        return promise;
      }

      const fallbackCid = isTrajectory ? extractRequestConversationId(init?.body) : null;
      promise
        .then((response) => {
          if (!response || !response.ok || typeof response.clone !== 'function') return;
          const clone = response.clone();
          const contentType = (clone.headers?.get?.('content-type') || '').toLowerCase();
          if (contentType.includes('application/json') && !contentType.includes('connect')) {
            clone
              .json()
              .then((obj) => {
                if (isStateStream && obj?.update) onAgentStateUpdate?.(obj.update);
                else if (isTrajectory && obj) {
                  const cid = fallbackCid || obj.trajectory?.cascadeId;
                  if (cid) onTrajectory?.(cid, obj);
                }
              })
              .catch(() => {});
            return;
          }
          if (!clone.body || typeof clone.body.getReader !== 'function') return;
          const reader = clone.body.getReader();
          const parser = createConnectEnvelopeParser((msg) => {
            if (isStateStream && msg?.update) {
              onAgentStateUpdate?.(msg.update);
            } else if (isTrajectory && msg) {
              const cid = fallbackCid || msg.trajectory?.cascadeId;
              if (cid) onTrajectory?.(cid, msg);
            }
          });
          (async () => {
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) parser.push(value);
              }
            } catch {
              // 流中止或取消时静默退出
            }
          })();
        })
        .catch(() => {});

      return promise;
    };
  }

  async function postJsonRpc(procedurePath, bodyObj) {
    if (!origFetch || !win.location?.origin) return null;
    const headers = { 'Content-Type': 'application/json' };
    const csrf = resolveCsrfToken();
    if (csrf) headers['x-codeium-csrf-token'] = csrf;
    if (capturedHostClient) headers['x-host-client'] = capturedHostClient;
    const res = await origFetch(`${win.location.origin}${procedurePath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }

  /**
   * 主动向本地 language_server 补齐当前会话的生成器元数据与近期步骤（只读分页）。
   * 用于 costSummary 实验开关未开启或进入历史会话时还原 Token、缓存与 TPS。
   */
  async function backfillConversation(conversationId, state) {
    if (!conversationId || !origFetch) return false;
    if (inflightBackfills.has(conversationId)) {
      return inflightBackfills.get(conversationId);
    }

    const totalGen = state?.totalGeneratorMetadataLength ?? 0;
    const haveGen = state?.generatorMetadatasByIndex?.size ?? 0;
    const needGen = !state?.generatorMetadataHydrated || (totalGen > 0 && haveGen < totalGen);

    const totalSteps = state?.totalStepsLength ?? 0;
    const recentTarget = Math.max(0, totalSteps - 50);
    let missingRecentStep = totalSteps > 0 && state?.stepsByIndex?.size === 0;
    if (!missingRecentStep && totalSteps > 0 && state?.stepsByIndex) {
      for (let i = recentTarget; i < totalSteps; i++) {
        if (!state.stepsByIndex.has(i)) {
          missingRecentStep = true;
          break;
        }
      }
    }

    const prevSig = `${totalGen}:${haveGen}:${totalSteps}:${state?.stepsByIndex?.size ?? 0}`;
    const lastAttempt = attemptedBackfills.get(conversationId);
    if (lastAttempt && lastAttempt.sig === prevSig && Date.now() - lastAttempt.at < 3000) {
      return false;
    }
    if (!needGen && !missingRecentStep) {
      return false;
    }

    const job = (async () => {
      attemptedBackfills.set(conversationId, { sig: prevSig, at: Date.now() });
      let changed = false;
      try {
        if (needGen) {
          let offset = 0;
          if (state?.generatorMetadataHydrated && totalGen > 0) {
            while (offset < totalGen && state.generatorMetadatasByIndex.has(offset)) {
              offset += 1;
            }
          }
          for (let page = 0; page < 40; page++) {
            const resp = await postJsonRpc(GET_GENERATOR_METADATA_PROC, {
              cascadeId: conversationId,
              generatorMetadataOffset: offset,
            });
            if (!resp || !Array.isArray(resp.generatorMetadata)) {
              break;
            }
            const batch = resp.generatorMetadata;
            if (batch.length === 0) {
              onGeneratorMetadata?.(conversationId, [], offset, true);
              break;
            }
            const reachedEnd = totalGen > 0 && offset + batch.length >= totalGen;
            onGeneratorMetadata?.(conversationId, batch, offset, reachedEnd);
            changed = true;
            offset += batch.length;
            if (totalGen > 0 && offset >= totalGen) break;
          }
        }

        if (missingRecentStep) {
          let stepOffset = recentTarget;
          for (let page = 0; page < 5; page++) {
            const resp = await postJsonRpc(GET_STEPS_PROC, {
              cascadeId: conversationId,
              stepOffset,
              verbosity: 3,
            });
            const batch = resp?.steps;
            if (!Array.isArray(batch) || batch.length === 0) break;
            onSteps?.(conversationId, batch, stepOffset, true);
            changed = true;
            stepOffset += batch.length;
            if (totalSteps > 0 && stepOffset >= totalSteps) break;
          }
        }
      } catch {
        // 忽略 RPC 补齐失败，保留已有流式数据
      } finally {
        inflightBackfills.delete(conversationId);
      }
      return changed;
    })();

    inflightBackfills.set(conversationId, job);
    return job;
  }

  const stop = () => {
    activeStreams.clear();
    inflightBackfills.clear();
  };
  stop.backfillConversation = backfillConversation;
  return stop;
}

// --- ui.js ---
/**
 * session-status 前端 UI 控制器：
 * 在 Antigravity 输入框下方渲染会话状态栏，并在收起后于右下角工具栏提供上下文环入口。
 */

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
function inspectComposerFiber(el) {
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
function createSessionStatusController(win, doc, store, onHydrateState, onNeedBackfill) {
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

// --- entry.js ---
/**
 * session-status 运行时入口：
 * 1) 同步挂载 WebSocket / fetch 旁路监听（避免错过首包）；
 * 2) DOM 就绪后挂载输入框状态栏与 MutationObserver。
 */
function installSessionStatusPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravitySessionStatusInstalled) {
    return null;
  }
  win.__myAntigravitySessionStatusInstalled = true;

  const store = createConversationStore();
  let controller = null;
  let scheduled = false;

  function scheduleScan() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.scanComposers();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  const stopTap = installTransportTap(win, {
    onAgentStateUpdate(update) {
      const state = applyAgentStateUpdate(store, update);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
        void stopTap.backfillConversation?.(state.conversationId, state);
      }
    },
    onTrajectory(cid, response) {
      const state = applyTrajectoryResponse(store, cid, response);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
    onGeneratorMetadata(cid, list, offset, reachedEnd) {
      const state = applyGeneratorMetadataList(store, cid, list, offset, reachedEnd);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
    onSteps(cid, list, offset, markHydrated) {
      const state = applyStepsList(store, cid, list, offset, markHydrated);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
  });

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(
      node.closest?.('[data-ag-ss-bar], [data-ag-ss-trigger], [data-ag-ss-popover], [data-ag-ss-tooltip]'),
    );
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createSessionStatusController(
      win,
      doc,
      store,
      (raw) => {
        hydrateFromClientState(store, raw);
      },
      (cid, state) => {
        void stopTap.backfillConversation?.(cid, state).then((changed) => {
          if (changed) controller?.refreshConversation(cid);
        });
      },
    );
    controller.scanComposers();
    // 兼容加载顺序晚于本插件的 zh-cn：在同批次脚本执行完毕后补刷一次语言与状态
    if (typeof win.setTimeout === 'function') {
      win.setTimeout(() => controller?.scanComposers(), 120);
    }

    if (typeof win.MutationObserver === 'function') {
      const observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') {
            scheduleScan();
            return;
          }
          if (!isOwnUiNode(m.target)) {
            scheduleScan();
            return;
          }
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
      if (doc.documentElement) {
        observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
      }
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initDom, { once: true });
  } else {
    initDom();
  }

  return {
    store,
    getController: () => controller,
    dispose() {
      stopTap();
      controller?.destroy();
    },
  };
}

  installSessionStatusPlugin(win, doc);
})(window, document);
