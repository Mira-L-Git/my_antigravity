// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/quota-rings/src/*.js, then run `npm run sync`.

(function registerQuotaRingsMod(win, doc) {
// --- quota-core.js ---
/**
 * quota-rings 纯函数核心模块：
 * 负责解析 Antigravity GetUserStatus / GetCascadeModelConfigData / RetrieveUserQuotaSummary
 * 返回的模型与配额数据，区分 Gemini 与其它模型，并按最小剩余比例聚合单/双窗口快照。
 */

const GEMINI_TEXT_RE = /(?:^|[^a-z0-9])(?:gemini|gemma|palm|bard)(?:$|[^a-z0-9])|gemini|gemma/i;
const FIVE_HOUR_WINDOW_RE = /(?:^|[^a-z0-9])(?:5\s*h|5\s*hours?|five[_\s-]*hours?|18000)(?:$|[^a-z0-9])/i;
const WEEKLY_WINDOW_RE = /(?:^|[^a-z0-9])(?:7\s*d|7\s*days?|1\s*w|weekly|week|604800)(?:$|[^a-z0-9])/i;

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * 将时间戳（ISO 字符串、Protobuf { seconds, nanos } 或 Unix 秒/毫秒）解析为毫秒时间。
 */
function parseTimestampMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return parseTimestampMs(Number(trimmed));
    }
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === 'object') {
    const sec = toFiniteNumber(raw.seconds);
    if (sec != null && sec > 0) {
      const nanos = toFiniteNumber(raw.nanos) || 0;
      return Math.round(sec * 1000 + nanos / 1e6);
    }
  }
  return null;
}

/**
 * 将 remainingFraction (0..1) 或百分比 (0..100) 规范化为 0..100 的整数；无效值返回 null。
 */
function normalizeRemainingPercent(rawFraction, isPercent = false) {
  const num = toFiniteNumber(rawFraction);
  if (num == null) return null;
  const pct = isPercent ? num : num <= 1 ? num * 100 : num;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/**
 * 判断模型属于 'gemini' 还是 'other'；对禁用或自定义模型返回 null。
 */
function classifyModelGroup(config) {
  if (!config || typeof config !== 'object') return null;
  if (config.disabled === true || config.isCustom === true) return null;
  if (config.pricingType === 'MODEL_PRICING_TYPE_BYOK') return null;

  const provider = typeof config.provider === 'string' ? config.provider.trim().toUpperCase() : '';
  if (provider === 'MODEL_PROVIDER_GOOGLE') {
    return 'gemini';
  }
  if (
    provider &&
    provider !== 'MODEL_PROVIDER_UNSPECIFIED' &&
    provider !== 'MODEL_PROVIDER_ANTIGRAVITY'
  ) {
    return 'other';
  }

  const haystack = [
    config.label,
    config.displayName,
    config.modelId,
    config.modelOrAlias?.model,
    config.modelOrAlias?.alias,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ');

  if (!haystack) return null;
  return GEMINI_TEXT_RE.test(haystack) ? 'gemini' : 'other';
}

function classifySummaryGroup(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  return GEMINI_TEXT_RE.test(text) ? 'gemini' : 'other';
}

function classifyWindowKind(windowText) {
  if (typeof windowText !== 'string' || !windowText.trim()) return null;
  if (FIVE_HOUR_WINDOW_RE.test(windowText)) return 'fiveHour';
  if (WEEKLY_WINDOW_RE.test(windowText)) return 'weekly';
  return null;
}

/**
 * 从单个模型的 label 提取精简基名（去掉尾部思考档位后缀如 "(High)"）。
 */
function stripEffortSuffix(label) {
  if (typeof label !== 'string') return '';
  return label
    .replace(/\s*\((?:(?:low|medium|high|xhigh|max)(?:\s+thinking)?|thinking)\)\s*$/i, '')
    .trim();
}

/**
 * 从 GetUserStatusResponse 或 CascadeModelConfigData 提取模型配额条目。
 */
function extractModelQuotaEntries(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const configData =
    payload.userStatus?.cascadeModelConfigData ??
    payload.user_status?.cascade_model_config_data ??
    payload.cascadeModelConfigData ??
    payload.cascade_model_config_data ??
    payload;

  const configs =
    configData?.clientModelConfigs ??
    configData?.client_model_configs ??
    payload.clientModelConfigs ??
    payload.client_model_configs;

  if (!Array.isArray(configs)) return [];

  const entries = [];
  for (const cfg of configs) {
    const group = classifyModelGroup(cfg);
    if (!group) continue;
    const qi = cfg.quotaInfo ?? cfg.quota_info;
    if (!qi || typeof qi !== 'object') continue;
    const rawFrac = qi.remainingFraction ?? qi.remaining_fraction;
    const remainingPercent = normalizeRemainingPercent(rawFrac, false);
    if (remainingPercent == null) continue;

    const resetAtMs = parseTimestampMs(qi.resetTime ?? qi.reset_time);
    const label = String(cfg.label || cfg.modelOrAlias?.alias || cfg.modelOrAlias?.model || cfg.modelId || '').trim();
    const baseName = stripEffortSuffix(label) || label || group;

    entries.push({
      group,
      label: label || baseName,
      baseName,
      remainingPercent,
      resetAtMs,
    });
  }
  return entries;
}

/**
 * 从 RetrieveUserQuotaSummaryResponse 提取带窗口语义的配额条目（若存在）。
 */
function extractSummaryQuotaEntries(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const inner = payload.response && typeof payload.response === 'object' ? payload.response : payload;
  const groups = Array.isArray(inner.groups) ? inner.groups : [];
  const standaloneBuckets = Array.isArray(inner.buckets) ? inner.buckets : [];

  const entries = [];

  const pushBucket = (bucket, parentText = '') => {
    if (!bucket || typeof bucket !== 'object' || bucket.disabled === true) return;
    // 兼容 protojson 扁平字段与 protobuf oneof remaining 嵌套对象
    const rawFrac =
      bucket.remainingFraction ??
      bucket.remaining_fraction ??
      bucket.remaining?.remainingFraction ??
      bucket.remaining?.remaining_fraction ??
      (bucket.remaining?.case === 'remainingFraction' ? bucket.remaining.value : undefined);
    const remainingPercent = normalizeRemainingPercent(rawFrac, false);
    if (remainingPercent == null) return;

    const textForGroup = [
      bucket.displayName,
      bucket.display_name,
      bucket.bucketId,
      bucket.bucket_id,
      bucket.description,
      parentText,
    ]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' ');
    const group = classifySummaryGroup(textForGroup);
    if (!group) return;

    const windowRaw = [bucket.window, bucket.bucketId, bucket.bucket_id, bucket.displayName, bucket.display_name]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' ');
    const windowKind = classifyWindowKind(windowRaw);
    const resetAtMs = parseTimestampMs(bucket.resetTime ?? bucket.reset_time);
    const label = String(bucket.displayName || bucket.display_name || bucket.bucketId || bucket.bucket_id || '').trim();

    entries.push({
      group,
      label: label || group,
      baseName: label || group,
      remainingPercent,
      resetAtMs,
      windowKind,
    });
  };

  for (const grp of groups) {
    const parentText = [grp.displayName, grp.display_name, grp.description].filter(Boolean).join(' ');
    const buckets = Array.isArray(grp.buckets) ? grp.buckets : [];
    for (const b of buckets) {
      pushBucket(b, parentText);
    }
  }
  for (const b of standaloneBuckets) {
    pushBucket(b, '');
  }

  return entries;
}

