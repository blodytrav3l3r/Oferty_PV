@echo off
echo Uruchamianie glownej aplikacji WITROS Oferty (Node.js - TypeScript)...
echo.
echo Wybierz tryb:
echo   1 - Development (ts-node-dev z hot reload)
echo   2 - Production (node dist/server.js)
echo.
set /p mode="Wybierz tryb (1/2): "

if "%mode%"=="1" (
    echo Uruchamianie w trybie DEVELOPMENT...
    npm run dev
) else if "%mode%"=="2" (
    echo Budowanie aplikacji...
    call npm run build
    echo Uruchamianie w trybie PRODUCTION...
    npm start
) else (
    echo Nieznany tryb. Uruchamianie w trybie DEVELOPMENT...
    npm run dev
)
pause