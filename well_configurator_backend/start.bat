@echo off
echo Aktywacja wirtualnego srodowiska...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo Blad podczas aktywacji venv. Uruchom najpierw install.bat.
    pause
    exit /b 1
)

echo Uruchamianie serwera API...
python run.py
pause