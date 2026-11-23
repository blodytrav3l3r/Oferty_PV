@echo off
REM  Wersja: 1.64.24
REM Rola: Pokazuje wersje, commity i lokalne zmiany przed uruchomieniem S.O.K.
REM Uzycie: status.bat
REM Uruchamia: scripts/commit-info.mjs; nie uruchamia aplikacji.
REM Wplyw: Tylko odczyt Git i VERSION; nie pobiera ani nie zmienia kodu.
setlocal
cd /d "%~dp0"

echo ===========================================================
echo   S.O.K. - STATUS KODU
echo ===========================================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js. Zainstaluj Node.js lub uruchom S.O.K. przez Docker.
    pause
    exit /b 1
)

node scripts\commit-info.mjs
if errorlevel 1 (
    echo [BLAD] Nie udalo sie odczytac statusu kodu.
    pause
    exit /b 1
)

echo.
echo Najwazniejsze pliki do uruchamiania:
echo   start-docker.bat - uruchomienie S.O.K. w Dockerze
echo   start-dev.bat    - praca nad kodem i testy
echo   start-native.bat - lokalny PostgreSQL bez testowej bazy
echo.
echo Ten raport pokazuje kod lokalny. Start nie pobiera automatycznie nowych commitow.
pause
exit /b 0
