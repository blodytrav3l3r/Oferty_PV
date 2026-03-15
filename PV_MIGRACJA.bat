@echo off
TITLE PV Marketplace V2 - Migracja Danych

echo ===================================================
echo   [SYNC] PV Marketplace - Migracja z SQLite do CouchDB
echo ===================================================
echo.
echo UWAGA: Skrypt przeniesie istniejace dane pracownikow i oferty
echo do nowego, skalowalnego klastra CouchDB.
echo.
set /p confirm="Czy chcesz kontynuowac? (T/n): "
if /i "%confirm%" neq "T" exit /b

echo.
echo [INFO] Rozpoczynanie migracji...
call node src\migrate_sqlite_to_couchdb.js

echo.
echo [OK] Migracja zakonczona sukcesem!
echo.
pause
