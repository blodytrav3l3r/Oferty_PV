@echo off
REM ===========================================================
REM  rollback.bat - Powrot do poprzedniej wersji (rdzen w rollback.mjs)
REM  Uzycie: rollback.bat <windows|linux|docker> vX.Y.Z [--dry-run]
REM  Przyklad: rollback.bat windows v1.15.1
REM ===========================================================
setlocal
cd /d "%~dp0"
node scripts/rollback.mjs %*
exit /b %errorlevel%