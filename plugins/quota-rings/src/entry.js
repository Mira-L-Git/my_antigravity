/**
 * quota-rings 运行时入口：
 * 1) 同步挂载 fetch / WebSocket 旁路监听（避免错过首包与鉴权头）；
 * 2) DOM 就绪后在左下角「设置」右侧挂载双额度环，并监听侧栏重渲染与语言切换。
 */
import {
  buildQuotaSnapshot,
  extractModelQuotaEntries,
  extractSummaryQuotaEntries,
} from './quota-core.js';
import { installQuotaTap } from './quota-tap.js';
import { createQuotaRingsController } from './ui.js';

export function installQuotaRingsPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityQuotaRingsInstalled) {
    return null;
  }
  win.__myAntigravityQuotaRingsInstalled = true;

  let modelEntries = [];
  let summaryEntries = [];
  let controller = null;
  let observer = null;
  let scheduled = false;

  function recomputeAndRender() {
    const snap = buildQuotaSnapshot({ modelEntries, summaryEntries });
    controller?.setSnapshot(snap);
  }

  function scheduleSyncMount() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.syncMount();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  const tap = installQuotaTap(win, {
    onModelPayload(payload) {
      const next = extractModelQuotaEntries(payload);
      if (next.length > 0) {
        modelEntries = next;
        recomputeAndRender();
      }
    },
    onSummaryPayload(payload) {
      const next = extractSummaryQuotaEntries(payload);
      if (next.length > 0) {
        summaryEntries = next;
        recomputeAndRender();
      }
    },
  });

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(node.closest?.('[data-ag-qr-root], [data-ag-qr-tooltip]'));
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createQuotaRingsController(win, doc, {
      onRefreshRequested(opts) {
        void tap.refresh(opts);
      },
    });
    recomputeAndRender();

    // 首次挂载后尝试温和补齐（若原生请求尚未捕获或先于脚本完成）
    void tap.refresh({ force: false });

    if (typeof win.setTimeout === 'function') {
      win.setTimeout(() => {
        recomputeAndRender();
      }, 150);
    }

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') {
            recomputeAndRender();
            return;
          }
          if (!isOwnUiNode(m.target)) {
            scheduleSyncMount();
            return;
          }
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
    getSnapshot: () => buildQuotaSnapshot({ modelEntries, summaryEntries }),
    getController: () => controller,
    refresh: (opts) => tap.refresh(opts),
    dispose() {
      observer?.disconnect();
      tap.dispose();
      controller?.destroy();
    },
  };
}
