@echo off
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
REM ============================================
REM Unveil - Complete App Startup Script
REM ============================================
REM This script starts both frontend and backend
REM Press Ctrl+C to stop all processes

echo.
echo ====================================
echo   Unveil - Starting Application
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

REM Prefer local virtual environment if present
if exist "venv\Scripts\activate.bat" (
    echo Activating Python virtual environment...
    call "venv\Scripts\activate.bat"
)

set "PY_CMD=python"
if exist "venv\Scripts\python.exe" set "PY_CMD=venv\Scripts\python.exe"

REM Ensure backend Python dependencies are present before starting services.
%PY_CMD% -c "import firebase_admin" >nul 2>&1
if errorlevel 1 (
    echo Installing Python dependencies from requirements.txt...
    %PY_CMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Error: Failed to install Python dependencies
        pause
        exit /b 1
    )
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
