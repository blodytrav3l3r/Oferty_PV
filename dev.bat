@echo off
REM ===========================================================
REM  dev.bat — Development mode (final, 2026-07-01)
REM  Strategia: minimalna zlozonosc, zero zaglebiania w Edge Case.
REM  Wszystkie krytyczne zadania zlecone sa npm i cyzelnie
REM  odporne na MSYS bash escape'y.
REM ===========================================================

REM Wylacz delayed expansion zeby uniknac problemow z cyframi
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV - Development Mode (hot reload)
echo ===========================================================
echo.

REM Krok 1: Walidacja Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM Krok 2: Walidacja package.json
if not exist "package.json" (
    echo [BLAD] Brak package.json w %CD%
    pause
    exit /b 1
)

REM Krok 3: Auto-instalacja node_modules jesli brak
if not exist "node_modules" (
    echo [INFO] Brak node_modules. Instaluje zaleznosci...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm install nie powiodl sie.
        pause
        exit /b 1
    )
)

REM Krok 4: Sprawdzenie Prisma Client
if not exist "generated\prisma\index.d.ts" (
    echo [INFO] Generuje Prisma Client...
    call npx prisma generate
    if errorlevel 1 (
        echo [BLAD] prisma generate nie powiodl sie.
        pause
        exit /b 1
    )
)

REM Krok 5: Sprawdzenie schematu DB
echo [INFO] Sprawdzanie schematu bazy...
call node scripts/check-db.js >nul 2>nul
if errorlevel 1 (
    echo [INFO] Brak tabel telemetry/AI - migracja...
    call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul
)

REM Krok 6: PowerShell port-check (BEZ NETSTAT, ktory mogl wisniec)
echo [INFO] Sprawdzanie portu 3000...
set "PORT_PID="
for /f "tokens=*" %%n in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess" 2^>nul') do (
    if "%%n" neq "" set "PORT_PID=%%n"
)

if defined PORT_PID (
    echo [UWAGA] Port 3000 uzywany przez PID !PORT_PID!
    set /p "KEEP=Nadal kontynuowac? (T = nie, N = kontynuuj) [T/N]: "
    if /i "!KEEP!"=="N" (
        echo [INFO] Kontynuuje pomimo zajetego portu...
    ) else (
        echo [INFO] Zatrzymuje PID !PORT_PID!...
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

REM Krok 7: Uruchomienie
echo [INFO] Uruchamiam npm run dev (Ctrl+C stop)
echo.
call npm run dev

REM Restore
endlocal
