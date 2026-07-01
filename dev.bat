@echo off
REM ===========================================================
REM  dev.bat — Development mode (hot reload)
REM  Backend (ts-node-dev) + Frontend (Vite)
REM  Architektura: AI Learning Engine + Telemetry + Skill Bridge
REM ===========================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================================
echo   WITROS Oferty PV - Development Mode (hot reload)
echo ============================================================
echo.

REM Sprawdzenie Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM Sprawdzenie node_modules
if not exist "node_modules" (
    echo [INFO] Brak node_modules. Uruchamiam install.bat...
    call install.bat
    if errorlevel 1 exit /b 1
)

REM Sprawdzenie Prisma
if not exist "generated\prisma" (
    echo [INFO] Brak Prisma client. Generuje...
    call npx prisma generate >nul 2>&1
    if errorlevel 1 (
        echo [BLAD] prisma generate nie powiodl sie.
        pause
        exit /b 1
    )
)

REM Sprawdzenie migracji (heurystyka: jesli telemetry_logs missing, push)
echo [INFO] Sprawdzanie schematu bazy...
node scripts/check-db.js >nul 2>&1 || call npx prisma db push --skip-generate --accept-data-loss >nul 2>&1

REM Uruchom check/skan portu
echo [INFO] Sprawdzanie portu 3000...
netstat -ano 2^>nul | findstr ":3000 " > temp_port.txt
for /f "tokens=5" %%a in (temp_port.txt) do (
    if not "%%a"=="" (
        echo [UWAGA] Port 3000 jest uzywany przez PID %%a
        echo          Jesli to nie aplikacja WITROS, zatrzymaj ja.
    )
)
del temp_port.txt 2>nul

echo.
echo [INFO] Uruchamiam backend + frontend (Ctrl+C zatrzymuje oba)
echo [INFO] Backend:  http://localhost:3000
echo [INFO] Frontend: http://localhost:3000 (proxy do Vite)
echo.

REM Uruchamiaj oba procesy (concurrently dev)
call npm run dev

pause
