# taskbar-badge（测试阶段）

后台会话完成、需要审批或报错时提醒。每个待查看会话只计一次，显示报错、审批、完成中优先级最高的状态。窗口聚焦且正在查看对应会话时，清除该会话的提醒。

## Windows 任务栏和托盘

- Windows 任务栏通过 `setOverlayIcon` 显示待查看会话数，完成、审批、报错分别用深灰、黄、红表示。超过 99 显示 `99+`。
- 将鼠标停在任务栏缩略图或系统托盘图标上可查看准确数量。托盘图标继续用绿、黄、红圆点表示状态。

多 DPI 角标各自绘制，显示空间仍受 Windows Overlay 的 16 像素槽位限制。本机 ChatGPT Windows 客户端的 JavaScript 使用 `app.setBadgeCount`，Electron 的 Windows 实现同样通过 Overlay 显示。固定任务栏分组的整图由 Windows 根据应用标识和快捷方式选取。[Windows 角标接口](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon) · [Electron Windows 徽标实现](https://github.com/electron/electron/blob/v44.9.1/shell/browser/browser_win.cc#L525-L614) · [Windows 固定图标](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-relaunchiconresource)

## 升级

完全退出 Antigravity（包括系统托盘）后运行 `npm run install-loader`，以更新主进程桥接。后续仅修改插件源码时运行 `npm run sync` 即可。
