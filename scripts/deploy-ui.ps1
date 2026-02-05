# フロントエンドのみデプロイするスクリプト
# Usage: .\scripts\deploy-ui.ps1 [-Stage <stage_name>]

param (
    [string]$Stage = "dev"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$UiDir = Join-Path $ProjectDir "ui"
$DistDir = Join-Path $UiDir "dist"
$StackName = "NeatMemoApiStack-$Stage"

Write-Host "Deploying Frontend to S3 (Stage: $Stage, Stack: $StackName)..." -ForegroundColor Cyan

# スタック出力からS3バケット名とCloudFront Distribution IDを取得
try {
    $StackOutputs = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" | ConvertFrom-Json
}
catch {
    Write-Host "Error: Could not find stack '$StackName'. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

$BucketName = ($StackOutputs | Where-Object { $_.OutputKey -eq "S3BucketName" }).OutputValue
$FrontendUrl = ($StackOutputs | Where-Object { $_.OutputKey -eq "FrontendUrl" }).OutputValue
$ApiUrl = ($StackOutputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue
$UserPoolId = ($StackOutputs | Where-Object { $_.OutputKey -eq "UserPoolId" }).OutputValue
$UserPoolClientId = ($StackOutputs | Where-Object { $_.OutputKey -eq "UserPoolClientId" }).OutputValue
$DistributionId = ($StackOutputs | Where-Object { $_.OutputKey -eq "DistributionId" }).OutputValue
# Default to ap-northeast-1 if not in environment
$Region = $env:AWS_REGION
if (-not $Region) { $Region = "ap-northeast-1" }

if (-not $BucketName) {
    Write-Host "Error: Could not find S3BucketName in stack outputs." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $DistDir)) {
    Write-Host "Error: dist directory not found. Run 'npm run build' in ui directory first." -ForegroundColor Red
    exit 1
}

Write-Host "Uploading to bucket: $BucketName"

# S3にアップロード (config.jsを除外してsyncし、後で上書きする手もあるが、単に上書き後にconfig.jsをアップロードすればよい)
aws s3 sync $DistDir "s3://$BucketName" --delete

# Windows環境からのアップロード時にMIMEタイプがおかしくなる場合があるため、明示的に修正
Write-Host "Fixing Content-Types..."
aws s3 cp "s3://$BucketName/assets/" "s3://$BucketName/assets/" --recursive --exclude "*" --include "*.css" --metadata-directive REPLACE --content-type "text/css"
aws s3 cp "s3://$BucketName/assets/" "s3://$BucketName/assets/" --recursive --exclude "*" --include "*.js" --metadata-directive REPLACE --content-type "application/javascript"

# config.js の生成とアップロード
$ConfigContent = @"
window.ENV = {
  API_ENDPOINT: '$($ApiUrl.TrimEnd('/'))',
  USER_POOL_ID: '$UserPoolId',
  USER_POOL_CLIENT_ID: '$UserPoolClientId',
  REGION: '$Region'
};
"@

$ConfigPath = Join-Path $env:TEMP "config.js"
Set-Content -Path $ConfigPath -Value $ConfigContent -Encoding UTF8

Write-Host "Uploading dynamic config.js..."
aws s3 cp $ConfigPath "s3://$BucketName/config.js"

# CloudFront Invalidation
if ($DistributionId) {
    Write-Host "Invalidating CloudFront cache (ID: $DistributionId)..." -ForegroundColor Cyan
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --region $Region
} else {
    Write-Host "Warning: DistributionId not found in stack outputs. Skipping invalidation." -ForegroundColor Yellow
}

Write-Host "`nFrontend deployed successfully!" -ForegroundColor Green
Write-Host "URL: $FrontendUrl"
