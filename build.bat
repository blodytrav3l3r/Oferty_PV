@echo off
REM ===========================================================
REM  build.bat - Budowanie production bundle
REM ===========================================================

setlocal
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV - Budowanie produkcyjne
echo ===========================================================
echo.

REM Walidacja
where node >nul 2>nul || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

REM .env
if not exist ".env" (
    echo [INFO] Brak .env - kopiuje z .env.example...
    copy .env.example .env >nul
    if errorlevel 1 (
        echo [BLAD] Nie udalo sie utworzyc .env.
        pause
        exit /b 1
    )
)

REM npm install (zabezpieczenie przed brakiem lockfile)
if not exist "node_modules" (
    echo [INFO] Instaluje zaleznosci...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm install nie powiodl sie.
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

REM Vite build (obowiazkowy)
if exist "vite.config.js" (
    echo [INFO] Vite build...
    call npm run build:frontend
    if errorlevel 1 (
        echo [BLAD] Vite build.
        pause
        exit /b 1
    )
    echo [OK] Vite
) else (
    echo [WARN] Brak vite.config.js - pomijam Vite build
)

echo ===========================================================
echo   Build zakonczony
echo ===========================================================
pause
endlocal
