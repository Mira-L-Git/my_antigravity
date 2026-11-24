# file-link-color（文件链接蓝色高亮）

纯 CSS 插件：将 Antigravity 聊天正文中**带有文件图标**的文件链接名称（含扩展名后缀）显示为原生链接蓝，便于在长段对话中快速区分可点击文件引用与普通正文。

## 设计要点

- **精准筛选**：通过 `:has(img[src*="/symbols-icons/icons/files/"])` 命中内置 `symbols-icons` 全部文件图标（包括专属图标与普通文档兜底图标 `document.svg`），同时排除文件夹图标（`/icons/folders/`）。
- **作用域隔离**：仅作用于聊天正文中的 `.context-scope-mention .inline-pill`，不影响输入框 `@` 提及胶囊、变更文件卡片及侧边栏文件树；带行号后缀（如 `#L10-20`）的 `.text-muted-foreground` 子元素仍保持灰色。
- **主题自适应 & 零运行时开销**：复用原生 CSS 变量 `--color-link`（自动跟随官方明暗与自定义主题切换），不注入任何 JS 或 `MutationObserver`。
