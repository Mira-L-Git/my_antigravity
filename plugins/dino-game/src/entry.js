/**
 * dino-game 运行时入口：
 * 在右侧辅助面板挂载谷歌小恐龙入口与透明背景覆盖层视图。
 */
import { createDinoGameController } from './ui.js';

export function installDinoGamePlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityDinoGameInstalled) {
    return null;
  }
  win.__myAntigravityDinoGameInstalled = true;

  const controller = createDinoGameController(win, doc);
  let observer = null;
  let scheduled = false;

  function scheduleSyncMount() {
    if (scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller.syncMount();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  function start() {
    controller.syncMount();
    if (typeof win.MutationObserver === 'function' && doc.body) {
      observer = new win.MutationObserver(scheduleSyncMount);
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return {
    controller,
    destroy() {
      observer?.disconnect();
      controller.destroy();
    },
  };
}
