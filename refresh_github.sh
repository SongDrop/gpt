#!/bin/bash
set -e

echo "Fetching latest updates from GitHub..."

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