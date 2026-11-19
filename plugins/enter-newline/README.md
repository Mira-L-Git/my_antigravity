# enter-newline

将 Antigravity 桌面版聊天输入框的按键习惯反转为：

- `Enter`：换行
- `Shift + Enter`：发送 Prompt

## 实现原理

通过源码检查 Antigravity 桌面版（v2.32.1）的渲染层与前端逻辑可以确认：
- 聊天输入框基于 **Lexical** 富文本编辑器，默认注册了优先级为 `1` 的 `KEY_ENTER_COMMAND` 处理器：遇到无 `Shift` 的 `Enter` 直接提交；遇到 `Shift+Enter` 则返回 `false` 交给优先级 `0` 的处理器执行 `INSERT_LINE_BREAK_COMMAND` 换行。
- 本插件在 `window` 捕获阶段监听 `keydown`，在满足以下保护条件时，将原生 `KeyboardEvent` 实例上的 `shiftKey`（及 `getModifierState('Shift')`）取反：
  1. 仅作用于 `[contenteditable="true"][data-lexical-editor="true"]`（不影响搜索框、设置页、重命名框等普通输入框）。
  2. 排除输入法选词状态（`isComposing || keyCode === 229`）。
  3. 排除带有 `Ctrl` / `Cmd` / `Alt` 的组合快捷键。
  4. 当 `@` 提及或 `/` 斜杠命令补全弹窗（`[role="listbox"]`）可见且存在选项时，保留 `Enter` 选中菜单项的原生行为。
  5. 拦截按住 `Shift+Enter` 造成的键盘连发（`repeat`）。
