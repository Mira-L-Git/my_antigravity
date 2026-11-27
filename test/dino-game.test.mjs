import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildDinoGamePlugin } from '../plugins/dino-game/build.mjs';
import {
  DINO_DUCK_H,
  DINO_STAND_H,
  DINO_X,
  GROUND_Y,
  checkCollision,
  createGameState,
  isAuxNewTabMenuCandidate,
  pauseGame,
  resolveDinoLocale,
  resumeGame,
  scoreAuxPaneCandidate,
  setDucking,
  startGame,
  stepGame,
  togglePause,
  triggerJump,
} from '../plugins/dino-game/src/dino-core.js';
import { getShortSummary } from '../plugins/mod-manager/src/manager-core.js';
import { findAuxToolbarContainer } from '../plugins/dino-game/src/ui.js';

test('dino-game 物理与跳跃/下蹲/P键暂停流程', () => {
  let state = createGameState();
  assert.equal(state.status, 'idle');
  assert.equal('highScore' in state, false);

  // idle 状态下起跳自动开局
  state = triggerJump(state);
  assert.equal(state.status, 'running');
  assert.equal(state.dino.onGround, false);
  assert.ok(state.dino.vy < 0);

  // 推进若干帧后应上升再落地
  for (let i = 0; i < 60; i++) {
    state = stepGame(state, 0.016, () => 0.5);
  }
  assert.equal(state.dino.onGround, true);
  assert.equal(state.dino.y, GROUND_Y - DINO_STAND_H);
  assert.ok(state.score > 0);

  // 下蹲改变高度
  state = setDucking(state, true);
  assert.equal(state.dino.ducking, true);
  assert.equal(state.dino.y, GROUND_Y - DINO_DUCK_H);
  state = setDucking(state, false);
  assert.equal(state.dino.y, GROUND_Y - DINO_STAND_H);

  // P 键切换暂停与恢复
  state = togglePause(state);
  assert.equal(state.status, 'paused');
  const frozenScore = state.score;
  state = stepGame(state, 0.05, () => 0.5);
  assert.equal(state.score, frozenScore);
  state = togglePause(state);
  assert.equal(state.status, 'running');

  state = pauseGame(state);
  assert.equal(state.status, 'paused');
  state = resumeGame(state);
  assert.equal(state.status, 'running');
});

test('dino-game 碰撞检测与重开归零', () => {
  let state = startGame();
  state = {
    ...state,
    distance: 2000,
    score: 200,
    obstacles: [
      {
        kind: 'cactus-small',
        x: DINO_X + 8,
        y: GROUND_Y - 26,
        width: 15,
        height: 26,
      },
    ],
  };

  assert.equal(checkCollision(state.dino, state.obstacles), true);
  state = stepGame(state, 0.016, () => 0.5);
  assert.equal(state.status, 'gameover');

  // 重开后分数归零
  const restarted = startGame();
  assert.equal(restarted.status, 'running');
  assert.equal(restarted.score, 0);
});

test('右侧辅助面板评分严格要求同时具备新建页菜单与 URL 搜索栏，排除审查/浏览器/模型弹窗/窄子栏', () => {
  const leftSidebarScore = scoreAuxPaneCandidate({
    rect: { left: 0, right: 260, top: 32, bottom: 780, width: 260, height: 748 },
    viewportWidth: 1280,
    viewportHeight: 800,
    hasAuxMenu: true,
    hasUrlSearchInput: true,
    hasTopRightActions: true,
  });
  assert.equal(leftSidebarScore, -1);

  // 模型选择弹窗：未贴近最右边且高度不足主工作区
  const modelPopupScore = scoreAuxPaneCandidate({
    rect: { left: 480, right: 860, top: 520, bottom: 740, width: 380, height: 220 },
    viewportWidth: 1280,
    viewportHeight: 800,
    hasTopRightActions: true,
  });
  assert.equal(modelPopupScore, -1);

  // 文件审查界面：满高贴右但无新建页菜单与 URL 搜索栏
  const reviewPaneScore = scoreAuxPaneCandidate({
    rect: { left: 520, right: 1280, top: 32, bottom: 780, width: 760, height: 748 },
    viewportWidth: 1280,
    viewportHeight: 800,
    hasAuxMenu: false,
    hasUrlSearchInput: false,
    hasTopRightActions: true,
  });
  assert.equal(reviewPaneScore, -1);

  // 浏览器界面：有 URL 地址栏但无新建页菜单
  const browserPaneScore = scoreAuxPaneCandidate({
    rect: { left: 520, right: 1280, top: 32, bottom: 780, width: 760, height: 748 },
    viewportWidth: 1280,
    viewportHeight: 800,
    hasAuxMenu: false,
    hasUrlSearchInput: true,
    hasTopRightActions: true,
  });
  assert.equal(browserPaneScore, -1);

  const rightAuxScore = scoreAuxPaneCandidate({
    rect: { left: 520, right: 1280, top: 32, bottom: 780, width: 760, height: 748 },
    viewportWidth: 1280,
    viewportHeight: 800,
    hasAuxMenu: true,
    hasUrlSearchInput: true,
    hasTopRightActions: true,
  });
  assert.ok(rightAuxScore >= 20);
});

