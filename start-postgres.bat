@echo off
REM  Wersja: 1.64.19
REM Rola: Pomocnicza implementacja startu Docker Compose dla start-docker.bat.
REM Uzycie: start-postgres.bat
REM Uruchamia: docker compose up --detach --build dla postgres i app.
REM Wplyw: Buduje aplikacje z lokalnego folderu, bez pobierania kodu z GitHub; zachowuje wolumen PostgreSQL.
setlocal
cd /d "%~dp0"
set "APP_VERSION=1.64.19"
set "HTTPS_ENABLED=false"
set "APP_COMMIT_SHA=unknown"
set "APP_GIT_BRANCH=unknown"
set "APP_WORKTREE_DIRTY=unknown"

echo ===========================================================
echo   S.O.K. - Docker PostgreSQL 18 v%APP_VERSION%
echo ===========================================================
echo.

where node.exe >nul 2>nul
if not errorlevel 1 (
    for /f "tokens=1,* delims==" %%A in ('node scripts\commit-info.mjs --batch') do (
        if "%%A"=="APP_COMMIT_SHA" set "APP_COMMIT_SHA=%%B"
        if "%%A"=="APP_GIT_BRANCH" set "APP_GIT_BRANCH=%%B"
        if "%%A"=="APP_WORKTREE_DIRTY" set "APP_WORKTREE_DIRTY=%%B"
        if "%%A"=="INFO_LOCAL" echo [INFO] %%B
        if "%%A"=="INFO_REMOTE" echo [INFO] %%B
        if "%%A"=="INFO_STATE" echo [INFO] %%B
        if "%%A"=="INFO_DIRTY" echo [INFO] %%B
    )
) else (
    echo [UWAGA] Node.js niedostepny - nie mozna odczytac SHA; buduje lokalne pliki.
)
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
if errorlevel 1 if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"

where docker.exe >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Docker CLI w PATH ani w standardowej lokalizacji Docker Desktop.
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
echo [INFO] Zrodlem obrazu jest lokalny folder tego pliku BAT.
echo [INFO] GitHub nie jest zrodlem kodu dla tego uruchomienia.
docker compose --project-name sok --file docker-compose.yml up --detach --build --wait --wait-timeout 300 postgres app
if errorlevel 1 (
    echo [BLAD] S.O.K. nie uzyskal stanu gotowosci. Wolumen nie zostal usuniety ani zresetowany.
    echo        Sprawdz Docker Desktop. Dla bledow migracji uzyj procedury wznowienia instalatora.
    pause
    exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [UWAGA] Node.js niedostepny - nie mozna porownac commita kontenera.
) else (
    node scripts\docker-build-info.mjs
    if errorlevel 1 (
        pause
        exit /b 1
    )
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
