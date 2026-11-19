import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildSessionStatusPlugin } from '../plugins/session-status/build.mjs';
import {
  applyAgentStateUpdate,
  applyGeneratorMetadataList,
  applyStepsList,
  applyTrajectoryResponse,
  buildStatusSnapshot,
  createConversationStore,
  formatCachePercent,
  formatCompactTokens,
  hydrateFromClientState,
  parseDurationMs,
} from '../plugins/session-status/src/stats-core.js';
import {
  createConnectEnvelopeParser,
  installTransportTap,
} from '../plugins/session-status/src/transport-tap.js';

function createConnectFrame(obj, flags = 0) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const frame = Buffer.alloc(5 + payload.length);
  frame[0] = flags;
  frame.writeUInt32BE(payload.length, 1);
  payload.copy(frame, 5);
  return frame;
}

test('stats-core: 能精确归约回合、TPS、近10轮平均TPS、Token 构成与上下文分组', () => {
  const store = createConversationStore();
  const cid = 'conv-1';

  // 构造 11 个回合，其中第 0 轮无计时、第 1~10 轮有计时，第 11 轮正在运行
  const turns = [];
  const gens = [];
  for (let i = 0; i <= 11; i++) {
    turns.push({
      index: i,
      startStepIndex: i * 2,
      startTime: `2026-11-16T10:00:${String(i).padStart(2, '0')}Z`,
    });
    if (i === 0) {
      // 第 0 轮（最老，不在近 10 轮窗口中）
      gens.push({
        stepIndices: [0],
        chatModel: {
          usage: { inputTokens: '100', outputTokens: '500', cacheReadTokens: '0' },
          streamingDuration: '1s',
          timeToFirstToken: '0.2s',
        },
      });
    } else if (i === 1) {
      // 第 1 轮在近 10 轮窗口内（index 1..10），但缺失流式耗时，不参与 Avg TPS 且不能让第 0 轮补位
      gens.push({
        stepIndices: [2],
        chatModel: {
          usage: { inputTokens: '100', outputTokens: '200', cacheReadTokens: '0' },
          timeToFirstToken: '0.5s',
        },
      });
    } else if (i < 11) {
      // 第 2..10 轮（共 9 轮有效完成回合），每轮 200 output / 2s = 100 tok/s
      gens.push({
        stepIndices: [i * 2],
        chatModel: {
          usage: { inputTokens: '1000', outputTokens: '200', cacheReadTokens: '9000' },
          streamingDuration: '2s',
          timeToFirstToken: { seconds: 1, nanos: 0 },
        },
      });
    } else {
      // 第 11 轮（运行中，不计入已完成 Avg TPS，但自身若已结算可用于最近 TPS）
      gens.push({
        stepIndices: [22],
        chatModel: {
          modelDisplayName: 'Gemini 4 Hydrogen',
          usage: { inputTokens: '500', outputTokens: '120', cacheReadTokens: '4500' },
          streamingDuration: '1.5s',
          timeToFirstToken: '0.4s',
        },
      });
    }
  }

  applyAgentStateUpdate(store, {
    conversationId: cid,
    status: 2,
    fullyIdle: false,
    turnsUpdate: { turns, totalLength: turns.length },
    compactionInfo: { compactedAtStepIndices: [10, 18] },
    contextWindowUsage: {
      estimatedTokensUsed: '110000',
      maxContextTokens: '200000',
      tokenGroups: [
        { name: 'System', type: 'SYSTEM_PROMPT', numTokens: '15000' },
        { name: 'Tools', type: 'TOOLS', numTokens: '15000' },
        { name: 'Chat', type: 'CHAT_MESSAGES', numTokens: '60000' },
        { name: 'Subagent', type: 'SUBAGENTS', numTokens: '5000' },
      ],
    },
    costSummary: {
      total: {
        cumulativeTotal: {
          input: { tokens: '3880', estimatedCostUsd: 0.02 },
          cacheRead: { tokens: '141326', estimatedCostUsd: 0.04 },
          output: { tokens: '2600', estimatedCostUsd: 0.03 },
          thinking: { tokens: '1000', estimatedCostUsd: 0.01 },
          response: { tokens: '1600', estimatedCostUsd: 0.02 },
          generationCount: 12,
          estimatedCostUsd: 0.09,
        },
        subagent: {
          estimatedCostUsd: 0.015,
        },
      },
      pricing: { modelName: 'Gemini 4 Hydrogen' },
    },
    mainTrajectoryUpdate: {
      stepsUpdate: { totalLength: 24 },
      generatorMetadatasUpdate: {
        pageBounds: { startIndex: 0, endIndexExclusive: gens.length },
        indices: gens.map((_, i) => i),
        generatorMetadatas: gens,
        totalLength: gens.length,
      },
    },
  });

  const snap = buildStatusSnapshot(store.get(cid));
  assert.equal(snap.turns, 12);
  assert.equal(snap.steps, 12);
  assert.equal(snap.trajectorySteps, 24);
  assert.equal(snap.observedTps, 80); // 120 / 1.5s = 80 tok/s
  assert.equal(snap.averageTps, 100); // 9 轮有效完成回合均为 100 tok/s，第 0 轮未补位
  assert.equal(snap.averageTpsTurns, 9);
  assert.equal(snap.totalTokens, 3880 + 141326 + 2600);
  assert.equal(Math.round(snap.cacheHitPercent), 97); // 141326 / (3880 + 141326) = 97.33%
  assert.equal(snap.contextPercent, 55); // 110000 / 200000
  assert.equal(snap.compactions, 2);
  assert.deepEqual(snap.contextGroups, {
    systemAndTools: 30000,
    messages: 60000,
    subagents: 5000,
    other: 15000,
  });
  assert.equal(snap.modelName, 'Gemini 4 Hydrogen');
  assert.equal(snap.estimatedCostUsd, 0.09);
  assert.equal(snap.subagentCostUsd, 0.015);
});