test('新建标签页菜单识别与双语判定', () => {
  assert.equal(
    isAuxNewTabMenuCandidate(['审查', '打开文件', '终端', '浏览器', '侧边提问', 'Plugins (插件)']),
    true,
  );
  assert.equal(
    isAuxNewTabMenuCandidate(['Review', 'Open file', 'Terminal', 'Browser', 'Plugins']),
    true,
  );
  assert.equal(isAuxNewTabMenuCandidate(['新建对话', '自动化任务']), false);

  assert.equal(
    resolveDinoLocale({ __myAntigravityZhCnInstalled: true }, { documentElement: { lang: 'en' } }),
    'zh-CN',
  );
  assert.equal(
    resolveDinoLocale({ __myAntigravityManager: { bootEnabledIds: ['dino-game'] } }, { documentElement: { lang: 'en' } }),
    'en',
  );
});

test('dino-game mod.json 与 mod-manager 双语简介同步校验', () => {
  const modJsonPath = path.resolve('plugins/dino-game/mod.json');
  const modJson = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
  assert.equal(modJson.id, 'dino-game');
  assert.equal(getShortSummary(modJson, 'zh-CN'), '右侧辅助面板内嵌谷歌小恐龙小游戏');
  assert.equal(getShortSummary(modJson, 'en'), 'Embedded Chrome Dino game in right aux pane');

  const fallbackMod = { id: 'dino-game', name: modJson.name };
  assert.equal(getShortSummary(fallbackMod, 'zh-CN'), '右侧辅助面板内嵌谷歌小恐龙小游戏');
  assert.equal(getShortSummary(fallbackMod, 'en'), 'Embedded Chrome Dino game in right aux pane');
});

test('findAuxToolbarContainer 仅在同时存在新建页菜单与 URL 搜索框时锁定同行的 ⋮ 按钮，绝不误入审查/浏览器/文件树视图', () => {
  const toolbarContainer = { parentElement: null };
  const fileTreeToolbar = { parentElement: null };
  const moreBtn = {
    textContent: 'more_vert',
    parentElement: toolbarContainer,
    closest: () => null,
    hasAttribute: () => false,
    querySelector: (sel) => (sel.includes('symbol') ? { className: 'google-symbols' } : null),
    getBoundingClientRect: () => ({ top: 44, left: 1230, right: 1258, width: 28, height: 28 }),
  };
  const refreshBtn = {
    textContent: '',
    parentElement: fileTreeToolbar,
    closest: () => null,
    hasAttribute: () => false,
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 82, left: 1228, right: 1254, width: 26, height: 26 }),
  };
  const urlInput = {
    getBoundingClientRect: () => ({ top: 40, left: 780, right: 1210, width: 430, height: 36 }),
  };
  const newTabMenuList = {
    closest: () => null,
    children: [
      { hasAttribute: () => false, textContent: '审查' },
      { hasAttribute: () => false, textContent: '打开文件' },
      { hasAttribute: () => false, textContent: '终端' },
      { hasAttribute: () => false, textContent: '浏览器' },
    ],
  };

  // 图 3：新建标签页（有新建页菜单 + URL 搜索栏）-> 精准命中同行 ⋮ 按钮
  const fakeNewTabPane = {
    getBoundingClientRect: () => ({ top: 32, left: 520, right: 1280, width: 760, height: 748 }),
    querySelector: (sel) => (sel.includes('URL') ? urlInput : null),
    querySelectorAll: (sel) => {
      if (sel === 'button') return [refreshBtn, moreBtn];
      if (sel.includes('div')) return [newTabMenuList];
      return [];
    },
  };
  const found = findAuxToolbarContainer(fakeNewTabPane);
  assert.ok(found);
  assert.equal(found.container, toolbarContainer);
  assert.equal(found.beforeEl, moreBtn);

  // 图 2：浏览器界面（有 URL 地址栏但无新建页菜单）-> 返回 null
  const fakeBrowserPane = {
    getBoundingClientRect: () => ({ top: 32, left: 520, right: 1280, width: 760, height: 748 }),
    querySelector: (sel) => (sel.includes('URL') ? urlInput : null),
    querySelectorAll: (sel) => (sel === 'button' ? [moreBtn] : []),
  };
  assert.equal(findAuxToolbarContainer(fakeBrowserPane), null);

  // 图 1：文件审查 / 打开文件界面（无新建页菜单与 URL 搜索栏）-> 返回 null
  const fakeReviewPane = {
    getBoundingClientRect: () => ({ top: 32, left: 520, right: 1280, width: 760, height: 748 }),
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === 'button' ? [refreshBtn, moreBtn] : []),
  };
  assert.equal(findAuxToolbarContainer(fakeReviewPane), null);
});

test('dino-game 打包产物语法有效且可自包含执行', () => {
  const { outPath } = buildDinoGamePlugin();
  const code = fs.readFileSync(outPath, 'utf8');
  assert.doesNotThrow(() => new vm.Script(code, { filename: 'dino-game/index.js' }));
  assert.match(code, /installDinoGamePlugin/);
});
