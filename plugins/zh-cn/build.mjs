import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 将 plugins/zh-cn/dict/*.json 与 src/translator.js 打包为自包含的 index.js。
 */
export function buildZhCnPlugin() {
  const dictDir = path.join(__dirname, 'dict');
  const srcPath = path.join(__dirname, 'src', 'translator.js');
  const outPath = path.join(__dirname, 'index.js');

  const exactDict = {};
  let patterns = [];

  const files = fs
    .readdirSync(dictDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    const full = path.join(dictDir, file);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (file === 'patterns.json') {
      patterns = data;
    } else {
      Object.assign(exactDict, data);
    }
  }

  const template = fs.readFileSync(srcPath, 'utf8');
  const exactJson = JSON.stringify(exactDict, null, 2);
  const patternsJson = JSON.stringify(patterns, null, 2);
  const output = template
    .replaceAll('__ZH_CN_EXACT_DICT__', () => exactJson)
    .replaceAll('__ZH_CN_PATTERNS__', () => patternsJson);

  const banner = [
    '// GENERATED FILE - DO NOT EDIT DIRECTLY.',
    '// Edit plugins/zh-cn/dict/*.json or plugins/zh-cn/src/translator.js, then run `npm run sync`.',
    '',
  ].join('\n');

  fs.writeFileSync(outPath, banner + output, 'utf8');
  return {
    outPath,
    exactCount: Object.keys(exactDict).length,
    patternCount: patterns.length,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const res = buildZhCnPlugin();
  console.log(
    `[zh-cn] 构建完成: ${res.outPath} (${res.exactCount} 条精确词条, ${res.patternCount} 条动态模板)`,
  );
}