test('stats-core: 空闲时最新响应缺失有效计时应显示 null，运行中则暂沿用上一次有效响应', () => {
  const store = createConversationStore();
  applyAgentStateUpdate(store, {
    conversationId: 'c1',
    fullyIdle: false,
    mainTrajectoryUpdate: {
      generatorMetadatasUpdate: {
        indices: [0, 1],
        totalLength: 2,
        generatorMetadatas: [
          { chatModel: { usage: { outputTokens: 100 }, streamingDuration: '2s' } },
          { chatModel: { usage: { outputTokens: 50 } } },
        ],
      },
    },
  });
  assert.equal(buildStatusSnapshot(store.get('c1')).observedTps, 50);

  // 变为完全空闲后仍缺计时，严格显示 null（不伪造）
  applyAgentStateUpdate(store, { conversationId: 'c1', fullyIdle: true });
  assert.equal(buildStatusSnapshot(store.get('c1')).observedTps, null);
});

test('stats-core: hydrateFromClientState、applyTrajectoryResponse 与格式化函数边界行为正确', () => {
  assert.equal(parseDurationMs('0.25s'), 250);
  assert.equal(parseDurationMs({ seconds: 2, nanos: 500_000_000 }), 2500);
  assert.equal(parseDurationMs('-1s'), null);
  assert.equal(formatCachePercent(99.46), '99.5%');
  assert.equal(formatCachePercent(100), '100%');
  assert.equal(formatCachePercent(98.2), '98%');
  assert.equal(formatCompactTokens(18_500_000), '18.5M');
  assert.equal(formatCompactTokens(999_960), '1M');
  assert.equal(formatCompactTokens(12_340), '12.3K');

  const store = createConversationStore();
  hydrateFromClientState(store, {
    conversationId: 'c-hydrate',
    fullyIdle: true,
    turns: { 0: { startStepIndex: 0, startTimeMs: 1000 } },
    compactedAtStepIndices: [4],
    contextWindowUsage: { estimatedTokensUsed: 50000, maxContextTokens: 100000 },
    trajectorySlice: {
      totalStepsLength: 8,
      totalGeneratorMetadataLength: 3,
      generatorMetadataSlice: { startIndex: -1 },
      generatorMetadatasInSlice: [
        { chatModel: { usage: { outputTokens: 300 }, streamingDuration: '3s' } },
      ],
    },
  });
  const snap = buildStatusSnapshot(store.get('c-hydrate'));
  assert.equal(snap.turns, 1);
  assert.equal(snap.steps, 3);
  assert.equal(snap.observedTps, 100);
  assert.equal(snap.contextPercent, 50);
  assert.equal(snap.compactions, 1);

  applyTrajectoryResponse(store, 'c-traj', {
    trajectory: {
      steps: [{}, {}, {}],
      generatorMetadata: [{ chatModel: { usage: { outputTokens: 60 }, streamingDuration: '2s' } }],
    },
  });
  assert.equal(buildStatusSnapshot(store.get('c-traj')).observedTps, 30);
});

