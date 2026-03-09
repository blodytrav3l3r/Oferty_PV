@echo off
echo Uruchamianie serwera Well Configurator...
if not exist "venv\Scripts\activate.bat" (
    echo BLAD: Wirtualne srodowisko nie istnieje! Uruchom najpierw install.bat.
    pause
    exit /b
)

call venv\Scripts\activate.bat
python run.py
pause
