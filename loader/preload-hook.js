/* MY_ANTIGRAVITY_LOADER_START */
function installMyAntigravityDesktopMods() {
  const g = globalThis;
  const h = g.location?.hostname;
  const okHost =
    !g.location ||
    (/^https?:$/.test(g.location.protocol ?? '') &&
      (h === '127.0.0.1' || h === 'localhost'));
  if (!okHost || (g.top && g.self && g.top !== g.self)) {
    return;
  }
  try {
    const payload = electron_1.ipcRenderer.sendSync?.('my-antigravity:get-mods-sync');
    if (!payload || !payload.enabled || !Array.isArray(payload.mods)) {
      return;
    }

    const managerApi = {
      bootEnabledIds: payload.mods.map((m) => String(m.id)),
      getCatalog: () => electron_1.ipcRenderer.invoke('my-antigravity:get-mod-catalog'),
      setModEnabled: (id, enabled) =>
        electron_1.ipcRenderer.invoke('my-antigravity:set-mod-enabled', { id, enabled }),
      reloadWindow: () => electron_1.ipcRenderer.invoke('my-antigravity:reload-window'),
    };
    const attentionApi = {
      getBaseIcon: () => electron_1.ipcRenderer.invoke('my-antigravity:get-attention-base-icon'),
      setAttentionState: (state) =>
        electron_1.ipcRenderer.invoke('my-antigravity:set-attention-state', state),
    };
    try {
      if (electron_1.contextBridge && typeof electron_1.contextBridge.exposeInMainWorld === 'function') {
        electron_1.contextBridge.exposeInMainWorld('__myAntigravityManager', managerApi);
        electron_1.contextBridge.exposeInMainWorld('__myAntigravityAttention', attentionApi);
      } else {
        g.__myAntigravityManager = managerApi;
        g.__myAntigravityAttention = attentionApi;
      }
    } catch {
      g.__myAntigravityManager = managerApi;
      g.__myAntigravityAttention = attentionApi;
    }

    for (const mod of payload.mods) {
      if (mod.js) {
        const wrapped = `(() => {\n  try {\n${mod.js}\n  } catch (err) {\n    console.error('[my_antigravity] mod error (${mod.id}):', err);\n  }\n})();`;
        void Promise.resolve(electron_1.webFrame.executeJavaScript?.(wrapped)).catch(() => {});
      }
      if (mod.css) {
        const idJson = JSON.stringify(String(mod.id));
        const cssJson = JSON.stringify(String(mod.css));
        const injectCss = `(() => {
          const apply = () => {
            const parent = document.head || document.documentElement;
            if (!parent) return;
            const attr = 'data-my-antigravity-mod';
            let el = document.querySelector('style[' + attr + '=' + ${idJson} + ']');
            if (!el) {
              el = document.createElement('style');
              el.setAttribute(attr, ${idJson});
              parent.appendChild(el);
            }
            el.textContent = ${cssJson};
          };
          if (document.head || document.documentElement) apply();
          window.addEventListener('DOMContentLoaded', apply, { once: true });
        })();`;
        void Promise.resolve(electron_1.webFrame.executeJavaScript?.(injectCss)).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[my_antigravity] preload loader failed:', err);
  }
}
installMyAntigravityDesktopMods();
/* MY_ANTIGRAVITY_LOADER_END */
