import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildModelEnhancerPlugin } from '../plugins/model-enhancer/build.mjs';
import {
  formatEffortLabel,
  getAvailableEfforts,
  getDefaultEffort,
  parseEffortLabel,
  prepareSvgMarkup,
  resolveBaseAndEffort,
  resolveBrandId,
} from '../plugins/model-enhancer/src/model-core.js';
import { createModelEnhancerController } from '../plugins/model-enhancer/src/slider-ui.js';

// --- 轻量 DOM 模拟环境，用于验证 slider-ui 的完整交互链路 ---
function createMockDom() {
  const docListeners = new Map();
  const winListeners = new Map();

  function addListener(map, type, fn, capture = false) {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push({ fn, capture: Boolean(capture) });
  }
  function removeListener(map, type, fn, capture = false) {
    const list = map.get(type);
    if (!list) return;
    map.set(
      type,
      list.filter((item) => item.fn !== fn || item.capture !== Boolean(capture)),
    );
  }
  function dispatchList(map, event, captureOnly) {
    const list = [...(map.get(event.type) || [])];
    for (const item of list) {
      if (captureOnly !== undefined && item.capture !== captureOnly) continue;
      if (event._stopImmediate) break;
      item.fn.call(null, event);
    }
  }

  class MockNodeList extends Array {}

  class MockElement {
    constructor(tagName, ownerDocument) {
      this.tagName = tagName.toUpperCase();
      this.nodeType = 1;
      this.ownerDocument = ownerDocument;
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.styleProps = new Map();
      this.style = {
        setProperty: (k, v) => this.styleProps.set(k, String(v)),
        getPropertyValue: (k) => this.styleProps.get(k) || '',
        removeProperty: (k) => this.styleProps.delete(k),
      };
      this.hidden = false;
      this.disabled = false;
      this.title = '';
      this.type = '';
      this._textContent = '';
      this._listeners = new Map();
      this._rect = { left: 0, top: 0, width: 248, height: 30, right: 248, bottom: 30 };
    }

    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === this.ownerDocument.documentElement || cur === this.ownerDocument.body) return true;
        cur = cur.parentElement;
      }
      return false;
    }

    get textContent() {
      if (this.children.length === 0) return this._textContent;
      return this._textContent + this.children.map((c) => c.textContent).join('');
    }
    set textContent(val) {
      this._textContent = val == null ? '' : String(val);
      this.children = [];
    }

    set innerHTML(html) {
      this._innerHTML = String(html);
      // 极简解析：支持 svg 模板或图标插入
      if (this.tagName === 'TEMPLATE') {
        const match = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i.exec(html);
        if (match) {
          const svg = new MockElement('svg', this.ownerDocument);
          const attrMatches = match[1].matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g);
          for (const am of attrMatches) svg.setAttribute(am[1], am[2]);
          svg._innerHTML = match[2];
          this.content = { firstElementChild: svg };
        } else {
          this.content = { firstElementChild: null };
        }
      }
    }
    get innerHTML() {
      return this._innerHTML || '';
    }

    insertAdjacentHTML(_pos, html) {
      if (/<svg\b/i.test(html)) {
        const svg = new MockElement('svg', this.ownerDocument);
        this.append(svg);
      }
    }

    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'disabled') this.disabled = true;
    }
    getAttribute(k) {
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(k) {
      return this.attributes.has(k);
    }
    removeAttribute(k) {
      this.attributes.delete(k);
      if (k === 'disabled') this.disabled = false;
    }

    append(...nodes) {
      for (const n of nodes) {
        if (!n) continue;
        if (n.parentElement) n.remove();
        n.parentElement = this;
        this.children.push(n);
      }
    }
    prepend(...nodes) {
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const n = nodes[i];
        if (!n) continue;
        if (n.parentElement) n.remove();
        n.parentElement = this;
        this.children.unshift(n);
      }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    getBoundingClientRect() {
      return this._rect;
    }
    focus() {
      this.ownerDocument.activeElement = this;
    }

    addEventListener(type, fn, capture = false) {
      addListener(this._listeners, type, fn, capture);
    }
    removeEventListener(type, fn, capture = false) {
      removeListener(this._listeners, type, fn, capture);
    }

    dispatchEvent(event) {
      event.target = event.target || this;
      const chain = [];
      let cur = this;
      while (cur) {
        chain.unshift(cur);
        cur = cur.parentElement;
      }
      // Window + Document + Ancestors 捕获阶段
      dispatchList(winListeners, event, true);
      if (event._stopPropagation || event._stopImmediate) return !event.defaultPrevented;
      dispatchList(docListeners, event, true);
      if (event._stopPropagation || event._stopImmediate) return !event.defaultPrevented;
      for (const el of chain) {
        if (event._stopPropagation || event._stopImmediate) break;
        dispatchList(el._listeners, event, true);
      }
      // 冒泡阶段
      for (let i = chain.length - 1; i >= 0; i -= 1) {
        if (event._stopPropagation || event._stopImmediate) break;
        dispatchList(chain[i]._listeners, event, false);
      }
      if (!event._stopPropagation && !event._stopImmediate) {
        dispatchList(docListeners, event, false);
        dispatchList(winListeners, event, false);
      }
      return !event.defaultPrevented;
    }

    matchesSingle(sel) {
      const s = sel.trim();
      if (!s) return false;
      const attrMatch = /^\[([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?\]$/.exec(s);
      if (attrMatch) {
        const [, key, val] = attrMatch;
        if (val === undefined) return this.hasAttribute(key);
        return this.getAttribute(key) === val;
      }
      return this.tagName.toLowerCase() === s.toLowerCase();
    }

    matches(selector) {
      return selector.split(',').some((part) => this.matchesSingle(part));
    }

    closest(selector) {
      let cur = this;
      while (cur) {
        if (cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    querySelectorAll(selector) {
      const results = new MockNodeList();
      const parts = selector.split(',').map((s) => s.trim());

      const walk = (node, directOnly) => {
        for (const child of node.children) {
          if (parts.some((p) => {
            if (p.startsWith(':scope > ')) {
              return directOnly && child.matchesSingle(p.slice(':scope > '.length));
            }
            return child.matchesSingle(p);
          })) {
            results.push(child);
          }
          if (!parts.every((p) => p.startsWith(':scope > '))) {
            walk(child, false);
          }
        }
      };
      walk(this, true);
      return results;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  const doc = {
    readyState: 'complete',
    activeElement: null,
    createElement(tag) {
      return new MockElement(tag, doc);
    },
    addEventListener(type, fn, capture) {
      addListener(docListeners, type, fn, capture);
    },
    removeEventListener(type, fn, capture) {
      removeListener(docListeners, type, fn, capture);
    },
    querySelectorAll(sel) {
      return doc.body.querySelectorAll(sel);
    },
    querySelector(sel) {
      return doc.body.querySelector(sel);
    },
  };
  doc.documentElement = new MockElement('html', doc);
  doc.body = new MockElement('body', doc);
  doc.documentElement.append(doc.body);

  const win = {
    document: doc,
    __myAntigravityZhCnInstalled: false,
    addEventListener(type, fn, capture) {
      addListener(winListeners, type, fn, capture);
    },
    removeEventListener(type, fn, capture) {
      removeListener(winListeners, type, fn, capture);
    },
    setTimeout,
    clearTimeout,
  };

  function makeEvent(type, extra = {}) {
    return {
      type,
      button: 0,
      defaultPrevented: false,
      _stopPropagation: false,
      _stopImmediate: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._stopPropagation = true;
      },
      stopImmediatePropagation() {
        this._stopImmediate = true;
      },
      ...extra,
    };
  }

  return { win, doc, MockElement, makeEvent };
}

test('model-core: 思考档位解析、排序、默认档位与品牌匹配', () => {
  assert.deepEqual(parseEffortLabel('Gemini 4 Hydrogen (High)'), {
    base: 'Gemini 4 Hydrogen',
    effort: 'high',
  });
  assert.deepEqual(parseEffortLabel('GPT-5.6 (xhigh thinking)'), {
    base: 'GPT-5.6',
    effort: 'xhigh',
  });
  assert.equal(parseEffortLabel('Claude 4.5 Haiku'), null);

  const lowOpt = { label: 'Gemini 4 Hydrogen (Low)', value: 1 };
  const medOpt = { label: 'Gemini 4 Hydrogen (Medium)', value: 2 };
  const highOpt = { label: 'Gemini 4 Hydrogen (High)', value: 3 };
  const maxOpt = { label: 'Gemini 4 Hydrogen (Max)', value: 4 };
  const effortIndex = new Map([
    [
      'Gemini 4 Hydrogen',
      new Map([
        ['max', maxOpt],
        ['low', lowOpt],
        ['high', highOpt],
        ['medium', medOpt],
      ]),
    ],
  ]);

  const ordered = getAvailableEfforts('Gemini 4 Hydrogen', effortIndex);
  assert.deepEqual(
    ordered.map((x) => x.effort),
    ['low', 'medium', 'high', 'max'],
  );
  assert.equal(getDefaultEffort(ordered), 'medium');
  assert.equal(getDefaultEffort([{ effort: 'low', option: lowOpt }]), 'low');

  assert.deepEqual(resolveBaseAndEffort(highOpt, effortIndex), {
    base: 'Gemini 4 Hydrogen',
    groupKey: 'Gemini 4 Hydrogen',
    effort: 'high',
  });

  // groupedModels 结构下 effortIndex 以 groupKey 为键名，也能解析出 displayName 与档位列表
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 11 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 12 };
  const groupedEffortIndex = new Map([
    [
      'gemini-4-neon',
      new Map([
        ['low', neonLow],
        ['xhigh', neonXHigh],
      ]),
    ],
  ]);
  const groupedModels = {
    'gemini-4-neon': { displayName: 'Gemini 4 Neon' },
  };
  assert.deepEqual(resolveBaseAndEffort(neonXHigh, groupedEffortIndex, groupedModels), {
    base: 'Gemini 4 Neon',
    groupKey: 'gemini-4-neon',
    effort: 'xhigh',
  });
  assert.deepEqual(
    getAvailableEfforts('Gemini 4 Neon', groupedEffortIndex, groupedModels).map((x) => x.effort),
    ['low', 'xhigh'],
  );

  assert.equal(formatEffortLabel('high', 'zh-CN'), '高');
  assert.equal(formatEffortLabel('xhigh', 'en'), 'Extra');

  // 品牌图标匹配（含词边界检查、Gemini 4 新模型代号、Orchestrator 以及覆盖/屏蔽规则）
  assert.equal(resolveBrandId({ base: 'Gemini 4 Hydrogen' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Gemini 4 Carbon (Max)', modelId: 'gemini-4-carbon-max' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Carbon' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Neon' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Nano Banana 2' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Orchestrator', modelId: 'gemini-pro-orchestrator' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Orchestrator' }), 'gemini');
  assert.equal(resolveBrandId({ label: 'Claude Opus 4.5 (Thinking)' }), 'anthropic');
  assert.equal(resolveBrandId({ label: 'GPT-6.1 Sol' }), 'openai');
  assert.equal(resolveBrandId({ label: 'o3-mini' }), 'openai');
  assert.equal(resolveBrandId({ label: 'DeepSeek V4.1' }), 'deepseek');
  assert.equal(resolveBrandId({ label: 'Grok 4' }), 'grok');
  assert.equal(resolveBrandId({ label: 'Qwen 3.5 Max' }), 'qwen');
  assert.equal(resolveBrandId({ label: 'Kimi K2.5' }), 'kimi');
  assert.equal(resolveBrandId({ label: 'GLM-5' }), 'zhipu');
  assert.equal(resolveBrandId({ label: 'MiniMax M2' }), 'minimax');
  assert.equal(resolveBrandId({ label: 'Hunyuan T1' }), 'hunyuan');
  assert.equal(resolveBrandId({ label: 'Xiaomi MiMo' }), 'mimo');
  assert.equal(resolveBrandId({ label: 'Muse Spark' }), 'muse');
  assert.equal(resolveBrandId({ label: 'My Custom Pro Model 1' }), 'fallback');
  assert.equal(
    resolveBrandId({ label: 'Custom Endpoint', provider: 'MODEL_PROVIDER_ANTHROPIC' }),
    'anthropic',
  );
  // 覆盖表优先于品牌匹配；禁用清单优先返回 null（不渲染图标）
  assert.equal(
    resolveBrandId(
      { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high' },
      { overrides: [{ match: 'Gemini 4 Neon', icon: 'openai' }] },
    ),
    'openai',
  );
  assert.equal(
    resolveBrandId(
      { label: 'Gemini 4 Argon (Low)', modelId: 'gemini-4-argon-low' },
      { disabledPatterns: ['Gemini 4 Argon'] },
    ),
    null,
  );
});

test('model-core: SVG 清理 title 并为渐变 ID 生成全局唯一前缀', () => {
  const raw =
    '<svg viewBox="0 0 24 24"><title>Gemini</title><path fill="url(#g0)"/><defs><linearGradient id="g0"></linearGradient></defs></svg>';
  const a = prepareSvgMarkup(raw);
  const b = prepareSvgMarkup(raw);
  assert.ok(!a.includes('<title>'));
  assert.notEqual(a, b);
  const idA = /id="([^"]+)"/.exec(a)?.[1];
  const idB = /id="([^"]+)"/.exec(b)?.[1];
  assert.ok(idA && idB && idA !== idB);
  assert.ok(a.includes(`url(#${idA})`));
  assert.ok(b.includes(`url(#${idB})`));
});

test('slider-ui: Codex 二段式单面板切换、滑轨拖拽/键盘提交、品牌图标注入与 Esc 返回', () => {
  const { win, doc, makeEvent } = createMockDom();
  const iconsMap = {
    gemini: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>',
    anthropic: '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>',
    deepseek: '<svg viewBox="0 0 24 24"><path d="M3 3"/></svg>',
    fallback: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
  };

  const gemLow = { label: 'Gemini 4 Hydrogen (Low)', value: 1 };
  const gemMed = { label: 'Gemini 4 Hydrogen (Medium)', value: 2 };
  const gemHigh = { label: 'Gemini 4 Hydrogen (High)', value: 3 };
  const gemMax = { label: 'Gemini 4 Hydrogen (Max)', value: 4 };
  const claudeLow = { label: 'Claude 4.5 Sonnet (Low)', value: 10 };
  const claudeHigh = { label: 'Claude 4.5 Sonnet (High)', value: 11 };
  const deepseekSingle = { label: 'DeepSeek V4.1', value: 20 };

  const effortIndex = new Map([
    [
      'Gemini 4 Hydrogen',
      new Map([
        ['low', gemLow],
        ['medium', gemMed],
        ['high', gemHigh],
        ['max', gemMax],
      ]),
    ],
    [
      'Claude 4.5 Sonnet',
      new Map([
        ['low', claudeLow],
        ['high', claudeHigh],
      ]),
    ],
  ]);

  const selections = [];
  let closedCount = 0;

  const providerCtx = {
    selectedModel: gemHigh,
    effortIndex,
    groups: [{ groupName: 'Recommended', options: [gemLow, claudeLow, deepseekSingle] }],
    bestOfNConfig: { isBestOfNEnabled: false },
    isModelListLoading: false,
    setSelectedModel(opt) {
      // LQc 内层回调会顺带关闭弹窗
      providerCtx.selectedModel = opt;
      closedCount += 1;
    },
  };

  // 构建 XQc -> LQc -> KQc.Provider -> panelEl 的 Fiber 链
  const panelEl = doc.createElement('div');
  panelEl.setAttribute('data-testid', 'model-selector-panel');

  const nativeHeader = doc.createElement('div');
  nativeHeader.setAttribute('data-testid', 'model-selector-header');
  nativeHeader.textContent = 'Model';

  const gemRow = doc.createElement('button');
  gemRow.setAttribute('role', 'menuitem');
  const gemInner = doc.createElement('span');
  const gemGroup = doc.createElement('span');
  gemGroup.setAttribute('data-testid', 'model-selector-effort-group');
  gemGroup.setAttribute('data-model-base', 'Gemini 4 Hydrogen');
  gemGroup.textContent = 'Gemini 4 Hydrogen';
  gemInner.append(gemGroup);
  gemRow.append(gemInner);

  const claudeRow = doc.createElement('button');
  claudeRow.setAttribute('role', 'menuitem');
  const claudeInner = doc.createElement('span');
  const claudeGroup = doc.createElement('span');
  claudeGroup.setAttribute('data-testid', 'model-selector-effort-group');
  claudeGroup.setAttribute('data-model-base', 'Claude 4.5 Sonnet');
  claudeGroup.textContent = 'Claude 4.5 Sonnet';
  claudeInner.append(claudeGroup);
  claudeRow.append(claudeInner);

  const dsRow = doc.createElement('div');
  dsRow.setAttribute('role', 'menuitem');
  dsRow.setAttribute('data-testid', 'model-selector-item');
  dsRow.setAttribute('data-model-label', 'DeepSeek V4.1');
  const dsInner = doc.createElement('span');
  dsInner.textContent = 'DeepSeek V4.1';
  dsRow.append(dsInner);

  panelEl.append(nativeHeader, gemRow, claudeRow, dsRow);
  doc.body.append(panelEl);

  const xqcFiber = {
    memoizedProps: {
      modelSorts: [],
      setIsOpen: () => {},
      setSelectedModel(opt) {
        providerCtx.selectedModel = opt;
        selections.push(opt);
      },
    },
    return: null,
  };
  const lqcFiber = {
    memoizedProps: {
      modelSorts: [],
      setIsOpen: () => {},
      setSelectedModel: providerCtx.setSelectedModel,
    },
    return: xqcFiber,
  };
  const providerFiber = {
    memoizedProps: { value: providerCtx },
    return: lqcFiber,
  };
  panelEl.__reactFiber$test = { memoizedProps: {}, return: providerFiber };

  const controller = createModelEnhancerController(win, doc, iconsMap);
  controller.scanPanels();

  // 1. 首屏默认打开 Stage 1（拉条视图）
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'slider');
  assert.equal(doc.documentElement.getAttribute('data-ag-me-active'), 'true');
  const sliderView = panelEl.querySelector('[data-ag-me-slider-view]');
  assert.equal(sliderView.hidden, false);
  assert.equal(panelEl.querySelector('[data-ag-me-effort-title]').textContent, 'High');
  assert.equal(panelEl.querySelector('[data-ag-me-model-switch-name]').textContent, 'Gemini 4 Hydrogen');
  assert.equal(panelEl.querySelectorAll('[data-ag-me-tick]').length, 4);

  // 2. 键盘向右切换到 Max 档位，不关闭弹窗且不额外变色（不设置 high-intensity 属性）
  const rail = panelEl.querySelector('[data-ag-me-rail]');
  rail.dispatchEvent(makeEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(selections.at(-1), gemMax);
  assert.equal(closedCount, 0);
  controller.scanPanels();
  assert.equal(panelEl.querySelector('[data-ag-me-effort-title]').textContent, 'Max');
  assert.equal(rail.getAttribute('data-high-intensity'), null);
  assert.equal(panelEl.querySelector('[data-ag-me-effort-title]').getAttribute('data-high-intensity'), null);

  // 3. 点击重置按钮回到 Medium
  panelEl.querySelector('[data-ag-me-reset]').dispatchEvent(makeEvent('click'));
  assert.equal(selections.at(-1), gemMed);
  controller.scanPanels();
  assert.equal(panelEl.querySelector('[data-ag-me-effort-title]').textContent, 'Medium');
  assert.equal(panelEl.querySelector('[data-ag-me-reset]').disabled, true);

  // 4. 点击与连续拖动滑块：按下时保留过渡，拖动时连续跟手，松手回弹对齐刻度且不误关外部
  rail.dispatchEvent(makeEvent('pointerdown', { clientX: 120 }));
  assert.equal(rail.getAttribute('data-dragging'), null);
  rail.dispatchEvent(makeEvent('pointermove', { clientX: 48 }));
  assert.equal(rail.getAttribute('data-dragging'), 'true');
  const midRatio = Number(sliderView.style.getPropertyValue('--ag-me-p'));
  assert.ok(midRatio > 0 && midRatio < 1 / 3);
  rail.dispatchEvent(makeEvent('pointerup', { clientX: 16, target: doc.body }));
  assert.equal(rail.getAttribute('data-dragging'), null);
  assert.equal(sliderView.style.getPropertyValue('--ag-me-p'), '0');
  assert.equal(selections.at(-1), gemLow);
  // 紧随其后的文档级 click 应被拦截
  const trailingClick = makeEvent('click', { target: doc.body });
  doc.body.dispatchEvent(trailingClick);
  assert.equal(trailingClick.defaultPrevented, true);

  // 5. 点击模型名切到 Stage 2（带图标的模型列表），并验证悬停事件拦截（防闪烁）与焦点同步
  panelEl.querySelector('[data-ag-me-model-switch]').dispatchEvent(makeEvent('click'));
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'list');
  assert.equal(sliderView.hidden, true);
  let childHovered = false;
  gemRow.addEventListener('mousemove', () => {
    childHovered = true;
  });
  gemRow.dispatchEvent(makeEvent('mousemove'));
  assert.equal(childHovered, false);
  assert.equal(doc.activeElement, gemRow);
  let singleHovered = false;
  dsRow.addEventListener('mousemove', () => {
    singleHovered = true;
  });
  dsRow.dispatchEvent(makeEvent('mousemove'));
  assert.equal(singleHovered, true);
  assert.equal(gemInner.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'gemini');
  assert.equal(claudeInner.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'anthropic');
  assert.equal(dsInner.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'deepseek');

  // 再次扫描不应重复插入图标
  controller.scanPanels();
  assert.equal(gemInner.querySelectorAll('[data-ag-me-icon]').length, 1);

  // 6. 在列表点击 Claude 4.5 Sonnet（多档位模型）-> 自动切换模型并返回 Stage 1 拉条
  claudeRow.dispatchEvent(makeEvent('click'));
  assert.equal(selections.at(-1), claudeLow);
  assert.equal(closedCount, 0);
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'slider');
  assert.equal(panelEl.querySelector('[data-ag-me-model-switch-name]').textContent, 'Claude 4.5 Sonnet');
  assert.equal(panelEl.querySelectorAll('[data-ag-me-tick]').length, 2);

  // 7. 切换到列表后按 Esc 先回到滑条，再按 Esc 不拦截
  panelEl.querySelector('[data-ag-me-model-switch]').dispatchEvent(makeEvent('click'));
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'list');
  const escInList = makeEvent('keydown', { key: 'Escape' });
  doc.body.dispatchEvent(escInList);
  assert.equal(escInList.defaultPrevented, true);
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'slider');

  const escInSlider = makeEvent('keydown', { key: 'Escape' });
  doc.body.dispatchEvent(escInSlider);
  assert.equal(escInSlider.defaultPrevented, false);

  // 8. 开启 zh-cn 后应自动切换中文文案
  win.__myAntigravityZhCnInstalled = true;
  controller.scanPanels();
  assert.equal(panelEl.querySelector('[data-ag-me-effort-title]').textContent, '低');

  controller.destroy();
  assert.equal(doc.documentElement.getAttribute('data-ag-me-active'), null);
});

