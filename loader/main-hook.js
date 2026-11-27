'use strict';
/**
 * 注入到 Antigravity Electron 主进程 (dist/myAntigravityLoader.js)。
 * 负责读取 ~/.gemini/config/plugins/my_antigravity/desktop-mods/ 下的子插件，
 * 合并 ~/.gemini/config/plugins/my_antigravity/mods-state.json 中的用户开关状态，
 * 并尊重 ~/.gemini/config/config.json 中的插件总开关。
 */
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const CHANNEL = 'my-antigravity:get-mods-sync';
const CHANNEL_GET_CATALOG = 'my-antigravity:get-mod-catalog';
const CHANNEL_SET_ENABLED = 'my-antigravity:set-mod-enabled';
const CHANNEL_RELOAD_WINDOW = 'my-antigravity:reload-window';
const CHANNEL_CHECK_UPDATE = 'my-antigravity:check-update';
const CHANNEL_OPEN_EXTERNAL = 'my-antigravity:open-external';
const CHANNEL_GET_ATTENTION_BASE_ICON = 'my-antigravity:get-attention-base-icon';
const CHANNEL_SET_ATTENTION_STATE = 'my-antigravity:set-attention-state';

const GITHUB_REPO_URL = 'https://github.com/Mira-L-Git/my_antigravity';
const GITHUB_RAW_PACKAGE_URL = 'https://raw.githubusercontent.com/Mira-L-Git/my_antigravity/main/package.json';
const DEFAULT_APP_VERSION = '1.0.0';
const UPDATE_CHECK_TIMEOUT_MS = 8000;

const VALID_MOD_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const MAX_PNG_DATA_URL_LEN = 512 * 1024;
const ATTENTION_LEVEL_RANK = {
  none: 0,
  completed: 1,
  approval: 2,
  error: 3,
};

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

