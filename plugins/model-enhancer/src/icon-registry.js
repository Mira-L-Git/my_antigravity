/**
 * 模型图标配置表（修改后在仓库根目录运行 `npm run sync` 并重启 Antigravity 即可生效）：
 *
 * 匹配优先级（从高到低）：
 * 1. DISABLED_MODEL_PATTERNS：命中则不显示任何图标（用于已废弃或不想展示图标的模型）
 * 2. MODEL_ICON_OVERRIDES：按具体模型名称 / ID / 别名优先覆盖指定图标
 * 3. PROVIDER_ICON_MAP：按后端返回的 provider 枚举兜底匹配品牌图标
 * 4. BRAND_ICON_RULES：按关键字兜底匹配整个模型系列
 * 5. 以上均未命中时，使用通用兜底图标 `fallback`（assets/ui/sparkles.svg）
 */

/**
 * 取消显示图标的模型清单（支持精确字符串或正则；命中后该行不渲染图标，也不回退为 sparkles）。
 * 示例：
 *   'Gemini 4 Argon',
 *   /^gpt-oss-120b$/i,
 */
export const DISABLED_MODEL_PATTERNS = [];

/**
 * 具体模型精确/正则图标覆盖表：
 * - 适合给个别新模型、无品牌前缀的代号模型或单个模型单独指定图标；
 * - `icon` 对应 `assets/providers/<icon>.svg` 的文件名（其中 `xiaomimimo.svg` 的 key 为 `mimo`）。
 */
export const MODEL_ICON_OVERRIDES = [
  // Antigravity Orchestrator 协调器模型（底层对应 gemini-pro-orchestrator / gemini-pro-coordinator）
  {
    match: /^(?:orchestrator|gemini-pro-(?:orchestrator|coordinator))$/i,
    icon: 'gemini',
  },
  {
    match: /\bgemini-pro-orchestrator-/i,
    icon: 'gemini',
  },
];

/**
 * 后端 provider 枚举到图标 key 的映射。
 */
export const PROVIDER_ICON_MAP = [
  ['anthropic', 'anthropic'],
  ['google', 'gemini'],
  ['openai', 'openai'],
  ['deepseek', 'deepseek'],
  ['xai', 'grok'],
  ['glm', 'zhipu'],
  ['zhipu', 'zhipu'],
  ['kimi', 'kimi'],
];

/**
 * 品牌关键字兜底规则（按数组顺序从上到下匹配，越具体的规则建议放在越前面）。
 */
export const BRAND_ICON_RULES = [
  { id: 'deepseek', test: (s) => s.includes('deepseek') },
  {
    id: 'anthropic',
    test: (s) =>
      /\b(?:claude|anthropic|sonnet|opus|haiku)\b/.test(s) ||
      s.includes('claude') ||
      s.includes('anthropic'),
  },
  {
    id: 'gemini',
    test: (s) => s.includes('gemini') || s.includes('gemma') || /\b(?:palm|bard)\b/.test(s),
  },
  {
    id: 'grok',
    test: (s) => s.includes('grok') || /(?:^|[^a-z0-9])xai(?:$|[^a-z0-9])/.test(s),
  },
  { id: 'mimo', test: (s) => s.includes('mimo') || s.includes('xiaomi') },
  { id: 'kimi', test: (s) => s.includes('kimi') || s.includes('moonshot') },
  { id: 'minimax', test: (s) => s.includes('minimax') },
  { id: 'qwen', test: (s) => s.includes('qwen') || s.includes('qwq') },
  {
    id: 'hunyuan',
    test: (s) =>
      s.includes('hunyuan') ||
      s.includes('tencent') ||
      /(?:^|[^a-z0-9])hy3(?:$|[^a-z0-9])/.test(s),
  },
  {
    id: 'muse',
    test: (s) => /\bmuse\b/.test(s) || s.includes('muse-spark') || s.includes('llama'),
  },
  {
    id: 'zhipu',
    test: (s) =>
      s.includes('zhipu') ||
      s.includes('chatglm') ||
      /(?:^|[^a-z0-9])glm(?:$|[^a-z0-9])/.test(s),
  },
  {
    id: 'openai',
    test: (s) =>
      s.includes('openai') ||
      s.includes('gpt') ||
      s.includes('codex') ||
      /(?:^|[^a-z0-9])o[134](?:$|[^a-z0-9])/.test(s),
  },
  // 放在其它显式品牌之后，避免外部模型恰好借用元素/媒体代号时误归为 Gemini
  {
    id: 'gemini',
    test: (s) =>
      /\b(?:lyria|imagen|veo)\b/.test(s) ||
      /(?:^|[^a-z0-9])(?:nano[\s_-]*banana|carbon|neon|hydrogen|argon)(?:$|[^a-z0-9])/.test(s),
  },
];
