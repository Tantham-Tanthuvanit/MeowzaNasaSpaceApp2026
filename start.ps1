# start.ps1 — Windows PowerShell launch script for NASA SPHEREx Sky Viewer Backend and Frontend
$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"

Write-Host "=========================================================="
Write-Host "      NASA SPHEREx Sky Viewer — Launch Sequence           "
Write-Host "=========================================================="

# 0. Ensure environment and packages are properly set up
$NeedsSetup = $false
if (-not (Test-Path $VenvPython)) {
    $NeedsSetup = $true
} else {
    & $VenvPython -c "import sys, uvicorn, fastapi" >$null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $NeedsSetup = $true
    }
}

if ($NeedsSetup -or -not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Environment not initialized or incompatible with current OS. Running setup.ps1..."
    & (Join-Path $ProjectDir "setup.ps1")
}

$BackendProc = $null
$FrontendProc = $null

try {
    # 1. Start Python Backend
    Write-Host "[1/2] Launching Python backend (FastAPI) on port 8000..."
    $env:PYTHONPATH = $BackendDir
    $BackendProc = Start-Process -FilePath $VenvPython `
        -ArgumentList @("-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000") `
        -WorkingDirectory $BackendDir `
        -NoNewWindow -PassThru

    # 2. Start Frontend Dev Server
    Write-Host "[2/2] Launching React + Vite frontend on port 5173..."
    $FrontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", "npm run dev -- --host 0.0.0.0") `
        -WorkingDirectory $FrontendDir `
        -NoNewWindow -PassThru

    Write-Host ""
    Write-Host "Backend running at:  http://localhost:8000"
    Write-Host "Frontend running at: http://localhost:5173"
    Write-Host "Press Ctrl+C to terminate both servers."

    while (-not $BackendProc.HasExited -and -not $FrontendProc.HasExited) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nStopping servers..."
    if ($BackendProc -and -not $BackendProc.HasExited) {
        cmd /c "taskkill /PID $($BackendProc.Id) /T /F >nul 2>&1"
    }
    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        cmd /c "taskkill /PID $($FrontendProc.Id) /T /F >nul 2>&1"
    }
}