test('slider-ui: Best of N 模式及无 Fiber 降级场景仍安全工作并注入图标', () => {
  const { win, doc } = createMockDom();
  const iconsMap = {
    openai: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>',
    fallback: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
  };

  const panelEl = doc.createElement('div');
  panelEl.setAttribute('data-testid', 'model-selector-panel');
  const checkRow = doc.createElement('div');
  checkRow.setAttribute('role', 'menuitemcheckbox');
  const span = doc.createElement('span');
  span.textContent = 'GPT-6.1 Sol';
  checkRow.append(span);
  panelEl.append(checkRow);
  doc.body.append(panelEl);

  const controller = createModelEnhancerController(win, doc, iconsMap);
  controller.scanPanels();

  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'list');
  assert.equal(panelEl.querySelector('[data-ag-me-back-btn]').hidden, true);
  assert.equal(span.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'openai');

  controller.destroy();
});

test('slider-ui: 阶段切换支持平滑动画并在 reduced-motion 或卸载时安全跳过/取消', () => {
  const { win, doc, makeEvent } = createMockDom();
  const iconsMap = {
    gemini: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>',
    fallback: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
  };

  const gemLow = { label: 'Gemini 4 Hydrogen (Low)', value: 1 };
  const gemHigh = { label: 'Gemini 4 Hydrogen (High)', value: 2 };
  const effortIndex = new Map([
    [
      'Gemini 4 Hydrogen',
      new Map([
        ['low', gemLow],
        ['high', gemHigh],
      ]),
    ],
  ]);

  const providerCtx = {
    selectedModel: gemHigh,
    effortIndex,
    groups: [{ groupName: 'Recommended', options: [gemLow] }],
    bestOfNConfig: { isBestOfNEnabled: false },
    isModelListLoading: false,
    setSelectedModel() {},
  };

  const animCalls = [];
  let cancelledCount = 0;
  function attachAnimate(el, width, height) {
    el._rect = { left: 0, top: 0, width, height, right: width, bottom: height };
    el.animate = (keyframes, options) => {
      const anim = {
        onfinish: null,
        oncancel: null,
        cancel() {
          cancelledCount += 1;
          this.oncancel?.();
        },
      };
      animCalls.push({ el, keyframes, options, anim });
      return anim;
    };
  }

  const panelEl = doc.createElement('div');
  panelEl.setAttribute('data-testid', 'model-selector-panel');
  const nativeBody = doc.createElement('div');
  panelEl.append(nativeBody);
  doc.body.append(panelEl);

  panelEl.__reactFiber$test = {
    memoizedProps: { value: providerCtx },
    return: null,
  };

  // 动态按阶段返回不同尺寸，触发宽高过渡动画
  attachAnimate(panelEl, 200, 80);
  const origGetRect = panelEl.getBoundingClientRect.bind(panelEl);
  panelEl.getBoundingClientRect = () => {
    if (panelEl.getAttribute('data-ag-me-stage') === 'list') {
      return { left: 0, top: 0, width: 264, height: 240, right: 264, bottom: 240 };
    }
    return origGetRect();
  };
  attachAnimate(nativeBody, 264, 200);

  let reducedMotion = false;
  win.matchMedia = () => ({ matches: reducedMotion });

  const controller = createModelEnhancerController(win, doc, iconsMap);
  controller.scanPanels();

  const sliderView = panelEl.querySelector('[data-ag-me-slider-view]');
  const listHeader = panelEl.querySelector('[data-ag-me-list-header]');
  attachAnimate(sliderView, 192, 76);
  attachAnimate(listHeader, 256, 28);

  // Stage 1 -> Stage 2 触发容器宽高变形与内容淡入
  panelEl.querySelector('[data-ag-me-model-switch]').dispatchEvent(makeEvent('click'));
  assert.equal(panelEl.getAttribute('data-ag-me-animating'), 'true');
  const sizeCall = animCalls.find((c) => c.el === panelEl);
  assert.ok(sizeCall);
  assert.deepEqual(sizeCall.keyframes, [
    { width: '200px', height: '80px' },
    { width: '264px', height: '240px' },
  ]);
  assert.ok(animCalls.some((c) => c.el === nativeBody));

  // 动画完成清理 data-ag-me-animating
  sizeCall.anim.onfinish?.();
  assert.equal(panelEl.getAttribute('data-ag-me-animating'), null);

  // reduced-motion 开启时不再创建动画，直接切换
  animCalls.length = 0;
  reducedMotion = true;
  panelEl.querySelector('[data-ag-me-back-btn]').dispatchEvent(makeEvent('click'));
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'slider');
  assert.equal(animCalls.length, 0);

  // 卸载时清理仍在运行的动画
  reducedMotion = false;
  panelEl.querySelector('[data-ag-me-model-switch]').dispatchEvent(makeEvent('click'));
  assert.ok(animCalls.length > 0);
  controller.destroy();
  assert.ok(cancelledCount > 0);
});

