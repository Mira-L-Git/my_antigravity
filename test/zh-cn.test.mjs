import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildZhCnPlugin } from '../plugins/zh-cn/build.mjs';

function createDomHarness() {
  buildZhCnPlugin();
  const code = fs.readFileSync(path.resolve('plugins/zh-cn/index.js'), 'utf8');

  class FakeNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
      this.parentElement = null;
      this.childNodes = [];
    }
    appendChild(child) {
      child.parentElement = this.nodeType === 1 ? this : null;
      this.childNodes.push(child);
      return child;
    }
  }

  class FakeText extends FakeNode {
    constructor(value) {
      super(3);
      this.nodeValue = value;
    }
  }

  class FakeElement extends FakeNode {
    constructor(tagName, attrs = {}) {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.attrs = { ...attrs };
    }
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    }
    getAttribute(name) {
      return this.attrs[name] ?? null;
    }
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    }
    matches(selector) {
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part.startsWith('[') && part.endsWith(']')) {
          const inner = part.slice(1, -1);
          const eqIdx = inner.indexOf('=');
          if (eqIdx === -1) {
            if (this.hasAttribute(inner)) return true;
          } else {
            const k = inner.slice(0, eqIdx);
            const v = inner.slice(eqIdx + 1).replace(/^"|"$/g, '');
            if (this.getAttribute(k) === v) return true;
          }
        } else if (part.startsWith('.')) {
          const cls = (this.attrs.class || '').split(/\s+/);
          if (cls.includes(part.slice(1))) return true;
        } else if (this.tagName.toLowerCase() === part.toLowerCase()) {
          return true;
        }
      }
      return false;
    }
    closest(selector) {
      let cur = this;
      while (cur) {
        if (cur.matches && cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll() {
      const res = [];
      const visit = (node) => {
        for (const c of node.childNodes) {
          if (c.nodeType === 1) {
            if (c.hasAttribute('placeholder') || c.hasAttribute('aria-label') || c.hasAttribute('title')) {
              res.push(c);
            }
            visit(c);
          }
        }
      };
      visit(this);
      return res;
    }
  }

  const body = new FakeElement('body');
  const doc = {
    readyState: 'complete',
    body,
    documentElement: body,
    addEventListener() {},
    createTreeWalker(root) {
      const list = [];
      const visit = (n) => {
        for (const c of n.childNodes) {
          list.push(c);
          if (c.nodeType === 1) visit(c);
        }
      };
      visit(root);
      let idx = -1;
      return {
        nextNode() {
          idx += 1;
          return idx < list.length ? list[idx] : null;
        },
      };
    },
  };

  let capturedMenu = null;
  const win = {
    electronNative: {
      showContextMenu(items) {
        capturedMenu = items;
        return Promise.resolve(null);
      },
    },
  };

  vm.runInNewContext(code, { window: win, document: doc, console, queueMicrotask });

  return {
    body,
    win,
    FakeElement,
    FakeText,
    getCapturedMenu: () => capturedMenu,
  };
}

test('buildZhCnPlugin 能构建有效词库且精确翻译常用 UI 文本与标点', () => {
  const { win, body, FakeElement, FakeText } = createDomHarness();
  const btn = body.appendChild(new FakeElement('button'));
  const t1 = btn.appendChild(new FakeText('  New Conversation  '));
  const label = body.appendChild(new FakeElement('span'));
  const t2 = label.appendChild(new FakeText('Settings:'));
  const wait = body.appendChild(new FakeElement('span'));
  const t3 = wait.appendChild(new FakeText('Saving...'));

  win.__myAntigravityZhCn.walkAndTranslate(body);
  assert.equal(t1.nodeValue, '  新建对话  ');
  assert.equal(t2.nodeValue, '设置：');
  assert.equal(t3.nodeValue, '保存中...');
});

test('动态正则模板能翻译版本号、思考耗时、文件变更数与设置页小字说明', () => {
  const { win } = createDomHarness();
  const tr = win.__myAntigravityZhCn.translateText;
  assert.equal(tr('Version 2.32.1'), '版本 2.32.1');
  assert.equal(tr('Thought for 12s'), '思考了 12 秒');
  assert.equal(tr('3 files changed'), '3 个文件已变更');
  assert.equal(tr('5 minutes ago'), '5 分钟前');
  assert.equal(tr('Manage Antigravity app settings.'), '管理 Antigravity 应用设置。');
  assert.equal(
    tr('When toggled on, Antigravity collects usage data to help Google enhance performance and features.'),
    '开启后，Antigravity 会收集使用数据以帮助 Google 改进性能与功能。',
  );
  assert.equal(
    tr('When enabled, the agent will include default customizations, including default skills.'),
    '启用后，Agent 将加载内置默认的 Customizations（包括默认 Skills）。',
  );
  assert.equal(tr('Your Plan: Ultra'), '当前套餐：Ultra');
});

test('绝不翻译代码块、终端、编辑器、用户消息与 Agent 回复正文', () => {
  const { win, body, FakeElement, FakeText } = createDomHarness();

  const pre = body.appendChild(new FakeElement('pre'));
  const codeText = pre.appendChild(new FakeText('Settings'));

  const userMsg = body.appendChild(new FakeElement('div', { 'data-testid': 'user-message-content' }));
  const userText = userMsg.appendChild(new FakeText('New Conversation'));

  const agentResp = body.appendChild(new FakeElement('div', { 'data-testid': 'agent-response' }));
  const agentText = agentResp.appendChild(new FakeText('Enable Terminal Sandbox'));

  const editor = body.appendChild(new FakeElement('div', { 'data-lexical-editor': 'true' }));
  const editorText = editor.appendChild(new FakeText('Save'));

  const xterm = body.appendChild(new FakeElement('div', { class: 'xterm' }));
  const termText = xterm.appendChild(new FakeText('Cancel'));

  win.__myAntigravityZhCn.walkAndTranslate(body);
  assert.equal(codeText.nodeValue, 'Settings');
  assert.equal(userText.nodeValue, 'New Conversation');
  assert.equal(agentText.nodeValue, 'Enable Terminal Sandbox');
  assert.equal(editorText.nodeValue, 'Save');
  assert.equal(termText.nodeValue, 'Cancel');
});

test('翻译输入框 placeholder 与按钮 aria-label/title，并支持文本节点复用再翻译', () => {
  const { win, body, FakeElement, FakeText } = createDomHarness();
  const input = body.appendChild(
    new FakeElement('input', {
      placeholder: 'Search conversations...',
      'aria-label': 'Clear Search',
    }),
  );
  const btn = body.appendChild(new FakeElement('button', { title: 'Toggle Sidebar' }));
  const btnText = btn.appendChild(new FakeText('Save'));

  win.__myAntigravityZhCn.walkAndTranslate(body);
  assert.equal(input.getAttribute('placeholder'), '搜索对话...');
  assert.equal(input.getAttribute('aria-label'), '清除搜索');
  assert.equal(btn.getAttribute('title'), '切换侧边栏');
  assert.equal(btnText.nodeValue, '保存');

  // 模拟 React 将同一 Text 节点从 Save 改为 Saving...
  btnText.nodeValue = 'Saving...';
  win.__myAntigravityZhCn.walkAndTranslate(body);
  assert.equal(btnText.nodeValue, '保存中...');
});

test('showContextMenu 拦截器可翻译嵌套菜单与子菜单项', () => {
  const { win, getCapturedMenu } = createDomHarness();
  win.electronNative.showContextMenu([
    { label: 'Copy' },
    {
      label: 'More',
      submenu: [{ label: 'Delete Conversation' }],
    },
  ]);
  const menu = getCapturedMenu();
  assert.equal(menu[0].label, '复制');
  assert.equal(menu[1].submenu[0].label, '删除对话');
});

test('绝不翻译 google-symbols 图标文字，并覆盖 2.32.2 新增 UI 文案', () => {
  const { win, body, FakeElement, FakeText } = createDomHarness();

  const icon = body.appendChild(new FakeElement('span', { class: 'google-symbols' }));
  const iconText = icon.appendChild(new FakeText('navigation'));

  const matIcon = body.appendChild(new FakeElement('span', { class: 'material-symbols-outlined' }));
  const matText = matIcon.appendChild(new FakeText('layout'));

  win.__myAntigravityZhCn.walkAndTranslate(body);
  assert.equal(iconText.nodeValue, 'navigation');
  assert.equal(matText.nodeValue, 'layout');

  const tr = win.__myAntigravityZhCn.translateText;
  assert.equal(tr('View Usage'), '查看用量');
  assert.equal(tr('Ask /btw'), '顺便问一句 (/btw)');
  assert.equal(tr('Fork Conversation'), '分叉对话');
  assert.equal(tr('Enable Recommended Skills'), '启用推荐 Skills');
  assert.equal(tr('Credit Overages'), '额度超额使用');
  assert.equal(tr('Keybinding Scheme'), '快捷键方案');
  assert.equal(tr('Browsing Data'), '浏览数据');
  assert.equal(tr('Bundles'), '插件包 (Bundles)');
  assert.equal(tr('Enable Browser Agent'), '启用浏览器 Agent');
  assert.equal(tr('Extra High'), '超高');
  assert.equal(tr('Leaving Soon'), '即将下线');
  assert.equal(tr('Thinking effort'), '思考深度');
});
