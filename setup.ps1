# setup.ps1 — Automated Windows environment setup script for NASA SPHEREx Sky Viewer
$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"

Write-Host "=========================================================="
Write-Host "    NASA SPHEREx Sky Viewer — OS Setup & Initialization   "
Write-Host "=========================================================="
Write-Host " Detected OS: Windows ($([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture))"

# 1. Find a working Python >= 3.9 executable (skipping Windows Store alias stubs)
$PythonCmd = $null
$PythonArgs = @()

$Candidates = @(
    @{ Cmd = "py"; Args = @("-3") },
    @{ Cmd = "$env:LOCALAPPDATA\Python\bin\python.exe"; Args = @() },
    @{ Cmd = "python"; Args = @() },
    @{ Cmd = "python3"; Args = @() }
)

# Also include any Python installations in LocalAppData\Programs\Python
if (Test-Path "$env:LOCALAPPDATA\Programs\Python") {
    Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        ForEach-Object {
            $Candidates += @{ Cmd = $_.FullName; Args = @() }
        }
}

foreach ($c in $Candidates) {
    try {
        $cmdInfo = Get-Command $c.Cmd -ErrorAction SilentlyContinue
        if (-not $cmdInfo) { continue }
        # Skip Microsoft Store stub python.exe/python3.exe (though py.exe in WindowsApps is real)
        if ($cmdInfo.Source -like "*\Microsoft\WindowsApps\python*.exe") { continue }

        $cArgs = $c.Args
        & $cmdInfo.Source @cArgs -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >$null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $PythonCmd = $cmdInfo.Source
            $PythonArgs = $c.Args
            break
        }
    } catch {
        continue
    }
}

if (-not $PythonCmd) {
    Write-Error "Error: No compatible Python (>= 3.9) found. Please install Python 3.9+ from python.org."
    exit 1
}

$PyVersion = & $PythonCmd @PythonArgs --version 2>&1
Write-Host " Found Python: $PythonCmd $($PythonArgs -join ' ') ($PyVersion)"

# 2. Setup Python Virtual Environment
$VenvDir = Join-Path $BackendDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

$NeedNewVenv = $false
if (-not (Test-Path $VenvPython)) {
    $NeedNewVenv = $true
} else {
    try {
        & $VenvPython -c "import sys" >$null 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host " Existing virtual environment in backend/venv is incompatible with this system."
            $NeedNewVenv = $true
        }
    } catch {
        $NeedNewVenv = $true
    }
}

if ($NeedNewVenv) {
    Write-Host " Creating fresh virtual environment at backend/venv..."
    if (Test-Path $VenvDir) {
        Remove-Item -Recurse -Force $VenvDir
    }
    & $PythonCmd @PythonArgs -m venv $VenvDir
}

# 3. Install / Update Backend Dependencies
Write-Host " Installing/verifying backend Python dependencies..."
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPython -m pip install -r (Join-Path $BackendDir "requirements.txt") pytest pytest-asyncio --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install backend Python dependencies."
    exit 1
}
Write-Host " Backend virtual environment ready with all required dependencies."

# 4. Setup Frontend Dependencies
if (Test-Path $FrontendDir) {
    Write-Host " Checking frontend dependencies..."
    Push-Location $FrontendDir
    try {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            $NeedNpmInstall = $false
            if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
                $NeedNpmInstall = $true
            } else {
                cmd /c "npx vite --version >nul 2>&1"
                if ($LASTEXITCODE -ne 0) {
                    Write-Host " Frontend native dependencies (esbuild/rollup) incompatible with current OS."
                    $NeedNpmInstall = $true
                }
            }

            if ($NeedNpmInstall) {
                Write-Host " Installing frontend dependencies..."
                cmd /c "npm install --silent"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install frontend dependencies."
                    exit 1
                }
            } else {
                Write-Host " Frontend dependencies are up to date."
            }
        } else {
            Write-Host " Warning: 'npm' not found. Please install Node.js and npm to run the frontend."
        }
    } finally {
        Pop-Location
    }
}

Write-Host "=========================================================="
Write-Host " Setup complete! Ready to launch."
Write-Host " Run .\start.bat or .\start.ps1 (or ./start.sh in Git Bash) to start the system."
Write-Host "=========================================================="
