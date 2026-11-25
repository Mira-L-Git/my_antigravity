import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildModManagerPlugin } from '../plugins/mod-manager/build.mjs';
import {
  MIN_LOGO_SCORE,
  compareVersions,
  computePendingReloadIds,
  filterDisplayMods,
  formatVersionLabel,
  getShortSummary,
  parseVersionTuple,
  resolveCurrentVersion,
  resolveLocale,
  scoreLogoButtonCandidate,
  sortCatalogMods,
} from '../plugins/mod-manager/src/manager-core.js';
import { createModManagerController, findLogoButton } from '../plugins/mod-manager/src/ui.js';

function createFakeDom() {
  class FakeNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
      this.parentElement = null;
      this.childNodes = [];
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === doc.documentElement) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    appendChild(child) {
      if (child.parentElement) {
        const idx = child.parentElement.childNodes.indexOf(child);
        if (idx !== -1) child.parentElement.childNodes.splice(idx, 1);
      }
      child.parentElement = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      if (!this.parentElement) return;
      const idx = this.parentElement.childNodes.indexOf(this);
      if (idx !== -1) this.parentElement.childNodes.splice(idx, 1);
      this.parentElement = null;
    }
    replaceChildren(...nodes) {
      for (const c of [...this.childNodes]) c.parentElement = null;
      this.childNodes = [];
      for (const n of nodes) this.appendChild(n);
    }
    get textContent() {
      return this.childNodes.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this.replaceChildren(new FakeText(String(v ?? '')));
    }
  }

  class FakeText extends FakeNode {
    constructor(value) {
      super(3);
      this.nodeValue = value;
    }
    get textContent() {
      return this.nodeValue;
    }
    set textContent(v) {
      this.nodeValue = String(v ?? '');
    }
  }

  class FakeElement extends FakeNode {
    constructor(tagName, attrs = {}) {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.attrs = new Map();
      this.style = {};
      this.listeners = new Map();
      this.hidden = false;
      this.disabled = false;
      this.focused = false;
      this.rect = { left: 10, top: 42, right: 38, bottom: 70, width: 28, height: 28 };
      for (const [k, v] of Object.entries(attrs)) {
        this.setAttribute(k, v);
      }
    }
    get children() {
      return this.childNodes.filter((c) => c.nodeType === 1);
    }
    get className() {
      return this.getAttribute('class') || '';
    }
    set className(v) {
      this.setAttribute('class', v);
    }
    setAttribute(k, v) {
      this.attrs.set(k, String(v));
    }
    getAttribute(k) {
      return this.attrs.has(k) ? this.attrs.get(k) : null;
    }
    hasAttribute(k) {
      return this.attrs.has(k);
    }
    removeAttribute(k) {
      this.attrs.delete(k);
    }
    focus() {
      this.focused = true;
    }
    getBoundingClientRect() {
      return this.rect;
    }
    addEventListener(type, fn, capture = false) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ fn, capture: Boolean(capture) });
    }
    removeEventListener(type, fn, capture = false) {
      const list = this.listeners.get(type);
      if (!list) return;
      this.listeners.set(
        type,
        list.filter((entry) => !(entry.fn === fn && entry.capture === Boolean(capture))),
      );
    }
    matches(selector) {
      return selector.split(',').some((part) => {
        const s = part.trim();
        if (!s) return false;
        if (s.startsWith('.')) {
          return this.className.split(/\s+/).includes(s.slice(1));
        }
        if (s.startsWith('[') && s.endsWith(']')) {
          const inner = s.slice(1, -1);
          const eq = inner.indexOf('=');
          if (eq === -1) return this.hasAttribute(inner);
          const k = inner.slice(0, eq).replace(/\*$/, '');
          const val = inner.slice(eq + 1).replace(/^['"]|['"]$/g, '');
          const actual = this.getAttribute(k) || '';
          return inner.includes('*=') ? actual.includes(val) : actual === val;
        }
        return this.tagName.toLowerCase() === s.toLowerCase();
      });
    }
    closest(selector) {
      let cur = this;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(selector) {
      const res = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (child.matches(selector)) res.push(child);
          walk(child);
        }
      };
      walk(this);
      return res;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  const docListeners = new Map();
  const winListeners = new Map();

  const html = new FakeElement('html', { lang: 'zh-CN' });
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  html.appendChild(head);
  html.appendChild(body);

  const doc = {
    documentElement: html,
    head,
    body,
    readyState: 'complete',
    createElement: (tag) => new FakeElement(tag),
    querySelectorAll: (sel) => html.querySelectorAll(sel),
    querySelector: (sel) => html.querySelector(sel),
    addEventListener(type, fn, capture = false) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push({ fn, capture: Boolean(capture) });
    },
    removeEventListener(type, fn, capture = false) {
      const list = docListeners.get(type);
      if (!list) return;
      docListeners.set(
        type,
        list.filter((entry) => !(entry.fn === fn && entry.capture === Boolean(capture))),
      );
    },
    dispatchToElement(target, type, extra = {}) {
      let defaultPrevented = false;
      let propagationStopped = false;
      let immediateStopped = false;
      const event = {
        type,
        target,
        button: 0,
        altKey: false,
        ...extra,
        preventDefault() {
          defaultPrevented = true;
        },
        stopPropagation() {
          propagationStopped = true;
        },
        stopImmediatePropagation() {
          immediateStopped = true;
          propagationStopped = true;
        },
      };

      // 捕获阶段
      for (const entry of [...(docListeners.get(type) || [])]) {
        if (!entry.capture) continue;
        entry.fn(event);
        if (immediateStopped) break;
      }

      // 目标监听（用于验证原生监听器是否被成功拦截）
      if (!propagationStopped) {
        let cur = target;
        while (cur && cur.nodeType === 1) {
          for (const entry of [...(cur.listeners?.get(type) || [])]) {
            if (!entry.capture) entry.fn(event);
            if (immediateStopped) break;
          }
          if (propagationStopped) break;
          cur = cur.parentElement;
        }
      }

      return { event, defaultPrevented, propagationStopped };
    },
  };

  const win = {
    location: { reloadCalled: false, reload() { this.reloadCalled = true; } },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = winListeners.get(type);
      if (!list) return;
      winListeners.set(type, list.filter((x) => x !== fn));
    },
    dispatchResize() {
      for (const fn of winListeners.get('resize') || []) fn();
    },
  };

  return { win, doc, body, FakeElement };
}

