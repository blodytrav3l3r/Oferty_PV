@echo off
REM Start the Docker installation created by install-new-pc.bat.
call "%~dp0start-postgres.bat"
exit /b %errorlevel%
