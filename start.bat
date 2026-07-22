@echo off
REM ===========================================================
REM  start.bat - Jedno wejscie: caly system
REM  Uruchamia:
REM    - Backend Express (Prisma + SQLite) + Frontend Vite
REM  Uruchomienie: start.bat [--dev]
REM    --dev: uruchom w trybie deweloperskim (domyslne)
REM    prod:  odpowiednik prod.bat (produkcyjne)
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

set "MODE=dev"
if /i "%1"=="--prod" set "MODE=prod"
if /i "%1"=="prod" set "MODE=prod"

echo ===========================================================
if /i "%MODE%"=="dev" echo   WITROS Oferty PV - Development Mode
if /i "%MODE%"=="prod" echo   WITROS Oferty PV - Production
echo ===========================================================
echo.

REM ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM ---------- 2. package.json ----------
if not exist "package.json" (
    echo [BLAD] Brak package.json.
    pause
    exit /b 1
)

REM ---------- 3. node_modules ----------
if not exist "node_modules" (
    echo [INFO] Brak node_modules. Instaluje zaleznosci...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm install nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---------- 4. Prisma Client ----------
if not exist "generated\prisma\index.d.ts" (
    echo [INFO] Generuje Prisma Client...
    call npx prisma generate
    if errorlevel 1 (
        echo [BLAD] prisma generate nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---------- data directory ----------
if not exist "data" mkdir data

REM ---------- 5. Schema DB ----------
echo [INFO] Sprawdzanie schematu bazy...
call node scripts/check-db.js >nul 2>nul
if errorlevel 1 (
    echo [INFO] Migracja bazy - prisma db push ...
    call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul
)

REM ---------- Production: verify build ----------
if /i "%MODE%"=="prod" (
    if not exist "dist\server.js" (
        echo [INFO] Brak dist - budowanie...
        call build.bat
        if errorlevel 1 (
            echo [BLAD] build.bat nie powiodl sie.
            pause
            exit /b 1
        )
    )
    echo [OK] dist\server.js
)

REM ---------- 6. Port check ----------
echo [INFO] Sprawdzanie portu 3000...
set "PORT_PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    if "%%a" neq "" set "PORT_PID=%%a"
)

if defined PORT_PID (
    echo [UWAGA] Port 3000 zajety przez PID !PORT_PID!
    set /p "KILL=Czy zatrzymac ten proces i kontynuowac? (T/N) [T]: "
    if /i "!KILL!"=="N" (
        echo [INFO] Kontynuuje pomimo zajetego portu...
    ) else (
        echo [INFO] Zatrzymuje PID !PORT_PID!...
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

REM ---------- 7. Start ----------
echo.
echo ===========================================================
echo   Uruchamiam aplikacje (Ctrl+C aby zatrzymac)
echo ===========================================================
echo.

if /i "%MODE%"=="prod" (
    echo   Produkcja: http://localhost:3000
    call npm start
) else (
    echo   Frontend: http://localhost:5173
    echo   Backend:  http://localhost:3000/health
    set "NODE_ENV=development"
    call npm run dev
)

echo.
echo [INFO] Aplikacja zatrzymana.
pause
endlocal

