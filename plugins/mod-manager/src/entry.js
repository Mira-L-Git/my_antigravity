/**
 * mod-manager 运行时入口：
 * 等待 DOM 就绪后挂载左上角图标拦截与插件管理浮层控制器，并监听侧边栏重渲染保持锚点同步。
 */
import { createModManagerController } from './ui.js';

export function installModManagerPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityModManagerInstalled) {
    return null;
  }
  win.__myAntigravityModManagerInstalled = true;

  let controller = null;
  let observer = null;
  let scheduled = false;

  function scheduleSyncAnchor() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.syncAnchor();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(node.closest?.('[data-ag-mm-root]'));
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createModManagerController(win, doc);

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (!isOwnUiNode(m.target)) {
            scheduleSyncAnchor();
            return;
          }
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initDom, { once: true });
  } else {
    initDom();
  }

  return {
    getController: () => controller,
    dispose() {
      observer?.disconnect();
      controller?.dispose();
    },
  };
}
