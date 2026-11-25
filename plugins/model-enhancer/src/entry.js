/**
 * model-enhancer 运行时入口：
 * 在 DOM 就绪后挂载模型面板监听与双向视图控制器。
 */
import { createModelEnhancerController } from './slider-ui.js';

export function installModelEnhancerPlugin(win = window, doc = document, iconsMap = __MODEL_ENHANCER_ICONS__) {
  if (!win || !doc || win.__myAntigravityModelEnhancerInstalled) {
    return null;
  }
  win.__myAntigravityModelEnhancerInstalled = true;

  let controller = null;
  let observer = null;

  function nodeTouchesModelPanel(node) {
    if (!node || node.nodeType !== 1) return false;
    const testId = node.getAttribute?.('data-testid');
    if (testId === 'model-selector-panel' || testId === 'orchestrator-picker-row') return true;
    if (node.closest?.('[data-testid="model-selector-panel"], [data-testid="orchestrator-picker-row"]')) {
      return true;
    }
    return Boolean(
      node.querySelector?.('[data-testid="model-selector-panel"], [data-testid="orchestrator-picker-row"]'),
    );
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createModelEnhancerController(win, doc, iconsMap);
    controller.scanPanels();

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        let shouldScan = false;
        for (const m of mutations) {
          if (m.type === 'attributes') {
            shouldScan = true;
            break;
          }
          if (controller.isOwnUiNode(m.target)) continue;
          if (nodeTouchesModelPanel(m.target)) {
            shouldScan = true;
            break;
          }
          for (const list of [m.addedNodes, m.removedNodes]) {
            if (!list) continue;
            for (const n of list) {
              if (nodeTouchesModelPanel(n)) {
                shouldScan = true;
                break;
              }
            }
            if (shouldScan) break;
          }
          if (shouldScan) break;
        }
        // MutationObserver 在渲染前微任务中同步执行，避免打开瞬间闪出旧列表
        if (shouldScan) {
          controller.scanPanels();
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
    destroy() {
      observer?.disconnect();
      observer = null;
      controller?.destroy();
      controller = null;
      delete win.__myAntigravityModelEnhancerInstalled;
    },
  };
}
