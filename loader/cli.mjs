import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAsarFile, readAsar, writePatchedAsar } from './asar.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const MAIN_MARKER_START = '/* MY_ANTIGRAVITY_MAIN_LOADER_START */';
const MAIN_MARKER_END = '/* MY_ANTIGRAVITY_MAIN_LOADER_END */';
const PRELOAD_MARKER_START = '/* MY_ANTIGRAVITY_LOADER_START */';
const PRELOAD_MARKER_END = '/* MY_ANTIGRAVITY_LOADER_END */';

export function getDefaultAsarPath() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Programs', 'antigravity', 'resources', 'app.asar');
  }
  if (process.platform === 'darwin') {
    return '/Applications/Antigravity.app/Contents/Resources/app.asar';
  }
  return '/usr/lib/antigravity/resources/app.asar';
}

export function getPluginTargetDir(homeDir = os.homedir()) {
  return path.join(homeDir, '.gemini', 'config', 'plugins', 'my_antigravity');
}

function stripMarkedBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    return text;
  }
  const end = text.indexOf(endMarker, start);
  if (end === -1) {
    return text;
  }
  const before = text.slice(0, start).replace(/\s+$/, '');
  const after = text.slice(end + endMarker.length).replace(/^\s+/, '');
  if (!after) {
    return before + '\n';
  }
  return before + '\n' + after;
}

/**
 * 将工作区 plugins/* 同步到 Antigravity 全局插件目录 ~/.gemini/config/plugins/my_antigravity/
 */
export function syncPlugins({ sourceDir = path.join(REPO_ROOT, 'plugins'), targetDir = getPluginTargetDir() } = {}) {
  const modsTargetDir = path.join(targetDir, 'desktop-mods');
  fs.mkdirSync(modsTargetDir, { recursive: true });

  // 生成符合 Antigravity 原生插件规范的 plugin.json（仅使用官方允许的顶层字段）
  const logoSrc = path.join(REPO_ROOT, 'assets', 'logo.svg');
  const hasLogo = fs.existsSync(logoSrc);
  if (hasLogo) {
    const assetsTargetDir = path.join(targetDir, 'assets');
    fs.mkdirSync(assetsTargetDir, { recursive: true });
    fs.copyFileSync(logoSrc, path.join(assetsTargetDir, 'logo.svg'));
  }

  const pluginManifest = {
    name: 'my_antigravity',
    displayName: 'My Antigravity',
    version: '0.1.0',
    description: 'Custom desktop UI and UX enhancements for Antigravity (e.g., Enter for newline, Shift+Enter to send, Simplified Chinese UI).',
    ...(hasLogo ? { logo: 'assets/logo.svg' } : {}),
  };
  fs.writeFileSync(path.join(targetDir, 'plugin.json'), JSON.stringify(pluginManifest, null, 2) + '\n', 'utf8');

  const synced = [];
  if (fs.existsSync(sourceDir)) {
    const pluginDirs = fs
      .readdirSync(sourceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    // 清理目标目录中已删除的旧插件，保证两边一致
    const activeNames = new Set(pluginDirs.map((d) => d.name));
    for (const existing of fs.readdirSync(modsTargetDir, { withFileTypes: true })) {
      if (existing.isDirectory() && !activeNames.has(existing.name)) {
        fs.rmSync(path.join(modsTargetDir, existing.name), { recursive: true, force: true });
      }
    }

    for (const dir of pluginDirs) {
      const src = path.join(sourceDir, dir.name);
      const dst = path.join(modsTargetDir, dir.name);
      fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(src, dst, { recursive: true });
      synced.push(dir.name);
    }
  }

  const readmeLines = [
    '# My Antigravity',
    '',
    '自定义桌面端插件集合，由 `my_antigravity` 仓库同步生成。',
    '',
    '## 已同步模块 (`desktop-mods/`)',
    ...(synced.length ? synced.map((n) => `- \`${n}\``) : ['- (暂无)']),
    '',
  ];
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeLines.join('\n'), 'utf8');

  return { targetDir, synced };
}

/**
 * 幂等地将加载器注入到给定的 app.asar 文件（或临时副本）。
 */
