@echo off
REM ===========================================================
REM  well_configurator_backend/start.bat
REM  Python AI Backend (OSOBNY SERWIS).
REM  Port 8000, opcjonalny — domyslnie uzywa solvera JS.
REM  Wystawia /api/v1/configure z CP-SAT ML.
REM
REM  Mozna uruchomic recznie LUB z glownego start.bat (katalog glowny).
REM ===========================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================================
echo   Python AI Backend - Uruchamianie (port 8000)
echo ============================================================
echo.

where python >nul 2>&1 || (
    echo [BLAD] Brak Pythona. Uruchom install.bat.
    pause
    exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
    echo [BLAD] Brak venv. Uruchom install.bat.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo [INFO] Sprawdzanie zaleznosci...
python -c "import sqlalchemy, fastapi, ortools" 2>nul || (
    echo [BLAD] Brakuje pakietow. Uruchom install.bat.
    pause
    exit /b 1
)

if not exist "run.py" (
    echo [BLAD] Brak pliku run.py.
    pause
    exit /b 1
)

REM Restart pętla
:restart
echo [INFO] Uruchamianie run.py (port 8000)...
python run.py
set "EXIT_CODE=!errorlevel!"
echo [INFO] Zatrzymanie (kod: !EXIT_CODE!)
if "!EXIT_CODE!"=="0" goto end
echo [INFO] Restart za 3s...
timeout /t 3 /nobreak >nul 2>&1
goto restart

:end
echo [INFO] Normalne zamkniecie.
pause
