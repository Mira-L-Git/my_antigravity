import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  filterDisplayMods,
  getShortSummary,
  sortCatalogMods,
} from '../plugins/mod-manager/src/manager-core.js';

const require = createRequire(import.meta.url);

function loadMainHook() {
  const filename = path.resolve('loader/main-hook.js');
  const code = fs.readFileSync(filename, 'utf8');
  const mod = { exports: {} };
  const customRequire = (id) => (id === 'electron' ? {} : require(id));
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

const mainHook = loadMainHook();

const PLUGIN_DIR = path.resolve('plugins/file-link-color');
const MOD_JSON_PATH = path.join(PLUGIN_DIR, 'mod.json');
const CSS_PATH = path.join(PLUGIN_DIR, 'styles.css');
const PRELOAD_HOOK_CODE = fs.readFileSync(path.resolve('loader/preload-hook.js'), 'utf8');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

test('mod.json 符合加载器与 mod-manager 接入规范', () => {
  const meta = JSON.parse(fs.readFileSync(MOD_JSON_PATH, 'utf8'));
  assert.equal(meta.id, 'file-link-color');
  assert.match(meta.id, /^[a-z0-9][a-z0-9_-]*$/i);
  assert.equal(meta.enabled, true);
  assert.equal(meta.css, 'styles.css');
  assert.ok(fs.existsSync(CSS_PATH));
  assert.equal(typeof meta.summary, 'string');
  assert.ok(meta.summary.length > 0);
  assert.equal(typeof meta.summaryEn, 'string');
  assert.ok(meta.summaryEn.length > 0);
  assert.ok(typeof meta.description === 'string' && meta.description.length > 0);
});

test('styles.css 正确匹配文件图标（含普通文档）并排除文件夹', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.context-scope-mention\s+\.inline-pill:has\(img\[src\*="\/symbols-icons\/icons\/files\/"\]\)/);
  assert.doesNotMatch(css, /:not\(/);
  assert.doesNotMatch(css, /icons\/folders\//);
  assert.match(css, /color:\s*var\(--color-link,\s*var\(--link,\s*#60a5fa\)\)/);
  assert.doesNotMatch(css, /!important/);
});

test('main-hook 可正常加载纯 CSS 插件并支持 mod-manager 开关与双语摘要', () => {
  const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-flc-'));
  try {
    const modTarget = path.join(tmpConfigDir, 'plugins', 'my_antigravity', 'desktop-mods', 'file-link-color');
    copyDir(PLUGIN_DIR, modTarget);

    const catalog = mainHook.getModCatalog(tmpConfigDir);
    assert.equal(catalog.ok, true);
    assert.equal(catalog.mods.length, 1);

    const mod = catalog.mods[0];
    assert.equal(mod.id, 'file-link-color');
    assert.equal(mod.enabled, true);
    assert.equal(filterDisplayMods(catalog.mods).length, 1);
    assert.equal(sortCatalogMods(catalog.mods)[0].id, 'file-link-color');
    assert.equal(getShortSummary(mod, 'zh-CN'), '聊天带图标文件名蓝色高亮');
    assert.equal(getShortSummary(mod, 'en'), 'Blue text for chat file links');

    // 兼容旧版 app.asar 加载器（未透传 summaryEn 或对象 summary 被置空时）仍返回简短双语摘要
    assert.equal(
      getShortSummary({ id: 'file-link-color', summary: '', description: mod.description }, 'zh-CN'),
      '聊天带图标文件名蓝色高亮',
    );
    assert.equal(
      getShortSummary({ id: 'file-link-color', summary: mod.summary, description: mod.description }, 'en'),
      'Blue text for chat file links',
    );

    const loaded = mainHook.readMods(tmpConfigDir);
    assert.equal(loaded.enabled, true);
    assert.equal(loaded.mods.length, 1);
    assert.equal(loaded.mods[0].js, '');
    assert.ok(loaded.mods[0].css.includes('.context-scope-mention .inline-pill:has('));

    // 通过 setModEnabled 关闭后再读取，应不再下发 CSS
    const toggleRes = mainHook.setModEnabled('file-link-color', false, tmpConfigDir);
    assert.equal(toggleRes.ok, true);
    assert.equal(toggleRes.enabled, false);
    const loadedAfterDisable = mainHook.readMods(tmpConfigDir);
    assert.equal(loadedAfterDisable.mods.length, 0);
  } finally {
    fs.rmSync(tmpConfigDir, { recursive: true, force: true });
  }
});

test('preload-hook 可在主世界注入纯 CSS 插件的 <style> 标签', async () => {
  const cssText = fs.readFileSync(CSS_PATH, 'utf8');
  const injectedScripts = [];
  const headChildren = [];

  const fakeDoc = {
    head: {
      appendChild(el) {
        headChildren.push(el);
      },
    },
    documentElement: {},
    querySelector() {
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        attrs: {},
        textContent: '',
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
      };
    },
  };

  const sandbox = {
    globalThis: {
      location: { protocol: 'https:', hostname: '127.0.0.1' },
    },
    electron_1: {
      ipcRenderer: {
        sendSync(channel) {
          assert.equal(channel, 'my-antigravity:get-mods-sync');
          return {
            enabled: true,
            mods: [{ id: 'file-link-color', name: 'File Link Color', js: '', css: cssText }],
          };
        },
        invoke() {
          return Promise.resolve({});
        },
      },
      webFrame: {
        executeJavaScript(code) {
          injectedScripts.push(code);
          return Promise.resolve();
        },
      },
    },
    console,
  };
  sandbox.globalThis.top = sandbox.globalThis;
  sandbox.globalThis.self = sandbox.globalThis;

  vm.runInNewContext(PRELOAD_HOOK_CODE, sandbox);
  assert.equal(injectedScripts.length, 1);

  vm.runInNewContext(injectedScripts[0], {
    document: fakeDoc,
    window: { addEventListener() {} },
  });
  assert.equal(headChildren.length, 1);
  assert.equal(headChildren[0].attrs['data-my-antigravity-mod'], 'file-link-color');
  assert.equal(headChildren[0].textContent, cssText);
});
