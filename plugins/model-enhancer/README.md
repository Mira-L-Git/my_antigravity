# model-enhancer（模型图标与思考深度滑条）

为 Antigravity 桌面版模型选择器提供品牌图标识别与 Codex 风格的二段式思考深度拉条界面：

- **Stage 1（思考深度拉条面板）**：点击模型选择器触发器后首屏展示当前档位（如 `High` / `高`）、可点击的当前模型名按钮（`<模型名> ›`）、默认档位重置按钮（`↺`），以及支持点击平滑滑动、连续跟手拖动预览（松手吸附最近刻度）与键盘 `←/→/Home/End` 调节的胶囊滑轨；若当前档位带有上下文窗口选项（`contextWindowOptions`），下方会保留快捷切换行。
- **Stage 2（带图标的模型列表）**：点击当前模型名即可平滑切换至模型列表，自动为 Gemini（含 Gemini 4 `Carbon` / `Neon` / `Hydrogen` / `Argon` 与 `Orchestrator` 协调器及其规划器子菜单）、Claude、GPT/OpenAI、DeepSeek、Grok、Qwen、Kimi、GLM/智谱、MiniMax、Hunyuan、MiMo、Muse 等模型注入 `16×16` 品牌 SVG 图标，未知模型使用通用兜底图标 `sparkles`；点击多档位模型会切至该模型并自动返回拉条面板，按 `Esc` 可先返回滑条再退出弹窗。选中 `Orchestrator` 时不进入 Stage 1 滑条，保留原版列表与右侧「规划模型 → 思考深度」两级子菜单；在子菜单中切换规划模型或思考深度不会关闭弹窗，可连续调整。
- **语言联动**：自动感知 `zh-cn` 插件与 `<html lang>`，中英文无缝切换。

---

## 图标目录与匹配机制

所有图标配置与资源都在当前目录内维护，修改后只需在仓库根目录执行 `npm run sync` 并重启 Antigravity 窗口即可生效：

| 路径 | 用途 |
| --- | --- |
| `assets/providers/*.svg` | 各品牌或自定义的 SVG 图标文件（构建脚本会自动以文件名作为图标 key；`xiaomimimo.svg` 映射为 `mimo`） |
| `assets/ui/sparkles.svg` | 未匹配到任何规则时的通用兜底图标（`fallback`） |
| `src/icon-registry.js` | **图标维护主配置表**（包含屏蔽清单、精确覆盖表、provider 映射与品牌关键字兜底规则） |
| `build.mjs` | 将 `assets/` 下全部 SVG 与 `src/*.js` 打包为单文件 `index.js` |

### 匹配优先级（从高到低）

运行时解析单个模型行图标时，按以下顺序逐级匹配（命中即停止）：

1. **`DISABLED_MODEL_PATTERNS`**：命中则**不渲染任何图标**（也不会回退到 `sparkles`）。
2. **`MODEL_ICON_OVERRIDES`**：按具体模型名称、`modelId` 或别名精确/正则覆盖指定图标。
3. **`PROVIDER_ICON_MAP`**：根据 Antigravity 后端返回的 `provider` 枚举（如 `MODEL_PROVIDER_GOOGLE`）匹配。
4. **`BRAND_ICON_RULES`**：按关键字或正则兜底匹配整个品牌系列。
5. **未命中任何规则**：显示 `fallback`（`assets/ui/sparkles.svg`）。

---

## 一、如何自定义模型图标

常见有两种自定义需求：

### 方式 A：直接替换某个品牌的现有图标样式

例如想换掉新版 Gemini 或 OpenAI 的图标造型：

1. 准备规范的 SVG 图标（建议正方形 `viewBox="0 0 24 24"` 或类似比例，尽量去掉多余注释与 `<title>`）。
2. 直接覆盖对应文件：`plugins/model-enhancer/assets/providers/gemini.svg`（文件名保持不变）。
   > 若图标内含 `<linearGradient id="...">`，无需手动改 ID，插件运行时会自动为每个图标实例生成唯一渐变 ID，避免多行渲染冲突。
3. 在仓库根目录运行构建与同步：
   ```powershell
   npm test
   npm run sync
   ```
4. 重启 Antigravity 窗口即可看到新图标。

### 方式 B：只给某一个具体模型换上专属图标（不影响同品牌其他模型）

例如只想给 `Gemini 4 Carbon` 单独配一个图标，而其他 Gemini 模型继续使用 `gemini.svg`：

1. 将专属 SVG 放到 `plugins/model-enhancer/assets/providers/`，例如命名为 `gemini-carbon.svg`（图标 key 即为文件名 `gemini-carbon`）。
2. 打开 `plugins/model-enhancer/src/icon-registry.js`，在 **`MODEL_ICON_OVERRIDES`** 数组中新增一条规则：
   ```js
   export const MODEL_ICON_OVERRIDES = [
     {
       match: 'Gemini 4 Carbon', // 可写模型名/modelId 字符串（忽略大小写），或正则如 /^gemini-4-carbon/i
       icon: 'gemini-carbon',    // 对应 assets/providers/gemini-carbon.svg
     },
     // ...保留原有规则
   ];
   ```
