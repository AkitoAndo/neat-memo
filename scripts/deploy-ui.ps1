# フロントエンドのみデプロイするスクリプト
# Usage: .\scripts\deploy-ui.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$UiDir = Join-Path $ProjectDir "ui"

Write-Host "Deploying Frontend to S3..." -ForegroundColor Cyan

# スタック出力からS3バケット名とCloudFront Distribution IDを取得
$StackOutputs = aws cloudformation describe-stacks --stack-name NeatMemoApiStack --query "Stacks[0].Outputs" | ConvertFrom-Json

$BucketName = ($StackOutputs | Where-Object { $_.OutputKey -eq "S3BucketName" }).OutputValue
$FrontendUrl = ($StackOutputs | Where-Object { $_.OutputKey -eq "FrontendUrl" }).OutputValue

if (-not $BucketName) {
    Write-Host "Error: Could not find S3 bucket. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Uploading to bucket: $BucketName"

# S3にアップロード
aws s3 sync $UiDir "s3://$BucketName" --delete

Write-Host "`nFrontend deployed successfully!" -ForegroundColor Green
Write-Host "URL: $FrontendUrl"
