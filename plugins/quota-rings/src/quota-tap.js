/**
 * quota-tap：对 Antigravity 的 fetch / WebSocket 进行只读旁路监听，
 * 捕获 GetUserStatus / GetCascadeModelConfigData / RetrieveUserQuotaSummary 配额数据，
 * 并在首包缺失或窗口聚焦 / 对话轮次变化时通过只读 JSON-RPC 温和刷新。
 */

const GET_USER_STATUS_PROC = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const GET_MODEL_CONFIGS_PROC = '/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData';
const RETRIEVE_QUOTA_SUMMARY_PROC = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';

function parseConnectEnvelopes(bytes, onMessage) {
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 5 <= bytes.byteLength) {
    const flags = bytes[offset];
    const len =
      ((bytes[offset + 1] << 24) >>> 0) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 8) |
      bytes[offset + 4];
    const total = 5 + len;
    if (len > 32 * 1024 * 1024 || offset + total > bytes.byteLength) {
      break;
    }
    if ((flags & 128) === 0 && (flags & 1) === 0 && len > 0) {
      try {
        const text = decoder.decode(bytes.subarray(offset + 5, offset + total));
        if (text && text[0] === '{') {
          onMessage(JSON.parse(text));
        }
      } catch {
        // 忽略非 JSON 或损坏帧
      }
    }
    offset += total;
  }
}

function classifyProc(target) {
  if (typeof target !== 'string' || !target) return null;
  if (target.includes('GetUserStatus')) return 'userStatus';
  if (target.includes('GetCascadeModelConfigData')) return 'modelConfigs';
  if (target.includes('RetrieveUserQuotaSummary')) return 'quotaSummary';
  if (target.includes('SendUserCascadeMessage') || target.includes('StreamAgentStateUpdates')) return 'activity';
  return null;
}