function buildSidebarWithTopLogo(doc, FakeElement) {
  // 顶部原生文字菜单栏（必须被排除）
  const menubar = new FakeElement('div', { role: 'menubar' });
  const textMenuBtn = new FakeElement('button');
  textMenuBtn.textContent = 'Antigravity';
  textMenuBtn.rect = { left: 8, top: 4, right: 86, bottom: 26, width: 78, height: 22 };
  menubar.appendChild(textMenuBtn);
  doc.body.appendChild(menubar);

  // 左侧边栏顶部图标工具行
  const aside = new FakeElement('aside');
  const toolbar = new FakeElement('div');

  const logoBtn = new FakeElement('button');
  logoBtn.rect = { left: 10, top: 40, right: 38, bottom: 68, width: 28, height: 28 };
  logoBtn.appendChild(new FakeElement('svg'));

  const sidebarBtn = new FakeElement('button', { 'aria-label': 'Toggle Sidebar' });
  sidebarBtn.rect = { left: 44, top: 40, right: 72, bottom: 68, width: 28, height: 28 };
  sidebarBtn.appendChild(new FakeElement('svg'));

  const backBtn = new FakeElement('button', { 'aria-label': 'Back' });
  backBtn.rect = { left: 76, top: 40, right: 104, bottom: 68, width: 28, height: 28 };
  backBtn.appendChild(new FakeElement('svg'));

  const searchBtn = new FakeElement('button', { 'aria-label': 'Search' });
  searchBtn.rect = { left: 108, top: 40, right: 136, bottom: 68, width: 28, height: 28 };
  searchBtn.appendChild(new FakeElement('svg'));

  const newChatBtn = new FakeElement('button');
  newChatBtn.textContent = '新建对话';
  newChatBtn.rect = { left: 10, top: 78, right: 210, bottom: 112, width: 200, height: 34 };

  toolbar.appendChild(logoBtn);
  toolbar.appendChild(sidebarBtn);
  toolbar.appendChild(backBtn);
  toolbar.appendChild(searchBtn);
  aside.appendChild(toolbar);
  aside.appendChild(newChatBtn);
  doc.body.appendChild(aside);

  return { textMenuBtn, logoBtn, sidebarBtn, backBtn, searchBtn, newChatBtn };
}

