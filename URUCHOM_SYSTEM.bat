@echo off
chcp 65001 >nul
title WITROS Oferty - Launcher

echo.
echo  =======================================================
echo       🚀 WITROS Oferty - KREATOR uruchamiania
echo  =======================================================
echo.
echo  Wybierz tryb uruchomienia calego środowiska:
echo.
echo  [1] Tryb OFFLINE  (Dostep i praca tylko na tym komputerze)
echo  [2] Tryb ONLINE   (Dostep na wszystkich urzadzeniach w sieci Wi-Fi/LAN)
echo.

set /p choice="Twój wybór (wpisz 1 lub 2 i wcisnij Enter): "

cd /d "%~dp0"

echo.
echo  --- KROK 1: Uruchamiam Silnik Obliczeniowy Python ---
echo.
if exist "well_configurator_backend\venv\Scripts\activate.bat" (
    start "Silnik Python WITROS" cmd /k "cd well_configurator_backend && call venv\Scripts\activate.bat && set HOST=127.0.0.1 && python run.py"
    echo  [OK] Silnik obliczeniowy uruchomiono pomyslnie w nowym oknie!
) else (
    echo  [!] UWAGA: Nie znaleziono srodowiska Pythona. Skrypt konfiguracji studni z poziomu WWW wyrzuci blędy.
    echo  [!] PROSZE najpierw wejsc do folderu well_configurator_backend i uruchomic install.bat.
)
echo.
echo  --- KROK 2: Uruchamiam Interfejs (Frontend) ---
echo.

if "%choice%"=="1" goto OFFLINE
if "%choice%"=="2" goto ONLINE
goto OFFLINE

:OFFLINE
echo  Uruchamiam tryb OFFLINE...
call START_OFFLINE.bat
exit /b

:ONLINE
echo  Uruchamiam tryb ONLINE...
call START_ONLINE.bat
exit /b
