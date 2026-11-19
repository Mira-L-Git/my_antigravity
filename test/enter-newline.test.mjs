import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const MOD_CODE = fs.readFileSync(path.resolve('plugins/enter-newline/index.js'), 'utf8');

function createHarness({ insideLexical = true, menuOpen = false } = {}) {
  class FakeElement {
    constructor(isLexical = false) {
      this.isLexical = isLexical;
    }
    closest(selector) {
      if (this.isLexical && selector.includes('data-lexical-editor="true"')) {
        return this;
      }
      return null;
    }
  }
  class FakeHTMLElement extends FakeElement {
    constructor({ width = 120, height = 80, hasOption = true } = {}) {
      super(false);
      this.width = width;
      this.height = height;
      this.hasOption = hasOption;
    }
    getBoundingClientRect() {
      return { width: this.width, height: this.height };
    }
    querySelector(sel) {
      if (sel === '[role="option"]' && this.hasOption) {
        return {};
      }
      return null;
    }
  }

  const listeners = [];
  const target = new FakeElement(insideLexical);
  const win = {
    Element: FakeElement,
    HTMLElement: FakeHTMLElement,
    addEventListener(type, fn, capture) {
      listeners.push({ type, fn, capture });
    },
  };
  const doc = {
    activeElement: target,
    querySelectorAll() {
      return menuOpen ? [new FakeHTMLElement()] : [];
    },
  };

  vm.runInNewContext(MOD_CODE, { window: win, document: doc, console });

  return {
    target,
    dispatchKeyDown(overrides = {}) {
      let prevented = false;
      let stopped = false;
      const baseShift = Boolean(overrides.shiftKey);
      const event = {
        key: 'Enter',
        keyCode: 13,
        isComposing: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        repeat: false,
        target,
        ...overrides,
        preventDefault() {
          prevented = true;
        },
        stopImmediatePropagation() {
          stopped = true;
        },
      };
      // 模拟 Chromium 原生 KeyboardEvent.prototype.shiftKey 访问器
      Object.defineProperty(event, 'shiftKey', {
        configurable: true,
        enumerable: true,
        get: () => baseShift,
      });
      Object.defineProperty(event, 'getModifierState', {
        configurable: true,
        value: (k) => (k === 'Shift' ? baseShift : false),
      });

      for (const { type, fn } of listeners) {
        if (type === 'keydown') {
          fn(event);
        }
      }
      return { event, prevented, stopped };
    },
  };
}

test('聊天框内纯 Enter 会被反转为 shiftKey=true（换行）', () => {
  const { dispatchKeyDown } = createHarness();
  const { event, prevented } = dispatchKeyDown({ shiftKey: false });
  assert.equal(prevented, false);
  assert.equal(event.shiftKey, true);
  assert.equal(event.getModifierState('Shift'), true);
});

test('聊天框内 Shift+Enter 会被反转为 shiftKey=false（发送）', () => {
  const { dispatchKeyDown } = createHarness();
  const { event, prevented } = dispatchKeyDown({ shiftKey: true });
  assert.equal(prevented, false);
  assert.equal(event.shiftKey, false);
  assert.equal(event.getModifierState('Shift'), false);
});

test('按住 Shift+Enter 自动连发 (repeat=true) 会被阻止，防止重复发送', () => {
  const { dispatchKeyDown } = createHarness();
  const { prevented, stopped } = dispatchKeyDown({ shiftKey: true, repeat: true });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test('输入法组合状态 (isComposing 或 keyCode=229) 不拦截', () => {
  const { dispatchKeyDown } = createHarness();
  assert.equal(dispatchKeyDown({ shiftKey: false, isComposing: true }).event.shiftKey, false);
  assert.equal(dispatchKeyDown({ shiftKey: false, keyCode: 229 }).event.shiftKey, false);
});

test('带有 Ctrl / Meta / Alt 的组合键不拦截', () => {
  const { dispatchKeyDown } = createHarness();
  assert.equal(dispatchKeyDown({ shiftKey: false, altKey: true }).event.shiftKey, false);
  assert.equal(dispatchKeyDown({ shiftKey: false, ctrlKey: true }).event.shiftKey, false);
  assert.equal(dispatchKeyDown({ shiftKey: true, metaKey: true }).event.shiftKey, true);
});

test('非 Lexical 聊天输入框（如普通 input/search）不拦截', () => {
  const { dispatchKeyDown } = createHarness({ insideLexical: false });
  assert.equal(dispatchKeyDown({ shiftKey: false }).event.shiftKey, false);
  assert.equal(dispatchKeyDown({ shiftKey: true }).event.shiftKey, true);
});

test('@ 或 / 补全菜单打开时不拦截，保留 Enter 选中选项行为', () => {
  const { dispatchKeyDown } = createHarness({ menuOpen: true });
  assert.equal(dispatchKeyDown({ shiftKey: false }).event.shiftKey, false);
});
