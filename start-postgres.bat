@echo off
REM  Wersja: 1.56.8
REM Rola: Pomocnicza implementacja startu Docker Compose dla start-docker.bat.
REM Uzycie: start-postgres.bat
REM Uruchamia: docker compose up --detach --build dla postgres i app.
REM Wplyw: Przebudowuje obraz aplikacji i zachowuje istniejacy wolumen PostgreSQL.
setlocal
cd /d "%~dp0"
set "HTTPS_ENABLED=false"

echo ===========================================================
echo   S.O.K. - Start with PostgreSQL 18
echo ===========================================================
echo.

if not exist "docker-compose.yml" (
    echo [BLAD] Uruchom ten plik z kompletnego folderu S.O.K.
    pause
    exit /b 1
)
if not exist ".env" (
    echo [BLAD] Brak konfiguracji .env. Najpierw uruchom install-new-pc.bat.
    pause
    exit /b 1
)
if not exist ".sok-postgres-installed" (
    echo [BLAD] Instalacja PostgreSQL nie zostala potwierdzona.
    echo        Najpierw uruchom install-new-pc.bat i zakoncz import aktywnych cennikow.
    pause
    exit /b 1
)

where docker.exe >nul 2>nul
if errorlevel 1 (
    if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
        set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
    ) else (
        echo [BLAD] Brak Docker CLI. Uruchom Docker Desktop lub ponownie zainstaluj Docker Desktop.
        pause
        exit /b 1
    )
)

where docker.exe >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Nie mozna odnalezc Docker CLI w PATH ani standardowej lokalizacji.
    pause
    exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Docker Desktop nie jest gotowy. Uruchom go i sprobuj ponownie.
    pause
    exit /b 1
)

docker compose --project-name sok --file docker-compose.yml config --quiet
if errorlevel 1 (
    echo [BLAD] Nieprawidlowa konfiguracja Compose lub .env. Baza nie zostala zmieniona.
    pause
    exit /b 1
)

docker volume ls --quiet | findstr sok_postgres-data >nul
if errorlevel 1 (
    echo [BLAD] Brak wolumenu PostgreSQL S.O.K. Uruchom install-new-pc.bat.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$volume = docker volume inspect 'sok_postgres-data' | ConvertFrom-Json; if ($LASTEXITCODE -ne 0 -or @($volume).Count -ne 1 -or $volume[0].Labels.'com.docker.compose.project' -cne 'sok') { exit 1 }"
if errorlevel 1 (
    echo [BLAD] Wolumen nie nalezy do projektu S.O.K. Odmowa uruchomienia.
    pause
    exit /b 1
)

echo [INFO] Uruchamiam PostgreSQL 18 i S.O.K. z zachowaniem istniejacych danych.
docker compose --project-name sok --file docker-compose.yml up --detach --build --wait --wait-timeout 300 postgres app
if errorlevel 1 (
    echo [BLAD] S.O.K. nie uzyskal stanu gotowosci. Wolumen nie zostal usuniety ani zresetowany.
    echo        Sprawdz Docker Desktop. Dla bledow migracji uzyj procedury wznowienia instalatora.
    pause
    exit /b 1
)

docker compose --project-name sok --file docker-compose.yml ps
if errorlevel 1 (
    echo [BLAD] Nie udalo sie odczytac statusu kontenerow.
    pause
    exit /b 1
)

echo.
echo [OK] S.O.K. dziala pod http://127.0.0.1:3000
start "" "http://127.0.0.1:3000"
echo.
echo [INFO] To okno mozesz zamknac po sprawdzeniu uruchomienia.
pause
exit /b 0
