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
export function parseTimestampMs(raw) {
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
export function normalizeRemainingPercent(rawFraction, isPercent = false) {
  const num = toFiniteNumber(rawFraction);
  if (num == null) return null;
  const pct = isPercent ? num : num <= 1 ? num * 100 : num;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/**
 * 判断模型属于 'gemini' 还是 'other'；对禁用或自定义模型返回 null。
 */
export function classifyModelGroup(config) {
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
export function stripEffortSuffix(label) {
  if (typeof label !== 'string') return '';
  return label
    .replace(/\s*\((?:(?:low|medium|high|xhigh|max)(?:\s+thinking)?|thinking)\)\s*$/i, '')
    .trim();
}

/**
 * 从 GetUserStatusResponse 或 CascadeModelConfigData 提取模型配额条目。
 */
export function extractModelQuotaEntries(payload) {
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
export function extractSummaryQuotaEntries(payload) {
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
export function buildQuotaSnapshot({ modelEntries = [], summaryEntries = [] } = {}) {
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
export function formatResetTime(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
