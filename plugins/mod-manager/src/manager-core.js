/**
 * mod-manager 纯函数核心模块：
 * - 左上角 Antigravity 图标按钮候选项评分与防误判；
 * - 插件列表过滤、排序、简短功能摘要与待重载状态比对。
 */

const NON_LOGO_CONTROL_RE =
  /\b(?:sidebar|toggle[-_\s]?sidebar|collapse|expand|back|forward|search|close|minimize|maximize|settings)\b|侧边栏|折叠|展开|后退|前进|搜索|关闭|最小化|最大化|设置/i;

const LOGO_HINT_RE = /\b(?:antigravity|home|logo|brand)\b|首页/i;

const SHORT_SUMMARY_BY_ID = {
  'enter-newline': 'Enter 换行，Shift+Enter 发送',
  'model-enhancer': '模型品牌图标与思考深度拉条',
  'quota-rings': '左下角模型剩余额度双环',
  'session-status': '输入框下方会话与 Token 状态栏',
  'zh-cn': '桌面端界面简体中文化',
};

export const MIN_LOGO_SCORE = 4;

/**
 * 对候选元素特征进行打分；返回 -1 表示硬排除，不作为目标按钮。
 */
export function scoreLogoButtonCandidate(info) {
  if (!info || info.inIgnoredContainer || info.inMenubarOrMenu) {
    return -1;
  }
  const text = String(info.text || '').replace(/\s+/g, ' ').trim();
  if (text.length > 0) {
    return -1;
  }
  if (!info.hasSvg) {
    return -1;
  }

  const rect = info.rect;
  if (
    !rect ||
    rect.width < 16 ||
    rect.width > 56 ||
    rect.height < 16 ||
    rect.height > 56
  ) {
    return -1;
  }
  if (rect.left < 0 || rect.left > 120 || rect.top < 24 || rect.top > 120) {
    return -1;
  }

  const hintText = [info.testId, info.ariaLabel, info.title].filter(Boolean).join(' ');
  if (hintText && NON_LOGO_CONTROL_RE.test(hintText)) {
    return -1;
  }

  let score = 1;
  if (hintText && LOGO_HINT_RE.test(hintText)) {
    score += 10;
  }
  if (
    info.rowHasSiblingIconButtons &&
    typeof info.rowMinLeft === 'number' &&
    Math.abs(rect.left - info.rowMinLeft) <= 2
  ) {
    score += 6;
  }
  if (rect.left <= 48) {
    score += 2;
  }
  if (rect.top <= 84) {
    score += 1;
  }
  return score;
}

/**
 * 过滤掉不应在开关列表中展示的管理插件自身或受保护核心项。
 */
export function filterDisplayMods(mods) {
  if (!Array.isArray(mods)) {
    return [];
  }
  return mods.filter((mod) => mod && !mod.protected && mod.id !== 'mod-manager');
}

/**
 * 排序插件目录：按原英文 ID 字母序展示。
 */
export function sortCatalogMods(mods) {
  if (!Array.isArray(mods)) {
    return [];
  }
  return [...mods].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
}

/**
 * 提取精简的一句话功能说明：
 * 优先使用 mod.json 的 summary -> 内置精简映射 -> description 去冗余首句 -> name。
 */
export function getShortSummary(mod) {
  if (!mod) {
    return '';
  }
  const explicit = String(mod.summary || '').trim();
  if (explicit) {
    return explicit;
  }
  const id = String(mod.id || '').trim();
  if (id && Object.prototype.hasOwnProperty.call(SHORT_SUMMARY_BY_ID, id)) {
    return SHORT_SUMMARY_BY_ID[id];
  }
  const desc = String(mod.description || '').trim();
  if (desc) {
    // 去掉括号补充细节并截取首句，保持菜单紧凑易读
    const stripped = desc.replace(/[（(][^）)]*[）)]/g, '').trim();
    const firstSentence = stripped.split(/[。；;\n]/)[0]?.trim();
    return firstSentence || stripped || desc;
  }
  return String(mod.name || '暂无功能说明');
}

/**
 * 计算与当前窗口启动基线不一致、需要重载窗口才能生效的插件 ID 列表。
 */
export function computePendingReloadIds(mods, bootEnabledIds) {
  if (!Array.isArray(mods) || !Array.isArray(bootEnabledIds)) {
    return [];
  }
  const bootSet = new Set(bootEnabledIds.map((id) => String(id)));
  const pending = [];
  for (const mod of mods) {
    const id = String(mod?.id || '');
    if (!id) continue;
    const nowEnabled = Boolean(mod.enabled);
    const wasEnabled = bootSet.has(id);
    if (nowEnabled !== wasEnabled) {
      pending.push(id);
    }
  }
  return pending;
}
