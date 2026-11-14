@echo off
REM  Wersja: 1.58.0
REM ===========================================================
REM  start.bat - Reczny lokalny start z konfiguracja bazy w .env
REM  Uruchamia:
REM    - Backend Express + Prisma PostgreSQL serwuje API i frontend z public/
REM  Uruchomienie: start.bat [--dev|--prod]
REM    --dev: uruchom w trybie deweloperskim (domyslne)
REM    --prod: tryb produkcyjny (takze przez prod.bat)
REM Rola: Reczny start lokalnej aplikacji z DATABASE_URL z .env.
REM Uzycie: start.bat [--dev|--prod]
REM Uruchamia: scripts/ensure-db.bat, a nastepnie backend dev albo prod.
REM Wplyw: ensure-db moze wykonac migracje lub seed bazy z DATABASE_URL.
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

set "APP_VERSION=1.58.0"

set "MODE=dev"
if /i "%1"=="--prod" set "MODE=prod"
if /i "%1"=="prod" set "MODE=prod"

echo ===========================================================
if /i "%MODE%"=="dev" echo   S.O.K. - Development Mode v%APP_VERSION%
if /i "%MODE%"=="prod" echo   S.O.K. - Production v%APP_VERSION%
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
if not exist "generated\prisma-postgres\client.d.ts" (
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

REM ---------- 5. Schema DB + Seed ----------
echo [INFO] Sprawdzanie bazy danych...
call scripts\ensure-db.bat
if errorlevel 1 (
    echo [BLAD] Nie udalo sie przygotowac bazy danych. Uruchom install.bat i sprobuj ponownie.
    pause
    exit /b 1
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
    set "PROC_NAME=?"
    for /f "tokens=1" %%n in ('powershell -NoProfile -Command "(Get-Process -Id !PORT_PID! -ErrorAction SilentlyContinue).ProcessName" 2^>nul') do set "PROC_NAME=%%n"
    echo [UWAGA] Port 3000 zajety przez PID !PORT_PID! ^(!PROC_NAME!^)
    REM Domyslne T tylko dla node - cudzy proces (np. com.docker.backend) wymaga jawnego T.
    set "KILL_DEFAULT=N"
    echo !PROC_NAME! | findstr /i "node" >nul && set "KILL_DEFAULT=T"
    set /p "KILL=Czy zatrzymac ten proces i kontynuowac? (T/N) [!KILL_DEFAULT!]: "
    if not defined KILL set "KILL=!KILL_DEFAULT!"
    if /i "!KILL!"=="N" (
        echo [INFO] Kontynuuje pomimo zajetego portu...
    ) else (
        echo [INFO] Zatrzymuje PID !PORT_PID!...
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

REM ---------- 7. Start (watchdog P0) ----------
echo.
echo ===========================================================
echo   Uruchamiam aplikacje (Ctrl+C aby zatrzymac)
echo ===========================================================
echo.

set "MAX_RESTARTS=5"
set "RESTART_DELAY=5"
set "RESTART_COUNT=0"
REM C1: okno resetu licznika (s) + rotacja watchdog.log (bajty, 1 backup .1)
set "WATCHDOG_WINDOW=3600"
set "WATCHDOG_LOG_MAX=1048576"

:watchdog_loop
if /i "%MODE%"=="prod" (
    echo   Produkcja: HTTPS za reverse proxy ^(Caddy/Nginx^)
    echo   Wewnetrzny: http://127.0.0.1:3000
    set "NODE_ENV=production"
    call npm start
) else (
    echo   Aplikacja: http://localhost:3000
    echo   Backend:  http://localhost:3000/health
    echo   HTTPS:    https://localhost:3443 ^(Caddyfile.dev + mkcert, opcjonalnie^)
    set "NODE_ENV=development"
    call npm run dev
)

set "EXITCODE=%ERRORLEVEL%"
echo [%date% %time%] Server exited with code %EXITCODE% >> data\watchdog.log
REM C1: rotacja logu best-effort (nigdy nie blokuje watchdoga)
call node scripts\watchdog.cjs rotate data\watchdog.log %WATCHDOG_LOG_MAX% >nul 2>nul

REM exit 0 = kontrolowane zamkniecie (Ctrl+C / SIGTERM) -> nie restartuj
if "%EXITCODE%"=="0" goto watchdog_end

REM C1: zdrowy okres (>WATCHDOG_WINDOW bez crasha) kasuje historie licznika.
REM Crash loop dalej rosnie i staje na MAX_RESTARTS (brak nieskonczonej petli).
set "WD_DECISION=KEEP"
for /f "tokens=*" %%w in ('node scripts\watchdog.cjs window data\watchdog.last %WATCHDOG_WINDOW% 2^>nul') do set "WD_DECISION=%%w"
if /i "!WD_DECISION!"=="RESET" set "RESTART_COUNT=0"

set /a RESTART_COUNT+=1

if %RESTART_COUNT% GEQ %MAX_RESTARTS% (
    echo [WATCHDOG] Max restarts reached ^(%MAX_RESTARTS%^). Server stopped.
    echo [%date% %time%] Max restarts reached >> data\watchdog.log
    goto watchdog_end
)

echo [WATCHDOG] Restart %RESTART_COUNT%/%MAX_RESTARTS% za %RESTART_DELAY%s...
timeout /t %RESTART_DELAY% /nobreak >nul
goto watchdog_loop

:watchdog_end
echo.
echo [INFO] Aplikacja zatrzymana.

