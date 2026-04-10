@echo off
chcp 65001 >nul 2>&1
echo =========================================
echo Zabijanie zablokowanych portow i starych procesow...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
timeout /t 2 >nul
echo Stare procesy zamkniete.
echo =========================================
echo.
echo Uruchamianie aplikacji WITROS Oferty (Node.js TypeScript + Python AI Backend)...
echo.

echo [1/2] Uruchamianie Python AI Backend...
start "Python AI Backend" cmd /k "cd /d well_configurator_backend && python run.py"

timeout /t 3 >nul

echo [2/2] Uruchamianie Node.js Serwera (TypeScript)...
start "Node.js Server (TypeScript)" cmd /k "npm run dev"

echo.
echo =========================================
echo  Uruchamianie zakonczone!
echo =========================================
echo.
echo  Czekaj az oba serwery sie uruchomia...
echo.
echo  Python AI Backend:  http://127.0.0.1:5000
echo  Node.js Server:     http://127.0.0.1:3000
echo.
echo  TWOJ LINK DO APLIKACJI:
echo  http://127.0.0.1:3000/app.html#/studnie
echo.
echo  UWAGA: Upewnij sie, ze w zadnym oknie nie ma bledow ERROR!
echo =========================================
pause