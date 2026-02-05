# CDKデプロイスクリプト
# Usage: .\scripts\deploy.ps1 [-Stage <stage_name>]

param (
    [string]$Stage = "dev"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InfraDir = Join-Path $ProjectDir "infra"

Write-Host "Deploying NeatMemo CDK Stack (Stage: $Stage)..." -ForegroundColor Cyan

# infraディレクトリに移動
Push-Location $InfraDir

try {
    # 依存関係のインストール (CDK)
    Write-Host "`n[1/4] Installing CDK dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt -q --break-system-packages

    # Lambda依存関係のインストール (apiディレクトリへ)
    Write-Host "`n[2/4] Installing Lambda dependencies..." -ForegroundColor Yellow
    pip install -r ../api/requirements.txt -t ../api -q --break-system-packages

    # CDK Bootstrap (初回のみ必要、既に実行済みならスキップされる)
    Write-Host "`n[3/4] Running CDK bootstrap..." -ForegroundColor Yellow
    npx -y aws-cdk bootstrap

    # デプロイ
    Write-Host "`n[4/4] Deploying stack..." -ForegroundColor Yellow
    npx -y aws-cdk deploy "NeatMemoApiStack-$Stage" --require-approval never -c stage=$Stage

    Write-Host "`nDeployment completed successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}
