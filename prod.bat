@echo off
REM ===========================================================
REM  prod.bat — Production server start (final)
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

REM Czy jest dist\server.js?
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

REM Port check (PowerShell, nie netstat)
echo [INFO] Sprawdzanie portu 3000...
set "PORT_PID="
for /f "tokens=*" %%n in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess" 2^>nul') do (
    if "%%n" neq "" set "PORT_PID=%%n"
)
if defined PORT_PID (
    echo [UWAGA] Port 3000 uzywany przez PID !PORT_PID!
    set /p "KEEP=Zatrzymac i uruchomic? [T/N]: "
    if /i "!KEEP!"=="N" (
        echo [INFO] Kontynuuje pomimo zajetego portu...
    ) else (
        echo [INFO] Killuję PID !PORT_PID!...
        powershell -Command "Stop-Process -Id !PORT_PID! -Force" 2>nul
        timeout /t 2 /nobreak >nul 2>&1
    )
)

if not exist "data" mkdir data

echo [INFO] npm start (Ctrl+C stop)
echo         http://localhost:3000/health
echo         http://localhost:3000/api/version
echo.
call npm start

endlocal
