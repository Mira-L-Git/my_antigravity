export const TASKBAR_BADGE_STYLES = {
  completed: {
    fill: '#27272A',
    text: '#FFFFFF',
  },
  approval: {
    fill: '#FACC15',
    text: '#111827',
  },
  error: {
    fill: '#EF4444',
    text: '#FFFFFF',
  },
};

export const OVERLAY_DPI_SPECS = [
  { scaleFactor: 1.0, size: 16 },
  { scaleFactor: 1.25, size: 20 },
  { scaleFactor: 1.5, size: 24 },
  { scaleFactor: 2.0, size: 32 },
  { scaleFactor: 2.5, size: 40 },
];

export function formatBadgeCount(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 绘制高对比、无细边发糊的 Windows setOverlayIcon 独立角标（按目标 DPI 物理尺寸逐档绘制）。
 */
export function drawTaskbarOverlayIcon(ctx, count, level, size = 32) {
  const label = formatBadgeCount(count);
  const style = TASKBAR_BADGE_STYLES[level] || TASKBAR_BADGE_STYLES.completed;

  ctx.clearRect(0, 0, size, size);
  if (!label) {
    return;
  }

  ctx.save();
  const isThreeChars = label.length >= 3;

  if (isThreeChars) {
    const h = Math.round(size * 0.8);
    const y = Math.round((size - h) / 2);
    drawRoundedRectPath(ctx, 0, y, size, h, h / 2);
  } else {
    const r = size / 2 - 0.5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = style.fill;
  ctx.fill();

  const fontSize =
    label.length === 1
      ? Math.round(size * 0.72)
      : label.length === 2
        ? Math.round(size * 0.56)
        : Math.round(size * 0.42);

  ctx.fillStyle = style.text;
  ctx.font = `800 ${fontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + Math.max(0.5, size * 0.03));
  ctx.restore();
}

export const TRAY_DOT_COLORS = {
  completed: '#22C55E',
  approval: '#FACC15',
  error: '#EF4444',
};

/**
 * 绘制系统托盘图标：圆点直径约占画布 50%，底图微向左下偏移，
 * 使圆点圆心依然精准落在白色圆角方框右上边角且不被画布裁剪。
 */
export function drawTrayDottedIcon(ctx, baseImg, level, size = 64) {
  ctx.clearRect(0, 0, size, size);
  const color = TRAY_DOT_COLORS[level];
  if (!color) {
    if (baseImg) {
      ctx.drawImage(baseImg, 0, 0, size, size);
    }
    return;
  }

  if (baseImg) {
    const offsetX = -size * 0.05;
    const offsetY = size * 0.12;
    const drawSize = size * 0.92;
    ctx.drawImage(baseImg, offsetX, offsetY, drawSize, drawSize);
  }

  ctx.save();
  const radius = Math.max(6, Math.round(size * 0.25));
  const cx = Math.round(size * 0.725);
  const cy = Math.round(size * 0.275);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.lineWidth = Math.max(2, Math.round(size * 0.04));
  ctx.strokeStyle = '#18181B';
  ctx.stroke();
  ctx.restore();
}

export function createIconRenderer(win, doc, bridge) {
  let baseImgPromise = null;
  let cachedOverlay = null;
  const cache = new Map();

  function renderTaskbarIcon(count, level) {
    const label = formatBadgeCount(count);
    if (!label || !Object.hasOwn(TASKBAR_BADGE_STYLES, level)) return {};
    if (cachedOverlay?.label === label && cachedOverlay.level === level) return cachedOverlay.icons;

    const windowReps = [];
    for (const { scaleFactor, size } of OVERLAY_DPI_SPECS) {
      const canvas = doc.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext?.('2d');
      if (!ctx) continue;
      drawTaskbarOverlayIcon(ctx, count, level, size);
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl) windowReps.push({ scaleFactor, width: size, height: size, dataUrl });
    }
    const windowPngDataUrl = windowReps.find((rep) => rep.scaleFactor === 2)?.dataUrl || windowReps.at(-1)?.dataUrl;
    const icons = { windowReps, windowPngDataUrl };
    if (windowPngDataUrl) cachedOverlay = { label, level, icons };
    return icons;
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof win.Image !== 'function') {
        resolve(null);
        return;
      }
      const img = new win.Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function ensureBaseImage() {
    if (!baseImgPromise) {
      baseImgPromise = (async () => {
        if (!bridge || typeof bridge.getBaseIcon !== 'function') {
          return null;
        }
        const res = await bridge.getBaseIcon();
        if (!res?.ok || !res.dataUrl) {
          return null;
        }
        return loadImageFromDataUrl(res.dataUrl);
      })().catch(() => null).then((img) => {
        if (!img) baseImgPromise = null;
        return img;
      });
    }
    return baseImgPromise;
  }

  async function renderTrayIcon(level) {
    if (cache.has(level)) return cache.get(level);
    if (!TRAY_DOT_COLORS[level] || typeof doc?.createElement !== 'function') return null;
    const baseImg = await ensureBaseImage();
    if (!baseImg) return null;
    if (cache.has(level)) return cache.get(level);
    const canvas = doc.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    drawTrayDottedIcon(ctx, baseImg, level, 64);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl) cache.set(level, dataUrl);
    return dataUrl;
  }

  return {
    renderTaskbarIcon,
    renderTrayIcon,
    getCachedTrayIcon: (level) => cache.get(level) || null,
  };
}
