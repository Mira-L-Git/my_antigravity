/**
 * model-enhancer 纯函数核心模块：
 * 负责思考档位解析、品牌图标匹配与 SVG 实例 ID 去重，无 DOM / Node 依赖。
 */
import {
  BRAND_ICON_RULES,
  DISABLED_MODEL_PATTERNS,
  MODEL_ICON_OVERRIDES,
  PROVIDER_ICON_MAP,
} from './icon-registry.js';

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

export function parseEffortLabel(label) {
  if (typeof label !== 'string') return null;
  const match = EFFORT_SUFFIX_RE.exec(label.trim());
  if (!match) return null;
  const base = match[1].trim();
  const effort = match[2].toLowerCase();
  if (!base) return null;
  return { base, effort };
}

function resolveGroupDisplayName(groupKey, byEffort, option, groupedModels) {
  const gm = groupedModels && typeof groupedModels === 'object' ? groupedModels[groupKey] : null;
  if (gm && typeof gm.displayName === 'string' && gm.displayName.trim()) {
    return gm.displayName.trim();
  }
  const parsed = parseEffortLabel(option?.label);
  if (parsed?.base) return parsed.base;
  if (byEffort instanceof Map) {
    for (const candidate of byEffort.values()) {
      const candidateBase = parseEffortLabel(candidate?.label)?.base;
      if (candidateBase) return candidateBase;
    }
  }
  return groupKey;
}

export function resolveBaseAndEffort(option, effortIndex, groupedModels = null) {
  if (!option || option.isCustom) return null;
  const parsed = parseEffortLabel(option.label);

  if (effortIndex instanceof Map) {
    // Antigravity 新版 groupedModels 结构中 effortIndex 键名可能为 groupKey（如 gemini-4-neon）
    for (const [groupKey, byEffort] of effortIndex.entries()) {
      if (!(byEffort instanceof Map)) continue;
      for (const [effort, candidate] of byEffort.entries()) {
        if (
          candidate === option ||
          (candidate &&
            ((option.modelId && candidate.modelId === option.modelId) ||
              (candidate.label === option.label &&
                (candidate.value == null || option.value == null || candidate.value === option.value))))
        ) {
          return {
            base: resolveGroupDisplayName(groupKey, byEffort, option, groupedModels),
            groupKey,
            effort,
          };
        }
      }
    }
    if (parsed && effortIndex.has(parsed.base)) {
      return { base: parsed.base, groupKey: parsed.base, effort: parsed.effort };
    }
  }
  return parsed ? { base: parsed.base, groupKey: parsed.base, effort: parsed.effort } : null;
}

function findEffortGroupEntry(baseOrGroupKey, effortIndex, groupedModels = null) {
  if (!baseOrGroupKey || !(effortIndex instanceof Map)) return null;
  if (effortIndex.has(baseOrGroupKey)) {
    const direct = effortIndex.get(baseOrGroupKey);
    return direct instanceof Map ? direct : null;
  }
  if (groupedModels && typeof groupedModels === 'object') {
    for (const [groupKey, meta] of Object.entries(groupedModels)) {
      if (meta?.displayName === baseOrGroupKey && effortIndex.has(groupKey)) {
        const hit = effortIndex.get(groupKey);
        if (hit instanceof Map) return hit;
      }
    }
  }
  for (const byEffort of effortIndex.values()) {
    if (!(byEffort instanceof Map)) continue;
    for (const candidate of byEffort.values()) {
      if (parseEffortLabel(candidate?.label)?.base === baseOrGroupKey) {
        return byEffort;
      }
    }
  }
  return null;
}

export function getAvailableEfforts(baseOrGroupKey, effortIndex, groupedModels = null) {
  const byEffort = findEffortGroupEntry(baseOrGroupKey, effortIndex, groupedModels);
  if (!byEffort || byEffort.size === 0) return [];

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

export function isOrchestratorModel(option) {
  const id = typeof option?.modelId === 'string' ? option.modelId.trim().toLowerCase() : '';
  return (
    id === 'gemini-pro-coordinator' ||
    id === 'gemini-pro-orchestrator' ||
    id.startsWith('gemini-pro-orchestrator-')
  );
}

function testSafeRegex(regex, text) {
  if (regex.global || regex.sticky) regex.lastIndex = 0;
  return regex.test(text);
}

function matchesRulePattern(pattern, fields, haystack) {
  if (!pattern) return false;
  if (pattern instanceof RegExp) {
    return fields.some((f) => testSafeRegex(pattern, f)) || (haystack ? testSafeRegex(pattern, haystack) : false);
  }
  if (typeof pattern === 'string') {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    if (fields.some((f) => f.toLowerCase() === p)) return true;
    return haystack.includes(p);
  }
  return false;
}

export function resolveBrandId(meta = {}, registry = null) {
  const disabledPatterns = registry?.disabledPatterns ?? DISABLED_MODEL_PATTERNS;
  const overrides = registry?.overrides ?? MODEL_ICON_OVERRIDES;
  const providerMap = registry?.providerMap ?? PROVIDER_ICON_MAP;
  const brandRules = registry?.brandRules ?? BRAND_ICON_RULES;

  const parsedLabelBase = parseEffortLabel(meta.label)?.base || '';
  const fields = [
    meta.base,
    parsedLabelBase,
    meta.label,
    meta.displayName,
    meta.modelId,
    meta.modelAlias,
    meta.modelOrAlias?.model,
    meta.modelOrAlias?.alias,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim());

  const haystack = fields.join(' ').toLowerCase();

  for (const pattern of disabledPatterns) {
    if (matchesRulePattern(pattern, fields, haystack)) {
      return null;
    }
  }

  for (const entry of overrides) {
    if (entry && entry.icon && matchesRulePattern(entry.match, fields, haystack)) {
      return entry.icon;
    }
  }

  const providerRaw = typeof meta.provider === 'string' ? meta.provider.toLowerCase() : '';
  if (providerRaw && !providerRaw.includes('unspecified') && !providerRaw.includes('antigravity')) {
    for (const [token, brandId] of providerMap) {
      if (providerRaw.includes(token)) return brandId;
    }
  }

  if (!haystack) return 'fallback';

  for (const rule of brandRules) {
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
  if (!brandId) return null;
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