export function patchAsarText(mainJs, preloadJs, preloadHookCode) {
  const cleanMain = stripMarkedBlock(mainJs, MAIN_MARKER_START, MAIN_MARKER_END);
  const mainInjectBlock = [
    MAIN_MARKER_START,
    "require('./myAntigravityLoader').registerMyAntigravityLoader();",
    MAIN_MARKER_END,
  ].join('\n');

  // 插入到 electron_1.app.whenReady() 之前即可保证 IPC 在任意窗口创建前注册完毕
  const anchor = 'electron_1.app\n    .whenReady()';
  const altAnchor = 'electron_1.app.whenReady()';
  let patchedMain;
  if (cleanMain.includes(anchor)) {
    patchedMain = cleanMain.replace(anchor, `${mainInjectBlock}\n${anchor}`);
  } else if (cleanMain.includes(altAnchor)) {
    patchedMain = cleanMain.replace(altAnchor, `${mainInjectBlock}\n${altAnchor}`);
  } else {
    patchedMain = `${cleanMain.trimEnd()}\n${mainInjectBlock}\n`;
  }

  const cleanPreload = stripMarkedBlock(preloadJs, PRELOAD_MARKER_START, PRELOAD_MARKER_END);
  const patchedPreload = `${cleanPreload.trimEnd()}\n${preloadHookCode.trim()}\n`;

  return { patchedMain, patchedPreload };
}

export function installLoader(asarPath = getDefaultAsarPath(), { targetDir } = {}) {
  if (!fs.existsSync(asarPath)) {
    throw new Error(`找不到 app.asar: ${asarPath}`);
  }
  const syncResult = syncPlugins(targetDir ? { targetDir } : {});
  const backupPath = `${asarPath}.my_antigravity.bak`;

  const asar = readAsar(asarPath);
  const mainBuf = getAsarFile(asar, 'dist/main.js');
  const preloadBuf = getAsarFile(asar, 'dist/preload.js');
  if (!mainBuf || !preloadBuf) {
    throw new Error('app.asar 中缺少 dist/main.js 或 dist/preload.js');
  }

  // 若 app.asar 尚未打过补丁（首次安装或官方更新覆盖后），刷新原始备份
  const alreadyInstalled = mainBuf.toString('utf8').includes(MAIN_MARKER_START);
  if (!fs.existsSync(backupPath) || !alreadyInstalled) {
    fs.copyFileSync(asarPath, backupPath);
  }

  const mainHookBuf = fs.readFileSync(path.join(__dirname, 'main-hook.js'));
  const preloadHookCode = fs.readFileSync(path.join(__dirname, 'preload-hook.js'), 'utf8');
  const { patchedMain, patchedPreload } = patchAsarText(
    mainBuf.toString('utf8'),
    preloadBuf.toString('utf8'),
    preloadHookCode,
  );

  const tmpPath = `${asarPath}.my_antigravity.tmp`;
  writePatchedAsar(asarPath, tmpPath, {
    'dist/main.js': Buffer.from(patchedMain, 'utf8'),
    'dist/preload.js': Buffer.from(patchedPreload, 'utf8'),
    'dist/myAntigravityLoader.js': mainHookBuf,
  });

  try {
    fs.renameSync(tmpPath, asarPath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
      const wrapped = new Error(
        `无法覆盖正在被 Antigravity 占用的 app.asar (${err.code})。\n请先完全退出 Antigravity 桌面版（包括系统托盘），再重新运行:\n  npm run install-loader`,
      );
      wrapped.code = err.code;
      throw wrapped;
    }
    throw err;
  }

  return { asarPath, backupPath, ...syncResult };
}

