#!/bin/bash
set -e

# ========================
# CONFIGURATION
# ========================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG_DIR="$SCRIPT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# ========================
# ENVIRONMENT SETUP
# ========================
echo "Setting up environment..."

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

export NODE_OPTIONS=--openssl-legacy-provider

# ========================
# STOP EXISTING PROCESSES
# ========================
echo "Stopping existing services..."

stop_service() {
  local name=$1
  local pattern=$2
  echo "Stopping $name..."
  pkill -f "$pattern" || true
  for i in {1..5}; do
    if ! pgrep -f "$pattern" > /dev/null; then
      break
    fi
    sleep 1
  done
  pkill -9 -f "$pattern" || true
}

stop_service "backend" "uvicorn main:app"
stop_service "frontend" "npm start"

sleep 2

# ========================
# CLEANUP
# ========================
echo -e "\n=== Performing cleanup ==="

# Frontend cleanup
echo "Cleaning frontend,removing frontend/node_modules..."
cd "$FRONTEND_DIR" || { echo "❌ Frontend directory not found"; exit 1; }
rm -rf node_modules package-lock.json .cache .parcel-cache dist

# Backend cleanup
echo "Cleaning backend,removing backend/venv..."
cd "$BACKEND_DIR" || { echo "❌ Backend directory not found"; exit 1; }
rm -rf venv

# ========================
# FRONTEND SETUP
# ========================
echo -e "\n=== Setting up frontend ==="
cd "$FRONTEND_DIR"

echo "Installing frontend dependencies..."
npm cache clean --force
npm install --legacy-peer-deps

# Fix html-webpack-plugin compatibility
echo "Fixing html-webpack-plugin..."
npm uninstall html-webpack-plugin
npm install html-webpack-plugin@5.6.3 --save-dev --legacy-peer-deps

# Create loader.js if missing
if [ ! -f "node_modules/html-webpack-plugin/lib/loader.js" ]; then
  echo "Creating missing loader.js file..."
  mkdir -p node_modules/html-webpack-plugin/lib
  echo "module.exports = require('./lib');" > node_modules/html-webpack-plugin/lib/loader.js
fi

# ========================
# BACKEND SETUP
# ========================
echo -e "\n=== Setting up backend ==="
cd "$BACKEND_DIR"

# Create fresh virtual environment
echo "Creating virtual environment..."
python3.10 -m venv venv
source venv/bin/activate

echo "Upgrading pip and installing dependencies..."
python3.10 -m ensurepip --upgrade
python3.10 -m pip install --upgrade pip
pip install --upgrade pip
pip install -r requirements.txt

# Ensure uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
  echo "Installing uvicorn..."
  pip install "uvicorn[standard]"
fi

# ========================
# START SERVICES
# ========================
echo -e "\n=== Starting services ==="

start_service() {
  local name=$1
  local cmd=$2
  local log_file="$LOG_DIR/${name}.log"
  echo "Starting $name..."
  nohup bash -c "$cmd" > "$log_file" 2>&1 &
  local pid=$!
  echo "$name started with PID $pid"
  echo "Logs: $log_file"
  sleep 2
  if ! ps -p $pid > /dev/null; then
    echo "❌ $name failed to start. Log output:"
    tail -n 20 "$log_file"
    exit 1
  fi
  echo $pid
}

echo "Starting backend..."
#BACKEND_PID=$(start_service "backend" "source \"$BACKEND_DIR/venv/bin/activate\" && uvicorn main:app --reload")
BACKEND_PID=$(start_service "backend" "source \"$BACKEND_DIR/venv/bin/activate\" && uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
echo "Starting frontend..."
cd "$FRONTEND_DIR"
FRONTEND_PID=$(start_service "frontend" "npm start")

# ========================
# FINAL STATUS
# ========================
echo -e "\n✅ All services restarted successfully"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To view backend logs: tail -f $LOG_DIR/backend.log"
echo "To view frontend logs: tail -f $LOG_DIR/frontend.log"