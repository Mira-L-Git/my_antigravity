@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [my_antigravity] Installing loader and syncing plugins...
echo Please close Antigravity desktop app completely (including system tray) before continuing.
echo.
pause
node "%~dp0loader\cli.mjs" install
echo.
if errorlevel 1 (
  echo [FAILED] Please make sure Antigravity is completely closed and try again.
) else (
  echo [OK] Done! You can now reopen Antigravity.
)
pause
