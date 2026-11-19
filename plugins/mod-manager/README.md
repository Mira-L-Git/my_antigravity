# mod-manager（插件管理菜单）

将 Antigravity 桌面端左侧边栏左上角的 **Antigravity 品牌图标按钮**映射为 `My Antigravity` 插件管理菜单开关，方便在界面内单独启用或停用各个小插件：

- **精准映射入口**：仅拦截左上角纯 `<svg>` 品牌图标按钮（严格排除顶部文字菜单 `Antigravity`、侧边栏折叠、前进/后退与搜索按钮）；按住 **`Alt + 左键点击`** 仍可透传原生回首页功能。
- **简洁卡片列表**：自动扫描并展示其它已同步小插件，主标题显示原英文名（`id`），下方小字显示一句话功能摘要（优先读取 `mod.json` 的 `summary` 字段），不包含管理插件自身、版本号或总数角标。
- **持久化与平滑交互**：开关状态独立持久化至 `~/.gemini/config/plugins/my_antigravity/mods-state.json`（不因 `npm run sync` 被覆盖），变更后在底部提示并提供「立即重载」按钮；配备 Web Animations API 缩放/淡入淡出过渡动画，支持点击外部或按 `Esc` 关闭。
