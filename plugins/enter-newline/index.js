/**
 * enter-newline 插件：实现 Enter 换行，Shift+Enter 发送。
 *
 * 原理说明：
 * Antigravity 2.0 桌面版聊天输入框基于 Lexical 富文本编辑器：
 * - 普通 Enter（shiftKey=false）会触发提交；
 * - Shift+Enter（shiftKey=true）会透传给 Lexical RichText 插件执行 INSERT_LINE_BREAK_COMMAND 换行。
 *
 * 本插件在 window 捕获阶段拦截聊天编辑器内的 Enter 事件，在排除输入法组合与补全菜单后，
 * 通过在原生 KeyboardEvent 实例上覆写 shiftKey / getModifierState 的返回值，
 * 将纯 Enter 与 Shift+Enter 精准互换，避免合成假事件引发的双换行或 isTrusted 校验问题。
 */
(function registerEnterNewlineMod(win = window, doc = document) {
  if (win.__myAntigravityEnterNewlineInstalled) {
    return;
  }
  win.__myAntigravityEnterNewlineInstalled = true;

  function isChatLexicalEditor(target) {
    const el = target instanceof win.Element ? target : doc.activeElement;
    if (!(el instanceof win.Element)) {
      return false;
    }
    return Boolean(el.closest('[contenteditable="true"][data-lexical-editor="true"]'));
  }

  function isTypeaheadMenuOpen() {
    const menus = doc.querySelectorAll('[role="listbox"][aria-label="Typeahead menu"], [role="listbox"]');
    for (const menu of menus) {
      if (!(menu instanceof win.HTMLElement)) {
        continue;
      }
      const rect = menu.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && menu.querySelector('[role="option"]')) {
        return true;
      }
    }
    return false;
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }
    // 保护中文/日文等输入法（IME）选词与上屏回车
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // 仅处理纯 Enter 与纯 Shift+Enter，保留 Ctrl/Cmd/Alt+Enter 等组合快捷键
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (!isChatLexicalEditor(event.target)) {
      return;
    }
    // @ 提及或 / 斜杠命令补全菜单打开时，保留 Enter 选中菜单项的原生行为
    if (isTypeaheadMenuOpen()) {
      return;
    }
    // 防止按住 Shift+Enter 触发系统自动连发导致重复发送
    if (event.shiftKey && event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const swappedShift = !event.shiftKey;
    try {
      Object.defineProperty(event, 'shiftKey', {
        configurable: true,
        enumerable: true,
        get: () => swappedShift,
      });
      const origGetModifierState =
        typeof event.getModifierState === 'function' ? event.getModifierState.bind(event) : null;
      if (origGetModifierState) {
        Object.defineProperty(event, 'getModifierState', {
          configurable: true,
          value: (key) => (key === 'Shift' ? swappedShift : origGetModifierState(key)),
        });
      }
    } catch (err) {
      console.error('[my_antigravity:enter-newline] Failed to swap shiftKey:', err);
    }
  }

  win.addEventListener('keydown', handleKeyDown, true);
})(window, document);
