import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripModuleSyntax(source) {
  return source
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^\s*export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/gm, '');
}

export function buildDinoGamePlugin() {
  const srcDir = path.join(__dirname, 'src');
  const outPath = path.join(__dirname, 'index.js');

  const files = ['dino-core.js', 'ui.js', 'entry.js'];
  const chunks = files.map((file) => {
    const raw = fs.readFileSync(path.join(srcDir, file), 'utf8');
    return `// --- ${file} ---\n${stripModuleSyntax(raw).trim()}`;
  });

  const banner = [
    '// GENERATED FILE - DO NOT EDIT DIRECTLY.',
    '// Edit plugins/dino-game/src/*.js, then run `npm run sync`.',
    '',
  ].join('\n');

  const bundled = [
    banner,
    '(function registerDinoGameMod(win, doc) {',
    chunks.join('\n\n'),
    '',
    '  installDinoGamePlugin(win, doc);',
    '})(window, document);',
    '',
  ].join('\n');

  fs.writeFileSync(outPath, bundled, 'utf8');
  return { outPath, files };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const res = buildDinoGamePlugin();
  console.log(`[dino-game] 构建完成: ${res.outPath} (${res.files.length} 个源码模块)`);
}
