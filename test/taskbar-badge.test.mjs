import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { getShortSummary } from '../plugins/mod-manager/src/manager-core.js';
import { buildTaskbarBadgePlugin } from '../plugins/taskbar-badge/build.mjs';
import { inspectActiveConversation, installTaskbarBadgePlugin } from '../plugins/taskbar-badge/src/entry.js';
import { installAttentionTransportTap } from '../plugins/taskbar-badge/src/transport-tap.js';
import {
  LEVEL_PRIORITY,
  classifyRunStatus,
  classifyStepStatus,
  createBadgeTracker,
  extractUpdateSignal,
} from '../plugins/taskbar-badge/src/badge-core.js';
import {
  TRAY_DOT_COLORS,
  createIconRenderer,
  drawTaskbarOverlayIcon,
  drawTrayDottedIcon,
} from '../plugins/taskbar-badge/src/icon-renderer.js';

function createConnectFrame(obj, flags = 0) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const frame = Buffer.alloc(5 + payload.length);
  frame[0] = flags;
  frame.writeUInt32BE(payload.length, 1);
  payload.copy(frame, 5);
  return frame;
}

test('WebSocket 重连首帧补发完成，历史状态与已关闭的连接不重复发提醒', () => {
  class MockSocket extends EventTarget {
    send() {}
    receive(update) {
      this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type: 'data', streamId: '1', payload: { update } }),
      }));
    }
  }
  const win = { WebSocket: MockSocket };
  const tracker = createBadgeTracker();
  installAttentionTransportTap(win, { onAgentStateUpdate: tracker.applyUpdate });
  function connect() {
    const socket = new win.WebSocket('ws://localhost/connect-websocket');
    socket.send(JSON.stringify({ type: 'start', streamId: '1', procedure: 'StreamAgentStateUpdates' }));
    return socket;
  }
  const first = connect();
  first.receive({ conversationId: 'background', status: 2 });
  first.dispatchEvent(new Event('close'));
  const current = connect();
  current.receive({ conversationId: 'background', status: 1 });
  assert.equal(tracker.getSnapshot().level, 'completed');
  first.receive({ conversationId: 'other', status: 'ERROR' });
  assert.equal(tracker.getSnapshot().count, 1);
});

test('旧快照无法把已查看的实时提醒重新加回来，新的实时回合仍可提醒', () => {
  const tracker = createBadgeTracker();
  const apply = (status, source, generation) => tracker.applyUpdate(
    { conversationId: 'background', status }, { source, generation },
  );
  apply(2, 'manager');
  apply('ERROR', 'stream', 2);
  tracker.markConversationViewed('background');
  apply(2, 'stream', 1);
  apply(2, 'manager');
  apply(2, 'trajectory');
  apply('ERROR', 'stream', 2);
  assert.equal(tracker.getSnapshot().count, 0);
  apply(2, 'stream', 2);
  apply('ERROR', 'stream', 2);
  assert.equal(tracker.getSnapshot().count, 1);
});

test('fetch 轨迹请求晚到时保留新请求的结果', async () => {
  const pending = [];
  const win = { fetch: () => new Promise((resolve) => pending.push(resolve)) };
  const tracker = createBadgeTracker();
  installAttentionTransportTap(win, {
    onTrajectory: (cid, payload, meta) => tracker.applyUpdate({ conversationId: cid, status: payload.status }, meta),
  });
  const request = () => win.fetch('http://localhost/GetCascadeTrajectory');
  const response = (status) => ({
    ok: true,
    clone: () => ({
      headers: { get: () => 'application/json' },
      json: async () => ({ trajectory: { cascadeId: 'background' }, status }),
    }),
  });
  const older = request();
  const newer = request();
  pending[1](response(1));
  await newer;
  pending[0](response(2));
  await older;
  const next = request();
  pending[2](response(1));
  await next;
  await new Promise(setImmediate);
  assert.equal(tracker.getSnapshot().count, 0);
});