test('scoreLogoButtonCandidate 精准区分左上角图标与顶部文字 Antigravity 及侧栏按钮', () => {
  // 顶部文字菜单 Antigravity -> 排除
  assert.equal(
    scoreLogoButtonCandidate({
      text: 'Antigravity',
      hasSvg: false,
      inMenubarOrMenu: true,
      rect: { left: 8, top: 4, width: 78, height: 22 },
    }),
    -1,
  );

  // 侧边栏折叠按钮 -> 排除
  assert.equal(
    scoreLogoButtonCandidate({
      text: '',
      ariaLabel: 'Toggle Sidebar',
      hasSvg: true,
      rect: { left: 44, top: 40, width: 28, height: 28 },
      rowHasSiblingIconButtons: true,
      rowMinLeft: 10,
    }),
    -1,
  );

  // 左上角白色 Antigravity 图标（无 aria-label，位于工具行最左）-> 高分命中
  const logoScore = scoreLogoButtonCandidate({
    text: '',
    hasSvg: true,
    rect: { left: 10, top: 40, width: 28, height: 28 },
    rowHasSiblingIconButtons: true,
    rowMinLeft: 10,
  });
  assert.ok(logoScore >= MIN_LOGO_SCORE);
});

test('filterDisplayMods、sortCatalogMods、getShortSummary 与 computePendingReloadIds 行为正确', () => {
  const filtered = filterDisplayMods([
    { id: 'mod-manager', protected: true, enabled: true },
    { id: 'zh-cn', enabled: true },
    { id: 'enter-newline', enabled: false },
  ]);
  const sorted = sortCatalogMods(filtered);
  assert.deepEqual(
    sorted.map((m) => m.id),
    ['enter-newline', 'zh-cn'],
  );

  assert.equal(getShortSummary({ id: 'zh-cn', description: '一段很长的描述（含括号）' }), '桌面端界面简体中文化');
  assert.equal(
    getShortSummary({ id: 'zh-cn', description: '一段很长的描述（含括号）' }, 'en'),
    'Simplified Chinese desktop UI translation',
  );
  assert.equal(
    getShortSummary({ id: 'enter-newline' }, 'en'),
    'Enter for newline, Shift+Enter to send',
  );
  assert.equal(
    getShortSummary({ id: 'custom-mod', summary: '自定义简短说明', summaryEn: 'Short EN summary', description: '长描述' }, 'en'),
    'Short EN summary',
  );
  assert.equal(
    getShortSummary({ id: 'custom-mod', summary: { en: 'Object EN', 'zh-CN': '对象中文' } }, 'en'),
    'Object EN',
  );
  assert.equal(
    getShortSummary({ id: 'custom-mod', summary: '自定义简短说明', description: '长描述' }),
    '自定义简短说明',
  );
  assert.equal(
    getShortSummary({ id: 'other-mod', description: '实现某某功能（含补充说明）。第二句细节' }),
    '实现某某功能',
  );

  // resolveLocale 判断 zh-cn 启动态与未开启态
  assert.equal(resolveLocale({ __myAntigravityZhCnInstalled: true }, { documentElement: { lang: 'en' } }), 'zh-CN');
  assert.equal(resolveLocale({}, { documentElement: { lang: 'en' } }, ['enter-newline', 'zh-cn']), 'zh-CN');
  assert.equal(resolveLocale({}, { documentElement: { lang: 'en' } }, ['enter-newline']), 'en');

  // 改了 enter-newline 为 false，应提示待重载
  assert.deepEqual(
    computePendingReloadIds(sorted, ['enter-newline', 'zh-cn', 'mod-manager']),
    ['enter-newline'],
  );

  // 全部恢复到与启动一致，不应再提示待重载
  assert.deepEqual(
    computePendingReloadIds(
      [
        { id: 'enter-newline', enabled: true },
        { id: 'zh-cn', enabled: true },
        { id: 'mod-manager', enabled: true },
      ],
      ['enter-newline', 'zh-cn', 'mod-manager'],
    ),
    [],
  );
});

