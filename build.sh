#!/bin/bash
set -e

echo "--- CHECKING ENVIRONMENT ---"
node -v
python3 --version

echo "--- BUILDING FRONTEND ---"
cd frontend
npm install --omit=dev
npm run build
cd ..

echo "--- BUILDING BACKEND ---"
python3 -m venv /opt/venv
/opt/venv/bin/pip install --upgrade pip
/opt/venv/bin/pip install -r backend/requirements.txt

echo "--- BUILD COMPLETE ---"
