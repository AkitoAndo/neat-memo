# Dev Containerを開くスクリプト
# Usage: .\scripts\open-devcontainer.ps1

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Opening Dev Container for neat-memo..."

# VS Codeがインストールされているか確認
if (-not (Get-Command "code" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: VS Code CLI (code) is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install VS Code and add it to PATH"
    exit 1
}

# プロジェクトフォルダをHex変換
$hexPath = [System.BitConverter]::ToString([System.Text.Encoding]::UTF8.GetBytes($ProjectDir)).Replace("-", "").ToLower()

# Dev Container拡張機能を使ってコンテナ内で開く
$uri = "vscode-remote://dev-container+$hexPath/workspace"
code --folder-uri $uri

Write-Host "VS Code should now open the project in a Dev Container." -ForegroundColor Green
Write-Host "If the container doesn't start automatically, use:"
Write-Host "  Command Palette > 'Dev Containers: Reopen in Container'"
