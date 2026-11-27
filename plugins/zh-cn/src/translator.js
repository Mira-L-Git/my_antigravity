/**
 * zh-cn 运行时界面翻译引擎。
 * 由 build.mjs 注入词典与模板后生成自包含的 index.js。
 */
(function registerZhCnMod(win, doc) {
  if (win.__myAntigravityZhCnInstalled) {
    return;
  }
  win.__myAntigravityZhCnInstalled = true;

  // 以下占位常量在 build.mjs 打包时会被替换为真实词典与模板
  const EXACT_DICT = __ZH_CN_EXACT_DICT__;
  const LOWER_DICT = Object.create(null);
  for (const key of Object.keys(EXACT_DICT)) {
    const lower = key.toLowerCase();
    if (!(lower in LOWER_DICT)) {
      LOWER_DICT[lower] = EXACT_DICT[key];
    }
  }
  const PATTERNS = __ZH_CN_PATTERNS__.map((item) => ({
    regex: new RegExp(item.pattern),
    replace: item.replace,
    localizeDuration: Boolean(item.localizeDuration),
  }));

  // 绝不翻译文本节点的隔离区域：代码块、用户输入、AI 回复正文、终端、地址栏等
  const SKIP_TEXT_ANCESTOR_SELECTOR = [
    'pre',
    'code',
    'kbd',
    'samp',
    'var',
    'script',
    'style',
    'noscript',
    'textarea',
    'input',
    '[contenteditable="true"]',
    '[data-lexical-editor="true"]',
    '.xterm',
    '.monaco-editor',
    '.cm-editor',
    '.google-symbols',
    '.material-symbols-outlined',
    '.material-symbols-rounded',
    '.material-icons',
    '[data-testid="terminal-surface"]',
    '[data-testid="bottom-terminal-panel"]',
    '[data-testid="user-message-content"]',
    '[data-testid="agent-response"]',
    '[data-testid="markdown-code-block-preview"]',
    '[data-testid="browser-url-display"]',
    '[data-testid="external-link-confirm-uri"]',
    '[data-my-antigravity-no-i18n]',
  ].join(',');

  // 对属性（placeholder / aria-label / title）同样跳过对话正文与代码编辑器内部节点
  const SKIP_ATTR_ANCESTOR_SELECTOR = [
    'pre',
    'code',
    '.monaco-editor',
    '.cm-editor',
    '.xterm',
    '.google-symbols',
    '.material-symbols-outlined',
    '.material-symbols-rounded',
    '.material-icons',
    '[data-testid="user-message-content"]',
    '[data-testid="agent-response"]',
    '[data-my-antigravity-no-i18n]',
  ].join(',');

  const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label', 'title'];
  const writtenTextMap = new WeakMap();
  const writtenAttrMap = new WeakMap();

  function localizeDurationText(text) {
    return text
      .replace(/(\d+)\s*days?\b/gi, '$1 天')
      .replace(/(\d+)\s*hours?\b/gi, '$1 小时')
      .replace(/(\d+)\s*minutes?\b/gi, '$1 分钟')
      .replace(/(\d+)\s*seconds?\b/gi, '$1 秒')
      .replace(/(\d+)d\b/g, '$1 天')
      .replace(/(\d+)h\b/g, '$1 小时')
      .replace(/(\d+)m\b/g, '$1 分钟')
      .replace(/\s*,\s*/g, ' ');
  }

  function lookupDict(text) {
    if (Object.prototype.hasOwnProperty.call(EXACT_DICT, text)) {
      return EXACT_DICT[text];
    }
    if (text.includes(' ') || text.length >= 4) {
      const lower = text.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(LOWER_DICT, lower)) {
        return LOWER_DICT[lower];
      }
    }
    return null;
  }

  function translateCore(trimmed) {
    if (!trimmed) {
      return null;
    }
    const direct = lookupDict(trimmed);
    if (direct !== null) {
      return direct;
    }
    // 回退匹配：去掉末尾冒号或省略号后再查词典，并保留原末尾标点
    const suffixMatch = /^(.*?)(\s*[:：]|\.\.\.|…)$/.exec(trimmed);
    if (suffixMatch) {
      const base = suffixMatch[1].trim();
      const rawSuffix = suffixMatch[2];
      const baseHit = lookupDict(base);
      if (baseHit !== null) {
        const zhSuffix = rawSuffix.includes(':') ? '：' : rawSuffix;
        return baseHit + zhSuffix;
      }
    }
    for (let i = 0; i < PATTERNS.length; i++) {
      const { regex, replace, localizeDuration } = PATTERNS[i];
      if (regex.test(trimmed)) {
        const out = trimmed.replace(regex, replace);
        return localizeDuration ? localizeDurationText(out) : out;
      }
    }
    return null;
  }

  function translateText(raw) {
    if (typeof raw !== 'string') {
      return null;
    }
    // 跳过全空白、纯数字、或已含中文的文本以降低开销
    if (!raw.trim() || !/[A-Za-z]/.test(raw)) {
      return null;
    }
    const leadMatch = /^\s*/.exec(raw);
    const trailMatch = /\s*$/.exec(raw);
    const lead = leadMatch ? leadMatch[0] : '';
    const trail = trailMatch ? trailMatch[0] : '';
    const core = raw.slice(lead.length, raw.length - trail.length);

    // 优先按原换行结构精确查，再按折叠单行空白查
    let hit = translateCore(core);
    if (hit === null && /\s{2,}|\n/.test(core)) {
      hit = translateCore(core.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]{2,}/g, ' '));
    }
    if (hit === null) {
      return null;
    }
    return lead + hit + trail;
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== 3) {
      return;
    }
    const cur = node.nodeValue;
    if (!cur || cur === writtenTextMap.get(node)) {
      return;
    }
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_TEXT_ANCESTOR_SELECTOR)) {
      return;
    }
    const next = translateText(cur);
    if (next !== null && next !== cur) {
      writtenTextMap.set(node, next);
      node.nodeValue = next;
    }
  }

  function processElementAttrs(el) {
    if (!el || el.nodeType !== 1 || el.closest(SKIP_ATTR_ANCESTOR_SELECTOR)) {
      return;
    }
    let cache = writtenAttrMap.get(el);
    for (let i = 0; i < TRANSLATABLE_ATTRS.length; i++) {
      const attr = TRANSLATABLE_ATTRS[i];
      if (!el.hasAttribute(attr)) {
        continue;
      }
      const val = el.getAttribute(attr);
      if (!val || (cache && cache.get(attr) === val)) {
        continue;
      }
      const next = translateText(val);
      if (next !== null && next !== val) {
        if (!cache) {
          cache = new Map();
          writtenAttrMap.set(el, cache);
        }
        cache.set(attr, next);
        el.setAttribute(attr, next);
      }
    }
  }

  function walkAndTranslate(root) {
    if (!root) {
      return;
    }
    if (root.nodeType === 3) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== 1) {
      return;
    }
    processElementAttrs(root);
    if (root.matches && root.matches(SKIP_TEXT_ANCESTOR_SELECTOR)) {
      // 跳过文本子节点，但若内部包含需要翻属性的控件（如输入框 placeholder），则仅处理后代属性
      const attrTargets = root.querySelectorAll
        ? root.querySelectorAll('[placeholder],[aria-label],[title]')
        : [];
      for (let i = 0; i < attrTargets.length; i++) {
        processElementAttrs(attrTargets[i]);
      }
      return;
    }
    const walker = doc.createTreeWalker(root, 1 | 4 /* SHOW_ELEMENT | SHOW_TEXT */);
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === 3) {
        processTextNode(current);
      } else if (current.nodeType === 1) {
        processElementAttrs(current);
      }
      current = walker.nextNode();
    }
  }

  // 若宿主环境允许覆写 electronNative.showContextMenu，则一并翻译原生菜单项 label
  function installContextMenuTranslator() {
    try {
      const api = win.electronNative;
      if (!api || typeof api.showContextMenu !== 'function') {
        return;
      }
      const desc = Object.getOwnPropertyDescriptor(api, 'showContextMenu');
      if (desc && !desc.writable && !desc.configurable) {
        return;
      }
      const origShow = api.showContextMenu.bind(api);
      const translateItems = (items) =>
        Array.isArray(items)
          ? items.map((item) => {
              if (!item || typeof item !== 'object') {
                return item;
              }
              const next = { ...item };
              if (typeof next.label === 'string') {
                const zh = translateText(next.label);
                if (zh !== null) {
                  next.label = zh;
                }
              }
              if (Array.isArray(next.submenu)) {
                next.submenu = translateItems(next.submenu);
              }
              return next;
            })
          : items;
      api.showContextMenu = (items) => origShow(translateItems(items));
    } catch {
      // contextBridge 冻结对象时静默跳过，不影响 DOM 右键菜单翻译
    }
  }

  const pendingNodes = new Set();
  let scheduled = false;

  function flushPending() {
    scheduled = false;
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    for (let i = 0; i < nodes.length; i++) {
      walkAndTranslate(nodes[i]);
    }
  }

  function scheduleNode(node) {
    if (!node) {
      return;
    }
    pendingNodes.add(node);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flushPending);
    }
  }

  function start() {
    installContextMenuTranslator();
    const target = doc.body || doc.documentElement;
    if (!target) {
      return;
    }
    walkAndTranslate(target);
    const Observer = win.MutationObserver;
    if (typeof Observer !== 'function') {
      return;
    }
    const observer = new Observer((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'characterData') {
          scheduleNode(m.target);
        } else if (m.type === 'attributes') {
          processElementAttrs(m.target);
        } else if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            scheduleNode(m.addedNodes[j]);
          }
        }
      }
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // 暴露工具函数便于测试和调试
  win.__myAntigravityZhCn = { translateText, walkAndTranslate };
})(window, document);
