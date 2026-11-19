/**
 * session-status 运行时入口：
 * 1) 同步挂载 WebSocket / fetch 旁路监听（避免错过首包）；
 * 2) DOM 就绪后挂载输入框状态栏与 MutationObserver。
 */
import {
  applyAgentStateUpdate,
  applyGeneratorMetadataList,
  applyStepsList,
  applyTrajectoryResponse,
  createConversationStore,
  hydrateFromClientState,
} from './stats-core.js';
import { installTransportTap } from './transport-tap.js';
import { createSessionStatusController } from './ui.js';

export function installSessionStatusPlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravitySessionStatusInstalled) {
    return null;
  }
  win.__myAntigravitySessionStatusInstalled = true;

  const store = createConversationStore();
  let controller = null;
  let scheduled = false;

  function scheduleScan() {
    if (!controller || scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller?.scanComposers();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  const stopTap = installTransportTap(win, {
    onAgentStateUpdate(update) {
      const state = applyAgentStateUpdate(store, update);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
        void stopTap.backfillConversation?.(state.conversationId, state);
      }
    },
    onTrajectory(cid, response) {
      const state = applyTrajectoryResponse(store, cid, response);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
    onGeneratorMetadata(cid, list, offset, reachedEnd) {
      const state = applyGeneratorMetadataList(store, cid, list, offset, reachedEnd);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
    onSteps(cid, list, offset, markHydrated) {
      const state = applyStepsList(store, cid, list, offset, markHydrated);
      if (state && controller) {
        controller.refreshConversation(state.conversationId);
      }
    },
  });

  function isOwnUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(
      node.closest?.('[data-ag-ss-bar], [data-ag-ss-trigger], [data-ag-ss-popover], [data-ag-ss-tooltip]'),
    );
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createSessionStatusController(
      win,
      doc,
      store,
      (raw) => {
        hydrateFromClientState(store, raw);
      },
      (cid, state) => {
        void stopTap.backfillConversation?.(cid, state).then((changed) => {
          if (changed) controller?.refreshConversation(cid);
        });
      },
    );
    controller.scanComposers();
    // 兼容加载顺序晚于本插件的 zh-cn：在同批次脚本执行完毕后补刷一次语言与状态
    if (typeof win.setTimeout === 'function') {
      win.setTimeout(() => controller?.scanComposers(), 120);
    }

    if (typeof win.MutationObserver === 'function') {
      const observer = new win.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') {
            scheduleScan();
            return;
          }
          if (!isOwnUiNode(m.target)) {
            scheduleScan();
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
    store,
    getController: () => controller,
    dispose() {
      stopTap();
      controller?.destroy();
    },
  };
}
