@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "NODE_PACKAGES=%SCRIPT_DIR%\..\npm_packages"
set "PYTHON_PACKAGES=%SCRIPT_DIR%\python_packages"
set "APP_PORT=3000"

echo ========================================
echo    WITROS Oferty - Instalator offline
echo ========================================
echo.

call :check_node
if errorlevel 1 (
    echo [BLAD] Node.js nie jest zainstalowany lub nie jest w PATH.
    echo Pobierz z: https://nodejs.org/
    pause
    exit /b 1
)

call :check_npm
if errorlevel 1 (
    echo [BLAD] npm nie jest dostepny.
    pause
    exit /b 1
)

echo [OK] Node.js: !NODE_VERSION!
echo [OK] npm: !NPM_VERSION!
echo.

cd /d "%SCRIPT_DIR%"

if not exist "..\npm_packages" (
    echo [BLAD] Folder npm_packages nie istnieje: ..\npm_packages
    echo Upewnij sie, ze pakiet npm jest dostepny offline.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [BLAD] package.json nie znaleziony w: %SCRIPT_DIR%
    pause
    exit /b 1
)

echo ---------- Instalacja zaleznosci npm ----------

call :npm_install 2>&1
if errorlevel 1 (
    echo.
    echo [BLAD] Instalacja npm packages nie powiodla sie.
    echo.
    echo Probowano: npm ci --prefer-offline --no-save
    echo.
    echo Sprobuj ręcznie:
    echo npm ci --prefer-offline --no-save
    pause
    exit /b 1
)
echo [OK] Pakiety npm zainstalowane
echo.

echo ---------- Generowanie Prisma Client ----------

call :npx_prisma_generate 2>&1
if errorlevel 1 (
    echo.
    echo [BLAD] Prisma generate nie powiodla sie.
    pause
    exit /b 1
)
echo [OK] Prisma Client wygenerowany
echo.

echo ---------- Build aplikacji ----------

call :npm_build 2>&1
if errorlevel 1 (
    echo.
    echo [BLAD] Build nie powiodl sie.
    echo.
    echo Sprobuj ręcznie:
    echo   npm run build
    pause
    exit /b 1
)
echo [OK] Build zakonczony
echo.

echo ========================================
echo  Opcjonalne komponenty
echo ========================================
echo.

if exist "requirements.txt" (
    echo [Znaleziono] requirements.txt - dostepna instalacja AI backend
    set "AI_AVAILABLE=1"
) else (
    echo [INFO] requirements.txt nie znaleziono - instalacja AI niedostepna
    set "AI_AVAILABLE=0"
)

if not exist "python_packages" (
    echo [INFO] Folder python_packages nie istnieje - instalacja AI niedostepna
    set "AI_AVAILABLE=0"
)

echo.
if "%AI_AVAILABLE%"=="1" (
    choice /c YN /n /m "Czy zainstalowac backend AI (Python)? [Y/N]: "
) else (
    choice /c N /n /m "Kontynuowac instalacje? [N]: "
)
set "AI_CHOICE=!errorlevel!"

if "!AI_CHOICE!"=="1" (
    if "%AI_AVAILABLE%"=="1" (
        call :install_python_backend
    )
)

echo.
echo ========================================
echo  Weryfikacja portu
echo ========================================
echo.

call :check_port %APP_PORT%
if errorlevel 1 (
    echo [UWAGA] Port %APP_PORT% moze byc zajety.
    echo         Aplikacja moze nie uruchomic sie poprawnie.
    echo.
) else (
    echo [OK] Port %APP_PORT% jest dostepny
    echo.
)

echo ========================================
echo  Instalacja zakonczona pomyslnie!
echo ========================================
echo.
echo  Uruchom aplikacje: npm start
echo  Adres: http://localhost:%APP_PORT%
echo.
pause
exit /b 0

:check_node
set "NODE_VERSION="
for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VERSION=%%v"
if not defined NODE_VERSION exit /b 1
exit /b 0

:check_npm
set "NPM_VERSION="
for /f "tokens=*" %%v in ('npm --version 2^>nul') do set "NPM_VERSION=%%v"
if not defined NPM_VERSION exit /b 1
exit /b 0

:npm_install
call npm ci --prefer-offline --no-save
exit /b %errorlevel%

:npx_prisma_generate
call npx prisma generate
exit /b %errorlevel%

:npm_build
call npm run build
exit /b %errorlevel%

:install_python_backend
echo.
echo ---------- Instalacja Python backend ----------

where python >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Python nie jest zainstalowany lub nie jest w PATH.
    echo Pobierz z: https://python.org/
    goto :eof
)

for /f "tokens=*" %%v in ('python --version 2^>nul') do set "PY_VERSION=%%v"
echo [OK] Python: !PY_VERSION!
echo.

call pip install --no-index --find-links="%PYTHON_PACKAGES%" -r requirements.txt 2>&1
if errorlevel 1 (
    echo.
    echo [BLAD] Instalacja Python packages nie powiodla sie.
    echo.
    echo Sprobuj ręcznie:
    echo pip install --no-index --find-links=python_packages -r requirements.txt
    goto :eof
)
echo [OK] Python backend zainstalowany
goto :eof

:check_port
set "PORT_CHECK=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%1 "') do (
    if /i "%%a"=="LISTENING" set "PORT_CHECK=1"
)
if "%PORT_CHECK%"=="1" exit /b 1
exit /b 0