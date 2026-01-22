$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $PSScriptRoot ".."
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    Write-Host "Using virtual environment: .venv"
    $PythonCmd = $VenvPython
} else {
    Write-Host "Virtual environment not found. Using system python."
    $PythonCmd = "python"
}

Write-Host "--- Running Python Lint (Ruff) ---"
Push-Location $ProjectRoot
try {
    & $PythonCmd -m ruff check .
    if ($LASTEXITCODE -ne 0) { throw "Python lint failed" }
} finally {
    Pop-Location
}

Write-Host "--- Running Frontend Lint (ESLint) ---"
$UiDir = Join-Path $ProjectRoot "ui"
Push-Location $UiDir
try {
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw "Frontend lint failed" }
} finally {
    Pop-Location
}

Write-Host "Linting passed!"