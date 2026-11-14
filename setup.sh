#!/usr/bin/env bash
# setup.sh — Automated cross-platform environment setup script for NASA SPHEREx Sky Viewer
# Detects OS (macOS / Linux / Windows Git Bash / MSYS2 / WSL), creates a dedicated virtual environment,
# and installs all required backend Python packages and frontend Node dependencies.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Ensure common paths (including Homebrew on macOS and LocalAppData Python on Windows)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -n "${LOCALAPPDATA:-}" ]; then
    WIN_LOCALAPPDATA="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")"
    export PATH="$WIN_LOCALAPPDATA/Python/bin:$WIN_LOCALAPPDATA/Programs/Python/Python314:$WIN_LOCALAPPDATA/Programs/Python/Python313:$WIN_LOCALAPPDATA/Programs/Python/Python312:$WIN_LOCALAPPDATA/Programs/Python/Python311:$PATH"
fi

echo "=========================================================="
echo "    NASA SPHEREx Sky Viewer — OS Setup & Initialization   "
echo "=========================================================="

# 1. Detect Operating System & Architecture
OS_NAME="$(uname -s 2>/dev/null || echo "Unknown")"
ARCH_NAME="$(uname -m 2>/dev/null || echo "Unknown")"
echo " Detected OS: $OS_NAME ($ARCH_NAME)"

# Helper to resolve venv python path across Unix (venv/bin/python) and Windows (venv/Scripts/python.exe)
find_venv_python() {
    if [ -x "$BACKEND_DIR/venv/Scripts/python.exe" ]; then
        echo "$BACKEND_DIR/venv/Scripts/python.exe"
    elif [ -x "$BACKEND_DIR/venv/bin/python" ]; then
        echo "$BACKEND_DIR/venv/bin/python"
    else
        echo ""
    fi
}

# 2. Find compatible Python 3 executable (>= 3.9), skipping Windows Store stubs
PYTHON_BIN=""
PYTHON_ARGS=()

check_python_candidate() {
    local bin="$1"
    shift
    local args=("$@")
    if "$bin" "${args[@]}" -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >/dev/null 2>&1; then
        PYTHON_BIN="$bin"
        PYTHON_ARGS=("${args[@]}")
        return 0
    fi
    return 1
}

for py_candidate in python3.14 python3.13 python3.12 python3.11 python3.10 python3.9 python3 python; do
    while IFS= read -r candidate_path; do
        [ -z "$candidate_path" ] && continue
        if check_python_candidate "$candidate_path"; then
            break 2
        fi
    done < <(which -a "$py_candidate" 2>/dev/null || true)
done

# Fallback to Windows py launcher if available
if [ -z "$PYTHON_BIN" ] && command -v py >/dev/null 2>&1; then
    if check_python_candidate "$(command -v py)" -3; then
        :
    fi
fi

if [ -z "$PYTHON_BIN" ]; then
    echo " Error: No compatible Python (>= 3.9) found in PATH." >&2
    echo "Please install Python 3.9+ before continuing." >&2
    exit 1
fi

PY_VERSION="$("$PYTHON_BIN" "${PYTHON_ARGS[@]}" --version 2>&1)"
echo " Found Python: $PYTHON_BIN ${PYTHON_ARGS[*]} ($PY_VERSION)"

# 3. Setup Python Virtual Environment for this OS
cd "$BACKEND_DIR"

VENV_PYTHON="$(find_venv_python)"
NEED_NEW_VENV=false
if [ -z "$VENV_PYTHON" ]; then
    NEED_NEW_VENV=true
else
    # Check if existing venv's python is working and matches this OS/interpreter
    if ! "$VENV_PYTHON" -c "import sys" >/dev/null 2>&1; then
        echo " Existing virtual environment in backend/venv is incompatible with this system."
        NEED_NEW_VENV=true
    fi
fi

if [ "$NEED_NEW_VENV" = true ]; then
    echo " Creating fresh virtual environment at backend/venv..."
    rm -rf venv
    "$PYTHON_BIN" "${PYTHON_ARGS[@]}" -m venv venv
    VENV_PYTHON="$(find_venv_python)"
fi

if [ -z "$VENV_PYTHON" ]; then
    echo " Error: Failed to locate Python inside backend/venv." >&2
    exit 1
fi

# 4. Install / Update Backend Dependencies
echo " Installing/verifying backend Python dependencies..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet
"$VENV_PYTHON" -m pip install -r requirements.txt pytest pytest-asyncio --quiet

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
echo " Run ./start.sh (or .\\start.bat on Windows) to start the system."
echo "=========================================================="