test('transport-tap: Connect 流式分片解析、WebSocket 与 fetch 旁路监听互不干扰', async () => {
  const parsed = [];
  const parser = createConnectEnvelopeParser((msg) => parsed.push(msg));
  const f1 = createConnectFrame({ update: { conversationId: 'c1', fullyIdle: true } }, 0);
  const fTrailer = createConnectFrame({ error: {} }, 128);
  const combined = Buffer.concat([f1, fTrailer]);
  // 按任意字节切分推送
  parser.push(combined.subarray(0, 7));
  parser.push(combined.subarray(7, 20));
  parser.push(combined.subarray(20));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].update.conversationId, 'c1');

  // 模拟 WebSocket 与 fetch 环境
  const receivedUpdates = [];
  class FakeWS {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      this.sent = [];
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    send(data) {
      this.sent.push(data);
    }
    emit(type, evt) {
      for (const fn of this.listeners.get(type) || []) fn(evt);
    }
  }
  const fakeFrame = createConnectFrame({ update: { conversationId: 'c-fetch', turnsUpdate: { totalLength: 4, turns: [] } } });
  const fakeWin = {
    WebSocket: FakeWS,
    async fetch() {
      let idx = 0;
      const chunks = [fakeFrame.subarray(0, 10), fakeFrame.subarray(10)];
      const makeReader = () => ({
        async read() {
          if (idx >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[idx++] };
        },
      });
      return {
        ok: true,
        headers: { get: () => 'application/connect+json' },
        clone() {
          return {
            ok: true,
            headers: { get: () => 'application/connect+json' },
            body: { getReader: makeReader },
          };
        },
      };
    },
  };

  installTransportTap(fakeWin, {
    onAgentStateUpdate: (u) => receivedUpdates.push(u),
  });

  const ws = new fakeWin.WebSocket('wss://127.0.0.1:9999/connect-websocket');
  assert.ok(ws instanceof FakeWS);
  assert.equal(fakeWin.WebSocket.OPEN, 1);
  ws.send(JSON.stringify({
    streamId: 's1',
    type: 'start',
    procedure: '/exa.language_server_pb.LanguageServerService/StreamAgentStateUpdates',
    payload: { conversationId: 'c-ws' },
  }));
  ws.emit('message', {
    data: JSON.stringify({
      streamId: 's1',
      type: 'data',
      payload: { update: { conversationId: 'c-ws', contextWindowUsage: { estimatedTokensUsed: 40, maxContextTokens: 100 } } },
    }),
  });
  assert.equal(receivedUpdates.length, 1);
  assert.equal(receivedUpdates[0].conversationId, 'c-ws');

  await fakeWin.fetch('https://127.0.0.1:9999/exa.language_server_pb.LanguageServerService/StreamAgentStateUpdates', {
    method: 'POST',
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(receivedUpdates.length, 2);
  assert.equal(receivedUpdates[1].conversationId, 'c-fetch');
});

