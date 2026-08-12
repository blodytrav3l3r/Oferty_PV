@echo off
REM  Wersja: 1.14.0
REM ===========================================================
REM  setup-ai.bat - Diagnostyka i setup modulu AI / ML
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

set "APP_VERSION=1.14.0"

echo ===========================================================
echo   S.O.K. - Konfiguracja AI / ML v%APP_VERSION%
echo ===========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

echo [INFO] Uruchamianie diagnostyki i setupu AI/ML...
call npx ts-node scripts\setupAi.ts
if errorlevel 1 (
    echo [BLAD] Setup AI/ML nie powiodl sie.
    pause
    exit /b 1
)

echo [OK] Setup AI/ML zakonczony sukcesem.
pause
endlocal
