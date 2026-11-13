#!/usr/bin/env bash
# start.sh — Launch script for NASA SPHEREx Sky Viewer Backend and Frontend

set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "      NASA SPHEREx Sky Viewer — Launch Sequence           "
echo "=========================================================="

# 0. Ensure environment and packages are properly set up for current OS
if [ ! -d "$PROJECT_DIR/backend/venv" ] || ! "$PROJECT_DIR/backend/venv/bin/python" -c "import sys" >/dev/null 2>&1; then
    echo "Environment not initialized or incompatible with current OS. Running setup.sh..."
    "$PROJECT_DIR/setup.sh"
fi

BACKEND_TYPE="${1:-fastapi}" # Defaults to fastapi, or pass 'flask'

# 1. Start Python Backend
echo "[1/2] Launching Python backend ($BACKEND_TYPE) on port 8000..."
cd "$PROJECT_DIR/backend"

if [ "$BACKEND_TYPE" = "flask" ]; then
    PYTHONPATH=. ./venv/bin/python flask_app.py &
    BACKEND_PID=$!
else
    PYTHONPATH=. ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
fi

# 2. Start Frontend Dev Server
echo "[2/2] Launching React + Vite frontend on port 5173..."
cd "$PROJECT_DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM

echo ""
echo "🚀 Backend running at:  http://localhost:8000"
echo "✨ Frontend running at: http://localhost:5173"
echo "Press Ctrl+C to terminate both servers."
wait
