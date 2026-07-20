@echo off
REM ===========================================================
REM  prod.bat - Production server start
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV - Produkcja
echo ===========================================================
echo.

where node >nul 2>nul || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

REM ---- 1. .env ----
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Brak .env - kopiuje z .env.example...
        copy .env.example .env >nul
        if errorlevel 1 (
            echo [BLAD] Nie udalo sie utworzyc .env.
            pause
            exit /b 1
        )
        echo [OK] .env utworzony
    ) else (
        echo [BLAD] Brak .env.example. Utworz .env recznie.
        pause
        exit /b 1
    )
)

REM ---- 2. node_modules ----
if not exist "node_modules" (
    echo [INFO] Brak node_modules. Instaluje...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm install nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---- 3. Prisma Client ----
if not exist "generated\prisma\index.d.ts" (
    echo [INFO] Generuje Prisma Client...
    call npx prisma generate
    if errorlevel 1 (
        echo [BLAD] prisma generate nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---- 4. Schema DB ----
echo [INFO] Sprawdzanie schematu bazy...
call node scripts/check-db.js >nul 2>nul
if errorlevel 1 (
    echo [INFO] Migracja bazy danych...
    call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul
)

REM ---- 5. dist (build) ----
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

REM ---- 6. Port ----
for /f "tokens=2 delims==" %%a in ('findstr "^PORT=" .env 2^>nul') do set "APP_PORT=%%a"
if not defined APP_PORT set "APP_PORT=3000"
echo [INFO] Sprawdzanie portu !APP_PORT!...
set "PORT_PID="
for /f "tokens=*" %%n in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort !APP_PORT! -State Listen -ErrorAction SilentlyContinue).OwningProcess" 2^>nul') do (
    if "%%n" neq "" set "PORT_PID=%%n"
)
if defined PORT_PID (
    echo [UWAGA] Port !APP_PORT! uzywany przez PID !PORT_PID!
    set /p "KEEP=Zatrzymac i uruchomic? [T/N]: "
    if /i "!KEEP!"=="N" (
        echo [INFO] Kontynuuje pomimo zajetego portu...
    ) else (
        echo [INFO] Killuje PID !PORT_PID!...
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

if not exist "data" mkdir data

echo [INFO] npm start (Ctrl+C stop)
echo         http://localhost:!APP_PORT!/health
echo         http://localhost:!APP_PORT!/api/version
echo.
call npm start

endlocal
