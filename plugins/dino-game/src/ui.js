import {
  DINO_X,
  GROUND_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createGameState,
  isAuxNewTabMenuCandidate,
  pauseGame,
  resolveDinoLocale,
  resumeGame,
  scoreAuxPaneCandidate,
  setDucking,
  stepGame,
  togglePause,
  triggerJump,
} from './dino-core.js';

const ATTR_TRIGGER = 'data-my-antigravity-dino-trigger';
const ATTR_OVERLAY = 'data-my-antigravity-dino-overlay';
const ATTR_NO_TRANSLATE = 'data-my-antigravity-no-translate';

const DINO_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
  '<path d="M13 3h6v5h-2v1h-2v2h2v2h-2v4h-2v3h-2v-3h-2v3H9v-4H7v-2H5v-3h2v2h2v-2h2V6h2V3zm2 2v1h1V5h-1z"/>' +
  '</svg>';

const LABELS = {
  'zh-CN': {
    toolbarTitle: '谷歌小恐龙',
    headerTitle: '谷歌小恐龙',
    scoreLabel: '当前',
    close: '关闭',
    idleHint: '按 空格 / ↑ 或点击画面开始',
    pausedHint: '已暂停 · 按 P 或点击画面继续',
    gameoverHint: '游戏结束 · 按 空格 或点击重来',
    controlsHint: '跳跃',
    duckHint: '下蹲/速降',
    pauseHint: '暂停/继续',
  },
  en: {
    toolbarTitle: 'Chrome Dino',
    headerTitle: 'Chrome Dino',
    scoreLabel: 'SCORE',
    close: 'Close',
    idleHint: 'Press Space / ↑ or Click to Start',
    pausedHint: 'Paused · Press P or Click to Resume',
    gameoverHint: 'GAME OVER · Space or Click to Retry',
    controlsHint: 'Jump',
    duckHint: 'Duck / Drop',
    pauseHint: 'Pause',
  },
};

function detectDarkTheme(win, doc) {
  try {
    const html = doc?.documentElement;
    if (html?.classList?.contains('dark') || html?.dataset?.theme === 'dark') {
      return true;
    }
    if (html?.classList?.contains('light') || html?.dataset?.theme === 'light') {
      return false;
    }
    const bg = win?.getComputedStyle?.(doc.body || html)?.backgroundColor || '';
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const lum = 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
      return lum < 128;
    }
  } catch {
    // fallback dark
  }
  return true;
}

/**
 * 向上查找右侧辅助面板的真实背景色，使游戏视图与原生面板（如 Swarm 视图）无缝融为一体。
 */
function resolveHostBackgroundColor(el, win) {
  let cur = el;
  while (cur) {
    try {
      const bg = win?.getComputedStyle?.(cur)?.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        return bg;
      }
    } catch {
      break;
    }
    cur = cur.parentElement;
  }
  return '';
}

function hasAuxNewTabMenu(auxPane) {
  if (!auxPane || typeof auxPane.querySelectorAll !== 'function') return false;
  const candidates = auxPane.querySelectorAll('div, ul, nav');
  for (const el of candidates) {
    if (el.closest?.(`[${ATTR_OVERLAY}]`)) continue;
    const children = Array.from(el.children || []).filter(
      (c) => !c.hasAttribute?.(ATTR_TRIGGER),
    );
    if (children.length < 2 || children.length > 16) continue;
    if (isAuxNewTabMenuCandidate(children.map((c) => c.textContent || ''))) {
      return true;
    }
  }
  return false;
}

function isIconOnlyButton(btn) {
  const text = String(btn.textContent || '').trim();
  if (text.length === 0) return true;
  // 兼容图标字体（如 google-symbols 的 more_vert）
  return Boolean(btn.querySelector?.('[class*="icon" i], [class*="symbol" i]')) && text.length <= 24;
}

/**
 * 在右侧辅助面板内寻找右上角控制栏（放置小恐龙图标触发按钮）。
 */
