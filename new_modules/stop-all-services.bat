@echo off
echo 🛑 Stopping Chat Bot Services...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Run the stop script
node stop-all-services.js %*

REM Pause to see results if double-clicked
if "%1"=="" pause