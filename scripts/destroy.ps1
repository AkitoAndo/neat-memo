# CDKスタック削除スクリプト
# Usage: .\scripts\destroy.ps1 [-Stage <stage_name>]

param (
    [string]$Stage = "dev"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InfraDir = Join-Path $ProjectDir "infra"

Write-Host "Destroying NeatMemo CDK Stack (Stage: $Stage)..." -ForegroundColor Red

Push-Location $InfraDir

try {
    cdk destroy --force -c stage=$Stage
    Write-Host "`nStack destroyed successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}
