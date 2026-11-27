// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/dino-game/src/*.js, then run `npm run sync`.

(function registerDinoGameMod(win, doc) {
// --- dino-core.js ---
/**
 * dino-game 纯函数核心模块（Stage 1 精简版）：
 * - 小恐龙物理引擎、障碍物生成、宽容碰撞判定与当前局计分；
 * - 右侧辅助面板容器评分与 Plugins 子菜单识别；
 * - 双语（zh-cn 开关）识别。
 */
const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 160;
const GROUND_Y = 132;
const DINO_X = 36;
const DINO_STAND_W = 28;
const DINO_STAND_H = 34;
const DINO_DUCK_W = 38;
const DINO_DUCK_H = 20;
const GRAVITY = 2100;
const FAST_FALL_GRAVITY = 4800;
const JUMP_VELOCITY = -650;
const BASE_SPEED = 240;
const MAX_SPEED = 560;
const SPEED_ACCEL = 5.5;

const AUX_MENU_ANCHORS = [
  'review',
  '审查',
  'open file',
  '打开文件',
  'terminal',
  '终端',
  'browser',
  '浏览器',
  'side question',
  '侧边提问',
  'plugins',
  'plugins (插件)',
  'plugins（插件）',
];

/**
 * 判断当前是否使用简体中文界面（优先依据 zh-cn 插件状态）。
 */
function resolveDinoLocale(win, doc) {
  if (win && win.__myAntigravityZhCnInstalled) {
    return 'zh-CN';
  }
  const bootIds = win?.__myAntigravityManager?.bootEnabledIds;
  if (Array.isArray(bootIds) && bootIds.includes('zh-cn')) {
    return 'zh-CN';
  }
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if (htmlLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 判断一组菜单文本是否属于右侧辅助面板的新建页列表（至少命中 3 个已知锚点，排除浏览器或审查视图）。
 */
function isAuxNewTabMenuCandidate(textList) {
  if (!Array.isArray(textList) || textList.length < 3) {
    return false;
  }
  let hits = 0;
  const seen = new Set();
  for (const raw of textList) {
    const normalized = String(raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) continue;
    for (const anchor of AUX_MENU_ANCHORS) {
      if (normalized === anchor || normalized.startsWith(anchor + ' ') || normalized.startsWith(anchor + '(') || normalized.startsWith(anchor + '（')) {
        if (!seen.has(anchor)) {
          seen.add(anchor);
          hits += 1;
        }
        break;
      }
    }
    if (hits >= 3) {
      return true;
    }
  }
  return false;
}

/**
 * 对右侧辅助面板根容器候选进行打分：严格要求同时具备新建页菜单与 URL 搜索栏，排除审查/浏览器/弹窗/文件树。
 */
function scoreAuxPaneCandidate(info) {
  if (!info || !info.rect) return -1;
  const { rect, viewportWidth = 1280, viewportHeight = 800 } = info;
  const minHeight = Math.max(320, viewportHeight * 0.55);
  if (rect.width < 240 || rect.height < minHeight) {
    return -1;
  }
  // 必须位于右侧新建标签页（同时具备新建页菜单与 URL 搜索框），绝不挂载到审查、浏览器、终端或文件树
  if (!info.hasAuxMenu || !info.hasUrlSearchInput || !info.hasTopRightActions) {
    return -1;
  }
  if (rect.left < viewportWidth * 0.32 || rect.top > 96) {
    return -1;
  }
  if (rect.right < viewportWidth - 32 || rect.right > viewportWidth + 8 || rect.bottom > viewportHeight + 8) {
    return -1;
  }

  let score = 20;
  if (rect.height >= viewportHeight * 0.7) score += 2;
  if (rect.width >= viewportWidth * 0.25) score += 4;
  return score;
}

/**
 * 创建初始游戏状态。
 */
function createGameState() {
  return {
    status: 'idle', // 'idle' | 'running' | 'paused' | 'gameover'
    score: 0,
    distance: 0,
    speed: BASE_SPEED,
    elapsed: 0,
    groundOffset: 0,
    spawnTimer: 0.85,
    dino: {
      y: GROUND_Y - DINO_STAND_H,
      vy: 0,
      onGround: true,
      ducking: false,
      legFrame: 0,
    },
    obstacles: [],
    clouds: [
      { x: 130, y: 34, speedFactor: 0.18 },
      { x: 310, y: 50, speedFactor: 0.14 },
      { x: 430, y: 26, speedFactor: 0.2 },
    ],
  };
}

/**
 * 重置并开始一局游戏。
 */
function startGame() {
  const fresh = createGameState();
  fresh.status = 'running';
  return fresh;
}

/**
 * 暂停游戏（仅在 running 时有效）。
 */
function pauseGame(state) {
  if (!state || state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

/**
 * 恢复游戏（仅在 paused 时有效）。
 */
function resumeGame(state) {
  if (!state || state.status !== 'paused') return state;
  return { ...state, status: 'running' };
}

/**
 * 切换暂停状态（P 键）。
 */
function togglePause(state) {
  if (!state) return state;
  if (state.status === 'running') return pauseGame(state);
  if (state.status === 'paused') return resumeGame(state);
  return state;
}

/**
 * 触发跳跃：若处于 idle 或 gameover 则直接开局并起跳。
 */
function triggerJump(state) {
  let next = state;
  if (!next || next.status === 'idle' || next.status === 'gameover') {
    next = startGame();
  } else if (next.status === 'paused') {
    next = resumeGame(next);
  }
  if (next.status === 'running' && next.dino.onGround && !next.dino.ducking) {
    next = {
      ...next,
      dino: {
        ...next.dino,
        vy: JUMP_VELOCITY,
        onGround: false,
      },
    };
  }
  return next;
}

/**
 * 设置下蹲状态（空中按下蹲会触发快速下落）。
 */
function setDucking(state, ducking) {
  if (!state || state.status !== 'running') return state;
  const wantDuck = Boolean(ducking);
  if (state.dino.ducking === wantDuck) return state;
  const h = wantDuck ? DINO_DUCK_H : DINO_STAND_H;
  return {
    ...state,
    dino: {
      ...state.dino,
      ducking: wantDuck,
      y: state.dino.onGround ? GROUND_Y - h : state.dino.y,
    },
  };
}

function createObstacle(kind, rng) {
  if (kind === 'bird') {
    const heights = [GROUND_Y - 24, GROUND_Y - 46, GROUND_Y - 64];
    const y = heights[Math.floor(rng() * heights.length)] ?? heights[0];
    return {
      kind: 'bird',
      x: WORLD_WIDTH + 20,
      y: y - 20,
      width: 34,
      height: 20,
      wingFrame: 0,
    };
  }
  if (kind === 'cactus-double') {
    return {
      kind: 'cactus-double',
      x: WORLD_WIDTH + 20,
      y: GROUND_Y - 30,
      width: 30,
      height: 30,
    };
  }
  if (kind === 'cactus-tall') {
    return {
      kind: 'cactus-tall',
      x: WORLD_WIDTH + 20,
      y: GROUND_Y - 38,
      width: 18,
      height: 38,
    };
  }
  return {
    kind: 'cactus-small',
    x: WORLD_WIDTH + 20,
    y: GROUND_Y - 26,
    width: 15,
    height: 26,
  };
}

/**
 * 宽容 AABB 碰撞检测（内缩边距，避免像素边角擦碰误判）。
 */
function checkCollision(dino, obstacles) {
  const dinoW = dino.ducking ? DINO_DUCK_W : DINO_STAND_W;
  const dinoH = dino.ducking ? DINO_DUCK_H : DINO_STAND_H;
  const dx1 = DINO_X + 6;
  const dy1 = dino.y + 4;
  const dx2 = DINO_X + dinoW - 6;
  const dy2 = dino.y + dinoH - 4;

  for (const obs of obstacles) {
    const ox1 = obs.x + 3;
    const oy1 = obs.y + 3;
    const ox2 = obs.x + obs.width - 3;
    const oy2 = obs.y + obs.height - 3;
    if (dx1 < ox2 && dx2 > ox1 && dy1 < oy2 && dy2 > oy1) {
      return true;
    }
  }
  return false;
}

/**
 * 推进一帧游戏状态（dt 单位为秒，自动限幅防止切后台瞬移）。
 */
function stepGame(state, dtSeconds, rng = Math.random) {
  if (!state || state.status !== 'running') {
    return state;
  }
  const dt = Math.min(Math.max(Number(dtSeconds) || 0, 0), 0.05);
  if (dt === 0) return state;

  const speed = Math.min(MAX_SPEED, state.speed + SPEED_ACCEL * dt);
  const distance = state.distance + speed * dt;
  const score = Math.floor(distance * 0.1);
  const elapsed = state.elapsed + dt;

  // 更新小恐龙物理
  let dinoY = state.dino.y;
  let dinoVy = state.dino.vy;
  let onGround = state.dino.onGround;
  const currentH = state.dino.ducking ? DINO_DUCK_H : DINO_STAND_H;
  const floorTop = GROUND_Y - currentH;

  if (!onGround) {
    const g = state.dino.ducking ? FAST_FALL_GRAVITY : GRAVITY;
    dinoVy += g * dt;
    dinoY += dinoVy * dt;
    if (dinoY >= floorTop) {
      dinoY = floorTop;
      dinoVy = 0;
      onGround = true;
    }
  } else {
    dinoY = floorTop;
  }

  const dino = {
    ...state.dino,
    y: dinoY,
    vy: dinoVy,
    onGround,
    legFrame: Math.floor(elapsed * 12) % 2,
  };

  // 更新云朵与地面滚动
  const clouds = state.clouds.map((c) => {
    let nx = c.x - speed * c.speedFactor * dt;
    if (nx < -48) {
      nx = WORLD_WIDTH + 20 + rng() * 60;
    }
    return { ...c, x: nx };
  });
  const groundOffset = (state.groundOffset + speed * dt) % 24;

  // 移动障碍物并清理离屏元素
  const movedObstacles = state.obstacles
    .map((obs) => ({
      ...obs,
      x: obs.x - speed * dt,
      wingFrame: obs.kind === 'bird' ? Math.floor(elapsed * 8) % 2 : obs.wingFrame,
    }))
    .filter((obs) => obs.x + obs.width > -30);

  // 障碍物生成计时
  let spawnTimer = state.spawnTimer - dt;
  if (spawnTimer <= 0) {
    const allowBird = score >= 150;
    const roll = rng();
    let kind = 'cactus-small';
    if (allowBird && roll > 0.76) {
      kind = 'bird';
    } else if (roll > 0.52) {
      kind = 'cactus-double';
    } else if (roll > 0.28) {
      kind = 'cactus-tall';
    }
    movedObstacles.push(createObstacle(kind, rng));
    const minGapSec = Math.max(0.58, 1.05 - (speed - BASE_SPEED) / 900);
    spawnTimer = minGapSec + rng() * 0.65;
  }

  const hit = checkCollision(dino, movedObstacles);

  return {
    ...state,
    status: hit ? 'gameover' : 'running',
    score,
    distance,
    speed,
    elapsed,
    groundOffset,
    spawnTimer,
    dino,
    obstacles: movedObstacles,
    clouds,
  };
}

// --- ui.js ---
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
    scoreLabel: '当前',
    exit: '退出',
    idleHint: '按 空格 / ↑ 或点击画面开始',
    pausedHint: '已暂停 · 按 P 或点击画面继续',
    gameoverHint: '游戏结束 · 按 空格 或点击重来',
    controlsHint: '跳跃',
    duckHint: '下蹲/速降',
    pauseHint: '暂停/继续',
  },
  en: {
    toolbarTitle: 'Chrome Dino',
    scoreLabel: 'SCORE',
    exit: 'Exit',
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

const IGNORED_ANCESTOR_SELECTOR =
  `[${ATTR_OVERLAY}], [role="dialog"], [role="menu"], [role="listbox"], [aria-modal="true"], ` +
  '[data-radix-popper-content-wrapper], [data-radix-portal], [data-my-antigravity-mod]';

/**
 * 在右侧辅助面板「新建标签页」中定位 URL 搜索框右侧的 `⋮` 控制按钮（无新建页菜单或无 URL 搜索框时不挂载）。
 */
function findAuxToolbarContainer(auxPane) {
  if (!auxPane || typeof auxPane.getBoundingClientRect !== 'function') return null;
  if (!hasAuxNewTabMenu(auxPane)) return null;

  const auxRect = auxPane.getBoundingClientRect();
  const urlInput = auxPane.querySelector?.('input[placeholder*="URL" i], input[placeholder*="Search" i]');
  const inputRect = urlInput && typeof urlInput.getBoundingClientRect === 'function'
    ? urlInput.getBoundingClientRect()
    : null;
  if (!inputRect || inputRect.width <= 0 || inputRect.height <= 0 || inputRect.top > auxRect.top + 120) {
    return null;
  }

  const inputCenterY = inputRect.top + inputRect.height / 2;
  const matched = Array.from(auxPane.querySelectorAll('button')).filter((btn) => {
    if (btn.closest?.(IGNORED_ANCESTOR_SELECTOR)) return false;
    if (btn.hasAttribute?.(ATTR_TRIGGER)) return false;
    if (typeof btn.getBoundingClientRect !== 'function') return false;
    const r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.width > 48 || r.height > 48) return false;
    if (!isIconOnlyButton(btn)) return false;
    const btnCenterY = r.top + r.height / 2;
    return (
      Math.abs(btnCenterY - inputCenterY) <= 24 &&
      r.left >= inputRect.right - 8 &&
      r.left >= auxRect.right - 240
    );
  });

  if (matched.length === 0) return null;
  matched.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const anchorBtn = matched[0];
  return { container: anchorBtn.parentElement, beforeEl: anchorBtn };
}

/**
 * 探测并评分右侧辅助面板根容器（严格限制在视口右侧常驻分栏，排除浮层与窄子栏）。
 */
function findRightAuxPane(win, doc) {
  if (!doc || !doc.body) return null;
  const vw = win?.innerWidth || 1280;
  const vh = win?.innerHeight || 800;

  const elements = doc.querySelectorAll('div, section, aside, main');
  let bestEl = null;
  let bestRect = null;
  let bestScore = -1;

  for (const el of elements) {
    if (el.closest?.(IGNORED_ANCESTOR_SELECTOR)) continue;
    if (typeof el.getBoundingClientRect !== 'function') continue;
    const rect = el.getBoundingClientRect();
    if (
      rect.width < 240 ||
      rect.height < Math.max(320, vh * 0.55) ||
      rect.left < vw * 0.32 ||
      rect.top > 96 ||
      rect.right < vw - 32
    ) {
      continue;
    }

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
      bestRect = rect;
    } else if (
      score === bestScore &&
      bestEl &&
      bestEl.contains(el) &&
      bestRect &&
      rect.width >= bestRect.width - 16
    ) {
      // 仅在保持完整面板宽度时向内收敛，绝不收缩到内部文件树等窄子栏
      bestEl = el;
      bestRect = rect;
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
function createDinoGameController(win, doc) {
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

    const stage = doc.createElement('div');
    stage.className = 'my-antigravity-dino-stage';

    const scoreboard = doc.createElement('div');
    scoreboard.className = 'my-antigravity-dino-scoreboard';
    const scoreWrap = doc.createElement('span');
    scoreWrap.className = 'my-antigravity-dino-score';
    scoreWrap.textContent = `${t.scoreLabel} `;
    const scoreVal = doc.createElement('strong');
    scoreWrap.appendChild(scoreVal);

    const exitBtn = doc.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'my-antigravity-dino-exit-btn';
    exitBtn.title = 'Esc';
    exitBtn.setAttribute('aria-label', t.exit);
    exitBtn.textContent = t.exit;
    exitBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    exitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOverlay();
    });

    scoreboard.appendChild(scoreWrap);
    scoreboard.appendChild(exitBtn);

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

  function cleanupStaleTriggers(keepContainer = null) {
    const triggers = doc.querySelectorAll?.(`[${ATTR_TRIGGER}="toolbar"]`) || [];
    let kept = false;
    for (const btn of triggers) {
      if (keepContainer && !kept && btn.parentElement === keepContainer) {
        kept = true;
      } else {
        btn.remove?.();
      }
    }
    return kept;
  }

  function syncMount() {
    const t = getLabels();
    const auxPane = findRightAuxPane(win, doc);
    if (!auxPane) {
      cleanupStaleTriggers(null);
      if (isOpen && overlayEl && !overlayEl.isConnected) {
        closeOverlay();
      }
      return;
    }
    currentAuxPane = auxPane;

    // 仅在右侧辅助面板唯一最顶部控制栏挂载 1 个小恐龙图标入口，并清理残留误挂按钮
    const toolbar = findAuxToolbarContainer(auxPane);
    if (!toolbar) {
      cleanupStaleTriggers(null);
    } else if (!cleanupStaleTriggers(toolbar.container)) {
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

// --- entry.js ---
/**
 * dino-game 运行时入口：
 * 在右侧辅助面板挂载谷歌小恐龙入口与无边框覆盖层视图。
 */
function installDinoGamePlugin(win = window, doc = document) {
  if (!win || !doc || win.__myAntigravityDinoGameInstalled) {
    return null;
  }
  win.__myAntigravityDinoGameInstalled = true;

  const controller = createDinoGameController(win, doc);
  let observer = null;
  let scheduled = false;
  let settleTimer = null;

  function scheduleSyncMount() {
    if (scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      controller.syncMount();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flush);
    } else {
      queueMicrotask(flush);
    }
  }

  function scheduleWithSettle() {
    scheduleSyncMount();
    if (typeof win.setTimeout === 'function') {
      if (settleTimer) win.clearTimeout?.(settleTimer);
      settleTimer = win.setTimeout(() => {
        settleTimer = null;
        controller.syncMount();
      }, 180);
    }
  }

  function start() {
    controller.syncMount();
    if (typeof win.MutationObserver === 'function' && doc.body) {
      observer = new win.MutationObserver(scheduleSyncMount);
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
      });
    }
    doc.addEventListener?.('focusin', scheduleWithSettle);
    doc.addEventListener?.('transitionend', scheduleSyncMount);
    win.addEventListener?.('resize', scheduleSyncMount);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return {
    controller,
    destroy() {
      if (settleTimer) win.clearTimeout?.(settleTimer);
      observer?.disconnect();
      doc.removeEventListener?.('focusin', scheduleWithSettle);
      doc.removeEventListener?.('transitionend', scheduleSyncMount);
      win.removeEventListener?.('resize', scheduleSyncMount);
      controller.destroy();
    },
  };
}

  installDinoGamePlugin(win, doc);
})(window, document);
