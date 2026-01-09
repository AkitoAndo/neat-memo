# CDKデプロイスクリプト
# Usage: .\scripts\deploy.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InfraDir = Join-Path $ProjectDir "infra"

Write-Host "Deploying NeatMemo CDK Stack..." -ForegroundColor Cyan

# infraディレクトリに移動
Push-Location $InfraDir

try {
    # 依存関係のインストール
    Write-Host "`n[1/3] Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt -q --break-system-packages

    # CDK Bootstrap (初回のみ必要、既に実行済みならスキップされる)
    Write-Host "`n[2/3] Running CDK bootstrap..." -ForegroundColor Yellow
    cdk bootstrap

    # デプロイ
    Write-Host "`n[3/3] Deploying stack..." -ForegroundColor Yellow
    cdk deploy --require-approval never

    Write-Host "`nDeployment completed successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}