test('分栏按会话焦点判断，切到会话外时不随 DOM 顺序清除提醒', () => {
  const box = (cascadeId) => ({ __reactFiber$test: { memoizedProps: { cascadeId } } });
  const left = box('left');
  const right = box('right');
  const outside = {};
  const doc = {
    activeElement: right,
    querySelectorAll: (selector) => selector.includes('agent-input-box') ? [left, right] : [],
  };
  assert.equal(inspectActiveConversation(doc).conversationId, 'right');
  doc.activeElement = outside;
  assert.equal(inspectActiveConversation(doc).conversationId, null);
  assert.equal(inspectActiveConversation(doc, null, right).conversationId, 'right');
});

test('托盘底图与任务栏 IPC 独立恢复，相同计数也会重试', async () => {
  let baseAttempts = 0;
  const calls = [];
  const retryCallbacks = new Map();
  let timerId = 0;
  const win = {
    setTimeout(fn, delay) {
      retryCallbacks.set(++timerId, { fn, delay });
      return timerId;
    },
    clearTimeout(id) { retryCallbacks.delete(id); },
    Image: class {
      set src(_) { queueMicrotask(() => this.onload()); }
    },
    __myAntigravityAttention: {
      async getBaseIcon() {
        if (++baseAttempts === 1) throw Error('temporary failure');
        return { ok: true, dataUrl: 'data:image/png;base64,BASE' };
      },
      async setAttentionState(payload) {
        calls.push(payload);
        return calls.length === 1 ? { ok: false } : { ok: true };
      },
    },
  };
  const ctx = new Proxy({}, { get: () => () => {} });
  const doc = { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:image/png;base64,TRAY' }) };
  const plugin = installTaskbarBadgePlugin(win, doc);
  plugin.tracker.applyUpdate({ conversationId: 'background', status: 'ERROR' });
  await plugin.flushIconsNow();
  assert.ok(retryCallbacks.size > 0);
  await new Promise(setImmediate);
  assert.equal(calls[0].count, 1);
  assert.equal(calls[0].windowReps.length, 5);
  assert.equal(calls[0].trayPngDataUrl, null);
  await plugin.flushIconsNow();
  await new Promise(setImmediate);
  await plugin.flushIconsNow();
  assert.equal(calls.at(-1).count, 1);
  assert.equal(calls.at(-1).trayPngDataUrl, 'data:image/png;base64,TRAY');
  plugin.dispose();
});

test('badge-core: 状态识别、优先级(报错>>提问>>完成)、去重及点开消减归零', () => {
  assert.equal(classifyRunStatus(2), 'running');
  assert.equal(classifyRunStatus(3), 'approval');
  assert.equal(classifyRunStatus(1), 'idle');
  assert.equal(classifyRunStatus('CASCADE_RUN_STATUS_ERROR'), 'error');
  assert.equal(classifyRunStatus('CASCADE_RUN_STATUS_CANCELLED'), 'cancelled');
  assert.equal(classifyStepStatus({ status: 'CORTEX_STEP_STATUS_ERROR' }), 'error');
  assert.equal(classifyStepStatus({ status: 'CORTEX_STEP_STATUS_WAITING' }), 'approval');
  assert.equal(
    extractUpdateSignal({
      status: 1,
      fullyIdle: true,
      mainTrajectoryUpdate: { stepsUpdate: { steps: [{ status: 'CORTEX_STEP_STATUS_ERROR' }] } },
    }),
    'error',
  );

  const tracker = createBadgeTracker({ activeConversationId: 'c-active', windowFocused: true });

  // 正在聚焦查看的会话完成后不应加角标
  tracker.applyUpdate({ conversationId: 'c-active', status: 2, fullyIdle: false });
  let res = tracker.applyUpdate({ conversationId: 'c-active', status: 1, fullyIdle: true });
  assert.equal(res.snapshot.count, 0);
  assert.equal(res.snapshot.level, 'none');

  // 后台会话 c1 完成 -> count=1, level='completed'
  tracker.applyUpdate({ conversationId: 'c1', status: 2, fullyIdle: false });
  res = tracker.applyUpdate({ conversationId: 'c1', status: 1, fullyIdle: true });
  assert.equal(res.changed, true);
  assert.equal(res.snapshot.count, 1);
  assert.equal(res.snapshot.level, 'completed');

  // 同一会话 c1 再次完成不会重复叠加为 2
  tracker.applyUpdate({ conversationId: 'c1', status: 2, fullyIdle: false });
  res = tracker.applyUpdate({ conversationId: 'c1', status: 1, fullyIdle: true });
  assert.equal(res.snapshot.count, 1);

  // c1 随后进入提问审批 -> count 仍为 1，等级升级为 approval
  res = tracker.applyUpdate({ conversationId: 'c1', status: 3, fullyIdle: false });
  assert.equal(res.changed, true);
  assert.equal(res.snapshot.count, 1);
  assert.equal(res.snapshot.level, 'approval');

  // c2 报错 -> count=2，总优先级提升为 error
  tracker.applyUpdate({ conversationId: 'c2', status: 2, fullyIdle: false });
  res = tracker.applyUpdate({
    conversationId: 'c2',
    status: 1,
    fullyIdle: true,
    error: { message: 'boom' },
  });
  assert.equal(res.snapshot.count, 2);
  assert.equal(res.snapshot.level, 'error');

  // c3 完成 -> count=3，总优先级依然维持最高的 error
  tracker.applyUpdate({ conversationId: 'c3', status: 2, fullyIdle: false });
  res = tracker.applyUpdate({ conversationId: 'c3', status: 1, fullyIdle: true });
  assert.equal(res.snapshot.count, 3);
  assert.equal(res.snapshot.level, 'error');

  // 点开 c2（报错会话）-> count=2，最高级回落到 approval (c1)
  res = tracker.setViewingContext({ activeConversationId: 'c2', windowFocused: true });
  assert.equal(res.changed, true);
  assert.equal(res.snapshot.count, 2);
  assert.equal(res.snapshot.level, 'approval');

  // 若 c2 之后再收到同一报错的重复心跳，不应误复活角标
  res = tracker.applyUpdate({
    conversationId: 'c2',
    status: 1,
    fullyIdle: true,
    error: { message: 'boom' },
  });
  assert.equal(res.snapshot.count, 2);

  // 点开 c1（提问会话）-> count=1，最高级回落到 completed (c3)
  res = tracker.setViewingContext({ activeConversationId: 'c1', windowFocused: true });
  assert.equal(res.snapshot.count, 1);
  assert.equal(res.snapshot.level, 'completed');

  // 点开 c3 -> count=0，level='none'
  res = tracker.setViewingContext({ activeConversationId: 'c3', windowFocused: true });
  assert.equal(res.snapshot.count, 0);
  assert.equal(res.snapshot.level, 'none');
});

test('badge-core: 用户取消不计入完成；水合期运行中会话随后完成可正常触发；窗口失焦时当前会话也会计数', () => {
  const tracker = createBadgeTracker({ activeConversationId: 'c-cur', windowFocused: false });

  // 水合阶段已存在的历史报错/空闲不应直接弹窗，但运行中状态应记录 wasActive
  tracker.applyUpdate(
    { conversationId: 'c-old-err', status: 'CASCADE_RUN_STATUS_ERROR', fullyIdle: true },
    { isInitialHydration: true },
  );
  tracker.applyUpdate(
    { conversationId: 'c-running', status: 2, fullyIdle: false },
    { isInitialHydration: true },
  );
  assert.equal(tracker.getSnapshot().count, 0);

  // c-running 完成 -> 触发 completed
  let res = tracker.applyUpdate({ conversationId: 'c-running', status: 1, fullyIdle: true });
  assert.equal(res.snapshot.count, 1);
  assert.equal(res.snapshot.level, 'completed');

  // 用户主动取消 c-cancel -> 不计数
  tracker.applyUpdate({ conversationId: 'c-cancel', status: 2, fullyIdle: false });
  res = tracker.applyUpdate({
    conversationId: 'c-cancel',
    status: 'CASCADE_RUN_STATUS_CANCELLED',
    fullyIdle: true,
  });
  assert.equal(res.snapshot.count, 1);

  // 窗口处于失焦时，连当前所在会话 c-cur 触发审批也会计入；回到窗口聚焦时立即消掉
  tracker.applyUpdate({ conversationId: 'c-cur', status: 3, fullyIdle: false });
  assert.equal(tracker.getSnapshot().count, 2);
  assert.equal(tracker.getSnapshot().level, 'approval');

  res = tracker.setViewingContext({ windowFocused: true });
  assert.equal(res.snapshot.count, 1);
  assert.equal(res.snapshot.level, 'completed');
  assert.ok(LEVEL_PRIORITY.error > LEVEL_PRIORITY.approval);
  assert.ok(LEVEL_PRIORITY.approval > LEVEL_PRIORITY.completed);
});

test('icon-renderer: 托盘保留绿/黄/红状态，按颜色复用底图和 PNG', async () => {
  assert.equal(TRAY_DOT_COLORS.completed, '#22C55E');
  assert.equal(TRAY_DOT_COLORS.approval, '#FACC15');
  assert.equal(TRAY_DOT_COLORS.error, '#EF4444');

  function makeMockCtx() {
    const ops = [];
    return {
      ops,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      clearRect: (...a) => ops.push(['clearRect', ...a]),
      drawImage: (...a) => ops.push(['drawImage', ...a]),
      save: () => ops.push(['save']),
      restore: () => ops.push(['restore']),
      beginPath: () => ops.push(['beginPath']),
      moveTo: () => {},
      arcTo: () => {},
      closePath: () => {},
      arc: (...a) => ops.push(['arc', ...a]),
      fill() {
        ops.push(['fill', this.fillStyle]);
      },
      stroke() {
        ops.push(['stroke', this.strokeStyle]);
      },
      fillText(text) {
        ops.push(['text', text, this.fillStyle]);
      },
    };
  }

  const badgeCtx = makeMockCtx();
  drawTaskbarOverlayIcon(badgeCtx, 103, 'approval', 16);
  assert.ok(badgeCtx.ops.some(([op, color]) => op === 'fill' && color === '#FACC15'));
  assert.ok(badgeCtx.ops.some(([op, text, color]) => op === 'text' && text === '99+' && color === '#111827'));

  const trayCtx = makeMockCtx();
  drawTrayDottedIcon(trayCtx, { fake: true }, 'completed', 64);
  assert.ok(trayCtx.ops.some((op) => op[0] === 'fill' && op[1] === '#22C55E'));
  const arcOp = trayCtx.ops.find((op) => op[0] === 'arc');
  assert.ok(arcOp && arcOp[3] === 16); // 64px 画布下半径 16px（直径 32px）
  assert.ok(arcOp && arcOp[1] + arcOp[3] + 2 <= 64 && arcOp[2] - arcOp[3] - 2 >= 0); // 不越界裁剪

  let getBaseCalls = 0;
  let canvasDraws = 0;
  const mockWin = {
    Image: class MockImage {
      set src(v) {
        this._src = v;
        queueMicrotask(() => this.onload?.());
      }
    },
  };
  const mockDoc = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const ctx = makeMockCtx();
      return {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: () => {
          canvasDraws += 1;
          return `data:image/png;base64,FAKE_${canvasDraws}`;
        },
      };
    },
  };
  const renderer = createIconRenderer(mockWin, mockDoc, {
    getBaseIcon: async () => {
      getBaseCalls += 1;
      return { ok: true, dataUrl: 'data:image/png;base64,BASE' };
    },
  });

  const first = await renderer.renderTrayIcon('approval');
  const second = await renderer.renderTrayIcon('approval');
  assert.equal(first, second);
  assert.notEqual(await renderer.renderTrayIcon('error'), first);
  assert.equal(getBaseCalls, 1);
  assert.equal(canvasDraws, 2);
  assert.equal(await renderer.renderTrayIcon('none'), null);
  const overlay = renderer.renderTaskbarIcon(2, 'completed');
  assert.deepEqual(overlay.windowReps.map((rep) => rep.width), [16, 20, 24, 32, 40]);
  assert.equal(renderer.renderTaskbarIcon(2, 'completed'), overlay);
  assert.equal(canvasDraws, 7);
});

