/**
 * model-enhancer 纯函数核心模块：
 * 负责思考档位解析、品牌图标匹配与 SVG 实例 ID 去重，无 DOM / Node 依赖。
 */

export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];

export const EFFORT_LABELS = {
  'zh-CN': {
    low: '低',
    medium: '中',
    high: '高',
    xhigh: '超高',
    max: '极高',
  },
  en: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra',
    max: 'Max',
  },
};

const EFFORT_SUFFIX_RE = /^(.*?)\s*\((low|medium|high|xhigh|max)(?:\s+thinking)?\)\s*$/i;

const PROVIDER_ENUM_MAP = [
  ['anthropic', 'anthropic'],
  ['google', 'gemini'],
  ['openai', 'openai'],
  ['deepseek', 'deepseek'],
  ['xai', 'grok'],
  ['glm', 'zhipu'],
  ['zhipu', 'zhipu'],
  ['kimi', 'kimi'],
];

const BRAND_RULES = [
  { id: 'deepseek', test: (s) => s.includes('deepseek') },
  { id: 'anthropic', test: (s) => /\b(?:claude|anthropic|sonnet|opus|haiku)\b/.test(s) || s.includes('claude') || s.includes('anthropic') },
  { id: 'gemini', test: (s) => s.includes('gemini') || s.includes('gemma') || /\b(?:palm|bard)\b/.test(s) },
  { id: 'grok', test: (s) => s.includes('grok') || /(?:^|[^a-z0-9])xai(?:$|[^a-z0-9])/.test(s) },
  { id: 'mimo', test: (s) => s.includes('mimo') || s.includes('xiaomi') },
  { id: 'kimi', test: (s) => s.includes('kimi') || s.includes('moonshot') },
  { id: 'minimax', test: (s) => s.includes('minimax') },
  { id: 'qwen', test: (s) => s.includes('qwen') || s.includes('qwq') },
  { id: 'hunyuan', test: (s) => s.includes('hunyuan') || s.includes('tencent') || /(?:^|[^a-z0-9])hy3(?:$|[^a-z0-9])/.test(s) },
  { id: 'muse', test: (s) => /\bmuse\b/.test(s) || s.includes('muse-spark') || s.includes('llama') },
  { id: 'zhipu', test: (s) => s.includes('zhipu') || s.includes('chatglm') || /(?:^|[^a-z0-9])glm(?:$|[^a-z0-9])/.test(s) },
  { id: 'openai', test: (s) => s.includes('openai') || s.includes('gpt') || s.includes('codex') || /(?:^|[^a-z0-9])o[134](?:$|[^a-z0-9])/.test(s) },
];

export function parseEffortLabel(label) {
  if (typeof label !== 'string') return null;
  const match = EFFORT_SUFFIX_RE.exec(label.trim());
  if (!match) return null;
  const base = match[1].trim();
  const effort = match[2].toLowerCase();
  if (!base) return null;
  return { base, effort };
}

export function resolveBaseAndEffort(option, effortIndex) {
  if (!option || option.isCustom) return null;
  const parsed = parseEffortLabel(option.label);
  if (parsed) {
    if (!(effortIndex instanceof Map) || effortIndex.has(parsed.base)) {
      return parsed;
    }
  }
  if (effortIndex instanceof Map) {
    for (const [base, byEffort] of effortIndex.entries()) {
      if (!(byEffort instanceof Map)) continue;
      for (const [effort, candidate] of byEffort.entries()) {
        if (
          candidate === option ||
          (candidate &&
            candidate.label === option.label &&
            (candidate.value == null || option.value == null || candidate.value === option.value))
        ) {
          return { base, effort };
        }
      }
    }
  }
  return parsed;
}

export function getAvailableEfforts(baseName, effortIndex) {
  if (!baseName || !(effortIndex instanceof Map)) return [];
  const byEffort = effortIndex.get(baseName);
  if (!(byEffort instanceof Map) || byEffort.size === 0) return [];

  const result = [];
  const seen = new Set();
  for (const effort of EFFORT_ORDER) {
    if (byEffort.has(effort)) {
      seen.add(effort);
      result.push({ effort, option: byEffort.get(effort) });
    }
  }
  for (const [effort, option] of byEffort.entries()) {
    if (!seen.has(effort)) {
      result.push({ effort, option });
    }
  }
  return result;
}

export function getDefaultEffort(effortsList) {
  if (!Array.isArray(effortsList) || effortsList.length === 0) return null;
  const medium = effortsList.find((item) => item.effort === 'medium');
  return medium ? medium.effort : effortsList[0].effort;
}

export function formatEffortLabel(effort, lang = 'en') {
  const key = String(effort || '').toLowerCase();
  const table = lang === 'zh-CN' ? EFFORT_LABELS['zh-CN'] : EFFORT_LABELS.en;
  return table[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
}

export function resolveBrandId(meta = {}) {
  const providerRaw = typeof meta.provider === 'string' ? meta.provider.toLowerCase() : '';
  if (providerRaw && !providerRaw.includes('unspecified') && !providerRaw.includes('antigravity')) {
    for (const [token, brandId] of PROVIDER_ENUM_MAP) {
      if (providerRaw.includes(token)) return brandId;
    }
  }

  const haystack = [meta.base, meta.label, meta.modelId, meta.modelAlias]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .toLowerCase();

  if (!haystack) return 'fallback';

  for (const rule of BRAND_RULES) {
    if (rule.test(haystack)) {
      return rule.id;
    }
  }
  return 'fallback';
}

let svgSeq = 0;

export function prepareSvgMarkup(rawSvg, prefix = 'ag-me-svg') {
  if (typeof rawSvg !== 'string' || !rawSvg.trim()) return '';
  let markup = rawSvg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/gi, '').trim();
  const idMatches = [...markup.matchAll(/\bid="([^"]+)"/g)];
  if (idMatches.length > 0) {
    svgSeq += 1;
    const tag = `${prefix}-${svgSeq}`;
    for (const m of idMatches) {
      const oldId = m[1];
      const newId = `${tag}-${oldId}`;
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      markup = markup
        .replace(new RegExp(`id="${escaped}"`, 'g'), `id="${newId}"`)
        .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${newId})`)
        .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${newId}"`);
    }
  }
  return markup;
}

export function createBrandSvgElement(doc, iconsMap, brandId) {
  const raw = (iconsMap && (iconsMap[brandId] || iconsMap.fallback)) || '';
  const markup = prepareSvgMarkup(raw);
  if (!markup || !doc?.createElement) return null;

  const tpl = doc.createElement('template');
  tpl.innerHTML = markup;
  const svg = tpl.content?.firstElementChild;
  if (!svg || String(svg.tagName).toLowerCase() !== 'svg') return null;

  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-ag-me-icon', brandId || 'fallback');
  svg.removeAttribute('style');
  return svg;
}
