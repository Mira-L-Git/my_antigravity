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
    assert.match(loader1, /my-antigravity:get-mods-sync/);
    assert.match(loader1, /my-antigravity:set-mod-enabled/);
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
    assert.equal(manifest.name, 'my_antigravity');
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