function parseVersionTuple(version) {
  if (typeof version !== 'string') {
    return null;
  }
  const cleaned = version.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function normalizeVersion(version) {
  const tuple = parseVersionTuple(version);
  return tuple ? `${tuple[0]}.${tuple[1]}.${tuple[2]}` : DEFAULT_APP_VERSION;
}

function compareVersions(localVersion, remoteVersion) {
  const a = parseVersionTuple(localVersion);
  const b = parseVersionTuple(remoteVersion);
  if (!a || !b) {
    return null;
  }
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function getAppVersion(configDir = getConfigDir()) {
  const pluginManifestPath = path.join(getPluginRootDir(configDir), 'plugin.json');
  try {
    if (fs.existsSync(pluginManifestPath)) {
      const raw = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
      if (raw && parseVersionTuple(raw.version)) {
        return normalizeVersion(raw.version);
      }
    }
  } catch {
    // 忽略损坏的 plugin.json，继续回退
  }

  const managerMetaPath = path.join(getModsDir(configDir), 'mod-manager', 'mod.json');
  try {
    if (fs.existsSync(managerMetaPath)) {
      const raw = JSON.parse(fs.readFileSync(managerMetaPath, 'utf8'));
      if (raw && parseVersionTuple(raw.version)) {
        return normalizeVersion(raw.version);
      }
    }
  } catch {
    // 忽略损坏的 mod.json，使用内置默认版本号
  }

  return DEFAULT_APP_VERSION;
}

function getModCatalog(configDir = getConfigDir()) {
  const pluginEnabled = isPluginEnabled(configDir);
  const mods = scanAllMods(configDir, { includeCode: false });
  const appVersion = getAppVersion(configDir);
  return { ok: true, pluginEnabled, appVersion, mods };
}

function fetchJsonViaNodeHttps(url, timeoutMs = UPDATE_CHECK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'my-antigravity-updater',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status || 'ERR'}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function fetchJsonWithTimeout(url, timeoutMs = UPDATE_CHECK_TIMEOUT_MS) {
  const { net } = getElectron();
  // 优先使用 Electron net.fetch，自动复用系统/客户端代理设置
  if (net && typeof net.fetch === 'function') {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await net.fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      });
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status || 'ERR'}`);
      }
      return await res.json();
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
  return fetchJsonViaNodeHttps(url, timeoutMs);
}

async function checkForUpdates({ configDir = getConfigDir(), fetchJson } = {}) {
  const currentVersion = getAppVersion(configDir);
  const requestUrl = `${GITHUB_RAW_PACKAGE_URL}?t=${Date.now()}`;
  try {
    const pkg = fetchJson ? await fetchJson(requestUrl) : await fetchJsonWithTimeout(requestUrl);
    const remoteRaw = pkg && typeof pkg.version === 'string' ? pkg.version : '';
    const cmp = compareVersions(currentVersion, remoteRaw);
    if (cmp === null) {
      return {
        ok: false,
        currentVersion,
        error: '无法解析远端版本号',
      };
    }
    const latestVersion = normalizeVersion(remoteRaw);
    return {
      ok: true,
      currentVersion,
      latestVersion,
      hasUpdate: cmp === -1,
      repoUrl: GITHUB_REPO_URL,
    };
  } catch (err) {
    return {
      ok: false,
      currentVersion,
      error: err?.message || String(err),
    };
  }
}

function isAllowedGithubUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      (parsed.pathname === '/Mira-L-Git/my_antigravity' ||
        parsed.pathname.startsWith('/Mira-L-Git/my_antigravity/'))
    );
  } catch {
    return false;
  }
}

async function openExternalUrl(rawUrl = GITHUB_REPO_URL) {
  const target = rawUrl || GITHUB_REPO_URL;
  if (!isAllowedGithubUrl(target)) {
    return { ok: false, error: '不允许打开非项目白名单链接' };
  }
  const { shell } = getElectron();
  if (!shell || typeof shell.openExternal !== 'function') {
    return { ok: false, error: '当前环境不支持打开外部浏览器' };
  }
  try {
    await shell.openExternal(target);
    return { ok: true, url: target };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
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

function viewContainsWebContents(view, targetWc) {
  if (!view || !targetWc) return false;
  if (view.webContents === targetWc) return true;
  const children = view.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (viewContainsWebContents(child, targetWc)) {
        return true;
      }
    }
  }
  return false;
}

function resolveSenderWindow(sender) {
  if (!sender) {
    return null;
  }
  try {
    const utilsMod = require('./utils');
    if (utilsMod && typeof utilsMod.resolveHubWindowFromWebContents === 'function') {
      const resolved = utilsMod.resolveHubWindowFromWebContents(sender);
      if (resolved) {
        return resolved;
      }
    }
  } catch {
    // 非打包环境或测试环境无 ./utils 时降级到通用查找
  }

  const { BaseWindow, BrowserWindow } = getElectron();
  const findDirect = (wc) => {
    if (!wc) return null;
    if (BaseWindow && typeof BaseWindow.fromWebContents === 'function') {
      const bw = BaseWindow.fromWebContents(wc);
      if (bw) return bw;
    }
    if (BaseWindow && typeof BaseWindow.getAllWindows === 'function') {
      for (const bw of BaseWindow.getAllWindows()) {
        if (bw && (!bw.isDestroyed || !bw.isDestroyed()) && viewContainsWebContents(bw.contentView, wc)) {
          return bw;
        }
      }
    }
    if (BrowserWindow && typeof BrowserWindow.fromWebContents === 'function') {
      const win = BrowserWindow.fromWebContents(wc);
      if (win) return win;
    }
    return null;
  };

  let cur = sender;
  for (let depth = 0; cur && depth < 4; depth += 1) {
    const win = findDirect(cur);
    if (win) {
      return win;
    }
    cur = cur.hostWebContents || null;
  }
  return null;
}

function isValidPngDataUrl(value) {
  return (
    typeof value === 'string' &&
    value.length <= MAX_PNG_DATA_URL_LEN &&
    value.startsWith('data:image/png;base64,')
  );
}

function buildMultiDpiNativeImage(nativeImage, reps, fallbackDataUrl) {
  if (!nativeImage) {
    return null;
  }
  if (
    Array.isArray(reps) &&
    reps.length > 0 &&
    typeof nativeImage.createEmpty === 'function'
  ) {
    const img = nativeImage.createEmpty();
    if (img && typeof img.addRepresentation === 'function') {
      let added = 0;
      for (const rep of reps) {
        if (!rep || !isValidPngDataUrl(rep.dataUrl)) continue;
        const scaleFactor = Number(rep.scaleFactor);
        const width = Math.floor(Number(rep.width));
        const height = Math.floor(Number(rep.height));
        if (
          !Number.isFinite(scaleFactor) ||
          scaleFactor <= 0 ||
          !Number.isFinite(width) ||
          width <= 0 ||
          width > 512 ||
          !Number.isFinite(height) ||
          height <= 0 ||
          height > 512
        ) {
          continue;
        }
        img.addRepresentation({
          scaleFactor,
          width,
          height,
          dataURL: rep.dataUrl,
        });
        added += 1;
      }
      if (added > 0 && (!img.isEmpty || !img.isEmpty())) {
        return { img, repCount: added };
      }
    }
  }

  if (isValidPngDataUrl(fallbackDataUrl) && typeof nativeImage.createFromDataURL === 'function') {
    const img = nativeImage.createFromDataURL(fallbackDataUrl);
    if (img && (!img.isEmpty || !img.isEmpty())) {
      return { img, repCount: 1 };
    }
  }
  return null;
}

function createBaseIconStore() {
  let loaded = false;
  let baseDataUrl = null;
  let baseTrayImage = null;

  function ensureLoaded() {
    if (loaded) {
      return;
    }
    loaded = true;
    const { nativeImage } = getElectron();
    const candidates = [
      path.join(__dirname, '..', 'icon.png'),
      path.join(__dirname, '..', 'assets', 'icon.png'),
    ];
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const buf = fs.readFileSync(candidate);
        if (!buf || buf.length === 0) continue;
        baseDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        break;
      } catch (err) {
        console.error('[my_antigravity] Failed to load base icon.png:', err);
      }
    }

    const trayFile = process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png';
    const trayPath = path.join(__dirname, '..', trayFile);
    try {
      if (fs.existsSync(trayPath) && nativeImage && typeof nativeImage.createFromPath === 'function') {
        const trayImg = nativeImage.createFromPath(trayPath);
        if (trayImg && (!trayImg.isEmpty || !trayImg.isEmpty())) {
          if (process.platform === 'darwin' && typeof trayImg.setTemplateImage === 'function') {
            trayImg.setTemplateImage(true);
          }
          baseTrayImage = trayImg;
        }
      }
    } catch (err) {
      console.error('[my_antigravity] Failed to load base tray icon:', err);
    }
    if (!baseTrayImage && baseDataUrl && typeof nativeImage?.createFromDataURL === 'function') {
      baseTrayImage = nativeImage.createFromDataURL(baseDataUrl);
    }
  }

  return {
    getBaseDataUrl() {
      ensureLoaded();
      return baseDataUrl;
    },
    getBaseTrayImage() {
      ensureLoaded();
      return baseTrayImage;
    },
  };
}

function installTrayCapture(onTrayCreated) {
  const { Tray } = getElectron();
  if (!Tray || !Tray.prototype || typeof Tray.prototype.setToolTip !== 'function') {
    return;
  }
  let trayModule = null;
  try {
    trayModule = require('./tray');
  } catch {
    return;
  }
  if (!trayModule || typeof trayModule.createTray !== 'function') {
    return;
  }
  if (trayModule.createTray.__myAntigravityWrapped) {
    return;
  }
  const origCreateTray = trayModule.createTray;
  const wrappedCreateTray = function (...args) {
    const origSetToolTip = Tray.prototype.setToolTip;
    let captured = null;
    let tooltip = '';
    let hooked = false;
    try {
      Tray.prototype.setToolTip = function (...tipArgs) {
        captured = this;
        tooltip = tipArgs[0];
        return origSetToolTip.apply(this, tipArgs);
      };
      hooked = true;
    } catch {
      hooked = false;
    }
    let result;
    try {
      result = origCreateTray.apply(this, args);
    } finally {
      if (hooked) {
        try {
          Tray.prototype.setToolTip = origSetToolTip;
        } catch {
          // ignore restore error
        }
      }
    }
    if (captured) onTrayCreated(captured, tooltip);
    return result;
  };
  wrappedCreateTray.__myAntigravityWrapped = true;
  trayModule.createTray = wrappedCreateTray;
}

function summarizeAttention(entries) {
  const ids = new Set();
  let anonymousCount = 0;
  let level = 'none';
  let trayPngDataUrl = null;
  for (const entry of entries) {
    for (const id of entry.conversationIds) ids.add(id);
    anonymousCount += entry.count - entry.conversationIds.length;
    if (ATTENTION_LEVEL_RANK[entry.level] > ATTENTION_LEVEL_RANK[level]) {
      level = entry.level;
      trayPngDataUrl = entry.trayPngDataUrl;
    } else if (entry.level === level && !trayPngDataUrl) {
      trayPngDataUrl = entry.trayPngDataUrl;
    }
  }
  return { count: ids.size + anonymousCount, level, trayPngDataUrl };
}

function registerMyAntigravityLoader() {
  const { app, ipcMain, nativeImage } = getElectron();
  if (!ipcMain) {
    return;
  }

  const bootEnabledByWebContents = new Map();
  const trackedSenders = new Set();
  const attentionByWebContents = new Map();
  const appliedByWindow = new WeakMap();
  const iconStore = createBaseIconStore();
  let capturedTray = null;
  let trayTooltip = '';

  function pendingLabel(count) {
    return app?.getLocale?.()?.startsWith('zh')
      ? `${count} 个待查看会话`
      : `${count} pending ${count === 1 ? 'conversation' : 'conversations'}`;
  }

  function applyWindowAttention(win) {
    if (!win || win.isDestroyed?.() || typeof win.setOverlayIcon !== 'function') return false;
    const entries = [...attentionByWebContents.values()].filter((entry) => entry.win === win);
    const own = summarizeAttention(entries);
    const previous = appliedByWindow.get(win);
    const label = own.count > 0 ? pendingLabel(own.count) : '';
    const primary = entries.filter((entry) => entry.level === own.level).sort((a, b) => b.count - a.count)[0];
    const overlayCount = primary?.count || 0;

    if (primary && (own.count !== previous?.count || own.level !== previous?.level || overlayCount !== previous?.overlayCount)) {
      const built = buildMultiDpiNativeImage(nativeImage, primary.windowReps, primary.windowPngDataUrl);
      if (!built) return false;
      win.setOverlayIcon(built.img, label);
    } else if (!primary && previous?.count > 0) {
      win.setOverlayIcon(null, '');
    }
    if (previous?.count !== own.count && (own.count > 0 || previous?.count > 0)) {
      win.setThumbnailToolTip?.(label);
    }
    appliedByWindow.set(win, { level: own.level, count: own.count, overlayCount });
    return true;
  }

  function applyAggregatedTrayIcon({ count, trayPngDataUrl }) {
    if (!capturedTray || typeof capturedTray.setImage !== 'function') {
      return true;
    }
    if (typeof capturedTray.isDestroyed === 'function' && capturedTray.isDestroyed()) {
      capturedTray = null;
      return true;
    }
    capturedTray.setToolTip?.(count > 0 ? `${trayTooltip} · ${pendingLabel(count)}` : trayTooltip);
    if (!trayPngDataUrl) {
      const baseTray = iconStore.getBaseTrayImage();
      if (baseTray) {
        capturedTray.setImage(baseTray);
      }
      return true;
    }
    if (!nativeImage || typeof nativeImage.createFromDataURL !== 'function') {
      return false;
    }
    const img = nativeImage.createFromDataURL(trayPngDataUrl);
    if (img && (!img.isEmpty || !img.isEmpty())) {
      if (process.platform === 'darwin' && typeof img.setTemplateImage === 'function') {
        img.setTemplateImage(false);
      }
      capturedTray.setImage(img);
      return true;
    }
    return false;
  }

  function updateAttentionSurfaces(win) {
    const aggregate = summarizeAttention(attentionByWebContents.values());
    let updatedTray = false;
    let updatedWindow = process.platform !== 'win32';
    if (process.platform === 'win32') {
      try {
        updatedWindow = applyWindowAttention(win);
      } catch (err) {
        console.error('[my_antigravity] Failed to update taskbar attention:', err);
      }
    }
    try {
      updatedTray = applyAggregatedTrayIcon(aggregate);
    } catch (err) {
      console.error('[my_antigravity] Failed to update tray attention:', err);
    }
    return { updatedWindow, updatedTray, windowMethod: process.platform === 'win32' && updatedWindow ? 'setOverlayIcon' : null };
  }

  installTrayCapture((tray, tooltip) => {
    capturedTray = tray;
    trayTooltip = tooltip || 'Antigravity';
    try {
      applyAggregatedTrayIcon(summarizeAttention(attentionByWebContents.values()));
    } catch (err) {
      console.error('[my_antigravity] Failed to initialize tray attention:', err);
    }
  });

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
              const attention = attentionByWebContents.get(wcId);
              if (!attention) return;
              attentionByWebContents.delete(wcId);
              updateAttentionSurfaces(attention.win);
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
          const win = resolveSenderWindow(event?.sender);
          if (
            win &&
            typeof win.isDestroyed === 'function' &&
            !win.isDestroyed() &&
            typeof win.reload === 'function'
          ) {
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

      ipcMain.removeHandler?.(CHANNEL_CHECK_UPDATE);
      ipcMain.handle(CHANNEL_CHECK_UPDATE, async () => {
        try {
          return await checkForUpdates();
        } catch (err) {
          console.error('[my_antigravity] Failed to check updates:', err);
          return { ok: false, currentVersion: getAppVersion(), error: err?.message || String(err) };
        }
      });

      ipcMain.removeHandler?.(CHANNEL_OPEN_EXTERNAL);
      ipcMain.handle(CHANNEL_OPEN_EXTERNAL, async (_event, payload) => {
        try {
          return await openExternalUrl(payload?.url || GITHUB_REPO_URL);
        } catch (err) {
          console.error('[my_antigravity] Failed to open external url:', err);
          return { ok: false, error: err?.message || String(err) };
        }
      });

      ipcMain.removeHandler?.(CHANNEL_GET_ATTENTION_BASE_ICON);
      ipcMain.handle(CHANNEL_GET_ATTENTION_BASE_ICON, () => {
        try {
          return {
            ok: true,
            dataUrl: iconStore.getBaseDataUrl(),
            platform: process.platform,
          };
        } catch (err) {
          console.error('[my_antigravity] Failed to get base icon:', err);
          return { ok: false, error: err?.message || String(err), dataUrl: null, platform: process.platform };
        }
      });

      ipcMain.removeHandler?.(CHANNEL_SET_ATTENTION_STATE);
      ipcMain.handle(CHANNEL_SET_ATTENTION_STATE, (event, payload) => {
        try {
          const rawCount = Math.floor(Number(payload?.count));
          const count = Number.isSafeInteger(rawCount) ? Math.max(0, rawCount) : 0;
          const level =
            typeof payload?.level === 'string' && Object.prototype.hasOwnProperty.call(ATTENTION_LEVEL_RANK, payload.level)
              ? payload.level
              : 'none';
          const trayPngDataUrl = isValidPngDataUrl(payload?.trayPngDataUrl)
            ? payload.trayPngDataUrl
            : null;
          const windowPngDataUrl = isValidPngDataUrl(payload?.windowPngDataUrl)
            ? payload.windowPngDataUrl
            : null;
          const windowReps = Array.isArray(payload?.windowReps)
            ? payload.windowReps.slice(0, 5)
              .filter((rep) => isValidPngDataUrl(rep?.dataUrl))
              .map(({ scaleFactor, width, height, dataUrl }) => ({
                scaleFactor: Number(scaleFactor), width: Number(width), height: Number(height), dataUrl,
              }))
            : null;
          const ids = Array.isArray(payload?.conversationIds) ? payload.conversationIds : [];
          const conversationIds = [...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))].slice(0, count);
          const sender = event?.sender;
          const wcId = typeof sender?.id === 'number' ? sender.id : 'default';
          const previous = attentionByWebContents.get(wcId);
          const win = resolveSenderWindow(sender) || previous?.win || null;
          if (count > 0 && level !== 'none') {
            attentionByWebContents.set(wcId, {
              win, count, conversationIds, level, trayPngDataUrl, windowReps, windowPngDataUrl,
            });
          } else {
            attentionByWebContents.delete(wcId);
          }
          if (previous?.win && previous.win !== win) {
            updateAttentionSurfaces(previous.win);
          }
          return { ok: true, ...updateAttentionSurfaces(win) };
        } catch (err) {
          console.error('[my_antigravity] Failed to set attention state:', err);
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
  getAppVersion,
  parseVersionTuple,
  compareVersions,
  checkForUpdates,
  openExternalUrl,
  setModEnabled,
  readModsState,
  writeModsState,
  getModsStatePath,
  isPluginEnabled,
};
