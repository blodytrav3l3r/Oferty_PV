@echo off
REM ===========================================================
REM  prod.bat — Production server start
REM  Wymaga uprzedniego build.bat
REM  Auto Cron Service inicjalizowany wewnatrz server.ts
REM ===========================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================================
echo   WITROS Oferty PV - Production
echo ============================================================
echo.

where node >nul 2>&1 || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

REM Sprawdzenie czy dist istnieje
if not exist "dist\server.js" (
    echo [INFO] Brak zbudowanego dist\server.js — budowanie...
    call build.bat
    if errorlevel 1 exit /b 1
)

REM Sprawdzenie migracji
if not exist "dist\generated\prisma" (
    echo [INFO] Prisma client nie w dist - regeneracja...
    call npx prisma generate || exit /b 1
)

REM Health-check aplikacji
echo [INFO] Uruchamiam serwer produkcyjny (Ctrl+C zatrzymuje)...
echo        Inicjalizacja: Express + Prisma + Cron Service + AI Learning Engine
echo        Endpoint /health dostepny natychmiast
echo.

if not exist "data" mkdir data

call npm start

pause