test('mod-manager 完整交互：拦截左上角图标、开关插件、防自锁、Alt透传与一键重载', async () => {
  const { win, doc, FakeElement } = createFakeDom();
  const { textMenuBtn, logoBtn, sidebarBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  // 只命中图标，绝不命中顶部文字或侧边栏按钮
  assert.equal(findLogoButton(doc), logoBtn);

  let nativeLogoClicks = 0;
  logoBtn.addEventListener('click', () => {
    nativeLogoClicks += 1;
  });

  let nativeTextMenuClicks = 0;
  textMenuBtn.addEventListener('click', () => {
    nativeTextMenuClicks += 1;
  });

  let nativeSidebarClicks = 0;
  sidebarBtn.addEventListener('click', () => {
    nativeSidebarClicks += 1;
  });

  let catalog = [
    {
      id: 'enter-newline',
      version: '0.1.0',
      enabled: true,
      protected: false,
      description: 'Enter 换行，Shift+Enter 发送',
    },
    {
      id: 'zh-cn',
      version: '0.1.0',
      enabled: true,
      protected: false,
      description: '桌面版界面简体中文化',
    },
    {
      id: 'mod-manager',
      version: '0.1.0',
      enabled: true,
      protected: true,
      description: '插件管理菜单',
    },
  ];
  let reloadCalls = 0;
  const setCalls = [];

  const bridge = {
    bootEnabledIds: ['enter-newline', 'zh-cn', 'mod-manager'],
    async getCatalog() {
      return {
        ok: true,
        bootEnabledIds: ['enter-newline', 'zh-cn', 'mod-manager'],
        mods: catalog.map((m) => ({ ...m })),
      };
    },
    async setModEnabled(id, enabled) {
      setCalls.push({ id, enabled });
      catalog = catalog.map((m) => (m.id === id ? { ...m, enabled } : m));
      return { ok: true, id, enabled, mods: catalog.map((m) => ({ ...m })) };
    },
    async reloadWindow() {
      reloadCalls += 1;
      return { ok: true };
    },
  };

  const controller = createModManagerController(win, doc, { bridge });

  // 1. 点击顶部文字菜单和侧边栏按钮不应被拦截
  doc.dispatchToElement(textMenuBtn, 'click');
  doc.dispatchToElement(sidebarBtn, 'click');
  assert.equal(nativeTextMenuClicks, 1);
  assert.equal(nativeSidebarClicks, 1);
  assert.equal(controller.isOpen(), false);

  // 2. 点击左上角 SVG 图标（内部的 <svg> 子节点）应拦截原生事件并打开管理菜单
  const svgChild = logoBtn.children[0];
  doc.dispatchToElement(svgChild, 'click');
  assert.equal(nativeLogoClicks, 0);
  assert.equal(controller.isOpen(), true);

  // 等待异步 getCatalog 完成渲染
  await new Promise((r) => setTimeout(r, 10));

  const root = doc.querySelector('[data-ag-mm-root="true"]');
  assert.ok(root);
  assert.equal(root.hidden, false);
  assert.equal(root.getAttribute('data-my-antigravity-no-i18n'), 'true');

  // 验证不显示计数徽标、关闭按钮 ×、mod-manager 自身与版本号，且小字使用精简文案
  assert.equal(root.querySelector('.ag-mm-count'), null);
  assert.equal(root.querySelector('.ag-mm-close'), null);
  const rows = root.querySelectorAll('.ag-mm-item');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.getAttribute('data-mod-id') === 'mod-manager'), undefined);
  assert.equal(rows[0].querySelector('.ag-mm-item-name')?.textContent, 'enter-newline');
  assert.equal(rows[0].querySelector('.ag-mm-item-desc')?.textContent, 'Enter 换行，Shift+Enter 发送');
  assert.equal(rows[0].querySelector('.ag-mm-badge'), null);
  assert.equal(rows[1].querySelector('.ag-mm-item-name')?.textContent, 'zh-cn');
  assert.equal(rows[1].querySelector('.ag-mm-item-desc')?.textContent, '桌面端界面简体中文化');

  // 3. 切换 enter-newline 为关闭 -> 应显示待重载提示与「立即重载」按钮
  const enterSwitch = rows[0].querySelector('.ag-mm-switch');
  doc.dispatchToElement(enterSwitch, 'click');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(setCalls, [{ id: 'enter-newline', enabled: false }]);

  const footer = root.querySelector('.ag-mm-footer');
  const reloadBtn = root.querySelector('.ag-mm-reload-btn');
  assert.equal(footer.getAttribute('data-pending'), 'true');
  assert.equal(reloadBtn.hidden, false);

  // 4. 点击「立即重载」应调用 bridge.reloadWindow()
  doc.dispatchToElement(reloadBtn, 'click');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(reloadCalls, 1);

  // 5. 再把 enter-newline 开回来 -> 待重载提示应消失
  const enterSwitchAgain = root
    .querySelector('[data-mod-id="enter-newline"]')
    .querySelector('.ag-mm-switch');
  doc.dispatchToElement(enterSwitchAgain, 'click');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(footer.getAttribute('data-pending'), 'false');
  assert.equal(reloadBtn.hidden, true);

  // 6. 按 Esc 应关闭浮层并恢复锚点焦点
  doc.dispatchToElement(root, 'keydown', { key: 'Escape' });
  assert.equal(controller.isOpen(), false);
  assert.equal(logoBtn.focused, true);

  // 7. Alt + 点击左上角图标应透传原生功能
  doc.dispatchToElement(logoBtn, 'click', { altKey: true });
  assert.equal(nativeLogoClicks, 1);
  assert.equal(controller.isOpen(), false);

  controller.dispose();
});

