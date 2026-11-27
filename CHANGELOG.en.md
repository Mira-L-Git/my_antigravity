<div align="center">
  <h1>Changelog</h1>
  <p><a href="CHANGELOG.md">简体中文</a> | <strong>English</strong> | <a href="README.en.md">Back to README</a></p>
</div>

---

## v1.0.4 (2026-11-27)

- **`quota-rings`**: Fixed quota ring display issues by replacing `pathLength` + `stroke-dasharray` (which Chromium stretched under `vector-effect="non-scaling-stroke"`) with exact segmented arc-length slicing, ensuring weekly, 5-hour, and single-window rings render accurate progress proportions across all percentages and DPI scales.

---

## v1.0.3 (2026-11-27)

- **`model-enhancer`**: When `Orchestrator` is selected, the original list and its planner/thinking-effort submenus are kept (no slider card), and picking a planner or effort inside the submenu no longer closes the popover, so you can keep adjusting.
- **`zh-cn`**: Added Chinese translations for `Extra High`, `Max`, `Thinking effort`, `Leaving Soon`, and Orchestrator-related hints.
- **`taskbar-badge`**: Reworked tray and taskbar badge logic: the tray dot shows status with the exact count in its tooltip, reminders clear by conversation focus, and WebSocket reconnects or late requests no longer re-trigger reminders.

---

## v1.0.2 (2026-11-27)

- **Fixed `dino-game` UI display bugs**: Removed fallback toolbar mounting and enforced strict detection requiring both the right auxiliary pane's New Tab menu list and URL search bar, ensuring the Chrome Dino trigger appears strictly beside `⋮` on the New Tab view and no longer leaks into Review, Browser, workspace file tree, or model picker popovers.

---

## v1.0.1 (2026-11-26)

- **Removed `file-link-color`**: Cancelled and removed the `file-link-color` plugin from the suite because Antigravity Desktop now officially provides the same native link-blue styling for chat file links.

---

## v1.0.0 (2026-11-25)

**Initial public release of My Antigravity** — a zero-dependency modular UI/UX enhancement suite for the Antigravity desktop app, letting you toggle individual mods in-app after a single loader install.

### Highlights & Pain Points Solved

- **Input & Reading Experience**
  - **`enter-newline`**: Swaps chat shortcuts to `Enter` for newline and `Shift+Enter` to send, preventing accidental premature sends when writing multi-line prompts (while keeping IME and `@`/`/` typeahead intact).
  - **`zh-cn`**: Localizes the desktop UI to Simplified Chinese while isolating chat messages, code blocks, and terminals so conversation content is never altered.

- **Status Visibility & Model Control**
  - **`session-status`**: Shows real-time turns, TPS, token breakdown, cache hit rate, and context window usage right under the composer, making generation speed and remaining context easy to track at a glance.
  - **`quota-rings`**: Displays dual quota rings (Gemini & other built-in models, 5h + weekly split) beside Settings, eliminating repeated trips into the settings page to check remaining quota.
  - **`model-enhancer`**: Adds a Codex-style thinking-effort slider and brand icons to the model picker, making reasoning levels and model families easier to adjust and recognize.
  - **`taskbar-badge`** *(Experimental)*: Shows deduplicated taskbar overlay badges and system tray dots for unfocused session errors, approval requests, or completions so background tasks are never missed.

- **Plugin Management & Break-Time Fun**
  - **`mod-manager`**: Turns the top-left logo into an in-app plugin manager (`Alt + Click` keeps the original home action) with an on-demand **Check Updates / GitHub** button, removing manual config editing and making version checks effortless.
  - **`dino-game`**: Embeds a lightweight Chrome Dino mini-game in the right auxiliary pane for quick breaks during long agent runs.
