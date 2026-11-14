@echo off
REM  Wersja: 1.58.0
REM  Start S.O.K. with local PostgreSQL. Optional -Watch enables backend reload.
REM Rola: Start lokalnej aplikacji z przygotowana natywna baza PostgreSQL.
REM Uzycie: start-native.bat [-Watch] [-StartTestDatabase]
REM Uruchamia: scripts/start-native.ps1.
REM Wplyw: Sprawdza gotowa baze aplikacji; nie uruchamia migracji ani seedu.
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Windows PowerShell was not found.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-native.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
