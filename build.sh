#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "--- CHECKING ENVIRONMENT ---"
node -v || echo "Node not found"
npm -v || echo "NPM not found"
python3 --version || echo "Python not found"

echo "--- BUILDING FRONTEND ---"
cd frontend
npm install
npm run build
cd ..

echo "--- BUILDING BACKEND ---"
python3 -m venv /opt/venv
/opt/venv/bin/pip install --upgrade pip
/opt/venv/bin/pip install -r backend/requirements.txt

echo "--- BUILD COMPLETE ---"
