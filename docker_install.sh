#!/bin/bash
set -e

# ========================
# CONFIGURATION
# ========================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG_DIR="$SCRIPT_DIR/logs"

mkdir -p "$LOG_DIR"

# ========================
# ENVIRONMENT SETUP
# ========================
echo "Setting up environment..."

# Load NVM if needed
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

export NODE_OPTIONS=--openssl-legacy-provider

# ========================
# STOP EXISTING SERVICES
# ========================
echo "Stopping existing backend and frontend if any..."

pkill -f "uvicorn main:app" || true
pkill -f "serve" || true
pkill -f "node" || true

sleep 2

# ========================
# CLEANUP
# ========================
echo "Cleaning frontend and backend..."

cd "$FRONTEND_DIR" || { echo "❌ Frontend directory not found"; exit 1; }
rm -rf node_modules package-lock.json .cache .parcel-cache dist build

cd "$BACKEND_DIR" || { echo "❌ Backend directory not found"; exit 1; }
rm -rf venv

# ========================
# FRONTEND SETUP & BUILD
# ========================
echo "Setting up frontend..."

cd "$FRONTEND_DIR"
npm install --legacy-peer-deps

# Fix html-webpack-plugin if needed
npm uninstall html-webpack-plugin || true
npm install html-webpack-plugin@5.6.3 --save-dev --legacy-peer-deps

# Create loader.js if missing
if [ ! -f "node_modules/html-webpack-plugin/lib/loader.js" ]; then
  mkdir -p node_modules/html-webpack-plugin/lib
  echo "module.exports = require('./lib');" > node_modules/html-webpack-plugin/lib/loader.js
fi

echo "Building frontend for production..."
npm run build

echo "✅ Frontend build completed."

# ========================
# BACKEND SETUP
# ========================
echo "Setting up backend..."

cd "$BACKEND_DIR"
python3.10 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if ! command -v uvicorn &> /dev/null; then
  echo "Installing uvicorn..."
  pip install "uvicorn[standard]"
fi

# ========================
# START SERVICES
# ========================

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
    echo "❌ $name failed to start. Tail logs:"
    tail -n 20 "$log_file"
    exit 1
  fi
  echo $pid
}

echo "Starting backend..."
BACKEND_PID=$(start_service "backend" "source \"$BACKEND_DIR/venv/bin/activate\" && uvicorn main:app --host 0.0.0.0 --port 8000")
echo "Starting frontend static server..."

# Install 'serve' if missing
if ! command -v serve &> /dev/null; then
  echo "Installing 'serve' package globally..."
  npm install -g serve
fi

FRONTEND_PID=$(start_service "frontend" "serve -s $FRONTEND_DIR/build -l 3000")

# ========================
# FINAL STATUS
# ========================

echo -e "\n✅ All services started successfully"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To view backend logs: tail -f $LOG_DIR/backend.log"
echo "To view frontend logs: tail -f $LOG_DIR/frontend.log"

# Tail backend logs by default (optional)
tail -f "$LOG_DIR/backend.log"