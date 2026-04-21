@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_helper.ps1"
if errorlevel 1 (
    echo.
    echo Helper завершился с ошибкой.
    pause
)