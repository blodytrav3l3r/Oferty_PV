@echo off
REM Start S.O.K. with native PostgreSQL and Docker test PostgreSQL.
call "%~dp0start-native.bat" -Watch -StartTestDatabase
exit /b %errorlevel%
