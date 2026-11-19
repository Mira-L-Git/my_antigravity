# session-status（会话状态栏）

在 Antigravity 桌面版聊天输入框下方实时展示当前会话的：
- **回合 / 模型步数 / TPS**（及近 10 轮平均 TPS、平均首字延迟 TTFT）
- **累计 Token 用量 / 缓存命中率**（及输出/输入/缓存构成、预估 API 费用）
- **上下文窗口占用百分比**（及系统与工具/消息/子智能体分类进度条、压缩次数）

详见仓库根目录 [README.md](../../README.md) 中的 `session-status` 章节。

## 开发与同步

1. 编辑 `src/*.js` 或 `styles.css`；
2. 在仓库根目录执行 `npm test` 验证单测；
3. 执行 `npm run sync` 重新构建并同步到 `~/.gemini/config/plugins/my_antigravity/desktop-mods/session-status/`，重启 Antigravity 窗口即可生效。
