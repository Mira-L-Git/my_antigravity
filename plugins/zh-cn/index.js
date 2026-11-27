// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/zh-cn/dict/*.json or plugins/zh-cn/src/translator.js, then run `npm run sync`.
/**
 * zh-cn 运行时界面翻译引擎。
 * 由 build.mjs 注入词典与模板后生成自包含的 index.js。
 */
(function registerZhCnMod(win, doc) {
  if (win.__myAntigravityZhCnInstalled) {
    return;
  }
  win.__myAntigravityZhCnInstalled = true;

  // 以下占位常量在 build.mjs 打包时会被替换为真实词典与模板
  const EXACT_DICT = {
  "Ask anything, @ to mention, / for actions": "有问题尽管问，输入 @ 提及上下文，输入 / 触发指令",
  "Ask anything, @ to mention": "有问题尽管问，输入 @ 提及上下文",
  "Message subagent, @ to mention, / for actions": "给 Subagent 发消息，输入 @ 提及上下文，输入 / 触发指令",
  "Message subagent, @ to mention": "给 Subagent 发消息，输入 @ 提及上下文",
  "Listening. Ask anything.": "正在聆听，请随时提问。",
  "Send Message": "发送消息",
  "Queue Message": "加入队列",
  "Stop Recording and Send": "停止录音并发送",
  "Cancel Sending Message": "取消发送消息",
  "Cancel Task": "取消任务",
  "Add context": "添加上下文",
  "Add files": "添加文件",
  "Add screenshot to conversation": "添加截图到对话",
  "Write a comment...": "写下批注...",
  "Add inline comment": "添加行内批注",
  "Comment": "批注",
  "Comments": "批注",
  "Thought Process": "思考过程",
  "Thinking...": "正在思考...",
  "Files Changed": "已变更文件",
  "Branch Changes": "分支变更",
  "Agent Edits": "Agent 编辑",
  "Artifacts": "Artifacts（产出物）",
  "Artifact": "Artifact",
  "Subagents": "Subagents（子智能体）",
  "Background Tasks": "后台任务",
  "Background Task Output": "后台任务输出",
  "Terminals": "终端",
  "Terminal": "终端",
  "Kill Terminal": "终止终端",
  "Delete Terminal": "删除终端",
  "File explorer": "文件浏览器",
  "Files": "文件",
  "Changes": "变更",
  "Plan": "计划",
  "Goals": "目标",
  "Execution": "执行",
  "Context usage": "上下文用量",
  "Token Usage": "Token 用量",
  "Context and Quota Indicator": "上下文与配额指示器",
  "New Side Question": "新建侧边提问",
  "Side Question": "侧边提问",
  "Side Questions": "侧边提问",
  "Delete Side Question": "删除侧边提问",
  "New Coordinator": "新建协调器",
  "Coordinators": "协调器",
  "Coordinator settings": "协调器设置",
  "New Agent Script": "新建 Agent 脚本",
  "Custom Agents": "自定义 Agents",
  "Browser Subagent": "浏览器 Subagent",
  "Browser steps": "浏览器操作步骤",
  "Confirm Browser Interaction": "确认浏览器交互",
  "Announcements and tips": "公告与提示",
  "New models have been enabled for you!": "已为你启用新模型！",
  "Model": "模型",
  "No Model Selected": "未选择模型",
  "Loading models...": "正在加载模型...",
  "No models available": "暂无可用模型",
  "View Usage": "查看用量",
  "View plans": "查看套餐",
  "Edit Model": "编辑模型",
  "Add Model": "添加模型",
  "Drive": "Google Drive",
  "Search Google Drive": "搜索 Google Drive",
  "Ask /btw": "顺便问一句 (/btw)",
  "Ask a quick question without interrupting the main conversation.": "在不打断主对话的情况下快速提问。",
  "Ask a side question without interrupting the main conversation": "在不打断主对话的情况下发起侧边提问",
  "Good response": "有帮助的回复",
  "Good Response": "有帮助的回复",
  "Bad response": "不满意的回复",
  "Bad Response": "不满意的回复",
  "Copy Message": "复制消息",
  "Undo to Here": "撤销到此处",
  "Fork Conversation": "分叉对话",
  "Fork in Shared Workspace": "在共享工作区中分叉",
  "Fork in New Workspace": "在新工作区中分叉",
  "Work in a New Worktree": "在新的 Worktree 中工作",
  "Keeps your checkout untouched": "保持当前检出目录不受影响",
  "Sends after agent finishes working": "将在 Agent 完成工作后发送",
  "Cancel recording": "取消录音",
  "Remove audio": "移除语音",
  "Add to Chat/Quote": "添加到对话/引用",
  "Open Terminal": "打开终端",
  "No active terminals": "暂无活动终端",
  "Failed to create terminal": "创建终端失败",
  "Recent files": "最近文件",
  "Recent Files": "最近文件",
  "Search file contents...": "搜索文件内容...",
  "Revert file changes": "还原文件更改",
  "Files modified by the agent in this conversation": "本次对话中由 Agent 修改的文件",
  "Staged Changes": "已暂存更改",
  "Untracked (Unstaged)": "未跟踪（未暂存）",
  "Added (Staged)": "已新增（已暂存）",
  "Modified": "已修改",
  "Deleted": "已删除",
  "Renamed": "已重命名",
  "Browser Use": "浏览器使用",
  "Mention Page": "提及当前页面",
  "Capture Screenshot": "截取屏幕截图",
  "Capture Console Logs": "捕获控制台日志",
  "Open Browser Setup": "打开浏览器设置",
  "Side Question Selection": "侧边提问选中内容",
  "The main conversation's input isn't available right now.": "主对话的输入框当前不可用。",
  "Insert into main conversation": "插入到主对话",
  "This side question isn't available in this conversation.": "此侧边提问在当前对话中不可用。",
  "Response actions": "回复操作",
  "Previous Worktrees": "历史 Worktrees",
  "Voice dictation unavailable": "语音听写不可用",
  "Stop transcription": "停止转录",
  "Interrupt Agent": "中断 Agent",
  "Reasoning": "推理强度",
  "Thinking effort": "思考深度",
  "Low": "低",
  "Medium": "中",
  "High": "高",
  "Extra": "超高",
  "Extra High": "超高",
  "Max": "极高",
  "Fast": "快速",
  "Leaving Soon": "即将下线",
  "Default (Gemini Pro)": "默认 (Gemini Pro)",
  "The Orchestrator's own planner": "协调器默认规划模型",
  "Offloads routine steps to a faster executor. Same quality, fewer tokens used.": "将常规步骤交给更快的执行模型处理，保持同等质量并减少 Token 消耗。",
  "Controls how much time and quota the model spends reasoning before responding. Higher effort improves accuracy on hard problems, at the cost of slower responses and higher quota use.": "控制模型在回复前投入的思考时间与配额。更高深度可提升难题准确率，但会增加响应耗时和配额消耗。",
  "Save": "保存",
  "Cancel": "取消",
  "Close": "关闭",
  "Close Panel": "关闭面板",
  "Close Sidebar": "关闭侧边栏",
  "Close Tab": "关闭标签页",
  "Close Other Tabs": "关闭其他标签页",
  "Close Tabs to the Left": "关闭左侧标签页",
  "Close Tabs to the Right": "关闭右侧标签页",
  "Confirm": "确认",
  "Continue": "继续",
  "Submit": "提交",
  "Skip": "跳过",
  "Skip All": "全部跳过",
  "Back": "返回",
  "Back to home": "返回首页",
  "Next": "下一步",
  "Get started": "开始使用",
  "Done": "完成",
  "Edit": "编辑",
  "Delete": "删除",
  "Remove": "移除",
  "Add": "添加",
  "Create": "创建",
  "Copy": "复制",
  "Copied": "已复制",
  "Copy Path": "复制路径",
  "Copy path": "复制路径",
  "Copy command": "复制命令",
  "Copy Command": "复制命令",
  "Copy Config File Path": "复制配置文件路径",
  "Click to copy URL": "点击复制 URL",
  "Click to open docs": "点击打开文档",
  "Refresh": "刷新",
  "Reload": "重新加载",
  "Reset": "重置",
  "Reset to Default": "恢复默认",
  "Retry": "重试",
  "Try again": "重试",
  "Stop": "停止",
  "Start": "启动",
  "Restart": "重启",
  "Run": "运行",
  "Run Now": "立即运行",
  "Enable": "启用",
  "Disable": "禁用",
  "Enabled": "已启用",
  "Disabled": "已禁用",
  "Install": "安装",
  "Uninstall": "卸载",
  "Update": "更新",
  "Upload": "上传",
  "Upload Files": "上传文件",
  "Download": "下载",
  "Download files": "下载文件",
  "Download Diagnostics": "下载诊断信息",
  "Search": "搜索",
  "Clear": "清除",
  "Clear Search": "清除搜索",
  "Clear search": "清除搜索",
  "Clear filter": "清除筛选",
  "Clear file filter": "清除文件筛选",
  "Clear row filter": "清除行筛选",
  "Filter": "筛选",
  "Filter files...": "筛选文件...",
  "Filter resources...": "筛选资源...",
  "Filter rows...": "筛选行...",
  "Find": "查找",
  "Find in Pane": "在面板中查找",
  "Find in Conversation": "在对话中查找",
  "Select All": "全选",
  "Open": "打开",
  "Open File": "打开文件",
  "Open in Built-in Browser": "在内置浏览器中打开",
  "Open in Remote Control": "在 Remote Control 中打开",
  "Open on another device": "在其他设备上打开",
  "Dismiss": "忽略",
  "Dismiss Tip": "忽略提示",
  "Dismiss error": "关闭错误提示",
  "Dismiss notification": "关闭通知",
  "Learn more": "了解更多",
  "Actions": "操作",
  "Options": "选项",
  "Overview": "概览",
  "Details": "详情",
  "Logs": "日志",
  "Status": "状态",
  "Idle": "空闲",
  "In Progress": "进行中",
  "Running": "运行中",
  "Blocked": "已阻止",
  "Unknown": "未知",
  "Default": "默认",
  "System default": "系统默认",
  "Custom": "自定义",
  "All": "全部",
  "Other": "其他",
  "None": "无",
  "Yes": "是",
  "No": "否",
  "Error": "错误",
  "Warning": "警告",
  "Notice": "提示",
  "Loading...": "加载中...",
  "Saving...": "保存中...",
  "Connecting...": "连接中...",
  "Connect": "连接",
  "Disconnect": "断开连接",
  "Not Signed In": "未登录",
  "Sign in": "登录",
  "Sign out": "退出登录",
  "Sign in again": "重新登录",
  "Continue with Google": "使用 Google 账号继续",
  "Continue with Google Cloud": "使用 Google Cloud 继续",
  "Enter authorization code...": "输入授权码...",
  "Paste authorization code": "粘贴授权码",
  "Paste auth code": "粘贴授权码",
  "Paste code": "粘贴代码",
  "Global": "全局",
  "Local": "本地",
  "Remote": "远程",
  "This Computer": "本机",
  "Built In": "内置",
  "External": "外部",
  "Enterprise": "企业版",
  "Allow": "允许",
  "Deny": "拒绝",
  "Ask": "询问",
  "Always Allow": "始终允许",
  "Accept": "接受",
  "Reject": "拒绝",
  "Accept Step": "接受此步",
  "Reject Step": "拒绝此步",
  "Undo": "撤销",
  "Confirm Undo": "确认撤销",
  "Review": "审查",
  "Fork": "分叉对话",
  "Go Back": "后退",
  "Go Forward": "前进",
  "Go Back in Pane": "在面板中后退",
  "Go Forward in Pane": "在面板中前进",
  "See more results": "查看更多结果",
  "(empty)": "（空）",
  "Untitled": "未命名",
  "Cut": "剪切",
  "Paste": "粘贴",
  "Set up": "设置",
  "Log in": "登录",
  "Configure": "配置",
  "Allow Once": "仅允许本次",
  "Proceed with Plan": "按计划继续",
  "Open in side pane": "在侧边栏打开",
  "Open in External Browser": "在外部浏览器中打开",
  "Open in external browser": "在外部浏览器中打开",
  "Open in New Window": "在新窗口中打开",
  "Open Link in New Tab": "在新标签页打开链接",
  "Open Link in External Browser": "在外部浏览器中打开链接",
  "Copy Link": "复制链接",
  "Copy Link Address": "复制链接地址",
  "Open Image in New Tab": "在新标签页打开图片",
  "Copy Image": "复制图片",
  "Copy Image Address": "复制图片地址",
  "Downloads": "下载",
  "Close downloads": "关闭下载列表",
  "Show in folder": "在文件夹中显示",
  "Cancel download": "取消下载",
  "Remove from list": "从列表中移除",
  "View site information": "查看网站信息",
  "Cookies and site data": "Cookie 和网站数据",
  "Enter a URL (e.g. http://localhost:8080)": "输入 URL（例如 http://localhost:8080）",
  "Address bar": "地址栏",
  "No internet. Agent features may not work.": "无网络连接，Agent 功能可能无法正常工作。",
  "Manage": "管理",
  "Recommended": "推荐",
  "System default app": "系统默认应用",
  "Text Selection": "文本选择",
  "Plugins": "Plugins（插件）",
  "Skills": "Skills（技能）",
  "Rules": "Rules（规则）",
  "Skills & Rules": "Skills 与 Rules",
  "Hooks": "Hooks（钩子）",
  "MCP": "MCP",
  "MCP Servers": "MCP 服务器",
  "Installed MCP Servers": "已安装的 MCP 服务器",
  "Add MCP Server": "添加 MCP 服务器",
  "Add MCP Servers": "添加 MCP 服务器",
  "Refresh MCP servers": "刷新 MCP 服务器",
  "Delete MCP Server": "删除 MCP 服务器",
  "Sidecars": "Sidecars",
  "UI Extensions": "UI 扩展",
  "Extensions": "扩展",
  "Extension": "扩展",
  "Installed": "已安装",
  "Marketplace": "扩展市场",
  "Explore the plugin marketplace": "探索插件市场",
  "Build With Google Plugins": "Google 官方插件",
  "Browse and enable plugins from the Build With Google catalog.": "浏览并启用 Build With Google 目录中的官方插件。",
  "Explore other marketplace customizations": "探索市场中的其他定制扩展",
  "Loading installed plugins...": "正在加载已安装插件...",
  "Search customizations...": "搜索 Customizations...",
  "Search MCP servers by name": "按名称搜索 MCP 服务器",
  "Search connectors": "搜索连接器",
  "Connectors": "连接器",
  "Create plugin": "创建插件",
  "Customize Global Skills": "自定义全局 Skills",
  "Delete Skill": "删除 Skill",
  "Delete Hook": "删除 Hook",
  "Delete Handler": "删除处理器",
  "New hook name": "新 Hook 名称",
  "All tools (*)": "所有工具 (*)",
  "Hook will trigger if any tool is executed.": "当执行任意工具时触发此 Hook。",
  "Hook will only trigger if the tool name matches run_command.": "仅当工具名为 run_command 时触发此 Hook。",
  "Hook will only trigger if the tool name matches run_command or view_file.": "仅当工具名为 run_command 或 view_file 时触发此 Hook。",
  "Hook will only trigger if the tool name starts with browser_.": "仅当工具名以 browser_ 开头时触发此 Hook。",
  "Configure hooks that run on agent lifecycle events.": "配置在 Agent 生命周期事件上运行的 Hooks。",
  "External tools the agent can call via Model Context Protocol.": "Agent 可通过 Model Context Protocol (MCP) 调用的外部工具。",
  "Configure external tools via Model Context Protocol.": "通过 Model Context Protocol (MCP) 配置外部工具。",
  "Disabled. Open Details to finish setup or enable.": "已禁用，打开详情页完成配置或启用。",
  "Plugin Operation Error:": "插件操作错误：",
  "No plugin loads from this folder.": "此文件夹下未加载任何插件。",
  "Enter the configuration values this MCP server needs. Saving restarts the server with them.": "输入该 MCP 服务器所需的配置参数，保存后将使用新配置重启服务器。",
  "Only stored on your machine.": "仅保存在你的本地机器上。",
  "Loading customizations...": "正在加载自定义扩展...",
  "Loading available plugins...": "正在加载可用插件...",
  "Enable Recommended Skills": "启用推荐 Skills",
  "Manage Hooks": "管理 Hooks",
  "Add Hook Card": "添加 Hook 卡片",
  "MCP Tools": "MCP 工具",
  "MCP servers": "MCP 服务器",
  "UI extensions": "UI 扩展",
  "Context Providers": "上下文提供程序",
  "Themes": "主题",
  "Authenticate": "身份验证",
  "Set up authentication": "配置身份验证",
  "Go to Accounts": "前往账号设置",
  "View MCP servers": "查看 MCP 服务器",
  "Plugin details": "插件详情",
  "Setup required": "需要完成配置",
  "Sign-in required": "需要登录",
  "Sign in required": "需要登录",
  "Needs reconnect": "需要重新连接",
  "Unauthenticated": "未认证",
  "App update required": "需要更新应用",
  "Plugin update required": "需要更新插件",
  "Sign in to finish setting up this plugin.": "登录以完成此插件的设置。",
  "Disabled. Open the plugin page to finish setup.": "已禁用，打开插件页面完成设置。",
  "Website": "网站",
  "Repository": "仓库",
  "Readme": "自述文件",
  "Bundles": "插件包 (Bundles)",
  "Curated sets of plugins for common workflows and roles.": "面向常见工作流与角色的精选插件组合。",
  "Review bundle before adding": "添加前请检查插件包内容",
  "Review contents": "查看内容",
  "Add anyway": "仍然添加",
  "Installed separately": "已单独安装",
  "No longer available": "已不可用",
  "Workspace": "工作区",
  "View": "视图",
  "Window": "窗口",
  "File": "文件",
  "Help": "帮助",
  "Docs": "文档",
  "Check for Updates": "检查更新",
  "Update Available": "有可用更新",
  "New Window": "新建窗口",
  "Minimize": "最小化",
  "Maximize": "最大化",
  "Command Palette": "命令面板",
  "Open Command Palette": "打开命令面板",
  "File Picker": "文件选择器",
  "Open File Search": "打开文件搜索",
  "Zoom In": "放大",
  "Zoom Out": "缩小",
  "Reset Zoom": "重置缩放",
  "Toggle Between Light/Dark Themes": "切换浅色/深色主题",
  "Connect to SSH Host…": "连接到 SSH 主机…",
  "Connect to SSH Host...": "连接到 SSH 主机...",
  "Stop SSH Server…": "停止 SSH 服务…",
  "Stop SSH Server...": "停止 SSH 服务...",
  "Switch to This Computer": "切换到本机",
  "Connect to WSL": "连接到 WSL",
  "Reopen Locally": "在本地重新打开",
  "New Conversation": "新建对话",
  "Conversation History": "对话历史",
  "Open Conversation History": "打开对话历史",
  "Scheduled Tasks": "定时任务",
  "Automations": "自动化任务",
  "Customizations": "自定义扩展",
  "Settings": "设置",
  "Open Settings": "打开设置",
  "Provide Feedback": "提交反馈",
  "Give Feedback": "提交反馈",
  "Projects": "项目",
  "Not in Project": "未归属项目",
  "Create Project": "创建项目",
  "New Project": "新建项目",
  "Project Name": "项目名称",
  "Add Project": "添加项目",
  "Add Folder": "添加文件夹",
  "Workspaces": "工作区",
  "Conversations": "对话",
  "No conversations yet": "暂无对话",
  "Inbox": "收件箱",
  "New automation": "新建自动化任务",
  "New Group": "新建分组",
  "Move to Group": "移动到分组",
  "Rename Conversation": "重命名对话",
  "Open Folder": "打开文件夹",
  "Open Folder (Interactive)": "打开文件夹（交互式）",
  "Open Search": "打开搜索",
  "Open project settings": "打开项目设置",
  "Archive Workspace": "归档工作区",
  "Archive project": "归档项目",
  "Delete Permanently": "永久删除",
  "Delete Task": "删除任务",
  "Move Up": "上移",
  "Move Down": "下移",
  "Unread": "未读",
  "Pinned": "已置顶",
  "Recent": "最近",
  "Filters": "筛选器",
  "Search filters…": "搜索筛选条件…",
  "Search triggers…": "搜索触发器…",
  "Search Hosts…": "搜索主机…",
  "Search Repositories…": "搜索仓库…",
  "Toggle Sidebar": "切换侧边栏",
  "Collapse All Folders": "折叠所有文件夹",
  "Expand All Folders": "展开所有文件夹",
  "Display Options": "显示选项",
  "Group By": "分组方式",
  "Sort By": "排序方式",
  "Sort Conversations": "排序对话",
  "Sort Folders": "排序文件夹",
  "Last Updated": "最近更新",
  "Last Prompt": "最近提问",
  "Custom Order": "自定义排序",
  "Only Unread": "仅看未读",
  "Archived": "已归档",
  "Archived Only": "仅看已归档",
  "Only Archived": "仅看已归档",
  "Scheduled": "定时任务",
  "Repeat every": "重复频率",
  "Not scheduled": "未安排定时",
  "Hourly": "每小时",
  "Daily": "每天",
  "Weekly": "每周",
  "Next run": "下次运行",
  "Last run": "上次运行",
  "No runs yet": "暂无运行记录",
  "New conversation": "新建对话",
  "Loading conversations...": "正在加载对话...",
  "Environment": "运行环境",
  "Display": "显示",
  "Subtitles": "副标题",
  "Decorations": "装饰标记",
  "Auto Pin": "自动置顶",
  "Last 7 days": "最近 7 天",
  "Open Conversation": "打开对话",
  "Open Conversation in New Tab": "在新标签页打开对话",
  "Open side-by-side view": "打开并排视图",
  "Rename This Conversation": "重命名此对话",
  "Rename": "重命名",
  "Conversation name": "对话名称",
  "Pin This Conversation": "置顶此对话",
  "Unpin This Conversation": "取消置顶此对话",
  "Pin / Unpin Conversation": "置顶 / 取消置顶对话",
  "Archive This Conversation": "归档此对话",
  "Archive / Restore": "归档 / 恢复",
  "Restore": "恢复",
  "Mark as Read": "标为已读",
  "Mark as Unread": "标为未读",
  "Mark This Conversation as Read": "将此对话标为已读",
  "Mark This Conversation as Unread": "将此对话标为未读",
  "Mark All as Read": "全部标为已读",
  "Move to New Group": "移动到新分组",
  "Remove from Group": "从分组移除",
  "Rename Group": "重命名分组",
  "Group name": "分组名称",
  "Delete Conversation": "删除对话",
  "Copy Conversation Markdown": "复制对话 Markdown",
  "Copy Conversation ID": "复制对话 ID",
  "Copy Trajectory ID": "复制 Trajectory ID",
  "Open Trajectory Debug View": "打开 Trajectory 调试视图",
  "Search conversations...": "搜索对话...",
  "Search for conversations...": "搜索对话...",
  "Search projects...": "搜索项目...",
  "Search for commands...": "搜索命令...",
  "General": "通用",
  "Appearance": "外观",
  "Browser": "浏览器",
  "Account": "账号",
  "Agents": "Agents",
  "Environments": "运行环境",
  "Application": "应用程序",
  "App": "应用",
  "Models": "模型",
  "Notifications": "通知",
  "Accessibility": "无障碍",
  "Developer": "开发者",
  "Labs": "实验室",
  "Permissions": "权限",
  "Danger Zone": "危险操作区",
  "Preset": "预设",
  "Advanced": "高级",
  "Navigation": "导航",
  "Conversation": "对话",
  "Layout Controls": "布局控制",
  "Interface Layout": "界面布局",
  "Chat Layout": "聊天布局",
  "Chat Input": "聊天输入框",
  "Chat": "聊天",
  "Dark Theme": "深色主题",
  "Light Theme": "浅色主题",
  "Font": "字体",
  "Font Size": "字体大小",
  "Wide": "宽版",
  "Narrow": "窄版",
  "Fill": "铺满",
  "Right": "右侧",
  "Bottom Panel": "底部面板",
  "Inherit Global": "继承全局设置",
  "New Conversation Button": "新建对话按钮",
  "Which workspace the New Conversation button and keyboard shortcut start you in.": "设置点击“新建对话”按钮或使用快捷键时默认进入的工作区。",
  "Last Workspace": "上次的工作区",
  "Reuse your last workspace.": "复用你上一次打开的工作区。",
  "New Workspace": "新建工作区",
  "Create a new workspace from your first message.": "根据你的第一条消息创建新的工作区。",
  "Home": "首页",
  "Start without a workspace, for general questions.": "不关联工作区直接开始，适合通用提问。",
  "Queued Messages": "排队消息",
  "Configure when follow-up messages are sent.": "配置追问消息何时发送。",
  "Send Immediately": "立即发送",
  "Queue": "排队",
  "Interrupt the agent and send immediately.": "打断 Agent 并立即发送。",
  "Queue until after the current turn.": "排队等待当前轮次完成后发送。",
  "Enter to Send": "Enter 发送",
  "Send messages with the keyboard's Enter key instead of starting a new line.": "使用键盘 Enter 键直接发送消息，而非换行。",
  "Agent Non-Workspace File Access": "工作区外文件访问",
  "Allow the agent to automatically view and edit files outside the current workspace. Use with caution: this gives the agent access to additional potentially-relevant information, but also allows the agent to access credential files, secrets, and other files outside of the workspace that could be targeted in prompt injection attacks or other exploits by malicious actors.": "允许 Agent 自动查看和编辑当前工作区之外的文件。请谨慎开启：这能让 Agent 获取更多相关信息，但也可能访问凭据、密钥等工作区外文件，在提示词注入或恶意攻击场景下存在风险。",
  "Command Setup Script": "命令初始化脚本",
  "A shell setup script run before every command the agent executes.": "在 Agent 执行每条终端命令前自动运行的 Shell 初始化脚本。",
  "A shell setup script run before every command the agent executes in this project. Overrides the global script.": "在当前项目中 Agent 执行每条终端命令前运行的 Shell 初始化脚本，会覆盖全局脚本。",
  "Environment Setup Script": "环境初始化脚本",
  "A bash script run in your cloud environment after cloning repositories (or configure interactively in chat with /env-setup).": "在云端环境克隆仓库后运行的 Bash 脚本（也可在聊天中使用 /env-setup 交互式配置）。",
  "Validate": "验证",
  "Validating setup script…": "正在验证初始化脚本…",
  "Setup script ran successfully.": "初始化脚本运行成功。",
  "Setup script failed.": "初始化脚本运行失败。",
  "Enable Terminal Sandbox": "启用终端 Sandbox",
  "Enable Sandbox Mode": "启用 Sandbox 模式",
  "Run terminal commands with sandbox restrictions.": "在 Sandbox 限制环境下运行终端命令。",
  "Sandbox Allow Network": "Sandbox 允许联网",
  "Allow sandboxed commands to make network requests.": "允许处于 Sandbox 中的命令发起网络请求。",
  "Restricts agent tools to a secure, isolated local sandbox.": "将 Agent 工具限制在安全隔离的本地 Sandbox 中运行。",
  "Terminal sandbox is not supported in this environment": "当前环境不支持终端 Sandbox",
  "Terminal Command Auto Execution": "终端命令自动执行策略",
  "Controls whether terminal commands require your approval before running.\n\nNote: A change to this setting will only apply to new messages sent to the agent. In-progress responses will use the previous setting value.": "控制终端命令在执行前是否需要你的确认。\n\n注意：修改此设置仅对之后新发送给 Agent 的消息生效，正在进行的响应仍沿用原有策略。",
  "Controls whether terminal commands require your approval before running.": "控制终端命令在执行前是否需要你的确认。",
  "Note: A change to this setting will only apply to new messages sent to the agent. In-progress responses will use the previous setting value.": "注意：修改此设置仅对之后新发送给 Agent 的消息生效，正在进行的响应仍沿用原有策略。",
  "Always Proceed": "始终自动执行",
  "Always Ask": "始终询问",
  "Auto": "自动判断",
  "Request Review": "始终请求确认",
  "Require Review": "需要人工确认",
  "Proceed in Sandbox": "仅在 Sandbox 内自动执行",
  "The agent never asks for confirmation before executing terminal commands (except those in the Deny list). This provides the agent with the maximum ability to operate over long periods without intervention, but also has the highest risk of the agent executing an unsafe terminal command.": "Agent 执行终端命令前从不询问（Deny 列表中的命令除外）。这能让 Agent 长时间自主运行，但也具有执行不安全命令的最高风险。",
  "Terminal commands automatically proceed inside the sandbox. A command that needs to leave the sandbox proceeds only if an agent judges it reversible, and otherwise requests review.": "终端命令在 Sandbox 内自动执行；需要离开 Sandbox 的命令仅在 Agent 判断为可逆时才自动执行，否则请求人工确认。",
  "The agent always asks for confirmation before executing terminal commands (except those in the Allow list).": "Agent 执行任何终端命令前都会请求你的确认（Allow 列表中的命令除外）。",
  "Terminal command automatically proceeds if the command runs inside the sandbox. Otherwise, it requests review.": "如果命令在 Sandbox 内运行则自动执行，否则请求确认。",
  "Ask before sensitive operations.": "在敏感操作前询问。",
  "Every command requires approval.": "每条命令都需要确认。",
  "Automatically decide if commands run.": "自动判断命令是否允许直接运行。",
  "Run all commands without restrictions.": "无限制地运行所有命令。",
  "All terminal commands require review. The agent can read or write to any file in the machine.": "所有终端命令均需人工确认；Agent 可读写本机任意文件。",
  "Requires manual review for all terminal commands and file accesses outside of the working folders.": "所有终端命令以及工作目录之外的文件访问均需人工确认。",
  "Useful for typical development with an emphasis on security. It prioritizes safety over speed by requiring manual approval for all terminal commands and files outside the project directory.": "适合注重安全性的日常开发。所有终端命令及项目目录外的文件操作都需人工确认，安全优先于速度。",
  "Useful for tasks that require file access across your full machine. The agent has full read and write access to all local files, but all proposed terminal commands require manual review and approval before running.": "适合需要跨全盘访问文件的任务。Agent 对所有本地文件拥有完整读写权限，但所有终端命令在运行前仍需人工确认。",
  "A high-risk mode that disables all safety barriers. The agent operates with full system access, auto-executes all terminal commands, and reads or writes to all local files without review prompts.": "高风险模式，将关闭所有安全屏障。Agent 拥有完整系统访问权限，无需确认即可自动执行所有终端命令并读写所有本地文件。",
  "Disables all safety barriers for maximal iteration velocity.": "关闭所有安全屏障以换取最快迭代速度。",
  "Manually customize individual settings.": "手动自定义各项独立设置。",
  "Turbo": "Turbo",
  "Turbo mode": "Turbo 模式",
  "Full machine": "全机访问",
  "Enable Sounds for Agent": "启用 Agent 提示音",
  "Play a sound when your action is needed or the agent finishes.": "在需要你的操作或 Agent 完成任务时播放提示音。",
  "Set the volume of agent sounds.": "设置 Agent 提示音的音量大小。",
  "Enable Notifications for Agent": "启用 Agent 系统通知",
  "Show system notifications when your action is needed or the agent finishes.": "在需要你的操作或 Agent 完成任务时显示系统通知。",
  "Notification Settings": "通知设置",
  "Manage your notification preferences.": "管理你的通知偏好设置。",
  "To modify notification settings, open your operating system's system preferences.": "如需修改通知权限，请打开操作系统的系统设置。",
  "System Settings": "系统设置",
  "Sound": "声音",
  "Chime volume": "提示音音量",
  "Volume": "音量",
  "Conversation Steps": "对话步骤展示",
  "Choose how much detail is shown during a conversation.": "选择对话过程中显示多少执行细节。",
  "Verbose": "详细",
  "Custom Context Menus": "自定义右键菜单",
  "Replace the default browser right-click menu with quick actions.": "使用带快捷操作的自定义右键菜单替换浏览器默认菜单。",
  "Screen Reader Mode": "屏幕阅读器模式",
  "Optimize the interface and terminal output for screen readers.": "针对屏幕阅读器优化界面与终端输出。",
  "Conversation Width": "对话面板宽度",
  "Configure the maximum width of the conversation panel.": "配置对话面板的最大宽度。",
  "Terminal Placement": "终端显示位置",
  "Choose where terminal sessions appear.": "选择终端会话的显示位置。",
  "Markdown Artifact Width": "Markdown Artifact 宽度",
  "Configure the default width of markdown artifacts.": "配置 Markdown Artifact 视图的默认宽度。",
  "Configure the agent's visual theme and display preferences.": "配置视觉主题与界面显示偏好。",
  "Show how full the context window is next to the send button. Click it for a breakdown and to see your model quota.": "在发送按钮旁显示上下文窗口的占用比例，点击可查看详细构成与模型配额。",
  "Open Links In": "默认打开链接方式",
  "Choose where links open by default when clicked.": "选择点击链接时的默认打开位置。",
  "Built-in Browser": "内置浏览器",
  "External Browser": "外部浏览器",
  "Side Panel": "侧边栏面板",
  "Enable Browser Tools": "启用浏览器工具",
  "Let the agent use browser tools to open URLs, read web pages, and interact with browser content. This gives the agent access to important (and often critical) knowledge and methods of validation, but any browser integration does increase exposure to external malicious parties for security exploits.": "允许 Agent 使用浏览器工具打开 URL、读取网页并与页面内容交互。这有助于获取重要信息和进行验证，但也会增加暴露给外部恶意网页的安全风险。",
  "Browser Javascript Execution Policy": "浏览器 JavaScript 执行策略",
  "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "控制 Agent 是否可以运行自定义 JavaScript 来自动化复杂浏览器操作。",
  "Allow full browser script execution without prompting.": "无需确认即允许完整执行浏览器脚本。",
  "Prompt for approval before running browser scripts.": "运行浏览器脚本前请求人工确认。",
  "Block all browser JavaScript execution.": "禁止所有浏览器 JavaScript 执行。",
  "Configure built-in browser, link opening, and browser subagent preferences.": "配置内置浏览器、链接打开方式与 Browser Subagent 偏好。",
  "Browser Actuation Permissions": "浏览器操控权限",
  "Browser Actuation Rules": "浏览器操控规则",
  "Configure allowed and denied URLs for the browser subagent (invoked with /browser). Requires": "配置 Browser Subagent（通过 /browser 调用）允许和拒绝访问的 URL。需要",
  "Configure allowed and denied URLs for the browser subagent. It runs in the built-in browser, so no separate browser install is needed.": "配置 Browser Subagent 允许和拒绝访问的 URL。它运行在内置浏览器中，无需额外安装浏览器。",
  "Allow/deny agent browser actuation access to specific URLs.": "允许或拒绝 Agent 对特定 URL 执行浏览器操控。",
  "Allow/deny agent browser file downloads from specific sites.": "允许或拒绝 Agent 从特定网站下载文件。",
  "Browsing History": "浏览历史",
  "Clear Browser History": "清除浏览历史",
  "Clear visited URLs and autocomplete suggestions from the built-in browser.": "清除内置浏览器的访问历史与地址栏自动补全建议。",
  "Download Location": "下载位置",
  "Folder where files downloaded in the built-in browser are saved.": "内置浏览器下载文件的默认保存目录。",
  "Change": "更改",
  "The browser subagent has been disabled by your administrator. Contact your administrator to enable browser use.": "Browser Subagent 已被管理员禁用，请联系你的管理员开启浏览器功能。",
  "Include Jetski Default Customizations": "包含默认 Customizations",
  "Include default customizations, such as default skills.": "包含内置默认的 Customizations（如默认 Skills）。",
  "When enabled, the agent will include default customizations, including default skills.": "启用后，Agent 将加载内置默认的 Customizations（包括默认 Skills）。",
  "Default Customizations": "默认 Customizations",
  "Configure default behaviors, skills, and MCP servers.": "配置默认行为、Skills 与 MCP 服务器。",
  "There are no customizations enabled.": "当前未启用任何 Customizations。",
  "Prevent Sleep": "防止系统休眠",
  "Prevent the computer from sleeping while the app is running.": "应用运行时阻止电脑自动进入休眠状态。",
  "Keep In Menu Bar": "在托盘/菜单栏保留后台运行",
  "Keep the app accessible from the menu bar and running in the background when all windows are closed.": "关闭所有窗口后仍在后台运行，并保留托盘/菜单栏入口。",
  "Automatic Check for Updates": "自动检查更新",
  "Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.": "有新版本时自动提示重启更新；关闭后可通过应用菜单手动检查更新。",
  "Enable Remote Control": "启用 Remote Control",
  "Manage your conversations from the companion website.": "通过配套网页端远程管理你的对话。",
  "Work with local agents from another device.": "从其他设备远程操控本机上的 Agents。",
  "Nickname": "设备昵称",
  "Device Name": "设备名称",
  "A nickname for identifying this application in the companion website. Changing this will restart the connection.": "用于在配套网页端识别本设备的名称；修改后将重启远程连接。",
  "A label for this computer when you connect from another device. Changing it reconnects.": "从其他设备连接时用于识别这台电脑的标签；修改后将重新连接。",
  "Continue your work from another device with Remote Control. Scan the QR code or open the link below.": "通过 Remote Control 在其他设备上继续工作。扫描二维码或打开下方链接。",
  "Scan the code to open this device in Remote Control, or": "扫描二维码在 Remote Control 中打开此设备，或",
  "copy link": "复制链接",
  "Copy link": "复制链接",
  "Show Remote Control QR code": "显示 Remote Control 二维码",
  "Controls permissions for remote conversations.": "控制远程对话的权限策略。",
  "Default Workspace VCS": "默认工作区 VCS",
  "VCS used when creating a new workspace, including workspaces generated based off your initial prompt.": "创建新工作区（包括根据初始提示词自动创建）时默认使用的版本控制系统。",
  "Select the workspace type that will be used for new conversations started with the New Workspace option.": "选择通过“新建工作区”开启新对话时默认使用的工作区类型。",
  "Use full VCS clones for Best of N": "Best of N 使用完整 VCS 克隆",
  "Use full Git clones for Best of N": "Best of N 使用完整 Git 克隆",
  "Terminal & Tooling Permissions": "终端与工具权限",
  "Tool Permissions": "工具权限",
  "Permission Preset": "权限预设",
  "Permission Settings": "权限设置",
  "Permission Details": "权限详情",
  "Security Preset": "安全预设",
  "Local Permissions": "本地权限",
  "Global Permissions": "全局权限",
  "Cloud Permissions": "云端权限",
  "Modify permissions for file and terminal tools.": "修改文件与终端工具的权限设置。",
  "Configure what the agent can do in local and remote conversations.": "配置 Agent 在本地与远程对话中可执行的操作。",
  "Configure global allowed and denied resource permissions.": "配置全局允许与拒绝访问的资源权限。",
  "File Permissions": "文件权限",
  "File Access Rules": "文件访问规则",
  "File Reads": "文件读取",
  "File Writes": "文件写入",
  "Outside of folders file access policy": "目录外文件访问策略",
  "Configure allowed and denied paths for file reads and writes.": "配置允许和拒绝读写的文件路径。",
  "Allow/deny agent read access to specific files or directories.": "允许或拒绝 Agent 读取特定文件或目录。",
  "Allow/deny agent write access to specific files or directories.": "允许或拒绝 Agent 写入特定文件或目录。",
  "Network Permissions": "网络权限",
  "Network Access Rules": "网络访问规则",
  "Read URLs": "读取 URL",
  "Execute URLs": "执行 URL",
  "Configure allowed and denied URLs for reading.": "配置允许和拒绝读取的 URL。",
  "Allow/deny agent read access to specific URLs or domains.": "允许或拒绝 Agent 读取特定 URL 或域名。",
  "Terminal Commands": "终端命令",
  "Commands Outside Sandbox": "Sandbox 外命令",
  "Configure allowed terminal commands.": "配置允许执行的终端命令。",
  "Configure allowed commands outside the sandbox.": "配置允许在 Sandbox 外执行的命令。",
  "Allow/deny specific terminal commands.": "允许或拒绝特定的终端命令。",
  "Allow/deny agent command execution outside the sandbox.": "允许或拒绝 Agent 在 Sandbox 之外执行命令。",
  "Configure agent execution, queued message delivery, and permissions.": "配置 Agent 执行、排队消息投递与权限策略。",
  "Configure workspace-specific permissions, resources, and customizations.": "配置当前工作区专属的权限、资源与 Customizations。",
  "Configures how the agent tries to access files outside of its working folders.": "配置 Agent 访问工作目录之外文件时的策略。",
  "Controls the actions the agent can take.": "控制 Agent 可以执行的操作范围。",
  "These settings can only be changed on the computer running the app, not from a remote session.": "这些设置只能在运行桌面应用的本机上修改，无法在远程会话中更改。",
  "Your agent’s ability to execute commands is also controlled by enterprise security policies.": "Agent 执行命令的权限同时受企业安全策略控制。",
  "Disabled by organization policy": "已被组织策略禁用",
  "Blocked by organization policy": "已被组织策略阻止",
  "Managed by Enterprise Gateway": "由 Enterprise Gateway 托管",
  "Enterprise Gateway": "Enterprise Gateway",
  "GitHub Permissions": "GitHub 权限",
  "GitHub Policies": "GitHub 策略",
  "Configure GitHub access policies.": "配置 GitHub 访问策略。",
  "Manage fine-grained permissions for GitHub.": "管理精细化的 GitHub 权限。",
  "Enable fine-grained GitHub permissions and define the org, repository, and resource-level access the agent is allowed to use.": "启用精细化 GitHub 权限，定义允许 Agent 访问的组织、仓库及资源级别范围。",
  "Auth and Billing": "认证与账单",
  "Accounts": "账号列表",
  "Signed-in accounts": "已登录账号",
  "Available licenses": "可用许可证",
  "Select your license": "选择你的许可证",
  "Select License": "选择许可证",
  "Manage License": "管理许可证",
  "Other License": "其他许可证",
  "Select Billing Model": "选择计费模式",
  "Select Project": "选择项目",
  "Provide Google Cloud Project": "填写 Google Cloud 项目",
  "Manage your plan, credentials, and general preferences.": "管理你的套餐、凭据与通用偏好。",
  "Manage your model quota and credits.": "管理你的模型配额与额度。",
  "Use Antigravity through your Gemini subscription.": "通过你的 Gemini 订阅使用 Antigravity。",
  "Pay only for the tokens you use, billed through Gemini platform.": "仅按实际使用的 Token 数量计费，通过 Gemini 平台结算。",
  "Get More AI Credits": "获取更多 AI 额度",
  "Models & Usage": "模型与用量",
  "Model Quota": "模型配额",
  "Model Credits": "模型额度",
  "No quota information available.": "暂无可用的配额信息。",
  "No token data available.": "暂无 Token 用量数据。",
  "Loading token usage...": "正在加载 Token 用量...",
  "Loading licenses...": "正在加载许可证...",
  "Connected": "已连接",
  "Disconnected": "已断开",
  "Not connected": "未连接",
  "Needs re-auth": "需要重新认证",
  "No sign-in needed": "无需登录",
  "You are logged in using Application Default Credentials (ADC). To log out, undo any changes to ~/.gemini/config/config.json (or unset AGY_ADC_AUTH if launched from terminal) and restart the application.": "当前通过 Application Default Credentials (ADC) 登录。如需退出登录，请撤销 ~/.gemini/config/config.json 中的对应修改（或取消环境变量 AGY_ADC_AUTH）并重启应用。",
  "You are logged in using environment credentials and cannot sign out from the application.": "当前通过环境变量凭据登录，无法在应用内直接退出。",
  "You cannot sign out from Remote Control. Please sign out on your local application.": "无法在 Remote Control 中退出登录，请在本地桌面应用中退出。",
  "Remote Agents Data": "远程 Agents 数据",
  "Delete All Data": "删除所有数据",
  "Delete All Remote Agents Data": "删除所有远程 Agents 数据",
  "Delete All Remote Agents Data?": "确定删除所有远程 Agents 数据？",
  "Manage and delete your data anytime": "随时管理或删除你的数据",
  "Permanently delete your remote conversations, projects, scheduled tasks, connected plugins and settings. Data in the desktop app and your Google account are not affected.": "永久删除云端远程对话、项目、定时任务、已连接插件和设置。桌面本地应用数据与你的 Google 账号不受影响。",
  "This permanently deletes all of your Remote Agents conversations, projects, scheduled tasks, connected plugins and settings, and stops any running remote agents. It can't be undone. Data in the desktop app and your Google account are not affected, and you can keep using Remote Agents afterwards.": "此操作将永久删除你的所有远程 Agents 对话、项目、定时任务、已连接插件与设置，并停止所有运行中的远程 Agents，且无法撤销。本地桌面应用与 Google 账号数据不受影响，后续仍可继续使用 Remote Agents。",
  "Uploaded project files and in-chat attachments are stored on Google servers and mounted into your cloud sandbox so your agent can read and work with them.": "上传的项目文件与聊天附件保存在 Google 服务器上，并挂载到云端 Sandbox 中供 Agent 读取与处理。",
  "Uploaded files and connected resources are mounted in your cloud environment.": "已上传的文件与关联资源会挂载到你的云端运行环境中。",
  "Remove individual uploaded files or connected resources in Project Settings, or delete a project or conversation to remove its stored files.": "你可以在项目设置中移除单个已上传文件或关联资源，或通过删除项目/对话来清理其存储的文件。",
  "App version": "应用版本",
  "Copy version details": "复制版本详情",
  "Operating System": "操作系统",
  "Host Environment": "宿主环境",
  "User Type": "用户类型",
  "Settings Unavailable": "设置暂不可用",
  "Privacy Settings": "隐私设置",
  "You can change this in": "你可以在此处更改：",
  "Google Antigravity Terms of Service": "Google Antigravity 服务条款",
  "Prohibited Use Policy": "禁止使用政策",
  "Google Privacy Policy": "Google 隐私政策",
  "Terms of Service": "服务条款",
  "Legal Help": "法律帮助",
  "here": "这里",
  "Voice": "语音",
  "Voice Mode": "语音模式",
  "Voice mode": "语音模式",
  "Voice engine": "语音引擎",
  "Voice engine address": "语音引擎地址",
  "Voice volume": "语音音量",
  "Voice transcript": "语音转写记录",
  "Voices": "音色",
  "Microphone": "麦克风",
  "The voice used in Voice mode. Powered by Gemini Live.": "语音模式使用的音色（由 Gemini Live 驱动）。",
  "Input device for voice mode and dictation.": "语音模式与听写使用的麦克风输入设备。",
  "Save audio recordings": "保存语音录音",
  "Recordings": "录音记录",
  "Delete all recordings?": "删除所有录音？",
  "Delete all": "全部删除",
  "Your sign-in needs an update.": "你的登录状态需要刷新。",
  "to use Voice.": "以使用语音功能。",
  "Allow microphone access to start Voice": "请允许麦克风权限以启动语音功能",
  "Microphone blocked": "麦克风已被阻止",
  "Microphone blocked. Allow in": "麦克风权限被阻止，请在以下位置允许：",
  "Subscription": "订阅",
  "Quota": "配额",
  "Billing model": "计费模式",
  "Pay As You Go": "按量付费",
  "Credit Overages": "额度超额使用",
  "Enable AI Credit Overages": "启用 AI 额度超额使用",
  "Enable Overages": "启用超额使用",
  "Refresh quota and credits data": "刷新配额与额度数据",
  "Daily limit": "每日限额",
  "Weekly limit": "每周限额",
  "Weekly Limit Remaining": "每周限额剩余",
  "Five Hour Limit Remaining": "5 小时限额剩余",
  "Daily Limit Remaining": "每日限额剩余",
  "Refreshing...": "刷新中...",
  "Pricing is based on public API pricing": "定价基于公开 API 价格计算",
  "Click to view more": "点击查看更多",
  "Trajectory Stats": "轨迹统计",
  "Jetski Chat": "Jetski 聊天",
  "Upgrade": "升级",
  "See Activity": "查看明细",
  "See Plans": "查看套餐",
  "Purchase Credits": "购买额度",
  "Insufficient AI Credits": "AI 额度不足",
  "Your plan": "当前套餐",
  "Orchestrator Settings": "Orchestrator 设置",
  "Choose the models Orchestrator uses. A larger, smarter orchestrator model with a faster, cheaper executor gives high quality for fewer tokens.": "选择 Orchestrator 使用的模型组合。用更强的 Orchestrator 模型搭配更快、更经济的 Executor 模型，能以更少 Token 获得高质量结果。",
  "Model selection": "模型选择",
  "Orchestrator model selection": "Orchestrator 模型选择",
  "Default uses server-managed routing and Orchestrator quota. Custom pins specific models for orchestration and execution.": "默认模式使用服务端智能路由与 Orchestrator 配额；自定义模式可分别为编排与执行固定指定模型。",
  "Orchestrator Model": "Orchestrator 模型",
  "Plans the work, makes design decisions, and reviews the result. Pick a top-tier model. You can also pick one per conversation from the Orchestrator row in the model menu.": "负责规划任务、制定设计决策并审查结果，建议选择顶尖模型。你也可以在模型菜单的 Orchestrator 行中为单个对话单独指定。",
  "Executor Model": "Executor 执行模型",
  "Carries out the plan: searches, edits, builds, and tests. Pick a faster, cheaper model.": "负责执行计划：检索、编辑、构建与测试，建议选择更快、更经济的模型。",
  "Gemini Models": "Gemini 模型",
  "Error Loading Models": "加载模型出错",
  "No Models Available": "暂无可用模型",
  "Select Model": "选择模型",
  "Select Model to Send Message": "选择用于发送消息的模型",
  "Select another model": "选择其他模型",
  "Change model": "切换模型",
  "Choose which key sends a message in the chat composer.": "选择在聊天输入框中发送消息的按键。",
  "For Antigravity Business consumption options, see": "如需了解 Antigravity Business 用量选项，请参阅",
  "documentation": "文档",
  "Enable browser agent": "启用浏览器 Agent",
  "Browser actions": "浏览器操作",
  "Browser downloads": "浏览器下载",
  "Browsing data": "浏览数据",
  "Unsandboxed commands": "Sandbox 外命令",
  "Access grants": "访问授权",
  "Plugin permissions": "插件权限",
  "Changes plugins can make without asking.": "插件无需确认即可执行的操作。",
  "Open Preferences": "打开偏好设置",
  "Notification Preferences": "通知偏好设置",
  "Link Settings": "链接设置",
  "Project Settings": "项目设置",
  "Advanced Settings": "高级设置",
  "Telemetry is disabled in Settings": "遥测已在设置中禁用",
  "Developer: Reset NUX": "开发者：重置新手引导 (NUX)",
  "Developer: Reset Onboarding": "开发者：重置初始化引导",
  "Console Telemetry": "控制台遥测",
  "Enable Telemetry": "启用遥测日志",
  "Print telemetry to the console": "在控制台输出遥测事件",
  "Logs each telemetry event to the browser's DevTools console as it fires, with the click or key that caused it. Stays on across reloads until you turn it off.": "在每个遥测事件触发时将其及对应点击/按键打印到 DevTools 控制台；关闭前在页面刷新后仍保持开启。",
  "Developer-only tools. These settings do not affect other users.": "仅限开发者使用的调试工具，这些设置不会影响其他用户。",
  "Try out early-stage features before they ship. These may be changed or removed at any time. These features are experimental, and we make no guarantees about performance or functionality.": "抢先体验尚未正式发布的新特性。实验性功能可能随时调整或移除，不对其性能或稳定性作保证。",
  "Custom Flags": "自定义 Flags",
  "Flags come from Mendel experiments and from the host app. Overrides are local to this browser and change how every feature gated on the flag resolves. Some features are only read at startup — reload the window if a change does not take effect.": "Flags 来自实验配置与宿主应用。覆盖项仅在本地生效，会改变受对应 Flag 控制的功能行为。部分开关仅在启动时读取——若修改未生效请重新加载窗口。",
  "This client was started with no custom flags.": "当前客户端启动时未设置任何自定义 Flag。",
  "No custom flag matches your search.": "没有匹配搜索条件的自定义 Flag。",
  "Search flags": "搜索特性标志 (Flags)",
  "No matching flags": "无匹配的 Flag",
  "Turn on a flag you don't have": "开启尚未展示的 Flag",
  "Feature Environment Override": "特性环境覆盖",
  "Override feature environment": "覆盖特性环境",
  "When enabled, the values below replace the auto-detected OS, host, and user type used for feature gating.": "启用后，下方配置将替代自动检测的 OS、宿主类型和用户类型，用于控制特性开关。",
  "Simulate running on a different OS.": "模拟在不同的操作系统上运行。",
  "Simulate a different host (Electron, desktop or mobile Web, Extension, remote control, or installed PWA).": "模拟不同的宿主环境（Electron、桌面/移动 Web、扩展、Remote Control 或 PWA）。",
  "Simulate a different user cohort (Google, External, Enterprise).": "模拟不同的用户群体（Google、External、Enterprise）。",
  "Workspace URI Switcher": "工作区 URI 切换器",
  "Workspace URI query parameter": "工作区 URI 查询参数",
  "Workspace URI to switch to": "要切换到的工作区 URI",
  "Sets the `workspaceUri` URL parameter and reloads, repointing the active workspace. Pick a folder from an existing project or enter a custom URI (e.g. file:///path/to/workspace).": "设置 `workspaceUri` URL 参数并重新加载以切换当前活动工作区。可从已有项目中选择文件夹，或输入自定义 URI（如 file:///path/to/workspace）。",
  "Project Folders": "项目文件夹",
  "Project General": "项目通用设置",
  "Project Agent": "项目 Agent 设置",
  "No folders added yet.": "尚未添加任何文件夹。",
  "No resources added yet.": "尚未添加任何资源。",
  "Files, folders, and repositories you connect are accessible to your agent in this project, including during background or scheduled runs.": "你关联的文件、文件夹和仓库在本项目中均可被 Agent 访问（包括后台运行和定时任务期间）。",
  "Folders these agents can access.": "Agents 可访问的文件夹。",
  "Commands and files these agents can use.": "Agents 可使用的命令与文件。",
  "No project selected": "未选择项目",
  "No project selected or project management not available.": "未选择项目，或当前不支持项目管理。",
  "Project Required": "需要选择项目",
  "License Required": "需要许可证",
  "Windows Subsystem for Linux": "Windows Subsystem for Linux (WSL)",
  "The app is currently connected to a WSL distro. Reopening locally relaunches it directly on Windows.": "当前应用正连接到 WSL 发行版。点击“在本地重新打开”将直接在 Windows 上重启应用。",
  "Run the app against a Linux environment. Connecting relaunches the app into the selected WSL distro.": "在 Linux 环境中运行应用。连接后将在所选 WSL 发行版中重启应用。",
  "Nothing is running right now": "当前没有正在运行的任务",
  "Background tasks and terminals agents left running, across all conversations.": "跨所有对话的后台任务与由 Agent 启动的终端会话。",
  "Running processes are killed. This cannot be undone.": "运行中的进程将被强制终止，且无法撤销。",
  "Cancel All Tasks": "取消所有任务",
  "Stop All Subagents": "停止所有 Subagents",
  "Stop Subagent": "停止 Subagent",
  "Reset All to Defaults": "全部恢复默认",
  "Reset all shortcuts to defaults": "将所有快捷键恢复为默认值",
  "No keyboard shortcuts found matching your filter.": "没有匹配筛选条件的快捷键。",
  "Search shortcuts": "搜索快捷键",
  "Press keys...": "请按下快捷键...",
  "Add Shortcut": "添加快捷键",
  "Invite a Friend": "邀请好友",
  "Share your referral link with friends": "向好友分享你的推荐链接",
  "Google One Referral": "Google One 推荐",
  "Upload Debug Bundle": "上传调试日志包",
  "Copy error messages": "复制错误信息",
  "Copy output": "复制输出",
  "Enable Browser Agent": "启用浏览器 Agent",
  "Let the agent open URLs, read web pages, and interact with browser content. This gives the agent access to important (and often critical) knowledge and methods of validation, but any browser integration does increase exposure to external malicious parties for security exploits.": "允许 Agent 打开 URL、读取网页并与浏览器内容交互。这能让 Agent 获取重要甚至关键的信息与验证手段，但任何浏览器集成都会增加外部恶意页面发起安全利用的风险。",
  "Browsing Data": "浏览数据",
  "Clear history, cookies and site data from the built-in browser, or manage cookies for each site.": "清除内置浏览器的历史记录、Cookie 与站点数据，或按站点管理 Cookie。",
  "Cookies by Site": "按站点管理 Cookie",
  "Clear Browsing Data?": "清除浏览数据？",
  "Choose what to clear from the built-in browser. It can't be undone.": "选择要从内置浏览器清除的数据，此操作无法撤销。",
  "Browsing history": "浏览历史记录",
  "Visited URLs and autocomplete suggestions.": "已访问的 URL 与自动补全建议。",
  "Cookies and other site data": "Cookie 和其他站点数据",
  "Cookies, site storage and cache. Signs you out of all sites in the built-in browser and reloads its open tabs.": "Cookie、站点存储与缓存。将退出内置浏览器中所有网站的登录状态并重新加载已打开的标签页。",
  "An agent is using the built-in browser. Clearing its data signs the agent out of sites and may interrupt its task.": "当前有 Agent 正在使用内置浏览器。清除其数据会退出网站登录并可能中断当前任务。",
  "Sites with cookies": "包含 Cookie 的站点",
  "Search sites...": "搜索站点...",
  "Shortcuts": "快捷键",
  "Keyboard Shortcuts": "键盘快捷键",
  "Open Keyboard Shortcuts": "打开键盘快捷键",
  "Keyboard shortcuts for quick navigation and control.": "用于快速导航与控制操作的键盘快捷键。",
  "Edit Shortcut": "编辑快捷键",
  "Remove Shortcut": "移除快捷键",
  "navigation": "导航",
  "conversation": "对话",
  "layout": "布局",
  "Toggle Model Selector": "切换模型选择器",
  "Open Conversation Picker": "打开对话选择器",
  "Search Conversations": "搜索对话",
  "Open Workspace Selector": "打开工作区选择器",
  "Toggle Project Selector": "切换项目选择器",
  "Toggle Environment Selector": "切换环境选择器",
  "Toggle Side Panel": "切换右侧面板",
  "Toggle Maximize Side Panel": "最大化/还原右侧面板",
  "Toggle Overview Panel": "切换概览面板",
  "Toggle Terminal": "切换终端面板",
  "Toggle File Viewer": "切换文件查看器",
  "Toggle Word Wrap": "切换自动换行",
  "New Tab": "新建标签页",
  "Reopen Closed Tab": "重新打开关闭的标签页",
  "New Terminal Tab": "新建终端标签页",
  "Close Terminal Tab": "关闭终端标签页",
  "Split Terminal": "拆分终端",
  "Split Conversation Vertically": "垂直分屏对话",
  "Split Conversation Horizontally": "水平分屏对话",
  "Equalize Split Panes": "均分分屏窗格",
  "Previous Side Panel Tab": "上一个侧边栏标签页",
  "Next Side Panel Tab": "下一个侧边栏标签页",
  "Focus Input": "聚焦输入框",
  "Submit Prompt (Alternate to Enter)": "提交 Prompt（Enter 的备用快捷键）",
  "Enter always submits. This adds a second shortcut.": "默认 Enter 始终提交；此处用于添加第二个备用快捷键。（若已开启 enter-newline 插件，则由 Shift+Enter 提交）",
  "Cancel Generation": "停止生成",
  "Continue Response": "继续生成",
  "Jump to Previous Prompt": "跳转到上一条提问",
  "Jump to Next Prompt": "跳转到下一条提问",
  "Select Next Conversation": "选择下一个对话",
  "Select Previous Conversation": "选择上一个对话",
  "Move Conversation Up": "上移对话",
  "Move Conversation Down": "下移对话",
  "Add to Chat": "添加到对话",
  "Quote Selection": "引用选中内容",
  "Open in Code Search": "在代码搜索中打开",
  "Code Search": "代码搜索",
  "Open Commit Graph": "打开提交图谱",
  "Comment on Selection": "对选中内容添加批注",
  "Terminal: Add to Chat": "终端：添加到对话",
  "Start Voice Recording": "开始语音输入",
  "Stop Voice Recording": "停止语音输入",
  "Toggle Voice Recording": "切换语音输入",
  "Mute Voice Mic": "静音麦克风",
  "Mute Voice Speaker": "静音语音播报",
  "Terminal: Select All": "终端：全选",
  "Keybinding Scheme": "快捷键方案",
  "Choose between non-colliding VS Code defaults or standalone Antigravity chords.": "在无冲突的 VS Code 默认方案或独立 Antigravity 组合键方案之间选择。",
  "Manage your keybinding scheme and customize shortcuts in VS Code.": "管理快捷键方案，并在 VS Code 中自定义快捷键。",
  "VS Code Default": "VS Code 默认方案",
  "Antigravity (AGY) Style": "Antigravity (AGY) 风格",
  "Customize Shortcuts": "自定义快捷键",
  "All active Antigravity shortcuts and user keybinding overrides are managed directly by VS Code.": "所有生效中的 Antigravity 快捷键与用户自定义键位覆盖均由 VS Code 直接管理。",
  "VS Code Keyboard Shortcuts": "VS Code 键盘快捷键"
};
  const LOWER_DICT = Object.create(null);
  for (const key of Object.keys(EXACT_DICT)) {
    const lower = key.toLowerCase();
    if (!(lower in LOWER_DICT)) {
      LOWER_DICT[lower] = EXACT_DICT[key];
    }
  }
  const PATTERNS = [
  {
    "pattern": "^Version\\s+(.+)$",
    "replace": "版本 $1"
  },
  {
    "pattern": "^Manage\\s+(.+?)\\s+app settings\\.$",
    "replace": "管理 $1 应用设置。"
  },
  {
    "pattern": "^When toggled on,\\s+(.+?)\\s+collects usage data to help Google enhance performance and features\\.$",
    "replace": "开启后，$1 会收集使用数据以帮助 Google 改进性能与功能。"
  },
  {
    "pattern": "^When toggled on,\\s+(.+?)\\s+will use your AI credits to fulfill model requests once you're out of model quota\\.\\s+\\1\\s+will always use your model quota first before using AI credits\\.$",
    "replace": "开启后，当你的模型配额用完时，$1 将使用你的 AI 额度来响应模型请求。$1 始终会优先使用模型配额，然后再消耗 AI 额度。"
  },
  {
    "pattern": "^Receive product updates, tips, and promotions from Google\\s+(.+?)\\s+via email\\.$",
    "replace": "通过电子邮件接收来自 Google $1 的产品更新、使用技巧和优惠信息。"
  },
  {
    "pattern": "^How loud\\s+(.+?)'s voice is\\.$",
    "replace": "设置 $1 语音播报的音量大小。"
  },
  {
    "pattern": "^Your [Pp]lan:\\s*(.+)$",
    "replace": "当前套餐：$1"
  },
  {
    "pattern": "^You can upgrade to a\\s+(.+?)\\s+plan to receive higher rate limits\\.$",
    "replace": "你可以升级到 $1 套餐以获得更高的速率限制。"
  },
  {
    "pattern": "^Available AI credits:\\s*(.+)$",
    "replace": "可用 AI 额度：$1"
  },
  {
    "pattern": "^You have used some of your weekly limit, it will fully refresh in\\s+(.+?)\\.$",
    "replace": "你已使用部分每周限额，将在 $1后完全刷新。",
    "localizeDuration": true
  },
  {
    "pattern": "^You have used some of your daily limit, it will fully refresh in\\s+(.+?)\\.$",
    "replace": "你已使用部分每日限额，将在 $1后完全刷新。",
    "localizeDuration": true
  },
  {
    "pattern": "^You have used some of your (\\d+)-hour limit, it will fully refresh in\\s+(.+?)\\.$",
    "replace": "你已使用部分 $1 小时限额，将在 $2后完全刷新。",
    "localizeDuration": true
  },
  {
    "pattern": "^You have reached your (\\d+)-hour limit(?:, it will (?:fully )?refresh in\\s+(.+?))?\\.?$",
    "replace": "你已达到 $1 小时限额，将在 $2后完全刷新。",
    "localizeDuration": true
  },
  {
    "pattern": "^You have reached your (weekly|daily) limit(?:, it will (?:fully )?refresh in\\s+(.+?))?\\.?$",
    "replace": "你已达到 $1 限额，将在 $2后完全刷新。",
    "localizeDuration": true
  },
  {
    "pattern": "^Resets in <1m$",
    "replace": "将在 1 分钟内重置"
  },
  {
    "pattern": "^Resets in\\s+(.+)$",
    "replace": "将在 $1后重置",
    "localizeDuration": true
  },
  {
    "pattern": "^Project ID:\\s*(.+)$",
    "replace": "项目 ID：$1"
  },
  {
    "pattern": "^(\\d+)\\s+accounts?$",
    "replace": "$1 个账号"
  },
  {
    "pattern": "^(\\d+)\\s+tools?$",
    "replace": "$1 个工具"
  },
  {
    "pattern": "^(\\d+)\\s+projects?$",
    "replace": "$1 个项目"
  },
  {
    "pattern": "^(\\d+)\\s+resources?$",
    "replace": "$1 个资源"
  },
  {
    "pattern": "^(\\d+)\\s+selected$",
    "replace": "已选择 $1 项"
  },
  {
    "pattern": "^Thought for\\s+(\\d+)s$",
    "replace": "思考了 $1 秒"
  },
  {
    "pattern": "^Thought for\\s+(\\d+)m\\s+(\\d+)s$",
    "replace": "思考了 $1 分 $2 秒"
  },
  {
    "pattern": "^Send Message\\s+(.+)$",
    "replace": "发送消息 $1"
  },
  {
    "pattern": "^(\\d+)\\s+files?\\s+changed$",
    "replace": "$1 个文件已变更"
  },
  {
    "pattern": "^(\\d+)\\s+conversations?$",
    "replace": "$1 个对话"
  },
  {
    "pattern": "^(\\d+)\\s+agents?\\s+running$",
    "replace": "$1 个 Agent 运行中"
  },
  {
    "pattern": "^(\\d+)\\s+minutes?\\s+ago$",
    "replace": "$1 分钟前"
  },
  {
    "pattern": "^(\\d+)\\s+hours?\\s+ago$",
    "replace": "$1 小时前"
  },
  {
    "pattern": "^(\\d+)\\s+days?\\s+ago$",
    "replace": "$1 天前"
  },
  {
    "pattern": "^Just now$",
    "replace": "刚刚"
  },
  {
    "pattern": "^Send feedback as\\s*(.+)$",
    "replace": "以 $1 身份发送反馈"
  },
  {
    "pattern": "^Plugin Operation Error:\\s*(.+)$",
    "replace": "插件操作错误：$1"
  },
  {
    "pattern": "^Custom Agent Error:\\s*(.+)$",
    "replace": "自定义 Agent 错误：$1"
  },
  {
    "pattern": "^(.+?)\\s+\\(disabled by admin\\)$",
    "replace": "$1（已被管理员禁用）"
  },
  {
    "pattern": "^(.+?)\\s+\\(still loading…\\)$",
    "replace": "$1（仍在加载…）"
  }
].map((item) => ({
    regex: new RegExp(item.pattern),
    replace: item.replace,
    localizeDuration: Boolean(item.localizeDuration),
  }));

  // 绝不翻译文本节点的隔离区域：代码块、用户输入、AI 回复正文、终端、地址栏等
  const SKIP_TEXT_ANCESTOR_SELECTOR = [
    'pre',
    'code',
    'kbd',
    'samp',
    'var',
    'script',
    'style',
    'noscript',
    'textarea',
    'input',
    '[contenteditable="true"]',
    '[data-lexical-editor="true"]',
    '.xterm',
    '.monaco-editor',
    '.cm-editor',
    '.google-symbols',
    '.material-symbols-outlined',
    '.material-symbols-rounded',
    '.material-icons',
    '[data-testid="terminal-surface"]',
    '[data-testid="bottom-terminal-panel"]',
    '[data-testid="user-message-content"]',
    '[data-testid="agent-response"]',
    '[data-testid="markdown-code-block-preview"]',
    '[data-testid="browser-url-display"]',
    '[data-testid="external-link-confirm-uri"]',
    '[data-my-antigravity-no-i18n]',
  ].join(',');

  // 对属性（placeholder / aria-label / title）同样跳过对话正文与代码编辑器内部节点
  const SKIP_ATTR_ANCESTOR_SELECTOR = [
    'pre',
    'code',
    '.monaco-editor',
    '.cm-editor',
    '.xterm',
    '.google-symbols',
    '.material-symbols-outlined',
    '.material-symbols-rounded',
    '.material-icons',
    '[data-testid="user-message-content"]',
    '[data-testid="agent-response"]',
    '[data-my-antigravity-no-i18n]',
  ].join(',');

  const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label', 'title'];
  const writtenTextMap = new WeakMap();
  const writtenAttrMap = new WeakMap();

  function localizeDurationText(text) {
    return text
      .replace(/(\d+)\s*days?\b/gi, '$1 天')
      .replace(/(\d+)\s*hours?\b/gi, '$1 小时')
      .replace(/(\d+)\s*minutes?\b/gi, '$1 分钟')
      .replace(/(\d+)\s*seconds?\b/gi, '$1 秒')
      .replace(/(\d+)d\b/g, '$1 天')
      .replace(/(\d+)h\b/g, '$1 小时')
      .replace(/(\d+)m\b/g, '$1 分钟')
      .replace(/\s*,\s*/g, ' ');
  }

  function lookupDict(text) {
    if (Object.prototype.hasOwnProperty.call(EXACT_DICT, text)) {
      return EXACT_DICT[text];
    }
    if (text.includes(' ') || text.length >= 4) {
      const lower = text.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(LOWER_DICT, lower)) {
        return LOWER_DICT[lower];
      }
    }
    return null;
  }

  function translateCore(trimmed) {
    if (!trimmed) {
      return null;
    }
    const direct = lookupDict(trimmed);
    if (direct !== null) {
      return direct;
    }
    // 回退匹配：去掉末尾冒号或省略号后再查词典，并保留原末尾标点
    const suffixMatch = /^(.*?)(\s*[:：]|\.\.\.|…)$/.exec(trimmed);
    if (suffixMatch) {
      const base = suffixMatch[1].trim();
      const rawSuffix = suffixMatch[2];
      const baseHit = lookupDict(base);
      if (baseHit !== null) {
        const zhSuffix = rawSuffix.includes(':') ? '：' : rawSuffix;
        return baseHit + zhSuffix;
      }
    }
    for (let i = 0; i < PATTERNS.length; i++) {
      const { regex, replace, localizeDuration } = PATTERNS[i];
      if (regex.test(trimmed)) {
        const out = trimmed.replace(regex, replace);
        return localizeDuration ? localizeDurationText(out) : out;
      }
    }
    return null;
  }

  function translateText(raw) {
    if (typeof raw !== 'string') {
      return null;
    }
    // 跳过全空白、纯数字、或已含中文的文本以降低开销
    if (!raw.trim() || !/[A-Za-z]/.test(raw)) {
      return null;
    }
    const leadMatch = /^\s*/.exec(raw);
    const trailMatch = /\s*$/.exec(raw);
    const lead = leadMatch ? leadMatch[0] : '';
    const trail = trailMatch ? trailMatch[0] : '';
    const core = raw.slice(lead.length, raw.length - trail.length);

    // 优先按原换行结构精确查，再按折叠单行空白查
    let hit = translateCore(core);
    if (hit === null && /\s{2,}|\n/.test(core)) {
      hit = translateCore(core.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]{2,}/g, ' '));
    }
    if (hit === null) {
      return null;
    }
    return lead + hit + trail;
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== 3) {
      return;
    }
    const cur = node.nodeValue;
    if (!cur || cur === writtenTextMap.get(node)) {
      return;
    }
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_TEXT_ANCESTOR_SELECTOR)) {
      return;
    }
    const next = translateText(cur);
    if (next !== null && next !== cur) {
      writtenTextMap.set(node, next);
      node.nodeValue = next;
    }
  }

  function processElementAttrs(el) {
    if (!el || el.nodeType !== 1 || el.closest(SKIP_ATTR_ANCESTOR_SELECTOR)) {
      return;
    }
    let cache = writtenAttrMap.get(el);
    for (let i = 0; i < TRANSLATABLE_ATTRS.length; i++) {
      const attr = TRANSLATABLE_ATTRS[i];
      if (!el.hasAttribute(attr)) {
        continue;
      }
      const val = el.getAttribute(attr);
      if (!val || (cache && cache.get(attr) === val)) {
        continue;
      }
      const next = translateText(val);
      if (next !== null && next !== val) {
        if (!cache) {
          cache = new Map();
          writtenAttrMap.set(el, cache);
        }
        cache.set(attr, next);
        el.setAttribute(attr, next);
      }
    }
  }

  function walkAndTranslate(root) {
    if (!root) {
      return;
    }
    if (root.nodeType === 3) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== 1) {
      return;
    }
    processElementAttrs(root);
    if (root.matches && root.matches(SKIP_TEXT_ANCESTOR_SELECTOR)) {
      // 跳过文本子节点，但若内部包含需要翻属性的控件（如输入框 placeholder），则仅处理后代属性
      const attrTargets = root.querySelectorAll
        ? root.querySelectorAll('[placeholder],[aria-label],[title]')
        : [];
      for (let i = 0; i < attrTargets.length; i++) {
        processElementAttrs(attrTargets[i]);
      }
      return;
    }
    const walker = doc.createTreeWalker(root, 1 | 4 /* SHOW_ELEMENT | SHOW_TEXT */);
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === 3) {
        processTextNode(current);
      } else if (current.nodeType === 1) {
        processElementAttrs(current);
      }
      current = walker.nextNode();
    }
  }

  // 若宿主环境允许覆写 electronNative.showContextMenu，则一并翻译原生菜单项 label
  function installContextMenuTranslator() {
    try {
      const api = win.electronNative;
      if (!api || typeof api.showContextMenu !== 'function') {
        return;
      }
      const desc = Object.getOwnPropertyDescriptor(api, 'showContextMenu');
      if (desc && !desc.writable && !desc.configurable) {
        return;
      }
      const origShow = api.showContextMenu.bind(api);
      const translateItems = (items) =>
        Array.isArray(items)
          ? items.map((item) => {
              if (!item || typeof item !== 'object') {
                return item;
              }
              const next = { ...item };
              if (typeof next.label === 'string') {
                const zh = translateText(next.label);
                if (zh !== null) {
                  next.label = zh;
                }
              }
              if (Array.isArray(next.submenu)) {
                next.submenu = translateItems(next.submenu);
              }
              return next;
            })
          : items;
      api.showContextMenu = (items) => origShow(translateItems(items));
    } catch {
      // contextBridge 冻结对象时静默跳过，不影响 DOM 右键菜单翻译
    }
  }

  const pendingNodes = new Set();
  let scheduled = false;

  function flushPending() {
    scheduled = false;
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    for (let i = 0; i < nodes.length; i++) {
      walkAndTranslate(nodes[i]);
    }
  }

  function scheduleNode(node) {
    if (!node) {
      return;
    }
    pendingNodes.add(node);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flushPending);
    }
  }

  function start() {
    installContextMenuTranslator();
    const target = doc.body || doc.documentElement;
    if (!target) {
      return;
    }
    walkAndTranslate(target);
    const Observer = win.MutationObserver;
    if (typeof Observer !== 'function') {
      return;
    }
    const observer = new Observer((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'characterData') {
          scheduleNode(m.target);
        } else if (m.type === 'attributes') {
          processElementAttrs(m.target);
        } else if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            scheduleNode(m.addedNodes[j]);
          }
        }
      }
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // 暴露工具函数便于测试和调试
  win.__myAntigravityZhCn = { translateText, walkAndTranslate };
})(window, document);