test('打包后的 session-status/index.js 能在主世界挂接输入框、响应收起展开与明细浮窗', () => {
  buildSessionStatusPlugin();
  const code = fs.readFileSync(path.resolve('plugins/session-status/index.js'), 'utf8');

  class FakeNode {
    constructor(nodeType, ownerDocument) {
      this.nodeType = nodeType;
      this.ownerDocument = ownerDocument;
      this.parentElement = null;
      this.childNodes = [];
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === this.ownerDocument.documentElement) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    append(...nodes) {
      for (const n of nodes) {
        const node = typeof n === 'string' ? new FakeText(n, this.ownerDocument) : n;
        node.remove?.();
        node.parentElement = this;
        this.childNodes.push(node);
      }
    }
    insertBefore(newNode, refNode) {
      newNode.remove?.();
      newNode.parentElement = this;
      const idx = refNode ? this.childNodes.indexOf(refNode) : -1;
      if (idx === -1) this.childNodes.push(newNode);
      else this.childNodes.splice(idx, 0, newNode);
      return newNode;
    }
    insertAdjacentElement(pos, el) {
      if (pos === 'afterend' && this.parentElement) {
        el.remove?.();
        el.parentElement = this.parentElement;
        const idx = this.parentElement.childNodes.indexOf(this);
        this.parentElement.childNodes.splice(idx + 1, 0, el);
      }
      return el;
    }
    replaceChildren(...nodes) {
      for (const c of this.childNodes) c.parentElement = null;
      this.childNodes = [];
      this.append(...nodes);
    }
    remove() {
      if (!this.parentElement) return;
      const idx = this.parentElement.childNodes.indexOf(this);
      if (idx !== -1) this.parentElement.childNodes.splice(idx, 1);
      this.parentElement = null;
    }
  }

  class FakeText extends FakeNode {
    constructor(text, doc) {
      super(3, doc);
      this.nodeValue = text;
    }
    get textContent() {
      return this.nodeValue;
    }
  }

  class FakeElement extends FakeNode {
    constructor(tagName, doc, attrs = {}) {
      super(1, doc);
      this.tagName = tagName.toUpperCase();
      this.attrs = {};
      this.dataset = {};
      this.style = {};
      this.listeners = new Map();
      this.hidden = false;
      this._text = '';
      this.classList = {
        _set: new Set(),
        add: (...cls) => cls.forEach((c) => this.classList._set.add(c)),
        contains: (c) => (this.attrs.class || '').split(/\s+/).includes(c) || this.classList._set.has(c),
      };
      for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
    }
    set className(v) {
      this.setAttribute('class', v);
    }
    get className() {
      return this.attrs.class || '';
    }
    set textContent(v) {
      this.childNodes = [];
      this._text = String(v ?? '');
    }
    get textContent() {
      if (this.childNodes.length === 0) return this._text;
      return this.childNodes.map((c) => c.textContent ?? '').join('');
    }
    set innerHTML(html) {
      this.childNodes = [];
      this._text = '';
      this._rawHtml = html;
      if (html.includes('<svg')) {
        const svg = new FakeElement('svg', this.ownerDocument);
        this.append(svg);
      }
    }
    insertAdjacentHTML(_pos, html) {
      if (html.includes('<svg')) {
        this.append(new FakeElement('svg', this.ownerDocument));
      }
    }
    setAttribute(name, val) {
      this.attrs[name] = String(val);
      if (name === 'hidden') this.hidden = true;
    }
    getAttribute(name) {
      return this.attrs[name] ?? null;
    }
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    }
    dispatchEvent(evt) {
      evt.target = evt.target || this;
      evt.stopPropagation = evt.stopPropagation || (() => {});
      for (const fn of this.listeners.get(evt.type) || []) fn(evt);
    }
    getClientRects() {
      return this.hidden ? [] : [{ left: 0, top: 0, width: 400, height: 100 }];
    }
    getBoundingClientRect() {
      return { left: 100, top: 600, right: 200, bottom: 622, width: 100, height: 22 };
    }
    matches(sel) {
      for (const raw of sel.split(',').map((s) => s.trim())) {
        if (raw === '.agy-composer-footer > div:last-child') {
          if (
            this.tagName === 'DIV' &&
            this.parentElement?.classList.contains('agy-composer-footer') &&
            this.parentElement.childNodes.filter((n) => n.nodeType === 1).at(-1) === this
          ) {
            return true;
          }
          continue;
        }
        if (raw.startsWith('#')) {
          const id = raw.slice(1).replace(/\\\./g, '.');
          if (this.attrs.id === id) return true;
        } else if (raw.startsWith('.')) {
          if (this.classList.contains(raw.slice(1))) return true;
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
          const inner = raw.slice(1, -1);
          const eq = inner.indexOf('=');
          if (eq === -1) {
            if (this.hasAttribute(inner)) return true;
          } else {
            const k = inner.slice(0, eq);
            const v = inner.slice(eq + 1).replace(/^"|"$/g, '');
            if (this.getAttribute(k) === v) return true;
          }
        } else if (this.tagName.toLowerCase() === raw.toLowerCase()) {
          return true;
        }
      }
      return false;
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches?.(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType === 1) {
            if (c.matches(sel)) out.push(c);
            walk(c);
          }
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
  }

  const doc = {
    readyState: 'complete',
    listeners: new Map(),
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    removeEventListener() {},
    dispatchEvent(evt) {
      for (const fn of this.listeners.get(evt.type) || []) fn(evt);
    },
    createElement: (tag) => new FakeElement(tag, doc),
    createElementNS: (_ns, tag) => new FakeElement(tag, doc),
    querySelectorAll: (sel) => doc.documentElement.querySelectorAll(sel),
  };
  doc.documentElement = new FakeElement('html', doc, { lang: 'en' });
  doc.body = new FakeElement('body', doc);
  doc.documentElement.append(doc.body);

  // 构建模拟 Antigravity 输入框 DOM 并挂上 React Fiber props
  const inputBox = new FakeElement('div', doc, { 'data-testid': 'agent-input-box' });
  const card = new FakeElement('div', doc, { id: 'antigravity.agentSidePanelInputBox', class: 'surface-composer' });
  const footer = new FakeElement('div', doc, { class: 'agy-composer-footer' });
  const footerLeft = new FakeElement('div', doc);
  const footerRight = new FakeElement('div', doc);
  footer.append(footerLeft, footerRight);
  card.append(footer);
  inputBox.append(card);
  inputBox.__reactFiber$test = {
    memoizedProps: { cascadeId: 'conv-ui-1', inExistingConversation: true },
    return: null,
  };
  doc.body.append(inputBox);

  const storageMap = new Map();
  class FakeWS {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) {
      this.url = url;
      this._listeners = new Map();
    }
    addEventListener(type, fn) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(fn);
    }
    send() {}
    emit(type, evt) {
      for (const fn of this._listeners.get(type) || []) fn(evt);
    }
  }

  const winListeners = new Map();
  const win = {
    __myAntigravityZhCnInstalled: true,
    innerWidth: 1280,
    innerHeight: 800,
    WebSocket: FakeWS,
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener() {},
    getComputedStyle: () => ({ display: 'flex', visibility: 'visible' }),
    requestAnimationFrame: (fn) => fn(),
  };

  vm.runInNewContext(code, { window: win, document: doc, console, Intl, Math, Map, Set, Object, Array, Promise, TextDecoder, Uint8Array, Number, String, Boolean, JSON, Date, queueMicrotask });

  // 触发 WebSocket 流推送
  const ws = new win.WebSocket('wss://127.0.0.1:1234/connect-websocket');
  ws.send(JSON.stringify({
    streamId: 'st-1',
    type: 'start',
    procedure: '/exa.language_server_pb.LanguageServerService/StreamAgentStateUpdates',
    payload: { conversationId: 'conv-ui-1' },
  }));
  ws.emit('message', {
    data: JSON.stringify({
      streamId: 'st-1',
      type: 'data',
      payload: {
        update: {
          conversationId: 'conv-ui-1',
          fullyIdle: true,
          turnsUpdate: { totalLength: 19, turns: [{ index: 18, startStepIndex: 0 }] },
          contextWindowUsage: { estimatedTokensUsed: 110000, maxContextTokens: 200000 },
          costSummary: {
            total: {
              cumulativeTotal: {
                input: { tokens: '370000' },
                cacheRead: { tokens: '18130000' },
                output: { tokens: '1000' },
                generationCount: 118,
              },
            },
          },
          mainTrajectoryUpdate: {
            generatorMetadatasUpdate: {
              indices: [117],
              totalLength: 118,
              generatorMetadatas: [
                {
                  stepIndices: [0],
                  chatModel: { usage: { outputTokens: 120 }, streamingDuration: '10s' },
                },
              ],
            },
          },
        },
      },
    }),
  });

  const bar = doc.querySelectorAll('[data-ag-ss-bar]')[0];
  assert.ok(bar, '状态栏应已挂载');
  assert.equal(bar.hidden, false);
  assert.equal(bar.getAttribute('data-my-antigravity-no-i18n'), 'true');
  assert.equal(bar.querySelector('[data-ag-ss-kind="statistics"]').textContent, '19 回合 118 步 · 12 tok/s');
  assert.equal(bar.querySelector('[data-ag-ss-kind="usage"]').textContent, '18.5M · 缓存 98%');
  assert.equal(bar.querySelector('[data-ag-ss-kind="context"]').textContent, '55%');

  // 点击统计按钮弹出浮窗，Escape 关闭
  bar.querySelector('[data-ag-ss-kind="statistics"]').dispatchEvent({ type: 'click' });
  assert.equal(doc.querySelectorAll('[data-ag-ss-popover]').length, 1);
  for (const fn of winListeners.get('keydown') || []) fn({ key: 'Escape' });
  assert.equal(doc.querySelectorAll('[data-ag-ss-popover]').length, 0);

  // 点击收起按钮隐藏状态栏并显示右下角小环，持久化 localStorage
  bar.querySelector('[data-ag-ss-action="collapse"]').dispatchEvent({ type: 'click' });
  assert.equal(bar.hidden, true);
  const trigger = doc.querySelectorAll('[data-ag-ss-trigger]')[0];
  assert.equal(trigger.hidden, false);
  assert.equal(storageMap.get('my_antigravity:session-status:expanded'), 'false');

  // 点击小环重新展开
  trigger.dispatchEvent({ type: 'click' });
  assert.equal(bar.hidden, false);
  assert.equal(trigger.hidden, true);
});

