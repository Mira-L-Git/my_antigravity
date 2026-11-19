import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildQuotaRingsPlugin } from '../plugins/quota-rings/build.mjs';
import {
  buildQuotaSnapshot,
  classifyModelGroup,
  extractModelQuotaEntries,
  extractSummaryQuotaEntries,
  formatResetTime,
  normalizeRemainingPercent,
  parseTimestampMs,
} from '../plugins/quota-rings/src/quota-core.js';
import { installQuotaTap } from '../plugins/quota-rings/src/quota-tap.js';
import {
  buildRingContent,
  createQuotaRingsController,
  findSettingsButton,
} from '../plugins/quota-rings/src/ui.js';

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
      this.rect = { left: 12, top: 740, right: 240, bottom: 772, width: 228, height: 32 };
      this.offsetWidth = 180;
      this.offsetHeight = 64;
      for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
    }
    get children() {
      return this.childNodes.filter((c) => c.nodeType === 1);
    }
    get childElementCount() {
      return this.children.length;
    }
    get className() {
      return this.getAttribute('class') || '';
    }
    set className(v) {
      this.setAttribute('class', v);
    }
    get id() {
      return this.getAttribute('id') || '';
    }
    set id(v) {
      this.setAttribute('id', v);
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
    after(...nodes) {
      if (!this.parentElement) return;
      const p = this.parentElement;
      const idx = p.childNodes.indexOf(this);
      let insertAt = idx + 1;
      for (const n of nodes) {
        if (n.parentElement) n.remove();
        n.parentElement = p;
        p.childNodes.splice(insertAt, 0, n);
        insertAt += 1;
      }
    }
    append(...nodes) {
      for (const n of nodes) this.appendChild(n);
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(evt) {
      const event = {
        type: evt.type,
        key: evt.key,
        target: this,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
      };
      for (const fn of this.listeners.get(evt.type) || []) fn(event);
      return !event.defaultPrevented;
    }
    click() {
      this.dispatchEvent({ type: 'click' });
    }
    getBoundingClientRect() {
      return this.rect;
    }
    scrollIntoView() {}
    matches(selector) {
      return selector.split(',').some((part) => {
        const s = part.trim();
        if (!s) return false;
        if (s.startsWith('.')) {
          const cls = s.slice(1);
          return this.className.split(/\s+/).includes(cls);
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
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      const out = [];
      const walk = (node) => {
        for (const c of node.children || []) {
          if (c.matches(selector)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }
  }

  const doc = {
    documentElement: new FakeElement('html', { lang: 'zh-CN' }),
    body: new FakeElement('body'),
    head: new FakeElement('head'),
    visibilityState: 'visible',
    createElement(tag) {
      return new FakeElement(tag);
    },
    createElementNS(_ns, tag) {
      return new FakeElement(tag);
    },
    createTextNode(v) {
      return new FakeText(v);
    },
    querySelector(sel) {
      return this.documentElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return this.documentElement.querySelectorAll(sel);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  return { doc, FakeElement, FakeText };
}

function createConnectFrame(obj, flags = 0) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const frame = Buffer.alloc(5 + payload.length);
  frame[0] = flags;
  frame.writeUInt32BE(payload.length, 1);
  payload.copy(frame, 5);
  return frame;
}

test('quota-core: 模型分类正确区分 Gemini 与其它模型并忽略禁用与 BYOK', () => {
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_GOOGLE', label: 'Gemini 4 Hydrogen' }), 'gemini');
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_ANTHROPIC', label: 'Claude Sonnet 4.6' }), 'other');
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_OPENAI', label: 'GPT-5' }), 'other');
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_UNSPECIFIED', label: 'Gemma 3' }), 'gemini');
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_ANTIGRAVITY', label: 'DeepSeek R1' }), 'other');
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_GOOGLE', disabled: true, label: 'Disabled' }), null);
  assert.equal(
    classifyModelGroup({ provider: 'MODEL_PROVIDER_OPENAI', pricingType: 'MODEL_PRICING_TYPE_BYOK', label: 'BYOK' }),
    null,
  );
  assert.equal(classifyModelGroup({ provider: 'MODEL_PROVIDER_OPENAI', isCustom: true, label: 'Custom' }), null);
});

test('quota-core: 解析 GetUserStatus / ModelConfigData 并按组内最小剩余比例聚合', () => {
  const payload = {
    userStatus: {
      cascadeModelConfigData: {
        clientModelConfigs: [
          {
            label: 'Gemini 4 Pro (High)',
            provider: 'MODEL_PROVIDER_GOOGLE',
            quotaInfo: { remainingFraction: 0.624, resetTime: '2026-11-18T14:30:00Z' },
          },
          {
            label: 'Gemini 4 Flash (Low)',
            provider: 'MODEL_PROVIDER_GOOGLE',
            quotaInfo: { remainingFraction: 0.95, resetTime: '2026-11-18T14:30:00Z' },
          },
          {
            label: 'Claude Sonnet 4.6 (Thinking)',
            provider: 'MODEL_PROVIDER_ANTHROPIC',
            quotaInfo: { remainingFraction: 0.72, resetTime: { seconds: 1795000000, nanos: 0 } },
          },
          {
            label: 'GPT-5 (Medium)',
            provider: 'MODEL_PROVIDER_OPENAI',
            quotaInfo: { remainingFraction: 0.88, resetTime: '2026-11-18T16:00:00Z' },
          },
          {
            label: 'Invalid Model',
            provider: 'MODEL_PROVIDER_OPENAI',
            quotaInfo: { remainingFraction: null },
          },
        ],
      },
    },
  };

  const entries = extractModelQuotaEntries(payload);
  assert.equal(entries.length, 4);

  const snap = buildQuotaSnapshot({ modelEntries: entries });
  assert.equal(snap.available, true);
  assert.equal(snap.gemini.mode, 'single');
  assert.equal(snap.gemini.primary, 62);
  assert.equal(snap.gemini.buckets.length, 2);
  assert.equal(snap.other.mode, 'single');
  assert.equal(snap.other.primary, 72);
  assert.equal(snap.other.buckets[0].models[0], 'Claude Sonnet 4.6');
});

test('quota-core: 当摘要接口提供 5h 与 weekly 双时间窗时启用 dual 模式，缺任一窗时安全降级', () => {
  const summaryPayload = {
    response: {
      groups: [
        {
          displayName: 'Gemini',
          buckets: [
            { displayName: 'Gemini 5h', window: '5h', remainingFraction: 0.81, resetTime: '2026-11-18T15:00:00Z' },
            { displayName: 'Gemini Weekly', window: '7d', remainingFraction: 0.45, resetTime: '2026-11-24T00:00:00Z' },
          ],
        },
        {
          displayName: 'Partner Models',
          buckets: [
            { displayName: 'Claude 5h', window: '5 hours', remainingFraction: 0.34, resetTime: '2026-11-18T15:00:00Z' },
            { displayName: 'Claude Weekly', window: 'weekly', remainingFraction: 0.67, resetTime: '2026-11-24T00:00:00Z' },
          ],
        },
      ],
    },
  };

  const summaryEntries = extractSummaryQuotaEntries(summaryPayload);
  const snap = buildQuotaSnapshot({ summaryEntries });
  assert.equal(snap.gemini.mode, 'dual');
  assert.equal(snap.gemini.fiveHour, 81);
  assert.equal(snap.gemini.weekly, 45);
  assert.equal(snap.gemini.primary, 81);
  assert.equal(snap.other.mode, 'dual');
  assert.equal(snap.other.fiveHour, 34);
  assert.equal(snap.other.weekly, 67);
  assert.equal(snap.other.primary, 34);
});

test('quota-core: 时间戳与百分比边界处理（不把缺失当 0）', () => {
  assert.equal(normalizeRemainingPercent(null), null);
  assert.equal(normalizeRemainingPercent(undefined), null);
  assert.equal(normalizeRemainingPercent(0), 0);
  assert.equal(normalizeRemainingPercent(1.2), 1);
  assert.equal(normalizeRemainingPercent(-0.2), 0);
  assert.equal(parseTimestampMs('bad-date'), null);
  assert.equal(formatResetTime(null), null);
  const formatted = formatResetTime(Date.parse('2026-11-18T14:05:00Z'));
  assert.match(formatted, /^\d{2}\/\d{2} \d{2}:\d{2}$/);
});

test('quota-tap: 旁路监听 fetch (Connect-JSON/JSON) 并在拿到 CSRF 后自动补齐', async () => {
  const receivedModels = [];
  const receivedSummaries = [];
  const calls = [];

  const mockResponsePayload = {
    userStatus: {
      cascadeModelConfigData: {
        clientModelConfigs: [
          {
            label: 'Gemini 4 Hydrogen',
            provider: 'MODEL_PROVIDER_GOOGLE',
            quotaInfo: { remainingFraction: 0.9 },
          },
        ],
      },
    },
  };

  const fakeWin = {
    location: { origin: 'https://127.0.0.1:4321' },
    fetch: async (url, init) => {
      calls.push({ url, headers: init?.headers });
      if (url.includes('RetrieveUserQuotaSummary')) {
        return { ok: false, status: 404 };
      }
      if (url.includes('GetUserStatus')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          clone() {
            return {
              headers: { get: () => 'application/json' },
              json: async () => mockResponsePayload,
            };
          },
          json: async () => mockResponsePayload,
        };
      }
      // 模拟原生另一条携带 csrf header 的请求（Connect-JSON 响应）
      const frame = createConnectFrame({
        clientModelConfigs: [
          {
            label: 'Claude Sonnet 4.6',
            provider: 'MODEL_PROVIDER_ANTHROPIC',
            quotaInfo: { remainingFraction: 0.55 },
          },
        ],
      });
      return {
        ok: true,
        status: 200,
        clone() {
          return {
            headers: { get: () => 'application/connect+json' },
            arrayBuffer: async () => frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength),
          };
        },
      };
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };

  const tap = installQuotaTap(fakeWin, {
    onModelPayload: (p) => receivedModels.push(p),
    onSummaryPayload: (p) => receivedSummaries.push(p),
  });

  // 1) 无 token 时不发请求，标记等待重试
  const initial = await tap.refresh({ force: true });
  assert.equal(initial, false);
  assert.equal(calls.length, 0);

  // 2) 原生发出一条带 CSRF token 的 GetCascadeModelConfigData 请求，应触发旁路解析 + 自动补齐 GetUserStatus
  await fakeWin.fetch('https://127.0.0.1:4321/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData', {
    method: 'POST',
    headers: { 'x-codeium-csrf-token': 'tok-123' },
  });

  await new Promise((r) => setTimeout(r, 30));
  assert.equal(receivedModels.length >= 1, true);
  assert.equal(receivedSummaries.length, 0);
  // 404 后不再重复探测 RetrieveUserQuotaSummary
  const summaryCallsBefore = calls.filter((c) => c.url.includes('RetrieveUserQuotaSummary')).length;
  assert.equal(summaryCallsBefore <= 1, true);

  tap.dispose();
});

test('ui: 左下角按「左圆角方形(其它) + 右圆形(Gemini)」挂载、渲染 1:3 双窗与悬停/点击行为', async () => {
  const { doc, FakeElement } = createFakeDom();
  const sidebar = new FakeElement('aside');
  const footerRow = new FakeElement('div');
  const settingsBtn = new FakeElement('button');
  settingsBtn.appendChild(new FakeElement('svg'));
  settingsBtn.appendChild(doc.createTextNode('设置'));
  footerRow.appendChild(settingsBtn);
  sidebar.appendChild(footerRow);
  doc.body.appendChild(sidebar);

  let settingsClicked = 0;
  let modelsTabClicked = 0;
  let refreshForced = 0;

  settingsBtn.addEventListener('click', () => {
    settingsClicked += 1;
    // 模拟打开设置弹窗并挂载左侧导航标签
    const dialog = new FakeElement('div', { role: 'dialog' });
    const nav = new FakeElement('nav');
    const generalTab = new FakeElement('button');
    generalTab.textContent = '通用';
    const modelsTab = new FakeElement('button');
    modelsTab.textContent = '模型';
    modelsTab.addEventListener('click', () => {
      modelsTabClicked += 1;
    });
    nav.append(generalTab, modelsTab);
    dialog.appendChild(nav);
    doc.body.appendChild(dialog);
  });

  const fakeWin = {
    innerWidth: 1280,
    innerHeight: 800,
    __myAntigravityZhCnInstalled: true,
    getComputedStyle: () => ({ display: 'block', flexDirection: 'column' }),
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };

  assert.equal(findSettingsButton(doc, fakeWin), settingsBtn);

  const ctrl = createQuotaRingsController(fakeWin, doc, {
    onRefreshRequested: (opts) => {
      if (opts?.force) refreshForced += 1;
    },
  });

  ctrl.setSnapshot(
    buildQuotaSnapshot({
      modelEntries: [
        { group: 'other', baseName: 'Claude Sonnet 4.6', remainingPercent: 72, resetAtMs: Date.parse('2026-11-18T15:00:00Z') },
        { group: 'gemini', baseName: 'Gemini 4 Pro', remainingPercent: 90, resetAtMs: Date.parse('2026-11-18T15:00:00Z') },
      ],
      summaryEntries: [
        { group: 'other', baseName: 'Claude 5h', windowKind: 'fiveHour', remainingPercent: 72, resetAtMs: Date.parse('2026-11-18T15:00:00Z') },
        { group: 'other', baseName: 'Claude Weekly', windowKind: 'weekly', remainingPercent: 48, resetAtMs: Date.parse('2026-11-24T00:00:00Z') },
        { group: 'gemini', baseName: 'Gemini 5h', windowKind: 'fiveHour', remainingPercent: 90, resetAtMs: Date.parse('2026-11-18T15:00:00Z') },
        { group: 'gemini', baseName: 'Gemini Weekly', windowKind: 'weekly', remainingPercent: 65, resetAtMs: Date.parse('2026-11-24T00:00:00Z') },
      ],
    }),
  );

  // 验证 inline 挂载到 footerRow 且位于设置按钮右侧
  assert.equal(footerRow.getAttribute('data-ag-qr-host'), 'inline');
  const root = footerRow.querySelector('[data-ag-qr-root]');
  assert.ok(root);
  assert.equal(root.getAttribute('data-my-antigravity-no-i18n'), 'true');
  assert.equal(footerRow.children[0], settingsBtn);
  assert.equal(footerRow.children[1], root);

  const buttons = root.querySelectorAll('button');
  assert.equal(buttons.length, 2);
  // 左侧为其它模型圆角方形，右侧为 Gemini 圆形
  assert.equal(buttons[0].getAttribute('data-ag-qr-group'), 'other');
  assert.equal(buttons[0].getAttribute('data-ag-qr-shape'), 'square');
  assert.equal(buttons[1].getAttribute('data-ag-qr-group'), 'gemini');
  assert.equal(buttons[1].getAttribute('data-ag-qr-shape'), 'circle');

  // 检验 1:3 双窗节点存在与数字
  assert.equal(buttons[0].querySelector('[data-window="fiveHour"]') != null, true);
  const squareWeekly = buttons[0].querySelector('[data-window="weekly"]');
  assert.equal(squareWeekly != null, true);
  assert.equal(squareWeekly.querySelector('.ag-qr-track').getAttribute('d'), 'M 26.29 29.18 A 7 7 0 0 1 23 30 H 9 A 7 7 0 0 1 5.71 29.18');
  assert.equal(buttons[0].querySelector('.ag-qr-number').textContent, '72');
  assert.equal(buttons[1].querySelector('[data-window="fiveHour"]') != null, true);
  assert.equal(buttons[1].querySelector('[data-window="weekly"]') != null, true);
  assert.equal(buttons[1].querySelector('.ag-qr-number').textContent, '90');

  // 检验键盘聚焦立即显示 Tooltip，Escape 关闭
  buttons[0].dispatchEvent({ type: 'focus' });
  const tooltip = doc.body.querySelector('[data-ag-qr-tooltip]');
  assert.equal(tooltip.hidden, false);
  assert.equal(tooltip.textContent.includes('其它模型配额'), true);
  assert.equal(tooltip.textContent.includes('72%'), true);
  assert.equal(tooltip.textContent.includes('48%'), true);

  buttons[0].dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(tooltip.hidden, true);

  // 点击环 -> 打开设置并自动切换至「模型」标签页
  buttons[1].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(settingsClicked, 1);
  assert.equal(modelsTabClicked, 1);
  assert.equal(refreshForced, 1);

  ctrl.destroy();
});

test('ui: 单窗口 0% 不绘制进度描边点；非独占父容器自动切换 aligned 并在过窄时隐藏', () => {
  const { doc, FakeElement } = createFakeDom();
  const [svg, num] = buildRingContent(doc, 'square', {
    mode: 'single',
    primary: 0,
    fiveHour: null,
    weekly: null,
  });
  assert.equal(svg.querySelectorAll('.ag-qr-fill').length, 0);
  assert.equal(num.textContent, '0');

  const sidebar = new FakeElement('aside');
  const item1 = new FakeElement('button');
  const settingsBtn = new FakeElement('button');
  settingsBtn.textContent = 'Settings';
  settingsBtn.rect = { left: 10, top: 750, right: 100, bottom: 780, width: 90, height: 30 };
  sidebar.append(item1, settingsBtn);
  doc.body.appendChild(sidebar);

  const fakeWin = {
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle: () => ({ display: 'flex', flexDirection: 'column' }),
    addEventListener() {},
    removeEventListener() {},
  };

  const ctrl = createQuotaRingsController(fakeWin, doc);
  ctrl.setSnapshot(
    buildQuotaSnapshot({
      modelEntries: [
        { group: 'gemini', baseName: 'Gemini 4 Pro', remainingPercent: 100, resetAtMs: null },
      ],
    }),
  );

  const root = doc.body.querySelector('[data-ag-qr-root]');
  assert.equal(root.getAttribute('data-ag-qr-mode'), 'aligned');
  // 宽度 < 130 自动折叠隐藏避免遮挡文字
  assert.equal(root.getAttribute('data-ag-qr-collapsed'), 'true');

  // 宽度恢复正常时，垂直定位应与设置按钮内的 SVG 图标水平中心线重合
  root.rect = { left: 0, top: 0, right: 62, bottom: 26, width: 62, height: 26 };
  const gearIcon = new FakeElement('svg');
  gearIcon.rect = { left: 18, top: 746, right: 34, bottom: 762, width: 16, height: 16 }; // center = 754
  settingsBtn.appendChild(gearIcon);
  settingsBtn.rect = { left: 10, top: 742, right: 230, bottom: 774, width: 220, height: 32 }; // btn center = 758
  ctrl.syncMount();
  assert.equal(root.hasAttribute('data-ag-qr-collapsed'), false);
  // 754 - 26 / 2 = 741.00px
  assert.equal(root.style.top, '741.00px');
  ctrl.destroy();
});

test('build: 构建产物 plugins/quota-rings/index.js 能在主世界沙箱正常初始化', () => {
  const { outPath } = buildQuotaRingsPlugin();
  const code = fs.readFileSync(outPath, 'utf8');
  const { doc } = createFakeDom();

  const sandboxWindow = {
    document: doc,
    location: { origin: 'https://127.0.0.1:4321' },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
  };
  sandboxWindow.window = sandboxWindow;

  const ctx = vm.createContext({
    window: sandboxWindow,
    document: doc,
    console,
    TextDecoder,
    Uint8Array,
    queueMicrotask,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(code, ctx);
  assert.equal(sandboxWindow.__myAntigravityQuotaRingsInstalled, true);
  assert.equal(sandboxWindow.__myAntigravityQuotaTapInstalled, true);
});

test('quota-core & ui: 兼容 Antigravity 2.32.2 的 oneof remaining 与 google-symbols 设置图标', () => {
  const entries = extractSummaryQuotaEntries({
    response: {
      groups: [
        {
          displayName: 'Gemini',
          buckets: [
            {
              bucketId: 'gemini-5h',
              window: '5h',
              remaining: { remainingFraction: 0.72 },
            },
            {
              bucketId: 'gemini-weekly',
              window: 'weekly',
              remaining: { case: 'remainingFraction', value: 0.5 },
            },
          ],
        },
      ],
    },
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].remainingPercent, 72);
  assert.equal(entries[0].windowKind, 'fiveHour');
  assert.equal(entries[1].remainingPercent, 50);
  assert.equal(entries[1].windowKind, 'weekly');

  const { doc, FakeElement } = createFakeDom();
  const sidebar = new FakeElement('div');
  const otherBtn = new FakeElement('button');
  const settingsBtn = new FakeElement('button', { 'data-testid': 'settings-button' });
  const iconSpan = new FakeElement('span', { class: 'google-symbols' });
  iconSpan.textContent = 'settings';
  iconSpan.rect = { left: 18, top: 748, right: 34, bottom: 764, width: 16, height: 16 }; // center = 756
  settingsBtn.appendChild(iconSpan);
  settingsBtn.appendChild(new FakeElement('span'));
  settingsBtn.children[1].textContent = 'Settings';
  settingsBtn.rect = { left: 10, top: 742, right: 230, bottom: 774, width: 220, height: 32 };
  sidebar.append(otherBtn, settingsBtn);
  doc.body.appendChild(sidebar);

  const modelsTab = new FakeElement('button', { 'data-testid': 'settings-nav-item-Models' });
  modelsTab.textContent = 'Models';
  let modelsTabClicked = false;
  modelsTab.addEventListener('click', () => {
    modelsTabClicked = true;
  });
  doc.body.appendChild(modelsTab);

  const fakeWin = {
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle: () => ({ display: 'flex', flexDirection: 'column' }),
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  };

  assert.equal(findSettingsButton(doc, fakeWin), settingsBtn);
  const ctrl = createQuotaRingsController(fakeWin, doc);
  ctrl.setSnapshot(
    buildQuotaSnapshot({
      modelEntries: [{ group: 'gemini', baseName: 'Gemini 4 Hydrogen', remainingPercent: 80, resetAtMs: null }],
    }),
  );
  const root = doc.body.querySelector('[data-ag-qr-root]');
  root.rect = { left: 0, top: 0, right: 62, bottom: 26, width: 62, height: 26 };
  ctrl.syncMount();
  assert.equal(root.style.top, '743.00px');

  ctrl.openModelsSettings();
  assert.equal(modelsTabClicked, true);
  ctrl.destroy();
});