3. 运行 `npm test` 和 `npm run sync`，重启 Antigravity 窗口生效。

---

## 二、当有新模型时如何加上新图标

根据新模型的来源与命名规律，对应以下三种做法：

### 情况 1：属于已有品牌且名字里带品牌词（如 `Gemini 5 Pro`、`Claude 6`）

- 通常**无需任何改动**，会自动通过 `BRAND_ICON_RULES` 或 `PROVIDER_ICON_MAP` 匹配到既有品牌图标。

### 情况 2：属于已有品牌，但使用了无品牌前缀的新代号（如 `Neon`、`Orchestrator`）

1. 在 Antigravity 模型列表中确认该模型显示的准确名称（或通过开发者工具查看其 `modelId`）。
2. 打开 `plugins/model-enhancer/src/icon-registry.js`：
   - **仅针对单个新模型**：在 `MODEL_ICON_OVERRIDES` 中追加映射：
     ```js
     { match: /^(?:new-codename|New Codename)$/i, icon: 'gemini' },
     ```
   - **属于该品牌的一组新代号**：也可以在 `BRAND_ICON_RULES` 对应品牌规则中补充关键词（建议参考末尾 Gemini 代号规则，放在其他显式品牌之后，防止误匹配）。
3. 运行 `npm test` 和 `npm run sync`，重启 Antigravity 窗口生效。

### 情况 3：接入了全新品牌 / 新厂商（目录里还没有它的 SVG）

1. 将新品牌的 SVG 文件放入 `plugins/model-enhancer/assets/providers/`，例如 `mistral.svg`（`build.mjs` 会自动扫描该目录，无需改构建脚本）。
2. 打开 `plugins/model-enhancer/src/icon-registry.js`：
   - 在 `BRAND_ICON_RULES` 中追加新品牌的匹配规则：
     ```js
     { id: 'mistral', test: (s) => s.includes('mistral') || s.includes('codestral') },
     ```
   - 若该模型同时有后端 `provider` 枚举（如 `MODEL_PROVIDER_MISTRAL`），也可在 `PROVIDER_ICON_MAP` 追加 `['mistral', 'mistral']`。
3. 运行 `npm test` 和 `npm run sync`，重启 Antigravity 窗口生效。

---

## 三、已废弃模型如何消掉它的图标记录

根据你想「清理旧配置记录」还是「让列表里某个旧模型不再显示图标」，对应两种做法：

### 做法 A：清理配置中的已废弃模型/品牌记录

当某个模型或旧厂商已经从服务端下线，不再需要保留配置时：

1. 打开 `plugins/model-enhancer/src/icon-registry.js`：
   - 若该模型曾在 `MODEL_ICON_OVERRIDES` 中有专属映射，直接删除那一条 `{ match: ..., icon: ... }`。
   - 若它是 `BRAND_ICON_RULES` 中的独立关键字（或专属 `PROVIDER_ICON_MAP` 条目），一并删除对应关键字或整条规则。
2. 如果某个专属 SVG 文件（例如曾为旧模型单独添加的 `assets/providers/old-model.svg`）已经没有任何规则引用，将其从 `assets/providers/` 目录删除，减小打包体积。
3. 运行 `npm test` 和 `npm run sync`，构建产物 `index.js` 会自动剔除该记录与图标数据。

### 做法 B：模型仍在列表里，但想屏蔽/隐藏它的图标（不回退成通用星星）

如果你暂时不想让某个旧模型（例如仍残留的 `Gemini 4 Argon`）显示任何图标：

1. 打开 `plugins/model-enhancer/src/icon-registry.js`，在 **`DISABLED_MODEL_PATTERNS`** 中添加模型名称或正则：
   ```js
   export const DISABLED_MODEL_PATTERNS = [
     'Gemini 4 Argon',
     // 或用正则精确匹配 modelId：
     // /^gpt-oss-120b$/i,
   ];
   ```
   > `DISABLED_MODEL_PATTERNS` 优先级最高，命中后会跳过后续所有规则并清除该行图标，不会回退显示 `sparkles.svg`。
2. 运行 `npm test` 和 `npm run sync`，重启 Antigravity 窗口即可。

---

## 开发与同步

1. 编辑 `src/*.js`、`styles.css` 或 `assets/`；
2. 在仓库根目录运行 `npm test` 验证全部单测；
3. 运行 `npm run sync` 重新构建并同步到 `~/.gemini/config/plugins/my_antigravity/desktop-mods/model-enhancer/`，重启 Antigravity 窗口即可生效。
