#!/bin/bash

# ============================================
# AI Assembly Line Visual Inspector - Start Script
# ============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  AI Assembly Line Visual Inspector${NC}"
echo -e "${CYAN}  Starting Application...${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ---- Clean used ports ----
echo -e "${YELLOW}[1/6] Cleaning used ports...${NC}"
cleanup_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "  ${RED}Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo -e "  ${GREEN}Port $port is available${NC}"
  fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

# ---- Check PostgreSQL ----
echo ""
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${RED}PostgreSQL is not installed. Please install it first.${NC}"
  exit 1
fi

# Try to start PostgreSQL if not running
if ! pg_isready -q 2>/dev/null; then
  echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
  sleep 2
fi

if pg_isready -q 2>/dev/null; then
  echo -e "  ${GREEN}PostgreSQL is running${NC}"
else
  echo -e "  ${RED}PostgreSQL is not running. Please start it manually.${NC}"
  exit 1
fi

# ---- Create Database ----
echo ""
echo -e "${YELLOW}[3/6] Setting up database...${NC}"
DB_NAME="assembly_inspector"

if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo -e "  ${GREEN}Database '$DB_NAME' already exists${NC}"
else
  echo -e "  ${BLUE}Creating database '$DB_NAME'...${NC}"
  createdb "$DB_NAME" 2>/dev/null || psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
  echo -e "  ${GREEN}Database created${NC}"
fi

# ---- Install Dependencies ----
echo ""
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"

cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
  echo -e "  ${BLUE}Installing backend dependencies...${NC}"
  npm install --silent 2>&1 | tail -2
else
  echo -e "  ${GREEN}Backend dependencies already installed${NC}"
fi

cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo -e "  ${BLUE}Installing frontend dependencies...${NC}"
  npm install --silent 2>&1 | tail -2
else
  echo -e "  ${GREEN}Frontend dependencies already installed${NC}"
fi

# ---- Seed Database ----
echo ""
echo -e "${YELLOW}[5/6] Seeding database...${NC}"
cd "$PROJECT_DIR/backend"
node src/seed.js 2>&1
echo -e "  ${GREEN}Database seeded successfully${NC}"

# ---- Start Services ----
echo ""
echo -e "${YELLOW}[6/6] Starting services...${NC}"

# Create uploads directory
mkdir -p "$PROJECT_DIR/backend/uploads"

# Start backend with auto-reload (node --watch)
echo -e "  ${BLUE}Starting backend on port $BACKEND_PORT with auto-reload...${NC}"
cd "$PROJECT_DIR/backend"
node --watch src/server.js &
BACKEND_PID=$!

# Start frontend with hot reload
echo -e "  ${BLUE}Starting frontend on port $FRONTEND_PORT with hot reload...${NC}"
cd "$PROJECT_DIR/frontend"
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!

# ---- Trap for cleanup ----
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Application stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ---- Wait for services ----
sleep 3
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Application is running!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  ${CYAN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e ""
echo -e "  ${YELLOW}Login Credentials:${NC}"
echo -e "  Email:    admin@inspector.com"
echo -e "  Password: admin123"
echo -e ""
echo -e "  ${YELLOW}Press Ctrl+C to stop${NC}"
echo -e "${GREEN}============================================${NC}"

# Wait for background processes
wait
