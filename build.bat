@echo off
REM ===========================================================
REM  build.bat — Budowanie production bundle
REM ===========================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================================
echo   WITROS Oferty PV - Budowanie produkcyjne
echo ============================================================
echo.

where node >nul 2>&1 || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Brak node_modules, instalacja...
    call npm ci --no-audit --no-fund || exit /b 1
)

REM Prisma client
echo [INFO] Prisma generate...
call npx prisma generate || exit /b 1
echo [OK] Prisma client gotowy.

REM TypeScript compile (backend → dist/)
echo [INFO] TypeScript compile (backend)...
call npx tsc || exit /b 1
echo [OK] Backend skompilowany (dist^/).

REM Vite build (frontend → dist-fe/ lub podobne)
REM W tym projekcie frontend jest serwowany z public/ bezposrednio,
REM wiec tylko opcja dev:frontend buduje bundle produkcyjny.
echo.
echo [INFO] Gotowe do production.
echo Backend: dist^/server.js
echo Frontend: serwowany z public^/ przez backend (statycznie).
echo.

REM Opcjonalnie: Vite budowanie frontendu jako bundle (jesli potrzeba)
if exist "vite.config.js" (
    echo [INFO] Budowanie frontendu z Vite (opcja)...
    call npm run build:frontend || (
        echo [UWAGA] Frontend build nie powiodl sie — pomijam.
    )
)

pause
