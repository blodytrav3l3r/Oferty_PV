@echo off
setlocal
cd /d "%~dp0"

echo ===========================================================
echo   S.O.K. - Windows new PC installer
echo ===========================================================
echo.
echo This installer prepares PostgreSQL 18 and runs S.O.K. with Docker Desktop.
echo It does not delete volumes or an existing database.
echo Windows may request UAC approval to enable WSL and Docker Desktop terms must be accepted.
echo Docker Desktop licensing may require a paid subscription for some business users.
echo.

if not exist "docker-compose.yml" (
    echo [BLAD] Uruchom ten plik z kompletnego folderu S.O.K.
    pause
    exit /b 1
)
if not exist "scripts\setup-new-pc.ps1" (
    echo [BLAD] Brak scripts\setup-new-pc.ps1.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-new-pc.ps1" %*
if errorlevel 1 (
    echo.
    echo [BLAD] Instalacja nie zostala zakonczona. Przeczytaj komunikat powyzej.
    pause
    exit /b 1
)

endlocal
exit /b 0