test('未升级加载器（无 __myAntigravityManager）时友好提示而不崩溃', () => {
  const { win, doc, FakeElement } = createFakeDom();
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  const controller = createModManagerController(win, doc);
  doc.dispatchToElement(logoBtn, 'click');

  assert.equal(controller.isOpen(), true);
  const root = doc.querySelector('[data-ag-mm-root="true"]');
  const emptyMsg = root?.querySelector('.ag-mm-empty');
  assert.ok(emptyMsg);
  assert.match(emptyMsg.textContent, /install-loader/);

  controller.dispose();
});

test('构建产物 plugins/mod-manager/index.js 可在隔离上下文安全执行且幂等', () => {
  buildModManagerPlugin();
  const bundled = fs.readFileSync(path.resolve('plugins/mod-manager/index.js'), 'utf8');
  const { win, doc, FakeElement } = createFakeDom();
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  vm.runInNewContext(bundled, {
    window: win,
    document: doc,
    console,
    queueMicrotask,
  });
  assert.equal(win.__myAntigravityModManagerInstalled, true);
  assert.equal(logoBtn.getAttribute('data-ag-mm-anchor'), 'true');

  doc.dispatchToElement(logoBtn, 'click');
  assert.ok(doc.querySelector('[data-ag-mm-root="true"]'));

  // 重复执行应直接幂等跳过
  vm.runInNewContext(bundled, {
    window: win,
    document: doc,
    console,
    queueMicrotask,
  });
  assert.equal(doc.querySelectorAll('[data-ag-mm-root="true"]').length, 1);
});

test('打开与关闭支持 WAAPI 过渡动画，中途重开可安全取消旧退场动画', () => {
  const { win, doc, FakeElement } = createFakeDom();
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  const animCalls = [];
  const fakeProto = Object.getPrototypeOf(logoBtn);
  const origAnimate = fakeProto.animate;
  fakeProto.animate = function mockAnimate(keyframes, options) {
    const rec = {
      el: this,
      keyframes,
      options,
      cancelled: false,
      onfinish: null,
      oncancel: null,
      cancel() {
        this.cancelled = true;
        this.oncancel?.();
      },
      finish() {
        this.onfinish?.();
      },
    };
    animCalls.push(rec);
    return rec;
  };

  try {
    const controller = createModManagerController(win, doc, {
      bridge: {
        bootEnabledIds: ['enter-newline'],
        async getCatalog() {
          return { ok: true, mods: [{ id: 'enter-newline', enabled: true }] };
        },
        async setModEnabled() {
          return { ok: true, mods: [] };
        },
        async reloadWindow() {
          return { ok: true };
        },
      },
    });

    // 打开触发入场动画
    doc.dispatchToElement(logoBtn, 'click');
    const root = doc.querySelector('[data-ag-mm-root="true"]');
    assert.equal(animCalls.length, 1);
    assert.equal(animCalls[0].options.duration, 160);
    assert.equal(root.hidden, false);

    // 关闭触发退场动画（尚未 finish 前保持可见，结束后隐藏）
    doc.dispatchToElement(logoBtn, 'click');
    assert.equal(animCalls.length, 2);
    assert.equal(animCalls[1].options.duration, 130);
    assert.equal(root.style.pointerEvents, 'none');
    assert.equal(root.hidden, false);

    // 在退场动画完成前立刻再次打开 -> 应取消旧退场动画且即使旧回调触发也不误隐藏
    doc.dispatchToElement(logoBtn, 'click');
    assert.equal(animCalls[1].cancelled, true);
    assert.equal(animCalls.length, 3);
    animCalls[1].finish();
    assert.equal(root.hidden, false);
    assert.equal(root.style.pointerEvents, '');

    // 正常关闭并完成动画后，节点隐藏
    doc.dispatchToElement(logoBtn, 'click');
    const lastClose = animCalls[animCalls.length - 1];
    lastClose.finish();
    assert.equal(root.hidden, true);
    assert.equal(root.style.pointerEvents, '');

    controller.dispose();
  } finally {
    if (origAnimate === undefined) {
      delete fakeProto.animate;
    } else {
      fakeProto.animate = origAnimate;
    }
  }
});

