@echo off
REM  Wersja: 1.12.0
REM ===========================================================
REM  build.bat - Budowanie production bundle (final)
REM ===========================================================

setlocal
cd /d "%~dp0"

set "APP_VERSION=1.12.0"

echo ===========================================================
echo   WITROS Oferty PV - Budowanie produkcyjne v%APP_VERSION%
echo ===========================================================
echo.

REM Walidacja
where node >nul 2>nul || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

REM npm ci jesli brak node_modules
if not exist "node_modules" (
    echo [INFO] npm ci...
    call npm ci --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm ci nie powiodl sie.
        pause
        exit /b 1
    )
)
echo [OK] Dependencies OK

REM Prisma client
echo [INFO] Prisma generate...
call npx prisma generate
if errorlevel 1 (
    echo [BLAD] prisma generate
    pause
    exit /b 1
)
echo [OK] Prisma client

REM TypeScript compile
echo [INFO] TypeScript compile...
call npx tsc
if errorlevel 1 (
    echo [BLAD] TypeScript compile.
    pause
    exit /b 1
)
echo [OK] dist\

echo ===========================================================
echo   Build zakonczony
echo ===========================================================
pause
endlocal