test('slider-ui: groupedModels 键名兼容与 Orchestrator 行及子菜单图标注入', () => {
  const { win, doc, makeEvent } = createMockDom();
  const iconsMap = {
    gemini: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>',
    anthropic: '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>',
    fallback: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
  };

  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 2 };
  const effortIndex = new Map([
    [
      'gemini-4-neon',
      new Map([
        ['low', neonLow],
        ['xhigh', neonXHigh],
      ]),
    ],
  ]);

  const selections = [];
  const providerCtx = {
    selectedModel: neonLow,
    effortIndex,
    userStatus: {
      cascadeModelConfigData: {
        groupedModels: {
          'gemini-4-neon': { displayName: 'Gemini 4 Neon' },
        },
      },
    },
    groups: [{ groupName: 'Recommended', options: [neonLow] }],
    bestOfNConfig: { isBestOfNEnabled: false },
    isModelListLoading: false,
    setSelectedModel() {},
  };

  const panelEl = doc.createElement('div');
  panelEl.setAttribute('data-testid', 'model-selector-panel');

  const orchRow = doc.createElement('div');
  orchRow.setAttribute('role', 'menuitem');
  orchRow.setAttribute('data-testid', 'model-selector-orchestrator');
  orchRow.setAttribute('data-model-label', 'Orchestrator');
  const orchSpan = doc.createElement('span');
  orchSpan.textContent = 'Orchestrator';
  orchRow.append(orchSpan);

  const neonRow = doc.createElement('div');
  neonRow.setAttribute('role', 'menuitem');
  const neonInner = doc.createElement('span');
  const neonGroup = doc.createElement('span');
  neonGroup.setAttribute('data-testid', 'model-selector-effort-group');
  neonGroup.setAttribute('data-model-base', 'Gemini 4 Neon');
  neonGroup.textContent = 'Gemini 4 Neon';
  neonInner.append(neonGroup);
  neonRow.append(neonInner);

  // Portal 挂载到 document 上的 Orchestrator 子菜单行
  const pickerRow = doc.createElement('div');
  pickerRow.setAttribute('role', 'menuitem');
  pickerRow.setAttribute('data-testid', 'orchestrator-picker-row');
  pickerRow.setAttribute('data-model-label', 'Claude Opus 5.5');
  const pickerInner = doc.createElement('span');
  pickerInner.textContent = 'Claude Opus 5.5';
  pickerRow.append(pickerInner);

  panelEl.append(orchRow, neonRow);
  doc.body.append(panelEl, pickerRow);

  const xqcFiber = {
    memoizedProps: {
      modelSorts: [],
      setIsOpen: () => {},
      setSelectedModel(opt) {
        providerCtx.selectedModel = opt;
        selections.push(opt);
      },
    },
    return: null,
  };
  panelEl.__reactFiber$test = {
    memoizedProps: {},
    return: { memoizedProps: { value: providerCtx }, return: xqcFiber },
  };

  const controller = createModelEnhancerController(win, doc, iconsMap);
  controller.scanPanels();

  // Stage 1 应显示可读的 displayName "Gemini 4 Neon"，而不是 groupKey "gemini-4-neon"
  assert.equal(panelEl.querySelector('[data-ag-me-model-switch-name]').textContent, 'Gemini 4 Neon');
  assert.equal(panelEl.querySelectorAll('[data-ag-me-tick]').length, 2);

  // 切到 Stage 2 列表后应为 Orchestrator、Gemini 4 Neon 与子菜单行注入对应品牌图标
  panelEl.querySelector('[data-ag-me-model-switch]').dispatchEvent(makeEvent('click'));
  assert.equal(orchSpan.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'gemini');
  assert.equal(neonInner.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'gemini');
  assert.equal(pickerInner.querySelector('[data-ag-me-icon]').getAttribute('data-ag-me-icon'), 'anthropic');

  // 点击 Gemini 4 Neon 多档位行可正常切回 Stage 1
  neonRow.dispatchEvent(makeEvent('click'));
  assert.equal(panelEl.getAttribute('data-ag-me-stage'), 'slider');
  assert.equal(selections.at(-1), neonLow);

  controller.destroy();
});

test('build: 构建产物 index.js 可在隔离 VM 中幂等执行', () => {
  const res = buildModelEnhancerPlugin();
  assert.ok(fs.existsSync(res.outPath));
  assert.ok(res.iconCount >= 12);

  const code = fs.readFileSync(res.outPath, 'utf8');
  const { win, doc } = createMockDom();
  const ctx = { window: win, document: doc, console };
  vm.runInNewContext(code, ctx);
  assert.equal(win.__myAntigravityModelEnhancerInstalled, true);

  // 二次执行幂等不抛错
  vm.runInNewContext(code, ctx);
  assert.equal(win.__myAntigravityModelEnhancerInstalled, true);
});