test('zh-cn 未开启时功能介绍与管理菜单文案显示为英文', async () => {
  const { win, doc, FakeElement } = createFakeDom();
  doc.documentElement.setAttribute('lang', 'en');
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  const mods = [
    { id: 'enter-newline', enabled: true, protected: false },
    { id: 'zh-cn', enabled: false, protected: false },
  ];
  const controller = createModManagerController(win, doc, {
    bridge: {
      bootEnabledIds: ['enter-newline', 'mod-manager'],
      async getCatalog() {
        return { ok: true, bootEnabledIds: ['enter-newline', 'mod-manager'], mods: mods.map((m) => ({ ...m })) };
      },
      async setModEnabled(id, enabled) {
        return {
          ok: true,
          id,
          enabled,
          mods: mods.map((m) => (m.id === id ? { ...m, enabled } : { ...m })),
        };
      },
      async reloadWindow() {
        return { ok: true };
      },
    },
  });

  assert.match(logoBtn.getAttribute('title'), /Alt\+Click/);

  doc.dispatchToElement(logoBtn, 'click');
  await new Promise((r) => setTimeout(r, 10));

  const root = doc.querySelector('[data-ag-mm-root="true"]');
  const rows = root.querySelectorAll('.ag-mm-item');
  assert.equal(rows[0].querySelector('.ag-mm-item-desc')?.textContent, 'Enter for newline, Shift+Enter to send');
  assert.equal(rows[1].querySelector('.ag-mm-item-desc')?.textContent, 'Simplified Chinese desktop UI translation');
  assert.match(root.querySelector('.ag-mm-footer-text')?.textContent || '', /Alt\+Click/);

  // 拨动开关后，待重载提示与按钮也应为英文
  doc.dispatchToElement(rows[1].querySelector('.ag-mm-switch'), 'click');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(root.querySelector('.ag-mm-badge')?.textContent, 'Restart');
  assert.equal(root.querySelector('.ag-mm-reload-btn')?.textContent, 'Reload');

  controller.dispose();
});

