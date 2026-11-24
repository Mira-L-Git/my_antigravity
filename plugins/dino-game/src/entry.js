/**
 * dino-game 运行时入口：
 * 在右侧辅助面板挂载谷歌小恐龙入口与无边框覆盖层视图。
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
  let settleTimer = null;

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

  function scheduleWithSettle() {
    scheduleSyncMount();
    if (typeof win.setTimeout === 'function') {
      if (settleTimer) win.clearTimeout?.(settleTimer);
      settleTimer = win.setTimeout(() => {
        settleTimer = null;
        controller.syncMount();
      }, 180);
    }
  }

  function start() {
    controller.syncMount();
    if (typeof win.MutationObserver === 'function' && doc.body) {
      observer = new win.MutationObserver(scheduleSyncMount);
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
      });
    }
    doc.addEventListener?.('focusin', scheduleWithSettle);
    doc.addEventListener?.('transitionend', scheduleSyncMount);
    win.addEventListener?.('resize', scheduleSyncMount);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return {
    controller,
    destroy() {
      if (settleTimer) win.clearTimeout?.(settleTimer);
      observer?.disconnect();
      doc.removeEventListener?.('focusin', scheduleWithSettle);
      doc.removeEventListener?.('transitionend', scheduleSyncMount);
      win.removeEventListener?.('resize', scheduleSyncMount);
      controller.destroy();
    },
  };
}