export function findAuxToolbarContainer(auxPane) {
  if (!auxPane || typeof auxPane.getBoundingClientRect !== 'function') return null;
  const auxRect = auxPane.getBoundingClientRect();
  const urlInput = auxPane.querySelector?.('input[placeholder*="URL" i], input[placeholder*="Search" i]');
  const inputRect = urlInput && typeof urlInput.getBoundingClientRect === 'function'
    ? urlInput.getBoundingClientRect()
    : null;
  const hasVisibleInput = Boolean(inputRect && inputRect.width > 0 && inputRect.height > 0);

  const iconButtons = Array.from(auxPane.querySelectorAll('button')).filter((btn) => {
    if (btn.closest?.(`[${ATTR_OVERLAY}]`)) return false;
    if (btn.hasAttribute?.(ATTR_TRIGGER)) return false;
    if (typeof btn.getBoundingClientRect !== 'function') return false;
    const r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.width > 48 || r.height > 48) return false;
    if (!isIconOnlyButton(btn)) return false;
    return r.left >= auxRect.right - 240;
  });

  if (iconButtons.length === 0) return null;

  // 优先匹配与搜索框处于同一水平行的右侧按钮（如新标签页的 `⋮`）
  let matched = [];
  if (hasVisibleInput) {
    const inputCenterY = inputRect.top + inputRect.height / 2;
    matched = iconButtons.filter((btn) => {
      const r = btn.getBoundingClientRect();
      const btnCenterY = r.top + r.height / 2;
      return Math.abs(btnCenterY - inputCenterY) <= 24 && r.left >= inputRect.right - 8;
    });
  }

  // 回退到右侧面板顶部区域（放宽至 120px，兼容外层含 Tab 栏或内边距的容器）
  if (matched.length === 0) {
    matched = iconButtons.filter((btn) => btn.getBoundingClientRect().top <= auxRect.top + 120);
  }

  if (matched.length === 0) return null;
  matched.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const anchorBtn = matched[0];
  return { container: anchorBtn.parentElement, beforeEl: anchorBtn };
}

/**
 * 探测并评分右侧辅助面板根容器（严格限制在视口右侧）。
 */
export function findRightAuxPane(win, doc) {
  if (!doc || !doc.body) return null;
  const vw = win?.innerWidth || 1280;
  const vh = win?.innerHeight || 800;

  const elements = doc.querySelectorAll('div, section, aside, main');
  let bestEl = null;
  let bestScore = -1;

  for (const el of elements) {
    if (el.closest?.(`[${ATTR_OVERLAY}]`)) continue;
    if (typeof el.getBoundingClientRect !== 'function') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 220 || rect.height < 240 || rect.left < vw * 0.35) continue;

    const hasUrlSearchInput = Boolean(
      el.querySelector?.('input[placeholder*="URL" i], input[placeholder*="Search" i]'),
    );
    const hasAuxMenu = hasAuxNewTabMenu(el);
    const hasTopRightActions = Boolean(findAuxToolbarContainer(el));

    const score = scoreAuxPaneCandidate({
      rect,
      viewportWidth: vw,
      viewportHeight: vh,
      hasAuxMenu,
      hasUrlSearchInput,
      hasTopRightActions,
    });

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    } else if (score === bestScore && bestEl && bestEl.contains(el)) {
      bestEl = el;
    }
  }

  return bestScore >= 4 ? bestEl : null;
}

