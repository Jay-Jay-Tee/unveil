#!/bin/bash

# ============================================
# UnbiasedAI - Complete App Startup Script
# Bash Version for macOS / Linux
# ============================================
# This script starts both frontend and backend
# Press Ctrl+C to stop all processes

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}====================================${NC}"
echo -e "${CYAN}  UnbiasedAI - Starting Application${NC}"
echo -e "${CYAN}====================================${NC}"
echo ""
echo -e "${YELLOW}Checking dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to install npm dependencies${NC}"
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Please install Node.js 16+${NC}"
    echo -e "${YELLOW}Download from: https://nodejs.org${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm not found. Please install npm${NC}"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python3 not found. Please install Python 3.8+${NC}"
    echo -e "${YELLOW}Download from: https://python.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
PYTHON_VERSION=$(python3 --version)

echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
echo -e "${GREEN}✓ Python found: $PYTHON_VERSION${NC}"

# Prefer local virtual environment if present
if [ -f "venv/bin/activate" ]; then
    echo -e "${YELLOW}Activating Python virtual environment...${NC}"
    # shellcheck disable=SC1091
    source venv/bin/activate
fi

# If dependencies are missing, startup will fail with a clear import error.
# Install manually when needed: python3 -m pip install -r requirements.txt

echo ""
echo -e "${CYAN}====================================${NC}"
echo -e "${CYAN}Starting all services...${NC}"
echo -e "${CYAN}====================================${NC}"
echo ""
echo -e "Frontend will start at: ${GREEN}http://localhost:5173${NC}"
echo -e "Backend will start at:  ${GREEN}http://localhost:8001${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all processes${NC}"
echo ""

# Run both services concurrently
npm run start

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}Error: Failed to start services${NC}"
    exit 1
fi

