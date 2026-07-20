@echo off
REM ===========================================================
REM  start.bat - Serwer produkcyjny
REM  Buduje backend + frontend i uruchamia serwer.
REM  Do developmentu (hot-reload) uzyj dev.bat.
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV - Start produkcyjny
echo ===========================================================
echo.

REM ---- 1. Node.js ----
where node >nul 2>nul || (
    echo [BLAD] Brak Node.js. Uruchom install.bat.
    pause
    exit /b 1
)

REM ---- 2. .env ----
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Brak .env - kopiuje z .env.example...
        copy .env.example .env >nul
        if errorlevel 1 (
            echo [BLAD] Nie udalo sie utworzyc .env.
            pause
            exit /b 1
        )
    ) else (
        echo [BLAD] Brak .env.example. Utworz .env recznie.
        pause
        exit /b 1
    )
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

REM ---- 4. Build (jesli brak dist) ----
if not exist "dist\server.js" (
    echo [INFO] Brak dist - budowanie...
    call build.bat
    if errorlevel 1 (
        echo [BLAD] build.bat nie powiodl sie.
        pause
        exit /b 1
    )
)

REM ---- 5. Port ----
for /f "tokens=2 delims==" %%a in ('findstr "^PORT=" .env 2^>nul') do set "APP_PORT=%%a"
if not defined APP_PORT set "APP_PORT=3000"
echo [INFO] Sprawdzanie portu !APP_PORT!...
set "PORT_PID="
for /f "tokens=*" %%n in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort !APP_PORT! -State Listen -ErrorAction SilentlyContinue).OwningProcess" 2^>nul') do (
    if "%%n" neq "" set "PORT_PID=%%n"
)
if defined PORT_PID (
    echo [UWAGA] Port !APP_PORT! zajety przez PID !PORT_PID!
    set /p "KILL=Zwolnic port? (T=tak, N=nie) [T/N]: "
    if /i "!KILL!"=="T" (
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

if not exist "data" mkdir data

REM ---- 6. Start ----
echo.
echo ===========================================================
echo   Uruchamiam serwer produkcyjny (Ctrl+C aby zatrzymac)
echo ===========================================================
echo   http://localhost:!APP_PORT!
echo   http://localhost:!APP_PORT!/health
echo.
call npm start

echo.
echo [INFO] Serwer zatrzymany.
pause
endlocal