function drawPixelDino(ctx, dino, status, color) {
  ctx.fillStyle = color;
  const x = DINO_X;
  const y = Math.round(dino.y);

  if (dino.ducking) {
    ctx.fillRect(x, y + 4, 24, 10);
    ctx.fillRect(x + 22, y + 2, 16, 9);
    ctx.fillRect(x - 4, y + 6, 5, 4);
    if (dino.legFrame === 0) {
      ctx.fillRect(x + 6, y + 14, 4, 6);
      ctx.fillRect(x + 15, y + 14, 4, 3);
    } else {
      ctx.fillRect(x + 6, y + 14, 4, 3);
      ctx.fillRect(x + 15, y + 14, 4, 6);
    }
    ctx.clearRect(x + 28, y + 4, 3, 3);
    return;
  }

  ctx.fillRect(x + 12, y, 16, 12);
  ctx.fillRect(x + 14, y + 9, 10, 3);
  ctx.fillRect(x + 6, y + 11, 14, 14);
  ctx.fillRect(x, y + 14, 6, 6);
  ctx.fillRect(x - 2, y + 12, 4, 4);
  ctx.fillRect(x + 20, y + 15, 5, 3);

  if (status === 'gameover') {
    ctx.clearRect(x + 16, y + 2, 4, 4);
    ctx.fillRect(x + 17, y + 3, 2, 2);
  } else {
    ctx.clearRect(x + 16, y + 3, 3, 3);
  }

  if (!dino.onGround) {
    ctx.fillRect(x + 8, y + 25, 4, 8);
    ctx.fillRect(x + 15, y + 25, 4, 8);
  } else if (dino.legFrame === 0) {
    ctx.fillRect(x + 8, y + 25, 4, 9);
    ctx.fillRect(x + 15, y + 25, 4, 5);
  } else {
    ctx.fillRect(x + 8, y + 25, 4, 5);
    ctx.fillRect(x + 15, y + 25, 4, 9);
  }
}

function drawObstacle(ctx, obs, color) {
  ctx.fillStyle = color;
  const x = Math.round(obs.x);
  const y = Math.round(obs.y);

  if (obs.kind === 'bird') {
    ctx.fillRect(x + 8, y + 8, 18, 6);
    ctx.fillRect(x + 24, y + 6, 8, 4);
    ctx.fillRect(x + 2, y + 10, 7, 3);
    if (obs.wingFrame === 0) {
      ctx.fillRect(x + 12, y, 6, 8);
      ctx.fillRect(x + 10, y + 2, 4, 4);
    } else {
      ctx.fillRect(x + 12, y + 14, 6, 6);
    }
    return;
  }

  if (obs.kind === 'cactus-double') {
    ctx.fillRect(x + 4, y + 2, 6, 28);
    ctx.fillRect(x, y + 9, 4, 9);
    ctx.fillRect(x + 10, y + 7, 4, 9);
    ctx.fillRect(x + 19, y + 6, 6, 24);
    ctx.fillRect(x + 15, y + 12, 4, 8);
    ctx.fillRect(x + 25, y + 10, 4, 8);
    return;
  }

  const midX = x + Math.floor(obs.width / 2) - 3;
  ctx.fillRect(midX, y, 6, obs.height);
  ctx.fillRect(x, y + 7, midX - x, 4);
  ctx.fillRect(x, y + 3, 3, 8);
  ctx.fillRect(midX + 6, y + 10, x + obs.width - (midX + 6), 4);
  ctx.fillRect(x + obs.width - 3, y + 5, 3, 9);
}

function renderGameFrame(canvas, state, isDark, hintText) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;

  const fg = isDark ? '#e4e4e7' : '#27272a';
  const muted = isDark ? 'rgba(228, 228, 231, 0.35)' : 'rgba(39, 39, 42, 0.28)';
  const cloudColor = isDark ? 'rgba(228, 228, 231, 0.16)' : 'rgba(39, 39, 42, 0.12)';

  ctx.save();
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = cloudColor;
  for (const c of state.clouds) {
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    ctx.fillRect(cx, cy, 26, 7);
    ctx.fillRect(cx + 6, cy - 4, 14, 5);
  }

  ctx.fillStyle = muted;
  ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, 1.5);
  for (let gx = -Math.floor(state.groundOffset); gx < WORLD_WIDTH; gx += 24) {
    ctx.fillRect(gx + 4, GROUND_Y + 5, 4, 2);
    ctx.fillRect(gx + 15, GROUND_Y + 8, 2, 2);
  }

  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs, fg);
  }
  drawPixelDino(ctx, state.dino, state.status, fg);

  if (hintText) {
    ctx.fillStyle = fg;
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hintText, WORLD_WIDTH / 2, 54);
  }

  ctx.restore();
}

/**
 * 创建 dino-game 控制器，仅保留右侧面板右上角小恐龙图标入口，界面无边框融入原生面板底色。
 */