test('build & 集成测试: 打包产物 index.js 能在主世界监听后台事件并随点击切换消减图标', async (t) => {
  const buildRes = buildTaskbarBadgePlugin();
  const code = fs.readFileSync(buildRes.outPath, 'utf8');

  let wsInstance = null;
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      wsInstance = this;
    }
    send() {}
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    emit(type, ev) {
      for (const fn of this.listeners.get(type) || []) fn(ev);
    }
  }

  let currentCid = 'c-home';
  const inputBox = {
    __reactFiber$test: {
      memoizedProps: {
        get cascadeId() {
          return currentCid;
        },
        inExistingConversation: true,
      },
      return: null,
    },
  };

  const pushedStates = [];
  const winListeners = new Map();
  const fakeWin = {
    WebSocket: FakeWebSocket,
    fetch: async () => ({ ok: true }),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener() {},
    Image: class MockImage {
      set src(v) {
        this._src = v;
        queueMicrotask(() => this.onload?.());
      }
    },
    __myAntigravityAttention: {
      getBaseIcon: async () => ({ ok: true, dataUrl: 'data:image/png;base64,BASE' }),
      setAttentionState: async (payload) => {
        pushedStates.push(payload);
        return { ok: true };
      },
    },
  };

  const fakeDoc = {
    visibilityState: 'visible',
    body: {},
    hasFocus: () => true,
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll: (sel) => (sel.includes('agent-input-box') ? [inputBox] : []),
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        clearRect() {},
        drawImage() {},
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        arcTo() {},
        arc() {},
        closePath() {},
        fill() {},
        stroke() {},
        fillText() {},
      }),
      toDataURL: () => 'data:image/png;base64,RENDERED',
    }),
  };

  const context = {
    window: fakeWin,
    document: fakeDoc,
    TextDecoder,
    Uint8Array,
    Map,
    Set,
    console,
  };
  vm.runInNewContext(code, context);
  t.after(() => { for (const fn of winListeners.get('pagehide') || []) fn(); });

  const socket = new fakeWin.WebSocket('wss://127.0.0.1/connect-websocket');
  socket.send(
    JSON.stringify({
      type: 'start',
      streamId: 's-1',
      procedure: 'StreamAgentStateUpdates',
      payload: {},
    }),
  );

  // 首帧水合
  socket.emit('message', {
    data: JSON.stringify({
      type: 'data',
      streamId: 's-1',
      payload: { update: { conversationId: 'c-home', status: 1, fullyIdle: true } },
    }),
  });

  // 后台会话 c-bg1 运行后完成
  socket.emit('message', {
    data: JSON.stringify({
      type: 'data',
      streamId: 's-1',
      payload: { update: { conversationId: 'c-bg1', status: 2, fullyIdle: false } },
    }),
  });
  socket.emit('message', {
    data: JSON.stringify({
      type: 'data',
      streamId: 's-1',
      payload: { update: { conversationId: 'c-bg1', status: 1, fullyIdle: true } },
    }),
  });

  await new Promise((r) => setTimeout(r, 180));
  assert.ok(pushedStates.length >= 1);
  assert.equal(pushedStates.at(-1).count, 1);
  assert.equal(pushedStates.at(-1).level, 'completed');
  assert.equal(pushedStates[0].windowReps.length, 5);
  assert.equal(pushedStates[0].trayPngDataUrl, null);
  assert.equal(pushedStates.at(-1).trayPngDataUrl, 'data:image/png;base64,RENDERED');

  // 用户点开 c-bg1，计数归 0 并恢复原图标
  currentCid = 'c-bg1';
  for (const fn of winListeners.get('click') || []) fn();
  await new Promise((r) => setTimeout(r, 150));

  assert.equal(pushedStates.at(-1).count, 0);
  assert.equal(pushedStates.at(-1).level, 'none');
  assert.equal(pushedStates.at(-1).trayPngDataUrl, null);
  assert.ok(wsInstance);
  void createConnectFrame;
});

test('mod-manager 同步规范: zh-cn 开关切换时正确返回简洁中英文说明', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('plugins/taskbar-badge/mod.json'), 'utf8'),
  );
  assert.equal(manifest.id, 'taskbar-badge');
  assert.ok(manifest.summary.length > 0 && manifest.summary.length <= 24);
  assert.ok(manifest.summaryEn.length > 0 && manifest.summaryEn.length <= 48);

  assert.equal(getShortSummary(manifest, 'zh-CN'), '任务栏会话计数与托盘状态圆点');
  assert.equal(getShortSummary(manifest, 'en'), 'Taskbar badge count & tray status dot');
  assert.equal(getShortSummary({ id: 'taskbar-badge' }, 'zh-CN'), '任务栏会话计数与托盘状态圆点');
  assert.equal(getShortSummary({ id: 'taskbar-badge' }, 'en'), 'Taskbar badge count & tray status dot');
});
