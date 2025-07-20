#!/bin/bash
set -e

# ========================
# ENVIRONMENT SETUP
# ========================
echo "Setting up environment..."

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

export NODE_OPTIONS=--openssl-legacy-provider

# Define directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG_DIR="$SCRIPT_DIR/logs"

mkdir -p "$LOG_DIR"

# ========================
# STOP EXISTING SERVICES
# ========================
echo "Stopping existing backend and frontend if any..."

pkill -f "uvicorn main:app" || true
pkill -f "npm start" || true
pkill -f "node" || true

sleep 2

# ========================
# START BACKEND
# ========================
echo "Starting backend..."
cd "$BACKEND_DIR" || { echo "❌ Backend directory not found"; exit 1; }

# Recreate virtual environment if missing or pip not found
if [ ! -d "venv" ] || ! ./venv/bin/pip --version > /dev/null 2>&1; then
  echo "Creating virtual environment with pip..."
  rm -rf venv
  python3.10 -m venv --upgrade-deps venv
fi

source venv/bin/activate

echo "Upgrading pip and installing dependencies..."
# pip install --upgrade pip
# pip install -r requirements.txt

# Ensure uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
  echo "Installing uvicorn..."
  pip install "uvicorn[standard]"
fi

echo "Launching backend..."
# nohup uvicorn main:app --reload > "$LOG_DIR/backend.log" 2>&1 &
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
sleep 2

if ! ps -p $BACKEND_PID > /dev/null; then
  echo "❌ Backend failed to start. Check logs:"
  tail -n 20 "$LOG_DIR/backend.log"
  exit 1
fi

echo "✅ Backend started with PID $BACKEND_PID"
echo "Backend logs: $LOG_DIR/backend.log"

# ========================
# START FRONTEND
# ========================
echo "Starting frontend..."
cd "$FRONTEND_DIR" || { echo "❌ Frontend directory not found"; exit 1; }

#nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
nohup env HOST=0.0.0.0 npm start > "$LOG_DIR/frontend.log" 2>&1 &

FRONTEND_PID=$!
sleep 2

if ! ps -p $FRONTEND_PID > /dev/null; then
  echo "❌ Frontend failed to start. Check logs:"
  tail -n 20 "$LOG_DIR/frontend.log"
  exit 1
fi

echo "✅ Frontend started with PID $FRONTEND_PID"
echo "Frontend logs: $LOG_DIR/frontend.log"

# ========================
# FINAL STATUS
# ========================
echo -e "\n✅ All services restarted successfully"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To view backend logs: tail -f $LOG_DIR/backend.log"
echo "To view frontend logs: tail -f $LOG_DIR/frontend.log"
# After starting backend and frontend, add:

tail -f /app/logs/backend.log