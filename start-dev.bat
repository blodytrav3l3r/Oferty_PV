@echo off
REM Start S.O.K. without Docker and reload the backend when source files change.
call "%~dp0start-native.bat" -Watch
exit /b %errorlevel%
