#!/usr/bin/env bash
# setup.sh — Automated cross-platform environment setup script for NASA SPHEREx Sky Viewer
# Detects OS (macOS / Linux / Windows WSL/GitBash), creates a dedicated virtual environment,
# and installs all required backend Python packages and frontend Node dependencies.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Ensure common paths (including Homebrew on macOS)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=========================================================="
echo "    NASA SPHEREx Sky Viewer — OS Setup & Initialization   "
echo "=========================================================="

# 1. Detect Operating System & Architecture
OS_NAME="$(uname -s 2>/dev/null || echo "Unknown")"
ARCH_NAME="$(uname -m 2>/dev/null || echo "Unknown")"
echo " Detected OS: $OS_NAME ($ARCH_NAME)"

# 2. Find compatible Python 3 executable (prefer 3.12, 3.11, 3.10, 3.9, or system python3)
PYTHON_BIN=""
for py_candidate in python3.12 python3.11 python3.10 python3.9 python3 python; do
    if command -v "$py_candidate" >/dev/null 2>&1; then
        # Check python version
        if "$py_candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" 2>/dev/null; then
            PYTHON_BIN="$(command -v "$py_candidate")"
            break
        fi
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo " Error: No compatible Python (>= 3.9) found in PATH." >&2
    echo "Please install Python 3.9+ before continuing." >&2
    exit 1
fi

PY_VERSION="$("$PYTHON_BIN" --version 2>&1)"
echo " Found Python: $PYTHON_BIN ($PY_VERSION)"

# 3. Setup Python Virtual Environment for this OS
cd "$BACKEND_DIR"

NEED_NEW_VENV=false
if [ ! -d "venv" ]; then
    NEED_NEW_VENV=true
else
    # Check if existing venv's python is working and matches this OS/interpreter
    if ! ./venv/bin/python -c "import sys" >/dev/null 2>&1; then
        echo " Existing virtual environment in backend/venv is incompatible with this system."
        NEED_NEW_VENV=true
    fi
fi

if [ "$NEED_NEW_VENV" = true ]; then
    echo " Creating fresh virtual environment at backend/venv..."
    rm -rf venv
    "$PYTHON_BIN" -m venv venv
fi

# 4. Install / Update Backend Dependencies
echo " Installing/verifying backend Python dependencies..."
./venv/bin/python -m pip install --upgrade pip --quiet
./venv/bin/python -m pip install -r requirements.txt pytest pytest-asyncio --quiet

echo " Backend virtual environment ready with all required dependencies."

# 5. Setup Frontend Dependencies
if [ -d "$FRONTEND_DIR" ]; then
    echo " Checking frontend dependencies..."
    cd "$FRONTEND_DIR"
    if command -v npm >/dev/null 2>&1; then
        # Check if node_modules exists and native bindings work
        NEED_NPM_INSTALL=false
        if [ ! -d "node_modules" ]; then
            NEED_NPM_INSTALL=true
        else
            # Test if vite runs without native arch error
            if ! npx vite --version >/dev/null 2>&1; then
                echo " Frontend native dependencies (esbuild/rollup) incompatible with current OS."
                NEED_NPM_INSTALL=true
            fi
        fi

        if [ "$NEED_NPM_INSTALL" = true ]; then
            echo " Installing frontend dependencies for $OS_NAME ($ARCH_NAME)..."
            npm install --silent
        else
            echo " Frontend dependencies are up to date."
        fi
    else
        echo " Warning: 'npm' not found. Please install Node.js and npm to run the frontend."
    fi
fi

echo "=========================================================="
echo " Setup complete! Ready to launch."
echo " Run ./start.sh (or ./start.sh flask) to start the system."
echo "=========================================================="
