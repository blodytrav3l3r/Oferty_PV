@echo off
echo Sprawdzanie Pythona...
python --version
if errorlevel 1 (
    echo Python nie jest zainstalowany. Prosze zainstalowac Python 3.10+.
    pause
    exit /b 1
)

echo Tworzenie wirtualnego srodowiska...
python -m venv venv
if errorlevel 1 (
    echo Blad podczas tworzenia venv.
    pause
    exit /b 1
)

echo Aktywacja venv i instalacja pakietow...
call venv\Scripts\activate.bat
pip install -r requirements.txt
if errorlevel 1 (
    echo Blad podczas instalacji pakietow.
    pause
    exit /b 1
)

echo Instalacja zakonczona.
pause