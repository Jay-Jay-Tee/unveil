@echo off
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
REM ============================================
REM UnbiasedAI - Complete App Startup Script
REM ============================================
REM This script starts both frontend and backend
REM Press Ctrl+C to stop all processes

echo.
echo ====================================
echo   UnbiasedAI - Starting Application
echo ====================================
echo.
echo Checking dependencies...

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo Error: Failed to install npm dependencies
        pause
        exit /b 1
    )
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

echo.
echo ====================================
echo Starting all services...
echo ====================================
echo.
echo Frontend will start at: http://localhost:5173
echo Backend will start at: http://localhost:8001
echo.
echo Press Ctrl+C to stop all processes
echo.

REM Run both services concurrently
call npm run start

pause
