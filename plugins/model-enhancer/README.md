# model-enhancer（模型图标与思考深度滑条）

为 Antigravity 桌面版模型选择器提供品牌图标识别与 Codex 风格的二段式思考深度拉条界面：

- **Stage 1（思考深度拉条面板）**：点击模型选择器触发器后首屏展示当前档位（如 `High` / `高`）、可点击的当前模型名按钮（`<模型名> ›`）、默认档位重置按钮（`↺`），以及支持鼠标拖动与键盘 `←/→/Home/End` 调节的胶囊滑轨；若当前档位带有上下文窗口选项（`contextWindowOptions`），下方会保留快捷切换行。
- **Stage 2（带图标的模型列表）**：点击当前模型名即可切换至模型列表，自动为 Gemini、Claude、GPT/OpenAI、DeepSeek、Grok、Qwen、Kimi、GLM/智谱、MiniMax、Hunyuan、MiMo、Muse 等模型注入 16×16 品牌 SVG 图标，未知模型使用通用图标兜底；点击多档位模型会切至该模型并自动返回拉条面板，按 `Esc` 可先返回滑条再退出弹窗。
- **语言联动**：自动感知 `zh-cn` 插件与 `<html lang>`，中英文无缝切换。

## 开发与同步

1. 编辑 `src/*.js`、`styles.css` 或 `assets/`；
2. 在仓库根目录运行 `npm test` 验证全部单测；
3. 运行 `npm run sync` 重新构建并同步到 `~/.gemini/config/plugins/my_antigravity/desktop-mods/model-enhancer/`，重启 Antigravity 窗口即可生效。
