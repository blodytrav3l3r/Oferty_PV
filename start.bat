@echo off
REM ===========================================================
REM  start.bat — Jedno wejście: cały system
REM  Uruchamia:
REM    - Backend Express (Prisma + SQLite)
REM    - Frontend Vite (dev server)
REM ===========================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV — Start
echo ===========================================================
echo.

REM ---- 1. Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM ---- 2. package.json ----
if not exist "package.json" (
    echo [BLAD] Brak package.json.
    pause
    exit /b 1
)

REM ---- 3. node_modules ----
if not exist "node_modules" (
    echo [INFO] Brak node_modules. Instaluje...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm install nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---- 4. Prisma Client ----
if not exist "generated\prisma\index.d.ts" (
    echo [INFO] Generuje Prisma Client...
    call npx prisma generate
    if errorlevel 1 (
        echo [BLAD] prisma generate nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---- 5. Schema DB ----
echo [INFO] Sprawdzanie schematu bazy...
call node scripts/check-db.js >nul 2>nul
if errorlevel 1 (
    echo [INFO] Migracja bazy danych...
    call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul
)

REM ---- 6. Port 3000 ----
echo [INFO] Sprawdzanie portu 3000...
set "PORT_PID="
for /f "tokens=*" %%n in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess" 2^>nul') do (
    if "%%n" neq "" set "PORT_PID=%%n"
)
if defined PORT_PID (
    echo [UWAGA] Port 3000 zajety przez PID !PORT_PID!
    set /p "KILL=Zwolnic port? (T=tak, N=nie) [T/N]: "
    if /i "!KILL!"=="T" (
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)
REM ---- 7. Start ----
echo.
echo ===========================================================
echo   Uruchamiam aplikacje (Ctrl+C aby zatrzymac)
echo ===========================================================
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000/health
echo.
call npm run dev

echo.
echo [INFO] Aplikacja zatrzymana.
pause
endlocal
