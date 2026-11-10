@echo off
REM  Wersja: 1.56.11
REM ===========================================================
REM  build.bat - Budowanie production bundle (delegacja do npm)
REM Rola: Budowanie produkcyjnych plikow aplikacji w dist\.
REM Uzycie: build.bat
REM Uruchamia: npm run build (prisma generate, czyszczenie dist, tsc, kopiowanie klienta Prisma).
REM Wplyw: Usuwa i odtwarza dist; nie zmienia bazy danych.
REM ===========================================================

setlocal
cd /d "%~dp0"

set "APP_VERSION=1.56.11"

echo ===========================================================
echo   S.O.K. - Budowanie produkcyjne v%APP_VERSION%
echo ===========================================================
echo.

REM ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM ---------- 2. Zaleznosci (instaluje je install.bat) ----------
if not exist "node_modules" (
    echo [BLAD] Brak node_modules. Uruchom install.bat.
    pause
    exit /b 1
)

REM ---------- 3. Build (jedno zrodlo prawdy: package.json) ----------
echo [INFO] npm run build...
call npm run build
if errorlevel 1 (
    echo [BLAD] Build nie powiodl sie. Sprawdz komunikaty powyzej.
    pause
    exit /b 1
)

if not exist "dist\server.js" (
    echo [BLAD] Brak dist\server.js po buildzie.
    pause
    exit /b 1
)

echo [OK] dist\server.js
echo.
echo ===========================================================
echo   Build zakonczony
echo ===========================================================
echo.
echo [INFO] Produkcja: prod.bat
pause
exit /b 0
