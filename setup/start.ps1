# ============================================
# Unveil - Complete App Startup Script
# PowerShell Version for Windows
# ============================================
# This script starts both frontend and backend

# Fix Python Unicode encoding on Windows
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
# Press Ctrl+C to stop all processes

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Unveil - Starting Application" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install npm dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check if Python is installed
$pythonCheck = python --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Python not found. Please install Python 3.8+" -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Prefer local virtual environment if present
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating Python virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

$pythonCmd = "python"
if (Test-Path "venv\Scripts\python.exe") {
    $pythonCmd = "venv\Scripts\python.exe"
}

# Ensure backend Python dependencies are present before starting services.
& $pythonCmd -c "import firebase_admin" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing Python dependencies from requirements.txt..." -ForegroundColor Yellow
    & $pythonCmd -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install Python dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "✓ Node.js found" -ForegroundColor Green
Write-Host "✓ Python found: $pythonCheck" -ForegroundColor Green

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Starting all services..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend will start at: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Green

Write-Host "Backend will start at:  " -NoNewline
Write-Host "http://localhost:8001" -ForegroundColor Green

Write-Host ""
Write-Host "Press Ctrl+C to stop all processes" -ForegroundColor Yellow
Write-Host ""

# Run both services concurrently
npm run start

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Error: Failed to start services" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