test('stats-core 与 transport-tap: 无 costSummary 且无 streamingDuration 时可通过 GeneratorMetadata 与步骤时间戳回退计算 Token/缓存与 TPS', async () => {
  const store = createConversationStore();
  const cid = 'conv-no-cost';

  // 模拟 S2a 解码格式（metadata: { case: 'chatModel', value }）且不含 costSummary
  hydrateFromClientState(store, {
    conversationId: cid,
    fullyIdle: true,
    turns: { 0: { startStepIndex: 0 }, 1: { startStepIndex: 2 } },
    contextWindowUsage: { estimatedTokensUsed: 80000, maxContextTokens: 200000 },
    trajectorySlice: {
      totalStepsLength: 4,
      totalGeneratorMetadataLength: 2,
      generatorMetadataSlice: { startIndex: -1 },
      generatorMetadatasInSlice: [
        {
          stepIndices: [3],
          metadata: {
            case: 'chatModel',
            value: {
              usage: { inputTokens: 1000, cacheReadTokens: 9000, outputTokens: 200 },
              chatStartMetadata: { createdAt: '2026-11-16T10:00:10Z', startStepIndex: 3 },
            },
          },
        },
      ],
    },
  });

  // 尚未补齐前，不应把单条 metadata 当作会话总量
  let snap = buildStatusSnapshot(store.get(cid));
  assert.equal(snap.totalTokens, null);

  // 通过 backfillConversation 模拟调用 GetCascadeTrajectoryGeneratorMetadata 与 GetCascadeTrajectorySteps
  const fakeWin = {
    location: { origin: 'https://127.0.0.1:1234' },
    __APP_CONFIG__: { csrfToken: 'csrf-123' },
    WebSocket: class {},
    async fetch(url, init) {
      assert.equal(init.headers['x-codeium-csrf-token'], 'csrf-123');
      if (url.includes('GetCascadeTrajectoryGeneratorMetadata')) {
        const body = JSON.parse(init.body);
        if (body.generatorMetadataOffset === 0) {
          return {
            ok: true,
            async json() {
              return {
                generatorMetadata: [
                  {
                    stepIndices: [1],
                    chatModel: {
                      usage: { inputTokens: '500', cacheReadTokens: '4500', outputTokens: '100' },
                      chatStartMetadata: { createdAt: '2026-11-16T10:00:00Z', startStepIndex: 1 },
                    },
                  },
                  {
                    stepIndices: [3],
                    chatModel: {
                      usage: { inputTokens: '1000', cacheReadTokens: '9000', outputTokens: '200' },
                      chatStartMetadata: { createdAt: '2026-11-16T10:00:10Z', startStepIndex: 3 },
                    },
                  },
                ],
              };
            },
          };
        }
        return { ok: true, async json() { return { generatorMetadata: [] }; } };
      }
      if (url.includes('GetCascadeTrajectorySteps')) {
        return {
          ok: true,
          async json() {
            return {
              steps: [
                { metadata: { createdAt: '2026-11-16T10:00:00Z' } },
                { metadata: { createdAt: '2026-11-16T10:00:02Z', startedAt: '2026-11-16T10:00:00Z', finishedGeneratingAt: '2026-11-16T10:00:02Z' } },
                { metadata: { createdAt: '2026-11-16T10:00:09Z' } },
                { metadata: { createdAt: '2026-11-16T10:00:14Z', startedAt: '2026-11-16T10:00:10Z', finishedGeneratingAt: '2026-11-16T10:00:14Z' } },
              ],
            };
          },
        };
      }
      return { ok: false };
    },
  };

  const stop = installTransportTap(fakeWin, {
    onGeneratorMetadata: (id, list, offset, end) => applyGeneratorMetadataList(store, id, list, offset, end),
    onSteps: (id, list, offset, hyd) => applyStepsList(store, id, list, offset, hyd),
  });

  const changed = await stop.backfillConversation(cid, store.get(cid));
  assert.equal(changed, true);

  snap = buildStatusSnapshot(store.get(cid));
  assert.equal(snap.totalTokens, 1500 + 13500 + 300); // 15,300
  assert.equal(Math.round(snap.cacheHitPercent), 90); // 13500 / 15000
  assert.equal(snap.observedTps, 50); // 200 / 4s = 50 tok/s
  assert.equal(snap.averageTps, 50); // turn0: 100/2s=50, turn1: 200/4s=50
  assert.equal(snap.speedSource, 'step-timing');
});

