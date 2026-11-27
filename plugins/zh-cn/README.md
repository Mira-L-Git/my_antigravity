# zh-cn（界面中文化插件）

基于 **方案 A（纯渲染层插件化）** 将 Antigravity 桌面版的常见界面中文化，包括：
- 顶部菜单栏（Workspace / View / Window / 文件操作等）
- 左侧边栏（新建对话、对话历史、定时任务、自定义扩展、设置、排序/筛选子菜单）
- 设置页（通用、外观、浏览器、权限、应用、账号、Sandbox、模型 / Orchestrator / 配额等）
- 快捷键页、Customizations 页（Plugins / Skills / Rules / Hooks / MCP / 扩展市场）
- 主聊天区外框、输入框占位符、模型与工具审批按钮、右侧辅助面板
- 支持句首小写与大小写混合文案二级回退匹配，以及限额刷新/重置倒计时时长自动本地化

## 安全隔离机制

以下内容**绝对不会被翻译**，防止破坏对话或代码：
- 用户消息正文（`[data-testid="user-message-content"]`）
- Agent 回复正文（`[data-testid="agent-response"]`）
- 聊天输入框与富文本编辑器（`[data-lexical-editor="true"]`、`[contenteditable="true"]`）
- 代码块与行内代码（`pre`、`code`、`kbd`、`.monaco-editor`）
- 终端面板（`.xterm`、`[data-testid="terminal-surface"]`）
- 图标字体（`.google-symbols`、`.material-symbols-outlined`、`.material-symbols-rounded`、`.material-icons`）
- 浏览器地址栏和外部链接确认 URL

## 如何补充或修改译文

1. 按分类编辑 `plugins/zh-cn/dict/*.json`（例如 `settings.json`、`menus_and_sidebar.json`、`patterns.json`）。
2. 在项目根目录执行：
   ```bash
   npm run sync
   ```
   脚本会自动将词典重新打包到 `index.js` 并同步到 `~/.gemini/config/plugins/my_antigravity/desktop-mods/zh-cn/`，无需重新运行 `install.cmd`。
3. 重启 Antigravity 桌面版即可生效。
