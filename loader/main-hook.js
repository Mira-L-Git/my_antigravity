'use strict';
/**
 * 注入到 Antigravity Electron 主进程 (dist/myAntigravityLoader.js)。
 * 负责读取 ~/.gemini/config/plugins/my_antigravity/desktop-mods/ 下的子插件，
 * 合并 ~/.gemini/config/plugins/my_antigravity/mods-state.json 中的用户开关状态，
 * 并尊重 ~/.gemini/config/config.json 中的插件总开关。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHANNEL = 'my-antigravity:get-mods-sync';
const CHANNEL_GET_CATALOG = 'my-antigravity:get-mod-catalog';
const CHANNEL_SET_ENABLED = 'my-antigravity:set-mod-enabled';
const CHANNEL_RELOAD_WINDOW = 'my-antigravity:reload-window';

const VALID_MOD_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

let electronCache = null;
function getElectron() {
  if (!electronCache) {
    electronCache = require('electron');
  }
  return electronCache;
}

function getConfigDir() {
  return path.join(os.homedir(), '.gemini', 'config');
}

function getPluginRootDir(configDir = getConfigDir()) {
  return path.join(configDir, 'plugins', 'my_antigravity');
}

function getModsDir(configDir = getConfigDir()) {
  return path.join(getPluginRootDir(configDir), 'desktop-mods');
}

function getModsStatePath(configDir = getConfigDir()) {
  return path.join(getPluginRootDir(configDir), 'mods-state.json');
}

function isPluginEnabled(configDir = getConfigDir()) {
  const configPath = path.join(configDir, 'config.json');
  try {
    if (!fs.existsSync(configPath)) {
      return true;
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const entry = raw?.plugins?.my_antigravity;
    if (entry && typeof entry.enabled === 'boolean') {
      return entry.enabled;
    }
    return true;
  } catch (err) {
    console.error('[my_antigravity] Failed to read config.json:', err);
    return true;
  }
}

function readModsState(configDir = getConfigDir()) {
  const statePath = getModsStatePath(configDir);
  try {
    if (!fs.existsSync(statePath)) {
      return { version: 1, mods: {} };
    }
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const mods = {};
    if (raw && typeof raw.mods === 'object' && raw.mods !== null && !Array.isArray(raw.mods)) {
      for (const [k, v] of Object.entries(raw.mods)) {
        if (VALID_MOD_ID_RE.test(k) && typeof v === 'boolean') {
          mods[k] = v;
        }
      }
    }
    return { version: 1, mods };
  } catch (err) {
    console.error('[my_antigravity] Failed to read mods-state.json:', err);
    return { version: 1, mods: {} };
  }
}

function writeModsState(state, configDir = getConfigDir()) {
  const statePath = getModsStatePath(configDir);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    version: 1,
    mods: state && typeof state.mods === 'object' && state.mods !== null ? state.mods : {},
  };
  const json = JSON.stringify(payload, null, 2) + '\n';
  const tmpPath = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, json, 'utf8');
  fs.renameSync(tmpPath, statePath);
  return payload;
}

function isInsideDir(targetPath, rootDir) {
  return targetPath.startsWith(rootDir + path.sep) || targetPath === rootDir;
}

function scanAllMods(configDir = getConfigDir(), { includeCode = true } = {}) {
  const modsDir = getModsDir(configDir);
  if (!fs.existsSync(modsDir)) {
    return [];
  }

  const state = readModsState(configDir);
  const entries = fs
    .readdirSync(modsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const mods = [];
  for (const dir of entries) {
    const modRoot = path.join(modsDir, dir.name);
    const metaPath = path.join(modRoot, 'mod.json');
    let meta = { id: dir.name, enabled: true, entry: 'index.js' };
    if (fs.existsSync(metaPath)) {
      try {
        meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
      } catch (err) {
        console.error(`[my_antigravity] Invalid mod.json in ${dir.name}:`, err);
        continue;
      }
    }

    const id = String(meta.id || dir.name);
    if (!VALID_MOD_ID_RE.test(id)) {
      console.error(`[my_antigravity] Invalid mod id "${id}" in ${dir.name}`);
      continue;
    }

    const entryFile = path.resolve(modRoot, meta.entry || 'index.js');
    // 防止 mod.json 中的路径越界到插件目录之外
    if (!isInsideDir(entryFile, modRoot)) {
      continue;
    }
    const hasEntry = fs.existsSync(entryFile);

    let hasCss = false;
    let cssFile = '';
    if (meta.css) {
      cssFile = path.resolve(modRoot, meta.css);
      if (isInsideDir(cssFile, modRoot) && fs.existsSync(cssFile)) {
        hasCss = true;
      }
    }

    if (!hasEntry && !hasCss) {
      continue;
    }

    const defaultEnabled = meta.enabled !== false;
    const isProtected = meta.protected === true;
    const hasOverride =
      Object.prototype.hasOwnProperty.call(state.mods, id) && typeof state.mods[id] === 'boolean';
    const effectiveEnabled = isProtected ? true : hasOverride ? state.mods[id] : defaultEnabled;

    const item = {
      id,
      dirName: dir.name,
      name: String(meta.name || id),
      version: String(meta.version || '0.0.0'),
      summary:
        typeof meta.summary === 'string'
          ? meta.summary.trim()
          : meta.summary && typeof meta.summary === 'object'
            ? meta.summary
            : '',
      summaryEn: typeof meta.summaryEn === 'string' ? meta.summaryEn.trim() : '',
      description: String(meta.description || ''),
      enabled: effectiveEnabled,
      defaultEnabled,
      protected: isProtected,
    };

    if (includeCode) {
      item.js = hasEntry ? fs.readFileSync(entryFile, 'utf8') : '';
      item.css = hasCss ? fs.readFileSync(cssFile, 'utf8') : '';
    }

    mods.push(item);
  }
  return mods;
}

function readMods(configDir = getConfigDir()) {
  if (!isPluginEnabled(configDir)) {
    return { enabled: false, mods: [] };
  }
  const all = scanAllMods(configDir, { includeCode: true });
  const mods = all
    .filter((m) => m.enabled && (m.js || m.css))
    .map((m) => ({
      id: m.id,
      name: m.name,
      js: m.js,
      css: m.css,
    }));
  return { enabled: true, mods };
}

function getModCatalog(configDir = getConfigDir()) {
  const pluginEnabled = isPluginEnabled(configDir);
  const mods = scanAllMods(configDir, { includeCode: false });
  return { ok: true, pluginEnabled, mods };
}

function setModEnabled(id, enabled, configDir = getConfigDir()) {
  if (typeof id !== 'string' || !VALID_MOD_ID_RE.test(id)) {
    return { ok: false, error: '无效的插件 ID' };
  }
  if (typeof enabled !== 'boolean') {
    return { ok: false, error: 'enabled 必须为布尔值' };
  }
  const mods = scanAllMods(configDir, { includeCode: false });
  const target = mods.find((m) => m.id === id);
  if (!target) {
    return { ok: false, error: `未找到插件: ${id}` };
  }
  if (target.protected && !enabled) {
    return { ok: false, error: '该核心管理插件受保护，不可关闭' };
  }

  const state = readModsState(configDir);
  state.mods[id] = enabled;
  writeModsState(state, configDir);

  const updated = scanAllMods(configDir, { includeCode: false });
  return { ok: true, id, enabled, mods: updated };
}

function registerMyAntigravityLoader() {
  const { ipcMain, BrowserWindow } = getElectron();
  if (!ipcMain) {
    return;
  }

  const bootEnabledByWebContents = new Map();
  const trackedSenders = new Set();

  if (ipcMain.listenerCount(CHANNEL) === 0) {
    ipcMain.on(CHANNEL, (event) => {
      try {
        const result = readMods();
        const wcId = event?.sender?.id;
        if (typeof wcId === 'number') {
          bootEnabledByWebContents.set(
            wcId,
            result.enabled ? result.mods.map((m) => m.id) : [],
          );
          if (!trackedSenders.has(wcId) && typeof event.sender.once === 'function') {
            trackedSenders.add(wcId);
            event.sender.once('destroyed', () => {
              bootEnabledByWebContents.delete(wcId);
              trackedSenders.delete(wcId);
            });
          }
        }
        event.returnValue = result;
      } catch (err) {
        console.error('[my_antigravity] Failed to load mods:', err);
        event.returnValue = { enabled: false, mods: [] };
      }
    });
  }

  if (typeof ipcMain.handle === 'function') {
    try {
      ipcMain.removeHandler?.(CHANNEL_GET_CATALOG);
      ipcMain.handle(CHANNEL_GET_CATALOG, (event) => {
        try {
          const catalog = getModCatalog();
          const wcId = event?.sender?.id;
          const bootEnabledIds =
            typeof wcId === 'number' && bootEnabledByWebContents.has(wcId)
              ? [...bootEnabledByWebContents.get(wcId)]
              : catalog.mods.filter((m) => m.enabled).map((m) => m.id);
          return { ...catalog, bootEnabledIds };
        } catch (err) {
          console.error('[my_antigravity] Failed to get mod catalog:', err);
          return { ok: false, error: err?.message || String(err), mods: [], bootEnabledIds: [] };
        }
      });

      ipcMain.removeHandler?.(CHANNEL_SET_ENABLED);
      ipcMain.handle(CHANNEL_SET_ENABLED, (_event, payload) => {
        try {
          const id = payload?.id;
          const enabled = payload?.enabled;
          return setModEnabled(id, enabled);
        } catch (err) {
          console.error('[my_antigravity] Failed to set mod state:', err);
          return { ok: false, error: err?.message || String(err) };
        }
      });

      ipcMain.removeHandler?.(CHANNEL_RELOAD_WINDOW);
      ipcMain.handle(CHANNEL_RELOAD_WINDOW, (event) => {
        try {
          const win = BrowserWindow?.fromWebContents?.(event.sender);
          if (win && typeof win.isDestroyed === 'function' && !win.isDestroyed()) {
            win.reload();
            return { ok: true };
          }
          if (event?.sender && typeof event.sender.reload === 'function') {
            event.sender.reload();
            return { ok: true };
          }
          return { ok: false, error: '未找到可重载的窗口' };
        } catch (err) {
          console.error('[my_antigravity] Failed to reload window:', err);
          return { ok: false, error: err?.message || String(err) };
        }
      });
    } catch (err) {
      console.error('[my_antigravity] Failed to register manager IPC handlers:', err);
    }
  }
}

module.exports = {
  registerMyAntigravityLoader,
  readMods,
  scanAllMods,
  getModCatalog,
  setModEnabled,
  readModsState,
  writeModsState,
  getModsStatePath,
  isPluginEnabled,
};
