@echo off
echo ===================================================
echo   Instalator - Well Configurator Backend (Python)
echo ===================================================
echo.

echo [1/3] Sprawdzanie instalacji Pythona...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo BŁĄD: Python nie jest zainstalowany lub nie zdefiniowano go w zmiennych środowiskowych PATH.
    echo Pobierz i zainstaluj Pythona z https://www.python.org/downloads/
    pause
    exit /b
)

echo [2/3] Tworzenie wirtualnego srodowiska (venv)...
if not exist "venv" (
    python -m venv venv
) else (
    echo Wirtualne srodowisko juz istnieje. Pominiecie.
)

echo [3/3] Aktywacja srodowiska i instalacja zaleznosci...
call venv\Scripts\activate.bat

echo Aktualizacja pip...
python -m pip install --upgrade pip >nul 2>&1

echo Instalowanie pakietow z requirements.txt...
pip install -r requirements.txt

echo.
echo ===================================================
echo   Instalacja zakonczona pomyslnie!
echo ===================================================
echo.
echo Aby uruchomic serwer deweloperski, po prostu kliknij dwukrotnie plik start.bat
echo lub wpisz w konsoli komendy:
echo   1. venv\Scripts\activate
echo   2. python run.py
echo.
pause
