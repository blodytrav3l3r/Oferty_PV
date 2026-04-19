@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul 2>&1

echo =========================================
echo    Python AI Backend - Uruchamianie
echo =========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Python nie jest zainstalowany lub nie jest w PATH.
    echo Pobierz z: https://python.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>nul') do set "PY_VERSION=%%v"
echo [OK] Python: !PY_VERSION!
echo.

if not exist "venv" (
    echo [BLAD] Folder venv nie istnieje.
    echo        Uruchom install.bat z katalogu glownego aplikacji.
    echo        Lub zainstaluj zaleonosci recznie:
    echo        python -m venv venv
    echo        venv\Scripts\activate.bat
    echo        pip install -r requirements.txt
    pause
    exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
    echo [BLAD] Plik activate.bat nie znaleziony w venv.
    echo        Uszkodzone srodowisko wirtualne.
    echo        Zalecane: usun folder venv i stworz na nowo.
    pause
    exit /b 1
)

echo [OK] Srodowisko wirtualne znalezione
echo.

call venv\Scripts\activate.bat
if errorlevel 1 (
    echo.
    echo [BLAD] Blad aktywacji srodowiska wirtualnego.
    pause
    exit /b 1
)

echo [OK] Srodowisko wirtualne aktywowane
echo.

if exist "requirements.txt" (
    echo ---------- Sprawdzanie zaleznosci ----------
    pip show requests >nul 2>&1
    if errorlevel 1 (
        echo [UWAGA] Brakuje zaleznosci z requirements.txt
        echo         Instalowanie...
        pip install -r requirements.txt
        if errorlevel 1 (
            echo.
            echo [BLAD] Instalacja zaleznosci nie powiodla sie.
            pause
            exit /b 1
        )
    )
    echo.
)

echo ---------- Uruchamianie serwera ----------
echo.

if not exist "run.py" (
    echo [BLAD] Plik run.py nie znaleziony!
    pause
    exit /b 1
)

python run.py
if errorlevel 1 (
    echo.
    echo [BLAD] Serwer Python zakonczyl sie z bledem.
    pause
    exit /b 1
)

pause