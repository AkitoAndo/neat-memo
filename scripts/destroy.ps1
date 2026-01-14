# CDKスタック削除スクリプト
# Usage: .\scripts\destroy.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InfraDir = Join-Path $ProjectDir "infra"

Write-Host "Destroying NeatMemo CDK Stack..." -ForegroundColor Red

Push-Location $InfraDir

try {
    cdk destroy --force
    Write-Host "`nStack destroyed successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}
