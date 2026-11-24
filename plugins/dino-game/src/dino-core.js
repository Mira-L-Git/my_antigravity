/**
 * dino-game 纯函数核心模块（Stage 1 精简版）：
 * - 小恐龙物理引擎、障碍物生成、宽容碰撞判定与当前局计分；
 * - 右侧辅助面板容器评分与 Plugins 子菜单识别；
 * - 双语（zh-cn 开关）识别。
 */

export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 160;
export const GROUND_Y = 132;

export const DINO_X = 36;
export const DINO_STAND_W = 28;
export const DINO_STAND_H = 34;
export const DINO_DUCK_W = 38;
export const DINO_DUCK_H = 20;

export const GRAVITY = 2100;
export const FAST_FALL_GRAVITY = 4800;
export const JUMP_VELOCITY = -650;
export const BASE_SPEED = 240;
export const MAX_SPEED = 560;
export const SPEED_ACCEL = 5.5;

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
export function resolveDinoLocale(win, doc) {
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
 * 判断一组菜单文本是否属于右侧辅助面板的新建页列表（至少命中 2 个已知锚点）。
 */
export function isAuxNewTabMenuCandidate(textList) {
  if (!Array.isArray(textList) || textList.length < 2) {
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
    if (hits >= 2) {
      return true;
    }
  }
  return false;
}

/**
 * 对右侧辅助面板根容器候选进行打分，严格排除左侧边栏与过小元素。
 */
export function scoreAuxPaneCandidate(info) {
  if (!info || !info.rect) return -1;
  const { rect, viewportWidth = 1280, viewportHeight = 800 } = info;
  if (rect.width < 220 || rect.height < 240) {
    return -1;
  }
  // 严格限定在窗口右侧区域，绝不挂载到左侧边栏
  if (rect.left < viewportWidth * 0.35) {
    return -1;
  }
  if (rect.right > viewportWidth + 8 || rect.bottom > viewportHeight + 8) {
    return -1;
  }

  let score = 1;
  if (info.hasAuxMenu) score += 12;
  if (info.hasUrlSearchInput) score += 8;
  if (info.hasTopRightActions) score += 6;
  if (rect.left >= viewportWidth * 0.5) score += 4;
  if (rect.height >= viewportHeight * 0.7) score += 2;
  return score;
}

/**
 * 创建初始游戏状态。
 */
export function createGameState() {
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
export function startGame() {
  const fresh = createGameState();
  fresh.status = 'running';
  return fresh;
}

/**
 * 暂停游戏（仅在 running 时有效）。
 */
export function pauseGame(state) {
  if (!state || state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

/**
 * 恢复游戏（仅在 paused 时有效）。
 */
export function resumeGame(state) {
  if (!state || state.status !== 'paused') return state;
  return { ...state, status: 'running' };
}

/**
 * 切换暂停状态（P 键）。
 */
export function togglePause(state) {
  if (!state) return state;
  if (state.status === 'running') return pauseGame(state);
  if (state.status === 'paused') return resumeGame(state);
  return state;
}

/**
 * 触发跳跃：若处于 idle 或 gameover 则直接开局并起跳。
 */
export function triggerJump(state) {
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
export function setDucking(state, ducking) {
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
export function checkCollision(dino, obstacles) {
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
export function stepGame(state, dtSeconds, rng = Math.random) {
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
