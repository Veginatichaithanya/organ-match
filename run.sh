#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}   OrganMatch Monorepo — Unified Service Launcher     ${NC}"
echo -e "${CYAN}======================================================${NC}"

# Check for .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[!] .env file not found. Creating from .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}[+] Created .env file.${NC}"
    fi
fi

# Detect Docker availability
DOCKER_AVAILABLE=false
if command -v docker &>/dev/null && docker info &>/dev/null; then
    DOCKER_AVAILABLE=true
fi

# If argument "docker" is passed or if user wants Docker mode
if [ "$1" = "docker" ]; then
    if [ "$DOCKER_AVAILABLE" = "false" ]; then
        echo -e "${RED}[!] Docker is not installed or Docker daemon is not running.${NC}"
        exit 1
    fi
    echo -e "${BLUE}[*] Starting all services via Docker Compose...${NC}"
    exec docker compose up --build
fi

# Native Local Mode
echo -e "${BLUE}[*] Launching services in Native Local Mode...${NC}"

# 1. Check Node.js
if ! command -v node &>/dev/null; then
    echo -e "${RED}[!] Node.js is required but not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Node.js detected: $(node -v)${NC}"

# 2. Check Python
PYTHON_CMD=""
if command -v python3.12 &>/dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    echo -e "${RED}[!] Python 3 is required but not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Python detected: $($PYTHON_CMD --version)${NC}"

# 3. Setup Frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}[*] Installing frontend dependencies (one-time setup)...${NC}"
    (cd frontend && npm install)
fi

# 4. Setup Backend Virtual Environment if needed
BACKEND_VENV="backend/venv"
if [ ! -d "$BACKEND_VENV" ]; then
    echo -e "${YELLOW}[*] Setting up Python virtual environment in $BACKEND_VENV...${NC}"
    $PYTHON_CMD -m venv "$BACKEND_VENV" || true
fi

# Use venv python if available, otherwise host python
RUN_PY="$PYTHON_CMD"
if [ -f "$BACKEND_VENV/bin/python" ]; then
    RUN_PY="$BACKEND_VENV/bin/python"
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}[*] Shutting down all services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}[+] All services stopped.${NC}"
    exit 0
}

trap cleanup INT TERM EXIT

# Start Backend API
echo -e "${CYAN}[*] Starting Backend (FastAPI on port 8000)...${NC}"
(
    cd backend
    $RUN_PY -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!

# Start Frontend Dev Server
echo -e "${CYAN}[*] Starting Frontend (Vite on port 5173)...${NC}"
(
    cd frontend
    npm run dev
) &
FRONTEND_PID=$!

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN} Services Running:${NC}"
echo -e "${GREEN}  - Frontend: http://localhost:5173${NC}"
echo -e "${GREEN}  - Backend:  http://localhost:8000/docs${NC}"
echo -e "${GREEN} Press Ctrl+C at any time to stop all services.${NC}"
echo -e "${GREEN}======================================================${NC}"

# Wait for background processes
wait