function deduplicateBuckets(entries) {
  const map = new Map();
  for (const item of entries) {
    const key = `${item.remainingPercent}|${item.resetAtMs ?? 'none'}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        remainingPercent: item.remainingPercent,
        resetAtMs: item.resetAtMs,
        models: [],
      };
      map.set(key, bucket);
    }
    if (item.baseName && !bucket.models.includes(item.baseName)) {
      bucket.models.push(item.baseName);
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.remainingPercent !== b.remainingPercent) {
      return a.remainingPercent - b.remainingPercent;
    }
    return (a.resetAtMs ?? Infinity) - (b.resetAtMs ?? Infinity);
  });
}

function aggregateSingleWindow(entries) {
  if (!entries || entries.length === 0) return null;
  const buckets = deduplicateBuckets(entries);
  const minBucket = buckets[0];
  return {
    mode: 'single',
    primary: minBucket.remainingPercent,
    fiveHour: null,
    weekly: null,
    resetAt: {
      single: minBucket.resetAtMs,
      fiveHour: null,
      weekly: null,
    },
    buckets,
    modelCount: new Set(entries.map((e) => e.baseName)).size,
  };
}

function aggregateDualWindow(fiveHourEntries, weeklyEntries, detailEntries) {
  const fhMin = fiveHourEntries.reduce((best, cur) =>
    !best || cur.remainingPercent < best.remainingPercent ? cur : best,
  null);
  const wkMin = weeklyEntries.reduce((best, cur) =>
    !best || cur.remainingPercent < best.remainingPercent ? cur : best,
  null);
  if (!fhMin || !wkMin) return null;

  return {
    mode: 'dual',
    primary: fhMin.remainingPercent,
    fiveHour: fhMin.remainingPercent,
    weekly: wkMin.remainingPercent,
    resetAt: {
      single: null,
      fiveHour: fhMin.resetAtMs,
      weekly: wkMin.resetAtMs,
    },
    buckets: deduplicateBuckets(detailEntries && detailEntries.length > 0 ? detailEntries : fiveHourEntries),
    modelCount: new Set((detailEntries || fiveHourEntries).map((e) => e.baseName)).size,
  };
}

/**
 * 合并模型配额与（可选的）摘要窗口数据，生成供 UI 渲染的统一双组快照。
 * - 当同一组同时拥有 5 小时与周窗口数据时，输出 mode: 'dual'（支持 1:3 分段环）；
 * - 否则在存在至少一个有效模型配额时输出 mode: 'single'（完整环，绝不伪造周额度）。
 */
function buildQuotaSnapshot({ modelEntries = [], summaryEntries = [] } = {}) {
  const result = {
    gemini: null,
    other: null,
    available: false,
  };

  for (const groupName of ['other', 'gemini']) {
    const models = modelEntries.filter((e) => e.group === groupName);
    const summaries = summaryEntries.filter((e) => e.group === groupName);
    const fiveHourList = summaries.filter((e) => e.windowKind === 'fiveHour');
    const weeklyList = summaries.filter((e) => e.windowKind === 'weekly');

    if (fiveHourList.length > 0 && weeklyList.length > 0) {
      result[groupName] = aggregateDualWindow(fiveHourList, weeklyList, models);
    } else if (models.length > 0) {
      result[groupName] = aggregateSingleWindow(models);
    } else if (summaries.length > 0) {
      result[groupName] = aggregateSingleWindow(summaries);
    }
  }

  result.available = Boolean(result.gemini || result.other);
  return result;
}

/**
 * 将毫秒时间戳格式化为本地 24 小时制 MM/DD HH:mm；无效时间戳返回 null。
 */
function formatResetTime(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// --- quota-tap.js ---
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
function installQuotaTap(win, handlers = {}) {
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

// --- ui.js ---
/**
 * quota-rings 前端 UI 控制器：
 * 在左下角原生「设置 (Settings)」右侧渲染两个 22×22px 中性灰额度环
 * （左：其它模型圆角方形；右：Gemini 圆形），支持 1:3 双窗分段、悬停摘要与点击直达模型配额设置。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const COPY = {
  'zh-CN': {
    geminiLabel: 'Gemini 配额',
    otherLabel: '其它模型配额',
    fiveHour: '5 小时额度',
    weekly: '周额度',
    resetIn: '重置时间',
    openSettingsDesc: '点击打开设置中的模型配额页面',
    morePools: (n) => `另有 ${n} 组模型`,
  },
  en: {
    geminiLabel: 'Gemini Quota',
    otherLabel: 'Other Models',
    fiveHour: '5h Limit',
    weekly: 'Weekly Limit',
    resetIn: 'Reset in',
    openSettingsDesc: 'Open Models & Quota settings',
    morePools: (n) => `+${n} more model pools`,
  },
};

const SETTINGS_TEXT_RE = /^(?:open\s+)?settings$|^设置$|^打开设置$/i;
const MODELS_TAB_RE = /^(?:models|models\s*&\s*usage|模型|模型与用量)$/i;
const SETTINGS_SIBLING_TAB_RE =
  /^(?:general|appearance|account|browser|agents|notifications|customizations|app|shortcuts|developer|running|通用|外观|账号|浏览器|通知|自定义扩展|应用|快捷键|开发者|运行中)$/i;
const QUOTA_HEADING_RE = /^(?:model\s+quota|models\s*&\s*usage|模型配额|模型与用量)$/i;

function selectCopy(win, doc) {
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if ((win && win.__myAntigravityZhCnInstalled) || htmlLang.startsWith('zh')) {
    return COPY['zh-CN'];
  }
  return COPY.en;
}

function getNormalizedText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function isInIgnoredContainer(el) {
  return Boolean(
    el?.closest?.(
      '[data-ag-qr-root], [data-ag-qr-tooltip], [role="menu"], [role="dialog"], [role="tabpanel"], [data-testid="agent-input-box"]',
    ),
  );
}

/**
 * 在左侧边栏底部定位原生「Settings / 设置」按钮。
 */
function findSettingsButton(doc, win) {
  if (!doc?.querySelectorAll) return null;
  const direct = doc.querySelector?.('[data-testid="settings-button"]');
  if (direct && !isInIgnoredContainer(direct)) {
    return direct;
  }
  const candidates = [...doc.querySelectorAll('button, [role="button"], a')];
  const innerH = Number(win?.innerHeight) || 800;

  let best = null;
  let bestScore = -1;

  for (const el of candidates) {
    if (isInIgnoredContainer(el)) continue;
    const text = getNormalizedText(el);
    const aria = String(el.getAttribute?.('aria-label') || '').trim();
    if (!SETTINGS_TEXT_RE.test(text) && !SETTINGS_TEXT_RE.test(aria)) continue;

    let score = 1;
    // Antigravity 新版图标可能渲染为 <span class="google-symbols"> 或 <svg>
    if (el.querySelector?.('svg, .google-symbols')) score += 3;
    if (el.closest?.('aside, nav, [data-testid*="sidebar"]')) score += 2;

    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        if (rect.left >= 0 && rect.left < 360) score += 2;
        if (rect.top >= innerH * 0.45) score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function findModelsTabElement(doc) {
  if (!doc?.querySelectorAll) return null;
  const direct = doc.querySelector?.('[data-testid="settings-nav-item-Models"]');
  if (direct && !direct.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip], [data-testid="agent-input-box"]')) {
    return direct;
  }
  const items = [...doc.querySelectorAll('button, [role="tab"], [role="menuitem"], a')];
  for (const el of items) {
    if (el.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip], [data-testid="agent-input-box"]')) {
      continue;
    }
    const text = getNormalizedText(el);
    if (!MODELS_TAB_RE.test(text)) continue;
    // 确认附近同一导航容器内存在其它设置分类标签（General/Account 等），避免误点聊天区模型选择按钮
    const navParent = el.parentElement?.parentElement || el.parentElement;
    const siblings = navParent ? [...navParent.querySelectorAll('button, [role="tab"], a')] : [];
    const looksLikeSettingsNav = siblings.some((s) => SETTINGS_SIBLING_TAB_RE.test(getNormalizedText(s)));
    if (looksLikeSettingsNav) {
      return el;
    }
  }
  return null;
}

function scrollQuotaSectionIntoView(doc) {
  if (!doc?.querySelectorAll) return;
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, div, span')];
  for (const el of headings) {
    if (el.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip]')) continue;
    if (el.children?.length > 2) continue;
    const text = getNormalizedText(el);
    if (QUOTA_HEADING_RE.test(text)) {
      el.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      return;
    }
  }
}

function createSvgNode(doc, tag, attrs = {}) {
  const node = doc.createElementNS ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  if (tag === 'path' || tag === 'circle' || tag === 'rect') {
    node.setAttribute('vector-effect', 'non-scaling-stroke');
  }
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

function describeCircleArc(startDeg, endDeg, clockwise) {
  const r = 14;
  const toPt = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [16 + r * Math.cos(rad), 16 + r * Math.sin(rad)];
  };
  const from = toPt(startDeg);
  const to = toPt(endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${from[0].toFixed(3)} ${from[1].toFixed(3)} A ${r} ${r} 0 ${largeArc} ${clockwise ? 1 : 0} ${to[0].toFixed(3)} ${to[1].toFixed(3)}`;
}

// 圆角方形路径（viewBox 32×32，中心盒 [2..30]×[2..30]，圆角半径 7）
const SQUARE_FULL_TRACK_D =
  'M 16 2 H 23 A 7 7 0 0 1 30 9 V 23 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 2 23 V 9 A 7 7 0 0 1 9 2 Z';
const SQUARE_FULL_PROGRESS_D =
  'M 16 2 H 23 A 7 7 0 0 1 30 9 V 23 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 2 23 V 9 A 7 7 0 0 1 9 2 H 16';
// 1:3 分割（切割点上移至底角 52° 处，左右各退让 24°）：
// 上方 3/4 弧从右下角侧逆时针绕至左下角侧（配合 stroke-dasharray 从左下切口开始扣减）
const SQUARE_TOP_THREE_QUARTER_D =
  'M 29.79 24.69 A 7 7 0 0 0 30 23 V 9 A 7 7 0 0 0 23 2 H 9 A 7 7 0 0 0 2 9 V 23 A 7 7 0 0 0 2.21 24.69';
// 下方 1/4 弧顺着左右底角自然弯曲（约 20.8 单位长，与上方 67.4 单位形成 1:3 比例），从右向左绘制
const SQUARE_BOTTOM_LINE_D =
  'M 26.29 29.18 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 5.71 29.18';

/**
 * 为指定分组（'other' 圆角方形 / 'gemini' 圆形）绘制 22×22px SVG 环与居中数字。
 */
function buildRingContent(doc, shape, data) {
  const svg = createSvgNode(doc, 'svg', {
    viewBox: '0 0 32 32',
    class: 'ag-qr-svg',
    'aria-hidden': 'true',
  });

  const isDual = data.mode === 'dual' && data.fiveHour != null && data.weekly != null;

  if (shape === 'square') {
    if (isDual) {
      // 上方 3/4（5 小时额度）
      const gTop = createSvgNode(doc, 'g', {
        'data-window': 'fiveHour',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gTop.appendChild(createSvgNode(doc, 'path', { d: SQUARE_TOP_THREE_QUARTER_D, class: 'ag-qr-track' }));
      if (data.fiveHour > 0) {
        gTop.appendChild(
          createSvgNode(doc, 'path', {
            d: SQUARE_TOP_THREE_QUARTER_D,
            pathLength: 100,
            'stroke-dasharray': `${data.fiveHour} 105`,
            class: 'ag-qr-fill',
          }),
        );
      }
      svg.appendChild(gTop);

      // 下方 1/4 底边线（周额度）
      const gBottom = createSvgNode(doc, 'g', {
        'data-window': 'weekly',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gBottom.appendChild(createSvgNode(doc, 'path', { d: SQUARE_BOTTOM_LINE_D, class: 'ag-qr-track' }));
      if (data.weekly > 0) {
        gBottom.appendChild(
          createSvgNode(doc, 'path', {
            d: SQUARE_BOTTOM_LINE_D,
            pathLength: 100,
            'stroke-dasharray': `${data.weekly} 105`,
            class: 'ag-qr-fill',
          }),
        );
      }
      svg.appendChild(gBottom);
    } else {
      const gSingle = createSvgNode(doc, 'g', {
        'data-window': 'single',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gSingle.appendChild(createSvgNode(doc, 'path', { d: SQUARE_FULL_TRACK_D, class: 'ag-qr-track' }));
      if (data.primary > 0) {
        gSingle.appendChild(
          createSvgNode(doc, 'path', {
            d: SQUARE_FULL_PROGRESS_D,
            pathLength: 100,
            'stroke-dasharray': `${data.primary} 105`,
            class: 'ag-qr-fill',
          }),
        );
      }
      svg.appendChild(gSingle);
    }
  } else {
    // 圆形（Gemini）
    if (isDual) {
      // 上方 3/4 扇区：237° -> 483° 顺时针（5 小时）
      const gTop = createSvgNode(doc, 'g', {
        'data-window': 'fiveHour',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gTop.appendChild(
        createSvgNode(doc, 'path', { d: describeCircleArc(237, 483, true), class: 'ag-qr-track' }),
      );
      if (data.fiveHour > 0) {
        const start = 237 + (483 - 237) * (1 - data.fiveHour / 100);
        gTop.appendChild(
          createSvgNode(doc, 'path', { d: describeCircleArc(start, 483, true), class: 'ag-qr-fill' }),
        );
      }
      svg.appendChild(gTop);

      // 下方约 90° 扇区：213° -> 147° 逆时针（周额度）
      const gBottom = createSvgNode(doc, 'g', {
        'data-window': 'weekly',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gBottom.appendChild(
        createSvgNode(doc, 'path', { d: describeCircleArc(213, 147, false), class: 'ag-qr-track' }),
      );
      if (data.weekly > 0) {
        const start = 213 + (147 - 213) * (1 - data.weekly / 100);
        gBottom.appendChild(
          createSvgNode(doc, 'path', { d: describeCircleArc(start, 147, false), class: 'ag-qr-fill' }),
        );
      }
      svg.appendChild(gBottom);
    } else {
      const gSingle = createSvgNode(doc, 'g', {
        'data-window': 'single',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      gSingle.appendChild(createSvgNode(doc, 'circle', { cx: 16, cy: 16, r: 14, class: 'ag-qr-track' }));
      if (data.primary > 0) {
        gSingle.appendChild(
          createSvgNode(doc, 'circle', {
            cx: 16,
            cy: 16,
            r: 14,
            pathLength: 100,
            'stroke-dasharray': `${data.primary} 105`,
            transform: 'rotate(-90 16 16)',
            class: 'ag-qr-fill',
          }),
        );
      }
      svg.appendChild(gSingle);
    }
  }

  const num = doc.createElement('span');
  num.className = 'ag-qr-number';
  const numText = String(data.primary);
  num.textContent = numText;
  num.setAttribute('data-digits', String(numText.length));
  return [svg, num];
}

function appendTooltipRow(doc, parent, label, value, isMuted = false) {
  const dt = doc.createElement('dt');
  dt.textContent = label;
  if (isMuted) dt.className = 'ag-qr-tip-muted';
  const dd = doc.createElement('dd');
  dd.textContent = value;
  if (isMuted) dd.className = 'ag-qr-tip-muted';
  parent.appendChild(dt);
  parent.appendChild(dd);
}

function renderTooltipContent(doc, tooltipEl, groupKey, data, copy) {
  const dl = doc.createElement('dl');
  const title = groupKey === 'gemini' ? copy.geminiLabel : copy.otherLabel;

  if (data.mode === 'dual' && data.fiveHour != null && data.weekly != null) {
    const gTitle = doc.createElement('div');
    gTitle.className = 'ag-qr-tip-group';
    appendTooltipRow(doc, gTitle, title, '');
    dl.appendChild(gTitle);

    const gFive = doc.createElement('div');
    gFive.className = 'ag-qr-tip-group ag-qr-tip-sep';
    appendTooltipRow(doc, gFive, copy.fiveHour, `${data.fiveHour}%`);
    const fhReset = formatResetTime(data.resetAt?.fiveHour);
    if (fhReset) appendTooltipRow(doc, gFive, copy.resetIn, fhReset, true);
    dl.appendChild(gFive);

    const gWeek = doc.createElement('div');
    gWeek.className = 'ag-qr-tip-group ag-qr-tip-sep';
    appendTooltipRow(doc, gWeek, copy.weekly, `${data.weekly}%`);
    const wkReset = formatResetTime(data.resetAt?.weekly);
    if (wkReset) appendTooltipRow(doc, gWeek, copy.resetIn, wkReset, true);
    dl.appendChild(gWeek);
  } else {
    const gMain = doc.createElement('div');
    gMain.className = 'ag-qr-tip-group';
    appendTooltipRow(doc, gMain, title, `${data.primary}%`);
    const singleReset = formatResetTime(data.resetAt?.single);
    if (singleReset) appendTooltipRow(doc, gMain, copy.resetIn, singleReset, true);
    dl.appendChild(gMain);

    // 若组内存在多个不同配额子池（如 Pro 与 Flash 比例不同），补充精简明细
    if (Array.isArray(data.buckets) && data.buckets.length > 1) {
      const gSub = doc.createElement('div');
      gSub.className = 'ag-qr-tip-group ag-qr-tip-sep';
      const maxRows = 4;
      const shown = data.buckets.slice(0, maxRows);
      for (const b of shown) {
        const names = b.models.slice(0, 2).join(' / ') + (b.models.length > 2 ? '…' : '');
        appendTooltipRow(doc, gSub, names || title, `${b.remainingPercent}%`, true);
      }
      if (data.buckets.length > maxRows) {
        appendTooltipRow(doc, gSub, copy.morePools(data.buckets.length - maxRows), '', true);
      }
      dl.appendChild(gSub);
    }
  }

  tooltipEl.replaceChildren(dl);
}
function createQuotaRingsController(win, doc, { onRefreshRequested } = {}) {
  let snapshot = { gemini: null, other: null, available: false };
  let rootEl = null;
  let otherBtn = null;
  let geminiBtn = null;
  let tooltipEl = null;
  let currentHostEl = null;
  let currentSettingsBtn = null;
  let currentMountMode = null;
  let hoverTimer = null;
  let activeTipGroup = null;
  let resizeObserver = null;
  let navObserver = null;
  let navTimer = null;
  let lastRenderSig = '';

  function ensureElements() {
    if (rootEl) return;
    rootEl = doc.createElement('div');
    rootEl.setAttribute('data-ag-qr-root', 'true');
    rootEl.setAttribute('data-my-antigravity-no-i18n', 'true');

    const createBtn = (groupKey, shape) => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'ag-qr-btn';
      btn.setAttribute('data-ag-qr-group', groupKey);
      btn.setAttribute('data-ag-qr-shape', shape);
      btn.setAttribute('data-my-antigravity-no-i18n', 'true');

      btn.addEventListener('pointerenter', () => {
        if (hoverTimer != null) win.clearTimeout?.(hoverTimer);
        hoverTimer = win.setTimeout?.(() => showTooltip(groupKey), 350) ?? null;
      });
      btn.addEventListener('pointerleave', () => hideTooltip());
      btn.addEventListener('focus', () => showTooltip(groupKey));
      btn.addEventListener('blur', () => hideTooltip());
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          hideTooltip();
        }
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        openModelsSettings();
      });
      return btn;
    };

    otherBtn = createBtn('other', 'square');
    geminiBtn = createBtn('gemini', 'circle');
    rootEl.appendChild(otherBtn);
    rootEl.appendChild(geminiBtn);

    tooltipEl = doc.createElement('div');
    tooltipEl.id = 'ag-qr-tooltip';
    tooltipEl.className = 'surface-glass';
    tooltipEl.setAttribute('data-ag-qr-tooltip', 'true');
    tooltipEl.setAttribute('data-my-antigravity-no-i18n', 'true');
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.hidden = true;
    doc.body?.appendChild(tooltipEl);
  }

  function clearNavWatch() {
    if (navObserver) {
      navObserver.disconnect();
      navObserver = null;
    }
    if (navTimer != null) {
      win.clearTimeout?.(navTimer);
      navTimer = null;
    }
  }

  function openModelsSettings() {
    onRefreshRequested?.({ force: true });
    clearNavWatch();

    const existingTab = findModelsTabElement(doc);
    if (existingTab) {
      existingTab.click();
      win.setTimeout?.(() => scrollQuotaSectionIntoView(doc), 80);
      return;
    }

    const settingsBtn = currentSettingsBtn || findSettingsButton(doc, win);
    if (!settingsBtn) return;

    settingsBtn.click();

    const trySelectModels = () => {
      const tab = findModelsTabElement(doc);
      if (!tab) return false;
      clearNavWatch();
      tab.click();
      win.setTimeout?.(() => scrollQuotaSectionIntoView(doc), 90);
      return true;
    };

    if (trySelectModels()) return;

    if (typeof win.MutationObserver === 'function' && doc.body) {
      navObserver = new win.MutationObserver(() => {
        trySelectModels();
      });
      navObserver.observe(doc.body, { childList: true, subtree: true });
      navTimer = win.setTimeout?.(() => clearNavWatch(), 1500) ?? null;
    }
  }

  function positionTooltip(btn) {
    if (!tooltipEl || !btn || typeof btn.getBoundingClientRect !== 'function') return;
    const rect = btn.getBoundingClientRect();
    const w = tooltipEl.offsetWidth || 180;
    const h = tooltipEl.offsetHeight || 64;
    const vw = Number(win.innerWidth) || 1280;
    const vh = Number(win.innerHeight) || 800;

    let left = rect.right + 8;
    if (left + w > vw - 8) {
      left = Math.max(8, rect.left - w - 8);
    }
    const top = Math.max(8, Math.min(rect.top + (rect.height - h) / 2, vh - h - 8));
    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(groupKey) {
    if (hoverTimer != null) {
      win.clearTimeout?.(hoverTimer);
      hoverTimer = null;
    }
    const data = snapshot[groupKey];
    const btn = groupKey === 'gemini' ? geminiBtn : otherBtn;
    if (!data || !btn || !tooltipEl) return;

    if (tooltipEl.parentElement !== doc.body && doc.body) {
      doc.body.appendChild(tooltipEl);
    }
    activeTipGroup = groupKey;
    const copy = selectCopy(win, doc);
    renderTooltipContent(doc, tooltipEl, groupKey, data, copy);
    tooltipEl.hidden = false;
    btn.setAttribute('aria-describedby', tooltipEl.id);
    positionTooltip(btn);
  }

  function hideTooltip() {
    if (hoverTimer != null) {
      win.clearTimeout?.(hoverTimer);
      hoverTimer = null;
    }
    activeTipGroup = null;
    if (tooltipEl) tooltipEl.hidden = true;
    otherBtn?.removeAttribute('aria-describedby');
    geminiBtn?.removeAttribute('aria-describedby');
  }

  function getVerticalCenterAnchor(settingsBtn) {
    const icon = settingsBtn?.querySelector?.('svg, .google-symbols');
    if (icon && typeof icon.getBoundingClientRect === 'function') {
      const iconRect = icon.getBoundingClientRect();
      if (iconRect && iconRect.height > 0) {
        return iconRect;
      }
    }
    return typeof settingsBtn?.getBoundingClientRect === 'function' ? settingsBtn.getBoundingClientRect() : null;
  }

  function updateAlignedPosition() {
    if (!rootEl || !currentSettingsBtn) return;
    if (typeof currentSettingsBtn.getBoundingClientRect !== 'function') return;
    const btnRect = currentSettingsBtn.getBoundingClientRect();
    const anchorRect = getVerticalCenterAnchor(currentSettingsBtn);

    if (currentMountMode === 'inline') {
      if (btnRect && btnRect.height > 0 && anchorRect && anchorRect.height > 0) {
        const delta =
          anchorRect.top + anchorRect.height / 2 - (btnRect.top + btnRect.height / 2);
        rootEl.style.transform =
          Math.abs(delta) >= 0.25 && Math.abs(delta) <= 12
            ? `translateY(${delta.toFixed(2)}px)`
            : '';
      } else {
        rootEl.style.transform = '';
      }
      return;
    }

    if (currentMountMode !== 'aligned') return;
    if (!btnRect || btnRect.width < 130 || btnRect.height <= 0) {
      rootEl.setAttribute('data-ag-qr-collapsed', 'true');
      return;
    }
    rootEl.removeAttribute('data-ag-qr-collapsed');
    const rootRect = typeof rootEl.getBoundingClientRect === 'function' ? rootEl.getBoundingClientRect() : null;
    const rootH = rootRect && rootRect.height > 0 ? rootRect.height : 26;
    const vRect = anchorRect && anchorRect.height > 0 ? anchorRect : btnRect;
    const top = vRect.top + (vRect.height - rootH) / 2;
    const right = Math.max(8, (Number(win.innerWidth) || 1280) - btnRect.right + 8);
    rootEl.style.top = `${top.toFixed(2)}px`;
    rootEl.style.right = `${Math.round(right)}px`;
  }

  function clearHostMarkers() {
    if (currentHostEl) {
      currentHostEl.removeAttribute('data-ag-qr-host');
      currentHostEl = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  function unmount() {
    hideTooltip();
    clearHostMarkers();
    rootEl?.remove();
    currentSettingsBtn = null;
    currentMountMode = null;
  }

  function renderRings() {
    if (!rootEl) return;
    const copy = selectCopy(win, doc);
    const sig = JSON.stringify({
      lang: copy === COPY['zh-CN'] ? 'zh' : 'en',
      other: snapshot.other,
      gemini: snapshot.gemini,
    });
    if (sig === lastRenderSig && otherBtn.childElementCount > 0 === Boolean(snapshot.other)) {
      return;
    }
    lastRenderSig = sig;

    const syncOne = (btn, shape, data, title) => {
      if (!data) {
        btn.hidden = true;
        btn.replaceChildren();
        return;
      }
      btn.hidden = false;
      btn.replaceChildren(...buildRingContent(doc, shape, data));
      const summaryText =
        data.mode === 'dual'
          ? `${title}: ${copy.fiveHour} ${data.fiveHour}%, ${copy.weekly} ${data.weekly}%`
          : `${title}: ${data.primary}%`;
      btn.setAttribute('aria-label', summaryText);
      btn.setAttribute('aria-description', copy.openSettingsDesc);
    };

    syncOne(otherBtn, 'square', snapshot.other, copy.otherLabel);
    syncOne(geminiBtn, 'circle', snapshot.gemini, copy.geminiLabel);

    if (activeTipGroup) {
      if (snapshot[activeTipGroup]) {
        showTooltip(activeTipGroup);
      } else {
        hideTooltip();
      }
    }
  }

  function syncMount() {
    if (!snapshot.available) {
      unmount();
      return;
    }

    const settingsBtn = findSettingsButton(doc, win);
    if (!settingsBtn || !settingsBtn.parentElement) {
      unmount();
      return;
    }

    ensureElements();
    const parent = settingsBtn.parentElement;
    const otherSiblings = [...parent.children].filter((el) => el !== settingsBtn && el !== rootEl);
    let computedDir = '';
    try {
      computedDir = win.getComputedStyle?.(parent)?.flexDirection || '';
    } catch {
      computedDir = '';
    }

    const useInline = otherSiblings.length === 0 || computedDir === 'row';
    const nextMode = useInline ? 'inline' : 'aligned';

    if (currentSettingsBtn !== settingsBtn || currentMountMode !== nextMode || !rootEl.isConnected) {
      clearHostMarkers();
      currentSettingsBtn = settingsBtn;
      currentMountMode = nextMode;
      rootEl.setAttribute('data-ag-qr-mode', nextMode);
      rootEl.style.top = '';
      rootEl.style.right = '';
      rootEl.style.transform = '';
      rootEl.removeAttribute('data-ag-qr-collapsed');

      if (useInline) {
        currentHostEl = parent;
        parent.setAttribute('data-ag-qr-host', 'inline');
        settingsBtn.after(rootEl);
      } else if (doc.body) {
        doc.body.appendChild(rootEl);
      }
      if (typeof win.ResizeObserver === 'function') {
        resizeObserver = new win.ResizeObserver(() => updateAlignedPosition());
        resizeObserver.observe(settingsBtn);
        resizeObserver.observe(parent);
      }
    }

    renderRings();
    updateAlignedPosition();
  }

  function setSnapshot(nextSnapshot) {
    snapshot = nextSnapshot || { gemini: null, other: null, available: false };
    syncMount();
  }

  function handleResize() {
    updateAlignedPosition();
    if (activeTipGroup) {
      const btn = activeTipGroup === 'gemini' ? geminiBtn : otherBtn;
      if (btn) positionTooltip(btn);
    }
  }

  win.addEventListener?.('resize', handleResize);

  return {
    setSnapshot,
    syncMount,
    openModelsSettings,
    destroy() {
      clearNavWatch();
      unmount();
      tooltipEl?.remove();
      win.removeEventListener?.('resize', handleResize);
    },
  };
}

// --- entry.js ---
/**
 * quota-rings 运行时入口：
 * 1) 同步挂载 fetch / WebSocket 旁路监听（避免错过首包与鉴权头）；
 * 2) DOM 就绪后在左下角「设置」右侧挂载双额度环，并监听侧栏重渲染与语言切换。
 */
function installQuotaRingsPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityQuotaRingsInstalled) {
    return null;
  }
  win.__myAntigravityQuotaRingsInstalled = true;

  let modelEntries = [];
  let summaryEntries = [];
  let controller = null;
  let observer = null;
  let scheduled = false;

  function recomputeAndRender() {
    const snap = buildQuotaSnapshot({ modelEntries, summaryEntries });
    controller?.setSnapshot(snap);
  }

  function scheduleSyncMount() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.syncMount();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  const tap = installQuotaTap(win, {
    onModelPayload(payload) {
      const next = extractModelQuotaEntries(payload);
      if (next.length > 0) {
        modelEntries = next;
        recomputeAndRender();
      }
    },
    onSummaryPayload(payload) {
      const next = extractSummaryQuotaEntries(payload);
      if (next.length > 0) {
        summaryEntries = next;
        recomputeAndRender();
      }
    },
  });

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(node.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip]'));
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createQuotaRingsController(win, doc, {
      onRefreshRequested(opts) {
        void tap.refresh(opts);
      },
    });
    recomputeAndRender();

    // 首次挂载后尝试温和补齐（若原生请求尚未捕获或先于脚本完成）
    void tap.refresh({ force: false });

    if (typeof win.setTimeout === 'function') {
      win.setTimeout(() => {
        recomputeAndRender();
      }, 150);
    }

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') {
            recomputeAndRender();
            return;
          }
          if (!isOwnUiNode(m.target)) {
            scheduleSyncMount();
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
    getSnapshot: () => buildQuotaSnapshot({ modelEntries, summaryEntries }),
    getController: () => controller,
    refresh: (opts) => tap.refresh(opts),
    dispose() {
      observer?.disconnect();
      tap.dispose();
      controller?.destroy();
    },
  };
}

  installQuotaRingsPlugin(win, doc);
})(window, document);
