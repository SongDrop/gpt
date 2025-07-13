#!/bin/bash
set -e

echo "Fetching latest updates from GitHub..."
git clone https://github.com/SongDrop/gpt.git
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
export NODE_OPTIONS=--openssl-legacy-provider
node -v
npm -v
chmod +x reinstall.sh
./reinstall.sh


# Backend update
if [ -d "./backend" ]; then
  echo "Updating backend..."
  cd backend
  git pull origin main || echo "Failed to update backend repo"
  cd ..
else
  echo "Backend directory not found"
fi

# Frontend update
if [ -d "./frontend" ]; then
  echo "Updating frontend..."
  cd frontend
  git pull origin main || echo "Failed to update frontend repo"
  cd ..
else
  echo "Frontend directory not found"
fi

echo "GitHub repos refreshed."