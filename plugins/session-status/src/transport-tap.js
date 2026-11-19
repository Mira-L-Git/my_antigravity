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
export function createConnectEnvelopeParser(onMessage) {
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

export function installTransportTap(win, handlers = {}) {
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
