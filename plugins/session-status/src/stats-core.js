/**
 * session-status 纯函数统计核心（无 DOM / Node 依赖，可同时在浏览器与测试中运行）。
 */

export function toNum(value) {
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
export function parseDurationMs(value) {
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
export function parseTimestampMs(value) {
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

export function createConversationState(conversationId = '') {
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

export function createConversationStore() {
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
export function applyAgentStateUpdate(store, update) {
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
export function applyGeneratorMetadataList(store, conversationId, list, offset = 0, markHydrated = false) {
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
export function applyStepsList(store, conversationId, steps, offset = 0, markHydrated = false) {
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
export function applyTrajectoryResponse(store, conversationId, response) {
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
export function hydrateFromClientState(store, clientState) {
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
export function buildStatusSnapshot(state) {
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

export function formatCompactTokens(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1000) return new Intl.NumberFormat().format(Math.round(value));
  const useMillions = value >= 999_950;
  const scaled = value / (useMillions ? 1e6 : 1e3);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(scaled)}${useMillions ? 'M' : 'K'}`;
}

export function formatNumber(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat().format(Math.round(value));
}

export function formatCachePercent(percent) {
  if (percent == null || !Number.isFinite(percent)) return '—';
  return `${percent > 99 && percent < 100 ? percent.toFixed(1) : Math.round(percent)}%`;
}

export function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s`;
}

export function formatUsd(usd) {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
