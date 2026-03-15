@echo off
TITLE PV Marketplace V2 - System Pracowniczy

echo ===================================================
echo   WITROS - PV Marketplace V2 (System Pracowniczy)
echo ===================================================
echo.

:: 1. Sprawdzenie Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Node.js nie jest zainstalowany!
    echo Prosze zainstalowac Node.js z https://nodejs.org/
    pause
    exit /b
)

:: 2. Sprawdzenie zaleznosci
if not exist "node_modules\" (
    echo [INFO] Instalowanie zaleznosci, to moze chwile potrwac...
    call npm install
)

:: 3. Inicjalizacja bazy danych CouchDB
echo [INFO] Sprawdzanie i inicjalizacja klastra CouchDB...
call node src\db_init.js

:: 3a. Uruchomienie Backend AI (Well Configurator)
echo [INFO] Uruchamianie Backend AI (Well Configurator)...
if exist "well_configurator_backend\start.bat" (
    start "PV AI Backend" /min cmd /c "cd well_configurator_backend && start.bat"
) else (
    echo [OSTRZEZENIE] Nie znaleziono modułu AI w folderze well_configurator_backend.
)

:: 4. Uruchomienie serwera i przegladarki
echo.
echo [OK] System gotowy! Serwer startuje...
echo [INFO] Otwieranie przegladarki pod adresem: http://localhost:3000/pv_marketplace.html
echo.

:: Uruchomienie przegladarki
start http://localhost:3000
:: Start serwera Node.js (dzialającego w tle)
call npm start

pause
