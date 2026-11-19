@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [my_antigravity] Uninstalling loader and restoring original app.asar...
echo Please close Antigravity desktop app completely (including system tray) before continuing.
echo.
pause
node "%~dp0loader\cli.mjs" uninstall
echo.
pause
