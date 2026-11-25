import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 去除 ESM import/export 语法，将多模块源码拼装为可直接注入页面主世界的单文件 IIFE。
 */
function stripModuleSyntax(source) {
  return source
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^\s*export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/gm, '');
}

function loadIconsMap() {
  const providersDir = path.join(__dirname, 'assets', 'providers');
  const map = {};
  if (fs.existsSync(providersDir)) {
    for (const entry of fs.readdirSync(providersDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.svg')) {
        const id = entry.name.replace(/\.svg$/i, '');
        const key = id === 'xiaomimimo' ? 'mimo' : id;
        map[key] = fs.readFileSync(path.join(providersDir, entry.name), 'utf8').trim();
      }
    }
  }
  const fallbackPath = path.join(__dirname, 'assets', 'ui', 'sparkles.svg');
  if (fs.existsSync(fallbackPath)) {
    map.fallback = fs.readFileSync(fallbackPath, 'utf8').trim();
  }
  return map;
}

export function buildModelEnhancerPlugin() {
  const srcDir = path.join(__dirname, 'src');
  const outPath = path.join(__dirname, 'index.js');

  const iconsMap = loadIconsMap();
  const files = ['icon-registry.js', 'model-core.js', 'slider-ui.js', 'entry.js'];
  const chunks = files.map((file) => {
    const raw = fs.readFileSync(path.join(srcDir, file), 'utf8');
    return `// --- ${file} ---\n${stripModuleSyntax(raw).trim()}`;
  });

  const banner = [
    '// GENERATED FILE - DO NOT EDIT DIRECTLY.',
    '// Edit plugins/model-enhancer/src/*.js or assets/, then run `npm run sync`.',
    '',
  ].join('\n');

  const bundled = [
    banner,
    '(function registerModelEnhancerMod(win, doc) {',
    `  const __MODEL_ENHANCER_ICONS__ = ${JSON.stringify(iconsMap)};`,
    '',
    chunks.join('\n\n'),
    '',
    '  installModelEnhancerPlugin(win, doc, __MODEL_ENHANCER_ICONS__);',
    '})(window, document);',
    '',
  ].join('\n');

  fs.writeFileSync(outPath, bundled, 'utf8');
  return { outPath, files, iconCount: Object.keys(iconsMap).length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const res = buildModelEnhancerPlugin();
  console.log(
    `[model-enhancer] 构建完成: ${res.outPath} (${res.files.length} 个源码模块, ${res.iconCount} 个图标)`,
  );
}
