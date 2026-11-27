import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { getAsarFile, readAsar, writePatchedAsar } from '../loader/asar.mjs';
import { getDefaultAsarPath, installLoader, syncPlugins, uninstallLoader } from '../loader/cli.mjs';

function loadMainHookWithMockElectron() {
  const filename = path.resolve('loader/main-hook.js');
  const code = fs.readFileSync(filename, 'utf8');
  const cjsRequire = createRequire(filename);
  const mod = { exports: {} };
  const mockElectron = {
    ipcMain: {
      listenerCount: () => 0,
      on() {},
      handle() {},
      removeHandler() {},
    },
    BrowserWindow: { fromWebContents: () => null },
  };
  const customRequire = (id) => (id === 'electron' ? mockElectron : cjsRequire(id));
  vm.runInNewContext(code, {
    require: customRequire,
    module: mod,
    exports: mod.exports,
    __filename: filename,
    __dirname: path.dirname(filename),
    process,
    console,
  });
  return mod.exports;
}

const mainHook = loadMainHookWithMockElectron();

test('writePatchedAsar 与 installLoader/uninstallLoader 对真实 app.asar 副本幂等且校验完整', () => {
  const realAsar = getDefaultAsarPath();
  assert.ok(fs.existsSync(realAsar), `Expected real app.asar at ${realAsar}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agy-asar-test-'));
  try {
    const copyAsar = path.join(tmpDir, 'app.asar');
    const pluginTarget = path.join(tmpDir, 'plugin-target');
    fs.copyFileSync(realAsar, copyAsar);

    // 第一次安装
    installLoader(copyAsar, { targetDir: pluginTarget });
    const patched1 = readAsar(copyAsar);
    const main1 = getAsarFile(patched1, 'dist/main.js').toString('utf8');
    const preload1 = getAsarFile(patched1, 'dist/preload.js').toString('utf8');
    const loader1 = getAsarFile(patched1, 'dist/myAntigravityLoader.js').toString('utf8');

    assert.match(main1, /MY_ANTIGRAVITY_MAIN_LOADER_START/);
    assert.match(preload1, /MY_ANTIGRAVITY_LOADER_START/);
    assert.match(preload1, /__myAntigravityManager/);
    assert.match(preload1, /__myAntigravityAttention/);
    assert.match(preload1, /checkUpdate/);
    assert.match(preload1, /openExternal/);
    assert.match(loader1, /my-antigravity:get-mods-sync/);
    assert.match(loader1, /my-antigravity:set-mod-enabled/);
    assert.match(loader1, /my-antigravity:check-update/);
    assert.match(loader1, /my-antigravity:open-external/);
    assert.match(loader1, /my-antigravity:set-attention-state/);
    // 验证关键非修改文件的 offset 与 size 仍可读
    assert.ok(getAsarFile(patched1, 'package.json').toString('utf8').includes('"antigravity"'));

    // 第二次重复安装应保持幂等，不重复拼接标记
    installLoader(copyAsar, { targetDir: pluginTarget });
    const patched2 = readAsar(copyAsar);
    const preload2 = getAsarFile(patched2, 'dist/preload.js').toString('utf8');
    assert.equal(preload2.match(/MY_ANTIGRAVITY_LOADER_START/g)?.length, 1);

    // 卸载应完整恢复到原始字节内容
    uninstallLoader(copyAsar);
    assert.deepEqual(fs.readFileSync(copyAsar), fs.readFileSync(realAsar));

    // 无备份路径时也能通过清除标记卸载
    fs.unlinkSync(`${copyAsar}.my_antigravity.bak`);
    installLoader(copyAsar, { targetDir: pluginTarget });
    fs.unlinkSync(`${copyAsar}.my_antigravity.bak`);
    uninstallLoader(copyAsar);
    const stripped = readAsar(copyAsar);
    assert.equal(getAsarFile(stripped, 'dist/myAntigravityLoader.js'), null);
    assert.ok(!getAsarFile(stripped, 'dist/preload.js').toString('utf8').includes('MY_ANTIGRAVITY_LOADER_START'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('syncPlugins 同步到目标目录并生成合法 plugin.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agy-sync-test-'));
  try {
    const res = syncPlugins({ targetDir: tmpDir });
    assert.ok(res.synced.includes('enter-newline'));
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'plugin.json'), 'utf8'));
    const repoPkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    assert.equal(manifest.name, 'my_antigravity');
    assert.equal(manifest.version, repoPkg.version);
    assert.equal(manifest.logo, 'assets/logo.svg');
    assert.ok(fs.existsSync(path.join(tmpDir, 'assets', 'logo.svg')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'desktop-mods', 'enter-newline', 'index.js')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writePatchedAsar 在替换文件时同步更新 integrity hash', () => {
  const realAsar = getDefaultAsarPath();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agy-integrity-'));
  try {
    const out = path.join(tmpDir, 'out.asar');
    const customBuf = Buffer.from('console.log("hello");\n', 'utf8');
    writePatchedAsar(realAsar, out, { 'dist/custom_test.js': customBuf });
    const parsed = readAsar(out);
    assert.equal(parsed.header.files.dist.files['custom_test.js'].size, customBuf.length);
    assert.equal(parsed.header.files.dist.files['custom_test.js'].integrity.blocks.length, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('main-hook 支持独立 mods-state.json 持久化、防越界校验与保护锁定，且 syncPlugins 不覆盖状态', () => {
  const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agy-state-test-'));
  try {
    const pluginTarget = path.join(tmpConfigDir, 'plugins', 'my_antigravity');
    syncPlugins({ targetDir: pluginTarget });

    const initialCatalog = mainHook.getModCatalog(tmpConfigDir);
    assert.equal(initialCatalog.ok, true);
    assert.ok(initialCatalog.mods.some((m) => m.id === 'enter-newline' && m.enabled === true));
    assert.ok(initialCatalog.mods.some((m) => m.id === 'mod-manager' && m.protected === true));

    // 关闭 enter-newline
    const disableRes = mainHook.setModEnabled('enter-newline', false, tmpConfigDir);
    assert.equal(disableRes.ok, true);
    assert.equal(
      disableRes.mods.find((m) => m.id === 'enter-newline')?.enabled,
      false,
    );

    // readMods 应过滤掉已禁用的 enter-newline
    const activeAfterDisable = mainHook.readMods(tmpConfigDir);
    assert.equal(
      activeAfterDisable.mods.some((m) => m.id === 'enter-newline'),
      false,
    );
    assert.equal(
      activeAfterDisable.mods.some((m) => m.id === 'mod-manager'),
      true,
    );

    // 受保护插件 mod-manager 禁止关闭
    const lockRes = mainHook.setModEnabled('mod-manager', false, tmpConfigDir);
    assert.equal(lockRes.ok, false);
    assert.match(lockRes.error, /保护/);

    // 路径穿越或不存在的 ID 应被拒绝
    assert.equal(mainHook.setModEnabled('../evil', false, tmpConfigDir).ok, false);
    assert.equal(mainHook.setModEnabled('non-existent-mod', false, tmpConfigDir).ok, false);

    // 再次运行 syncPlugins 不应抹掉 mods-state.json 中的用户开关状态
    syncPlugins({ targetDir: pluginTarget });
    const afterSync = mainHook.getModCatalog(tmpConfigDir);
    assert.equal(
      afterSync.mods.find((m) => m.id === 'enter-newline')?.enabled,
      false,
    );

    // 若 mods-state.json 损坏，应安全回退至 mod.json 默认值
    fs.writeFileSync(mainHook.getModsStatePath(tmpConfigDir), '{corrupted-json', 'utf8');
    const fallback = mainHook.getModCatalog(tmpConfigDir);
    assert.equal(
      fallback.mods.find((m) => m.id === 'enter-newline')?.enabled,
      true,
    );
  } finally {
    fs.rmSync(tmpConfigDir, { recursive: true, force: true });
  }
});

test('main-hook: Windows 任务栏角标、会话去重、托盘聚合与销毁恢复', async () => {
  const filename = path.resolve('loader/main-hook.js');
  const code = fs.readFileSync(filename, 'utf8');
  const cjsRequire = createRequire(filename);
  const mod = { exports: {} };

  const handlers = new Map();
  const overlays = [];
  const secondOverlays = [];
  const thumbnailTooltips = [];
  const trayImages = [];
  const trayTooltips = [];

  class FakeTray {
    setToolTip(tip) { trayTooltips.push(tip); }
    setImage(img) {
      trayImages.push(img);
    }
    isDestroyed() {
      return false;
    }
  }
  const fakeTrayModule = {
    createTray() {
      const t = new FakeTray();
      t.setToolTip('Antigravity');
      return t;
    },
  };

  const wc1Listeners = new Map();
  const wc1 = {
    id: 101,
    once(ev, fn) {
      wc1Listeners.set(ev, fn);
    },
  };
  const wc2 = {
    id: 102,
    once() {},
  };

  const fakeBaseWin = {
    isDestroyed: () => false,
    setOverlayIcon(icon, description) {
      overlays.push({ icon, description });
    },
    setThumbnailToolTip: (tip) => thumbnailTooltips.push(tip),
    setProgressBar() { assert.fail('任务栏改回数字角标'); },
    setIcon() { assert.fail('不应替换窗口图标'); },
  };
  const secondWin = {
    ...fakeBaseWin,
    setOverlayIcon: (icon, description) => secondOverlays.push({ icon, description }),
    setThumbnailToolTip() {},
  };

  const mockElectron = {
    ipcMain: {
      listenerCount: () => 0,
      on(ch, fn) {
        handlers.set(ch, fn);
      },
      handle(ch, fn) {
        handlers.set(ch, fn);
      },
      removeHandler() {},
    },
    BaseWindow: {
      getAllWindows: () => [
        {
          isDestroyed: () => false,
          contentView: { children: [{ webContents: wc1 }] },
        },
      ],
    },
    BrowserWindow: {
      fromWebContents: () => null,
    },
    Tray: FakeTray,
    nativeImage: {
      createEmpty() {
        const reps = [];
        return { reps, addRepresentation: (rep) => reps.push(rep), isEmpty: () => !reps.length };
      },
      createFromDataURL: (url) => ({ kind: 'dataUrl', url, isEmpty: () => false }),
    },
  };

  const fakeUtilsMod = {
    resolveHubWindowFromWebContents: (wc) => wc === wc1 ? fakeBaseWin : secondWin,
  };

  const customRequire = (id) => {
    if (id === 'electron') return mockElectron;
    if (id === './tray') return fakeTrayModule;
    if (id === './utils') return fakeUtilsMod;
    return cjsRequire(id);
  };

  vm.runInNewContext(code, {
    require: customRequire,
    module: mod,
    exports: mod.exports,
    __filename: filename,
    __dirname: path.dirname(filename),
    process: Object.defineProperty(Object.create(process), 'platform', { value: 'win32' }),
    console,
  });

  mod.exports.registerMyAntigravityLoader();
  fakeTrayModule.createTray();

  // 注册 wc1 到销毁追踪
  handlers.get('my-antigravity:get-mods-sync')({ sender: wc1 });

  const setAttention = handlers.get('my-antigravity:set-attention-state');
  // 角标优先使用多个 DPI 表示，悬停展示精确数量。
  const r1 = await setAttention(
    { sender: wc1 },
    {
      count: 1,
      level: 'completed',
      conversationIds: ['first'],
      windowReps: [
        { scaleFactor: 1, width: 16, height: 16, dataUrl: 'data:image/png;base64,WIN_16' },
        { scaleFactor: 2, width: 32, height: 32, dataUrl: 'data:image/png;base64,WIN_32' },
      ],
      trayPngDataUrl: 'data:image/png;base64,TRAY_GREEN',
    },
  );
  assert.equal(r1.ok, true);
  assert.equal(r1.windowMethod, 'setOverlayIcon');
  assert.equal(r1.updatedWindow, true);
  assert.equal(r1.updatedTray, true);
  assert.equal(overlays.at(-1).icon.reps.length, 2);
  assert.equal(overlays.at(-1).description, '1 pending conversation');
  assert.equal(thumbnailTooltips.at(-1), '1 pending conversation');
  assert.equal(trayImages.at(-1).url, 'data:image/png;base64,TRAY_GREEN');

  await setAttention(
    { sender: wc1 },
    {
      count: 0,
      level: 'none',
      trayPngDataUrl: null,
    },
  );
  assert.deepEqual(overlays.at(-1), { icon: null, description: '' });
  assert.equal(thumbnailTooltips.at(-1), '');
  assert.equal(trayTooltips.at(-1), 'Antigravity');

  // wc2 报告审批（黄点），托盘应聚合为最高优先级黄点；随后 wc1 升级为报错（红点）
  await setAttention(
    { sender: wc2 },
    {
      count: 1,
      level: 'approval',
      conversationIds: ['shared'],
      windowPngDataUrl: 'data:image/png;base64,WIN_YELLOW',
      trayPngDataUrl: 'data:image/png;base64,TRAY_YELLOW',
    },
  );
  assert.equal(secondOverlays.at(-1).icon.url, 'data:image/png;base64,WIN_YELLOW');
  assert.equal(trayImages.at(-1).url, 'data:image/png;base64,TRAY_YELLOW');

  await setAttention(
    { sender: wc1 },
    {
      count: 2,
      level: 'error',
      conversationIds: ['shared', 'another'],
      windowPngDataUrl: 'data:image/png;base64,WIN_RED',
      trayPngDataUrl: 'data:image/png;base64,TRAY_RED',
    },
  );
  assert.equal(overlays.at(-1).icon.url, 'data:image/png;base64,WIN_RED');
  assert.equal(trayTooltips.at(-1), 'Antigravity · 2 pending conversations');
  assert.equal(trayImages.at(-1).url, 'data:image/png;base64,TRAY_RED');

  // wc1 关闭销毁后，托盘自动回落为 wc2 的黄点
  wc1Listeners.get('destroyed')?.();
  assert.equal(trayTooltips.at(-1), 'Antigravity · 1 pending conversation');
  assert.equal(trayImages.at(-1).url, 'data:image/png;base64,TRAY_YELLOW');
  await setAttention({ sender: wc2 }, { count: 0, level: 'none' });
  assert.deepEqual(secondOverlays.at(-1), { icon: null, description: '' });
  assert.equal(trayTooltips.at(-1), 'Antigravity');
});

test('main-hook: 支持读取 plugin.json 版本号、远端版本比对及白名单打开 GitHub', async () => {
  const pkgVersion = JSON.parse(
    fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'package.json'), 'utf8'),
  ).version;
  const parts = pkgVersion.split('.').map(Number);
  const nextPatchVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agy-update-test-'));
  try {
    const pluginTarget = path.join(tmpConfigDir, 'plugins', 'my_antigravity');
    syncPlugins({ targetDir: pluginTarget });

    assert.equal(mainHook.getAppVersion(tmpConfigDir), pkgVersion);
    assert.equal(mainHook.getModCatalog(tmpConfigDir).appVersion, pkgVersion);

    const latestRes = await mainHook.checkForUpdates({
      configDir: tmpConfigDir,
      fetchJson: async () => ({ version: pkgVersion }),
    });
    assert.equal(latestRes.ok, true);
    assert.equal(latestRes.hasUpdate, false);
    assert.equal(latestRes.currentVersion, pkgVersion);
    assert.equal(latestRes.latestVersion, pkgVersion);

    const newerPatchRes = await mainHook.checkForUpdates({
      configDir: tmpConfigDir,
      fetchJson: async () => ({ version: nextPatchVersion }),
    });
    assert.equal(newerPatchRes.ok, true);
    assert.equal(newerPatchRes.hasUpdate, true);
    assert.equal(newerPatchRes.latestVersion, nextPatchVersion);

    const badUrlRes = await mainHook.openExternalUrl('https://evil.example.com');
    assert.equal(badUrlRes.ok, false);
  } finally {
    fs.rmSync(tmpConfigDir, { recursive: true, force: true });
  }
});