test('版本号解析与从第一位到第三位依次比较规则正确', () => {
  assert.deepEqual(parseVersionTuple('v1.0.0'), [1, 0, 0]);
  assert.deepEqual(parseVersionTuple('1.2.10'), [1, 2, 10]);
  assert.equal(parseVersionTuple('invalid'), null);

  // 依次比较：第一位、第二位、第三位
  assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.1.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
  assert.equal(compareVersions('1.10.0', '1.2.0'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('1.0.0', 'bad'), null);

  assert.equal(formatVersionLabel('1.0.0'), 'v1.0.0');
  assert.equal(resolveCurrentVersion({ appVersion: '1.2.3' }, []), 'v1.2.3');
  assert.equal(resolveCurrentVersion({}, [{ id: 'mod-manager', version: '1.0.0' }]), 'v1.0.0');
});

test('mod-manager 主动检查更新：无被动请求、最新提示、发现新版本替换 GitHub 跳转按钮', async () => {
  const { win, doc, FakeElement } = createFakeDom();
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  let checkCount = 0;
  let remoteVersion = '1.0.0';
  const openedUrls = [];

  const controller = createModManagerController(win, doc, {
    bridge: {
      bootEnabledIds: ['enter-newline', 'zh-cn', 'mod-manager'],
      async getCatalog() {
        return {
          ok: true,
          appVersion: '1.0.0',
          bootEnabledIds: ['enter-newline', 'zh-cn', 'mod-manager'],
          mods: [
            { id: 'enter-newline', enabled: true, protected: false },
            { id: 'mod-manager', version: '1.0.0', enabled: true, protected: true },
          ],
        };
      },
      async setModEnabled() {
        return { ok: true, mods: [] };
      },
      async reloadWindow() {
        return { ok: true };
      },
      async checkUpdate() {
        checkCount += 1;
        return {
          ok: true,
          currentVersion: '1.0.0',
          latestVersion: remoteVersion,
          hasUpdate: compareVersions('1.0.0', remoteVersion) === -1,
          repoUrl: 'https://github.com/Mira-L-Git/my_antigravity',
        };
      },
      async openExternal(url) {
        openedUrls.push(url);
        return { ok: true };
      },
    },
  });

  // 打开菜单时不应被动检查更新
  doc.dispatchToElement(logoBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(checkCount, 0);

  const root = doc.querySelector('[data-ag-mm-root="true"]');
  const versionEl = root.querySelector('.ag-mm-version');
  const updateBtn = root.querySelector('.ag-mm-update-btn');
  const noticeEl = root.querySelector('.ag-mm-update-notice');
  assert.equal(versionEl?.textContent, 'v1.0.0');
  assert.equal(updateBtn?.textContent, '检查更新');
  assert.equal(noticeEl?.hidden, true);

  // 1. 远端仍为 1.0.0：点击检查更新 -> 提示“当前版本已是最新”
  doc.dispatchToElement(updateBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(checkCount, 1);
  assert.equal(noticeEl.hidden, false);
  assert.equal(noticeEl.getAttribute('data-tone'), 'latest');
  assert.equal(noticeEl.textContent, '当前版本已是最新');
  assert.equal(updateBtn.textContent, '检查更新');

  // 2. 远端升级为 1.1.0：再次点击检查更新 -> 显示新版本版号，按钮替换为 GitHub + 跳转图标
  remoteVersion = '1.1.0';
  doc.dispatchToElement(updateBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(checkCount, 2);
  assert.equal(noticeEl.hidden, false);
  assert.equal(noticeEl.getAttribute('data-tone'), 'available');
  assert.equal(noticeEl.textContent, '发现新版本 v1.1.0');
  assert.equal(updateBtn.getAttribute('data-state'), 'has-update');
  assert.ok(updateBtn.querySelector('.ag-mm-github-icon'));
  assert.equal(updateBtn.querySelector('.ag-mm-update-btn-label')?.textContent, 'GitHub');
  assert.ok(updateBtn.querySelector('.ag-mm-external-icon'));

  // 3. 再次点击替换后的 GitHub 按钮 -> 用默认浏览器打开 GitHub 项目，不再重复检查更新
  doc.dispatchToElement(updateBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(checkCount, 2);
  assert.deepEqual(openedUrls, ['https://github.com/Mira-L-Git/my_antigravity']);

  controller.dispose();
});

test('mod-manager 无新桥接接口时可回退 fetch 检查更新与 window.open 打开 GitHub，并支持英文文案', async () => {
  const { win, doc, FakeElement } = createFakeDom();
  doc.documentElement.setAttribute('lang', 'en');
  const { logoBtn } = buildSidebarWithTopLogo(doc, FakeElement);

  const opened = [];
  win.open = (url) => {
    opened.push(url);
  };
  win.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { version: '1.0.1' };
    },
  });

  const controller = createModManagerController(win, doc, {
    bridge: {
      bootEnabledIds: ['enter-newline', 'mod-manager'],
      async getCatalog() {
        return {
          ok: true,
          bootEnabledIds: ['enter-newline', 'mod-manager'],
          mods: [
            { id: 'enter-newline', enabled: true, protected: false },
            { id: 'mod-manager', version: '1.0.0', enabled: true, protected: true },
          ],
        };
      },
      async setModEnabled() {
        return { ok: true, mods: [] };
      },
      async reloadWindow() {
        return { ok: true };
      },
    },
  });

  doc.dispatchToElement(logoBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));

  const root = doc.querySelector('[data-ag-mm-root="true"]');
  const updateBtn = root.querySelector('.ag-mm-update-btn');
  const noticeEl = root.querySelector('.ag-mm-update-notice');
  assert.equal(updateBtn.textContent, 'Check Updates');

  doc.dispatchToElement(updateBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(noticeEl.hidden, false);
  assert.equal(noticeEl.textContent, 'New version v1.0.1 available');
  assert.equal(updateBtn.getAttribute('data-state'), 'has-update');

  doc.dispatchToElement(updateBtn, 'click');
  await new Promise((r) => setTimeout(r, 15));
  assert.deepEqual(opened, ['https://github.com/Mira-L-Git/my_antigravity']);

  controller.dispose();
});