export function installQuotaTap(win, handlers = {}) {
  const { onModelPayload, onSummaryPayload } = handlers;
  if (!win || win.__myAntigravityQuotaTapInstalled) {
    return {
      refresh: async () => false,
      scheduleRefresh: () => {},
      dispose: () => {},
    };
  }
  win.__myAntigravityQuotaTapInstalled = true;

  let disposed = false;
  let capturedCsrfToken = null;
  let capturedHostClient = null;
  let hasReceivedModelPayload = false;
  let summarySupported = null; // null: 未探测；true/false: 是否可用
  let inflightRefresh = null;
  let lastFetchAt = 0;
  let debounceTimer = null;
  let periodicTimer = null;
  let pendingInitialRetry = false;

  const activeWsStreams = new Map();
  const OrigWebSocket = win.WebSocket;
  const origFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;

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

  function captureAuthHeaders(headersObj) {
    if (!headersObj || typeof headersObj !== 'object') return;
    const readVal = (v) => (Array.isArray(v) ? v[0] : v);
    const csrf =
      typeof headersObj.get === 'function'
        ? headersObj.get('x-codeium-csrf-token')
        : readVal(headersObj['x-codeium-csrf-token'] ?? headersObj['X-Codeium-Csrf-Token']);
    const hadToken = Boolean(resolveCsrfToken());
    if (typeof csrf === 'string' && csrf) {
      capturedCsrfToken = csrf;
    }
    const hostClient =
      typeof headersObj.get === 'function'
        ? headersObj.get('x-host-client')
        : readVal(headersObj['x-host-client'] ?? headersObj['X-Host-Client']);
    if (typeof hostClient === 'string' && hostClient) {
      capturedHostClient = hostClient;
    }

    if (!hadToken && capturedCsrfToken && pendingInitialRetry && !hasReceivedModelPayload && !disposed) {
      pendingInitialRetry = false;
      queueMicrotask(() => {
        void refresh({ force: true });
      });
    }
  }

  function dispatchPayload(kind, obj) {
    if (!obj || typeof obj !== 'object') return;
    if (kind === 'userStatus' || kind === 'modelConfigs') {
      hasReceivedModelPayload = true;
      onModelPayload?.(obj);
    } else if (kind === 'quotaSummary') {
      summarySupported = true;
      onSummaryPayload?.(obj);
    }
  }

  async function readTapResponse(kind, response) {
    if (!response || !response.ok || typeof response.clone !== 'function') return;
    try {
      const clone = response.clone();
      const ct = (clone.headers?.get?.('content-type') || '').toLowerCase();
      if (ct.includes('application/json') && !ct.includes('connect')) {
        const obj = await clone.json();
        dispatchPayload(kind, obj);
        return;
      }
      if (typeof clone.arrayBuffer === 'function') {
        const ab = await clone.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (bytes.byteLength > 0 && bytes[0] === 0x7b) {
          const text = new TextDecoder().decode(bytes);
          dispatchPayload(kind, JSON.parse(text));
        } else if (bytes.byteLength >= 5) {
          parseConnectEnvelopes(bytes, (msg) => dispatchPayload(kind, msg));
        }
      }
    } catch {
      // 旁路解析失败不影响原生响应
    }
  }

  if (origFetch) {
    win.fetch = function tappedQuotaFetch(input, init) {
      if (init?.headers) captureAuthHeaders(init.headers);
      if (input && typeof input === 'object' && input.headers) {
        captureAuthHeaders(input.headers);
      }

      const url = typeof input === 'string' ? input : input?.url || '';
      const kind = classifyProc(url);
      const promise = origFetch(input, init);

      if (kind === 'userStatus' || kind === 'modelConfigs' || kind === 'quotaSummary') {
        promise.then((res) => readTapResponse(kind, res)).catch(() => {});
      } else if (kind === 'activity') {
        promise
          .then((res) => {
            if (res && res.ok) scheduleRefresh(1200);
          })
          .catch(() => {});
      }
      return promise;
    };
  }

  if (typeof OrigWebSocket === 'function') {
    class QuotaTapWebSocket extends OrigWebSocket {
      constructor(url, protocols) {
        if (protocols !== undefined) {
          super(url, protocols);
        } else {
          super(url);
        }
        try {
          if (String(url || '').includes('/connect-websocket')) {
            this.addEventListener('message', (event) => {
              if (typeof event?.data !== 'string' || event.data[0] !== '{') return;
              try {
                const msg = JSON.parse(event.data);
                if (!msg || typeof msg.streamId !== 'string') return;
                const kind = activeWsStreams.get(msg.streamId);
                if (!kind) return;
                if (msg.type === 'end') {
                  activeWsStreams.delete(msg.streamId);
                  if (kind === 'activity') scheduleRefresh(1200);
                  return;
                }
                if (msg.type === 'data' && msg.payload) {
                  if (kind === 'activity') {
                    // 对话状态变化后温和防抖刷新额度
                    scheduleRefresh(2500);
                  } else {
                    dispatchPayload(kind, msg.payload);
                  }
                }
              } catch {
                // ignore
              }
            });
            this.addEventListener('close', () => {
              activeWsStreams.clear();
            });
          }
        } catch {
          // ignore
        }
      }

      send(data) {
        try {
          if (typeof data === 'string' && data[0] === '{') {
            const msg = JSON.parse(data);
            if (msg?.headers) captureAuthHeaders(msg.headers);
            if (msg?.type === 'cancel' && typeof msg.streamId === 'string') {
              activeWsStreams.delete(msg.streamId);
            } else if (msg?.type === 'start' && typeof msg.streamId === 'string') {
              const kind = classifyProc(msg.procedure);
              if (kind) activeWsStreams.set(msg.streamId, kind);
            }
          }
        } catch {
          // ignore
        }
        return super.send(data);
      }
    }
    try {
      win.WebSocket = QuotaTapWebSocket;
    } catch {
      // ignore
    }
  }

  async function postJsonRpc(procedurePath, bodyObj) {
    if (!origFetch || !win.location?.origin) return { ok: false, status: 0, data: null };
    const csrf = resolveCsrfToken();
    if (!csrf) {
      pendingInitialRetry = true;
      return { ok: false, status: 0, data: null };
    }
    const headers = {
      'Content-Type': 'application/json',
      'x-codeium-csrf-token': csrf,
    };
    if (capturedHostClient) headers['x-host-client'] = capturedHostClient;

    try {
      const res = await origFetch(`${win.location.origin}${procedurePath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj ?? {}),
      });
      if (!res || !res.ok) {
        return { ok: false, status: res?.status || 0, data: null };
      }
      const data = await res.json();
      return { ok: true, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  }

  async function refresh({ force = false } = {}) {
    if (disposed || !origFetch) return false;
    const now = Date.now();
    const minCooldown = force ? 2000 : 15000;
    if (now - lastFetchAt < minCooldown) {
      return false;
    }
    if (inflightRefresh) {
      return inflightRefresh;
    }

    inflightRefresh = (async () => {
      lastFetchAt = Date.now();
      let updated = false;
      try {
        const userRes = await postJsonRpc(GET_USER_STATUS_PROC, {});
        if (userRes.ok && userRes.data) {
          dispatchPayload('userStatus', userRes.data);
          updated = true;
        } else if (!hasReceivedModelPayload) {
          const cfgRes = await postJsonRpc(GET_MODEL_CONFIGS_PROC, {});
          if (cfgRes.ok && cfgRes.data) {
            dispatchPayload('modelConfigs', cfgRes.data);
            updated = true;
          }
        }

        if (summarySupported !== false) {
          const sumRes = await postJsonRpc(RETRIEVE_QUOTA_SUMMARY_PROC, {
            request: {},
            forceRefresh: Boolean(force),
          });
          if (sumRes.ok && sumRes.data) {
            summarySupported = true;
            dispatchPayload('quotaSummary', sumRes.data);
            updated = true;
          } else if (sumRes.status >= 400) {
            // 服务端明确不支持该接口时停止后续无效探测
            summarySupported = false;
          }
        }
      } finally {
        inflightRefresh = null;
      }
      return updated;
    })();

    return inflightRefresh;
  }

  function scheduleRefresh(delayMs = 1500) {
    if (disposed || typeof win.setTimeout !== 'function') return;
    if (debounceTimer != null && typeof win.clearTimeout === 'function') {
      win.clearTimeout(debounceTimer);
    }
    debounceTimer = win.setTimeout(() => {
      debounceTimer = null;
      void refresh({ force: false });
    }, delayMs);
  }

  function handleVisibilityOrFocus() {
    if (disposed) return;
    if (win.document?.visibilityState === 'hidden') return;
    scheduleRefresh(400);
  }

  win.addEventListener?.('focus', handleVisibilityOrFocus);
  win.document?.addEventListener?.('visibilitychange', handleVisibilityOrFocus);

  if (typeof win.setInterval === 'function') {
    periodicTimer = win.setInterval(() => {
      if (disposed || win.document?.visibilityState === 'hidden') return;
      void refresh({ force: false });
    }, 180000);
  }

  return {
    refresh,
    scheduleRefresh,
    dispose() {
      disposed = true;
      if (debounceTimer != null) win.clearTimeout?.(debounceTimer);
      if (periodicTimer != null) win.clearInterval?.(periodicTimer);
      win.removeEventListener?.('focus', handleVisibilityOrFocus);
      win.document?.removeEventListener?.('visibilitychange', handleVisibilityOrFocus);
    },
  };
}
