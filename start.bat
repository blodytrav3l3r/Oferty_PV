@echo off
REM ===========================================================
REM  start.bat — Jedno wejście: cały system (Node + opc. Python)
REM  Uruchamia:
REM    - Backend Express (Prisma + SQLite)
REM    - Frontend Vite (dev server)
REM    - [opcjonalnie] Python AI Backend (OR-Tools/ML)
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

REM ---- 7. Python AI Backend (opcjonalnie) ----
echo.
echo [INFO] Python AI Backend (OR-Tools/ML) jest opcjonalny.
echo        Potrzebny tylko do optymalizacji konfiguracji studni.
echo        Wymaga: Python 3.11/3.12 + venv w well_configurator_backend/
echo.
set /p "START_PYTHON=Uruchomic Python backend? (T/N, domyslnie N): "
if /i "!START_PYTHON!"=="T" (
    if exist "well_configurator_backend\start.bat" (
        if exist "well_configurator_backend\venv" (
            echo [INFO] Uruchamiam Python backend w nowym oknie...
            start "Python AI Backend" cmd /c "cd /d well_configurator_backend && call start.bat"
            echo [OK] Python backend uruchomiony na porcie 8000
        ) else (
            echo [BLAD] Brak venv w well_configurator_backend\
            echo        Uruchom well_configurator_backend\install.bat
        )
    ) else (
        echo [BLAD] Brak well_configurator_backend\start.bat
    )
) else (
    echo [INFO] Python backend pominiety. Uzywasz solvera JS.
)

REM ---- 8. Start ----
echo.
echo ===========================================================
echo   Uruchamiam aplikacje (Ctrl+C aby zatrzymac)
echo ===========================================================
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000/health
echo   Python:   http://localhost:8000/api/v1/health
echo.
call npm run dev

echo.
echo [INFO] Aplikacja zatrzymana.
pause
endlocal