test('ui: 展开/收起时触发 FLIP 与状态栏 WAAPI 过渡，且中途反向可无缝取消旧动画并清理样式', async () => {
  const { createSessionStatusController } = await import('../plugins/session-status/src/ui.js');
  const store = createConversationStore();
  applyAgentStateUpdate(store, {
    conversationId: 'conv-anim',
    fullyIdle: true,
    turnsUpdate: { totalLength: 2, turns: [{ index: 0, startStepIndex: 0 }] },
  });

  const animCalls = [];
  class AnimEl {
    constructor(tag, doc, attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.ownerDocument = doc;
      this.parentElement = null;
      this.childNodes = [];
      this.attrs = {};
      this.dataset = {};
      this.style = {};
      this.listeners = new Map();
      this.hidden = false;
      this.classList = {
        _set: new Set(),
        add: (...c) => c.forEach((x) => this.classList._set.add(x)),
        contains: (c) => (this.attrs.class || '').split(/\s+/).includes(c) || this.classList._set.has(c),
      };
      for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === this.ownerDocument.documentElement) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    set className(v) { this.setAttribute('class', v); }
    get className() { return this.attrs.class || ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'hidden') this.hidden = true; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
    append(...nodes) {
      for (const n of nodes) {
        if (typeof n === 'string') continue;
        n.remove?.();
        n.parentElement = this;
        this.childNodes.push(n);
      }
    }
    insertBefore(n, ref) {
      n.remove?.();
      n.parentElement = this;
      const idx = ref ? this.childNodes.indexOf(ref) : -1;
      if (idx === -1) this.childNodes.push(n);
      else this.childNodes.splice(idx, 0, n);
      return n;
    }
    insertAdjacentElement(pos, el) {
      if (pos === 'afterend' && this.parentElement) {
        el.remove?.();
        el.parentElement = this.parentElement;
        const idx = this.parentElement.childNodes.indexOf(this);
        this.parentElement.childNodes.splice(idx + 1, 0, el);
      }
      return el;
    }
    insertAdjacentHTML() {}
    replaceChildren(...n) { this.childNodes = []; this.append(...n); }
    remove() {
      if (!this.parentElement) return;
      const idx = this.parentElement.childNodes.indexOf(this);
      if (idx !== -1) this.parentElement.childNodes.splice(idx, 1);
      this.parentElement = null;
    }
    addEventListener(t, fn) {
      if (!this.listeners.has(t)) this.listeners.set(t, []);
      this.listeners.get(t).push(fn);
    }
    removeEventListener() {}
    dispatchEvent(evt) {
      evt.target = evt.target || this;
      evt.stopPropagation = evt.stopPropagation || (() => {});
      for (const fn of this.listeners.get(evt.type) || []) fn(evt);
    }
    getClientRects() { return this.hidden ? [] : [{ left: 0, top: 0, width: 400, height: 100 }]; }
    getBoundingClientRect() {
      if (this.hasAttribute('data-ag-ss-bar')) {
        return { left: 10, top: 500, width: 380, height: 24 };
      }
      if (this.attrs.id === 'antigravity.agentSidePanelInputBox') {
        const bar = this.parentElement?.querySelector('[data-ag-ss-bar]');
        const barVisible = bar && !bar.hidden && bar.style.position !== 'fixed';
        return { left: 10, top: barVisible ? 400 : 424, width: 380, height: 100 };
      }
      if (this.parentElement?.classList.contains('agy-composer-footer')) {
        const trig = this.querySelector('[data-ag-ss-trigger]');
        const trigVisible = trig && !trig.hidden;
        return { left: trigVisible ? 300 : 324, top: 470, width: 80, height: 28 };
      }
      return { left: 0, top: 0, width: 100, height: 24 };
    }
    animate(keyframes, options) {
      const rec = { el: this, keyframes, options, cancelled: false, cancel() { rec.cancelled = true; } };
      animCalls.push(rec);
      return rec;
    }
    matches(sel) {
      for (const raw of sel.split(',').map((s) => s.trim())) {
        if (raw === '.agy-composer-footer > div:last-child') {
          if (
            this.tagName === 'DIV' &&
            this.parentElement?.classList.contains('agy-composer-footer') &&
            this.parentElement.childNodes.at(-1) === this
          ) return true;
          continue;
        }
        if (raw.startsWith('#')) {
          if (this.attrs.id === raw.slice(1).replace(/\\\./g, '.')) return true;
        } else if (raw.startsWith('.')) {
          if (this.classList.contains(raw.slice(1))) return true;
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
          const inner = raw.slice(1, -1);
          const eq = inner.indexOf('=');
          if (eq === -1 ? this.hasAttribute(inner) : this.getAttribute(inner.slice(0, eq)) === inner.slice(eq + 1).replace(/^"|"$/g, '')) return true;
        } else if (this.tagName.toLowerCase() === raw.toLowerCase()) return true;
      }
      return false;
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches?.(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const c of n.childNodes) {
          if (c.matches?.(sel)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }

  const doc = {
    addEventListener() {},
    removeEventListener() {},
    createElement: (t) => new AnimEl(t, doc),
    createElementNS: (_ns, t) => new AnimEl(t, doc),
    querySelectorAll: (s) => doc.documentElement.querySelectorAll(s),
  };
  doc.documentElement = new AnimEl('html', doc, { lang: 'zh-CN' });
  doc.body = new AnimEl('body', doc);
  doc.documentElement.append(doc.body);

  const inputBox = new AnimEl('div', doc, { 'data-testid': 'agent-input-box' });
  const card = new AnimEl('div', doc, { id: 'antigravity.agentSidePanelInputBox', class: 'surface-composer' });
  const footer = new AnimEl('div', doc, { class: 'agy-composer-footer' });
  footer.append(new AnimEl('div', doc), new AnimEl('div', doc));
  card.append(footer);
  inputBox.append(card);
  inputBox.__reactFiber$test = { memoizedProps: { cascadeId: 'conv-anim', inExistingConversation: true }, return: null };
  doc.body.append(inputBox);

  const storageMap = new Map();
  let nextTimerId = 1;
  const timers = new Map();
  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
    },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ display: 'flex', visibility: 'visible', opacity: '1' }),
    setTimeout: (fn) => {
      const id = nextTimerId++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener() {},
    removeEventListener() {},
  };

  const ctrl = createSessionStatusController(win, doc, store);
  ctrl.scanComposers();
  const bar = doc.querySelectorAll('[data-ag-ss-bar]')[0];
  const trigger = doc.querySelectorAll('[data-ag-ss-trigger]')[0];
  assert.equal(bar.hidden, false);

  // 点击收起：触发 card/footerRight FLIP、bar 退出与 trigger 入场动画
  bar.querySelector('[data-ag-ss-action="collapse"]').dispatchEvent({ type: 'click' });
  assert.equal(bar.style.position, 'fixed');
  assert.equal(trigger.hidden, false);
  assert.equal(animCalls.length, 4);
  const collapseAnims = [...animCalls];

  // 动画进行中更新数据时不应打断正在进行的收起动画
  ctrl.refreshConversation('conv-anim');
  assert.equal(collapseAnims.every((a) => !a.cancelled), true);
  assert.equal(bar.style.position, 'fixed');

  // 中途反向点击展开：取消旧动画，立即恢复文档流并播放展开动画
  trigger.dispatchEvent({ type: 'click' });
  assert.equal(collapseAnims.every((a) => a.cancelled), true);
  assert.equal(bar.style.position, '');
  assert.equal(bar.hidden, false);
  assert.equal(trigger.hidden, true);
  assert.ok(animCalls.length > 4);

  // 触发定时结算
  for (const fn of [...timers.values()]) fn();
  assert.equal(bar.hidden, false);
  assert.equal(trigger.hidden, true);
  ctrl.destroy();
});