export function uninstallLoader(asarPath = getDefaultAsarPath()) {
  const backupPath = `${asarPath}.my_antigravity.bak`;
  if (fs.existsSync(backupPath)) {
    try {
      fs.copyFileSync(backupPath, asarPath);
      return { asarPath, method: 'restored-from-backup' };
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
        throw new Error(
          `无法恢复 app.asar (${err.code})，请先完全退出 Antigravity 后重试。`,
        );
      }
      throw err;
    }
  }
  const asar = readAsar(asarPath);
  const mainBuf = getAsarFile(asar, 'dist/main.js');
  const preloadBuf = getAsarFile(asar, 'dist/preload.js');
  const cleanMain = stripMarkedBlock(mainBuf.toString('utf8'), MAIN_MARKER_START, MAIN_MARKER_END);
  const cleanPreload = stripMarkedBlock(preloadBuf.toString('utf8'), PRELOAD_MARKER_START, PRELOAD_MARKER_END);
  const tmpPath = `${asarPath}.my_antigravity.tmp`;
  writePatchedAsar(
    asarPath,
    tmpPath,
    {
      'dist/main.js': Buffer.from(cleanMain, 'utf8'),
      'dist/preload.js': Buffer.from(cleanPreload, 'utf8'),
    },
    ['dist/myAntigravityLoader.js'],
  );
  fs.renameSync(tmpPath, asarPath);
  return { asarPath, method: 'stripped-markers' };
}

export function getStatus(asarPath = getDefaultAsarPath()) {
  const backupPath = `${asarPath}.my_antigravity.bak`;
  const targetDir = getPluginTargetDir();
  const modsDir = path.join(targetDir, 'desktop-mods');
  const statePath = path.join(targetDir, 'mods-state.json');
  let stateMods = {};
  const stateExists = fs.existsSync(statePath);
  if (stateExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (parsed && typeof parsed.mods === 'object' && parsed.mods !== null) {
        stateMods = parsed.mods;
      }
    } catch {
      // ignore corrupted state
    }
  }
  let loaderInstalled = false;
  if (fs.existsSync(asarPath)) {
    const asar = readAsar(asarPath);
    const preloadBuf = getAsarFile(asar, 'dist/preload.js');
    const loaderBuf = getAsarFile(asar, 'dist/myAntigravityLoader.js');
    loaderInstalled = Boolean(
      loaderBuf && preloadBuf && preloadBuf.toString('utf8').includes(PRELOAD_MARKER_START),
    );
  }
  const mods = fs.existsSync(modsDir)
    ? fs
        .readdirSync(modsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
          const metaPath = path.join(modsDir, d.name, 'mod.json');
          let meta = { id: d.name, enabled: true };
          if (fs.existsSync(metaPath)) {
            try {
              meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
            } catch {
              // ignore
            }
          }
          const id = String(meta.id || d.name);
          const defaultEnabled = meta.enabled !== false;
          const isProtected = meta.protected === true;
          const hasOverride =
            Object.prototype.hasOwnProperty.call(stateMods, id) &&
            typeof stateMods[id] === 'boolean';
          const effectiveEnabled = isProtected
            ? true
            : hasOverride
              ? stateMods[id]
              : defaultEnabled;
          return {
            ...meta,
            id,
            defaultEnabled,
            enabled: effectiveEnabled,
          };
        })
    : [];
  return {
    asarPath,
    asarExists: fs.existsSync(asarPath),
    backupExists: fs.existsSync(backupPath),
    loaderInstalled,
    targetDir,
    statePath,
    stateExists,
    mods,
  };
}

function parseAsarArg(args) {
  const idx = args.indexOf('--asar');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : getDefaultAsarPath();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const [cmd = 'status', ...rest] = process.argv.slice(2);
  const asarPath = parseAsarArg(rest);
  try {
    if (cmd === 'sync') {
      const res = syncPlugins();
      console.log(`已同步插件到: ${res.targetDir}`);
      console.log(`已同步模块: ${res.synced.join(', ') || '(无)'}`);
    } else if (cmd === 'install') {
      const res = installLoader(asarPath);
      console.log(`已安装通用插件加载器到: ${res.asarPath}`);
      console.log(`原始备份位置: ${res.backupPath}`);
      console.log(`已同步插件模块: ${res.synced.join(', ') || '(无)'}`);
      console.log('请重启 Antigravity 桌面版以生效。');
    } else if (cmd === 'uninstall') {
      const res = uninstallLoader(asarPath);
      console.log(`已卸载加载器 (${res.method}): ${res.asarPath}`);
    } else if (cmd === 'status') {
      console.log(JSON.stringify(getStatus(asarPath), null, 2));
    } else {
      console.error(`未知命令: ${cmd} (支持: sync | install | uninstall | status)`);
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