export function createDinoGameController(win, doc) {
  let state = createGameState();
  let isOpen = false;
  let rafId = null;
  let lastTs = 0;

  let currentAuxPane = null;
  let overlayEl = null;
  let canvasEl = null;
  let scoreValueEl = null;

  function getLabels() {
    const locale = resolveDinoLocale(win, doc);
    return LABELS[locale] || LABELS.en;
  }

  function updateScoreboard() {
    if (scoreValueEl) {
      scoreValueEl.textContent = String(state.score).padStart(5, '0');
    }
  }

  function getOverlayHint() {
    const t = getLabels();
    if (state.status === 'idle') return t.idleHint;
    if (state.status === 'paused') return t.pausedHint;
    if (state.status === 'gameover') return t.gameoverHint;
    return '';
  }

  function drawNow() {
    if (!canvasEl) return;
    const dark = detectDarkTheme(win, doc);
    if (overlayEl) {
      overlayEl.classList.toggle('is-light', !dark);
    }
    renderGameFrame(canvasEl, state, dark, getOverlayHint());
    updateScoreboard();
  }

  function stopLoop() {
    if (rafId !== null && typeof win.cancelAnimationFrame === 'function') {
      win.cancelAnimationFrame(rafId);
    }
    rafId = null;
    lastTs = 0;
  }

  function loop(ts) {
    if (!isOpen || state.status !== 'running') {
      rafId = null;
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    state = stepGame(state, dt);
    drawNow();

    if (state.status === 'running') {
      rafId = win.requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function ensureLoopRunning() {
    if (isOpen && state.status === 'running' && rafId === null) {
      lastTs = 0;
      rafId = win.requestAnimationFrame(loop);
    }
  }

  function handleActionJump() {
    state = triggerJump(state);
    drawNow();
    ensureLoopRunning();
  }

  function closeOverlay() {
    isOpen = false;
    if (state.status === 'running') {
      state = pauseGame(state);
    }
    stopLoop();
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
      canvasEl = null;
      scoreValueEl = null;
    }
    syncTriggerStates();
  }

  function syncTriggerStates() {
    const triggers = doc.querySelectorAll?.(`[${ATTR_TRIGGER}="toolbar"]`) || [];
    for (const btn of triggers) {
      btn.setAttribute('data-active', isOpen ? 'true' : 'false');
    }
  }

  function buildOverlay() {
    const t = getLabels();
    const overlay = doc.createElement('div');
    overlay.className = 'my-antigravity-dino-overlay';
    overlay.setAttribute(ATTR_OVERLAY, '1');
    overlay.setAttribute(ATTR_NO_TRANSLATE, '1');
    overlay.setAttribute('tabindex', '0');

    const header = doc.createElement('div');
    header.className = 'my-antigravity-dino-header';

    const titleGroup = doc.createElement('div');
    titleGroup.className = 'my-antigravity-dino-title-group';
    titleGroup.innerHTML = DINO_ICON_SVG;
    const titleSpan = doc.createElement('span');
    titleSpan.textContent = t.headerTitle;
    titleGroup.appendChild(titleSpan);

    const actions = doc.createElement('div');
    actions.className = 'my-antigravity-dino-actions';

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'my-antigravity-dino-icon-btn';
    closeBtn.textContent = t.close;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOverlay();
    });

    actions.appendChild(closeBtn);
    header.appendChild(titleGroup);
    header.appendChild(actions);

    const stage = doc.createElement('div');
    stage.className = 'my-antigravity-dino-stage';

    const scoreboard = doc.createElement('div');
    scoreboard.className = 'my-antigravity-dino-scoreboard';
    const scoreWrap = doc.createElement('span');
    scoreWrap.textContent = `${t.scoreLabel} `;
    const scoreVal = doc.createElement('strong');
    scoreWrap.appendChild(scoreVal);
    scoreboard.appendChild(scoreWrap);

    const canvasWrap = doc.createElement('div');
    canvasWrap.className = 'my-antigravity-dino-canvas-wrap';

    const canvas = doc.createElement('canvas');
    canvas.className = 'my-antigravity-dino-canvas';
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    canvas.width = WORLD_WIDTH * dpr;
    canvas.height = WORLD_HEIGHT * dpr;
    const ctx = canvas.getContext?.('2d');
    ctx?.scale?.(dpr, dpr);

    canvasWrap.appendChild(canvas);
    canvasWrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      overlay.focus();
      if (state.status === 'paused') {
        state = resumeGame(state);
        drawNow();
        ensureLoopRunning();
      } else {
        handleActionJump();
      }
    });

    const hint = doc.createElement('div');
    hint.className = 'my-antigravity-dino-hint';
    hint.innerHTML =
      `<span><span class="my-antigravity-dino-kbd">Space</span> / <span class="my-antigravity-dino-kbd">↑</span> ${t.controlsHint}</span>` +
      `<span><span class="my-antigravity-dino-kbd">↓</span> ${t.duckHint}</span>` +
      `<span><span class="my-antigravity-dino-kbd">P</span> ${t.pauseHint}</span>`;

    stage.appendChild(scoreboard);
    stage.appendChild(canvasWrap);
    stage.appendChild(hint);

    overlay.appendChild(header);
    overlay.appendChild(stage);

    overlay.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          handleActionJump();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        state = setDucking(state, true);
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        state = togglePause(state);
        if (state.status === 'paused') {
          stopLoop();
          drawNow();
        } else if (state.status === 'running') {
          drawNow();
          ensureLoopRunning();
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      }
    });

    overlay.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        state = setDucking(state, false);
      }
    });

    overlayEl = overlay;
    canvasEl = canvas;
    scoreValueEl = scoreVal;
    return overlay;
  }

  function openOverlay(auxPane) {
    const targetPane = auxPane || currentAuxPane || findRightAuxPane(win, doc);
    if (!targetPane) return false;
    currentAuxPane = targetPane;

    const pos = win.getComputedStyle?.(targetPane)?.position;
    if (pos === 'static') {
      targetPane.style.position = 'relative';
    }

    if (!overlayEl || !overlayEl.isConnected) {
      buildOverlay();
      targetPane.appendChild(overlayEl);
    }

    // 继承宿主面板底色，达到类似 Swarm 视图的无背景融合感
    const hostBg = resolveHostBackgroundColor(targetPane, win);
    if (hostBg) {
      overlayEl.style.backgroundColor = hostBg;
    }

    isOpen = true;
    syncTriggerStates();
    drawNow();
    overlayEl.focus();
    return true;
  }

  function toggleOverlay(auxPane) {
    if (isOpen) {
      closeOverlay();
    } else {
      openOverlay(auxPane);
    }
  }

  function syncMount() {
    const t = getLabels();
    const auxPane = findRightAuxPane(win, doc);
    if (!auxPane) {
      if (isOpen && overlayEl && !overlayEl.isConnected) {
        closeOverlay();
      }
      return;
    }
    currentAuxPane = auxPane;

    // 仅在右侧辅助面板右上角挂载小恐龙图标入口
    const toolbar = findAuxToolbarContainer(auxPane);
    if (toolbar && !toolbar.container.querySelector(`[${ATTR_TRIGGER}="toolbar"]`)) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'my-antigravity-dino-toolbar-btn';
      btn.setAttribute(ATTR_TRIGGER, 'toolbar');
      btn.setAttribute(ATTR_NO_TRANSLATE, '1');
      btn.title = t.toolbarTitle;
      btn.setAttribute('aria-label', t.toolbarTitle);
      btn.setAttribute('data-active', isOpen ? 'true' : 'false');
      btn.innerHTML = DINO_ICON_SVG;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOverlay(auxPane);
      });
      toolbar.container.insertBefore(btn, toolbar.beforeEl);
    }

    if (isOpen && overlayEl && !overlayEl.isConnected) {
      openOverlay(auxPane);
    }
  }

  return {
    syncMount,
    openOverlay,
    closeOverlay,
    toggleOverlay,
    getState: () => state,
    isOpen: () => isOpen,
    destroy() {
      closeOverlay();
    },
  };
}
