#!/bin/bash
# フロントエンドのみデプロイするスクリプト
# Usage: ./scripts/deploy-ui.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_DIR/ui"

echo "Deploying Frontend to S3..."

# スタック出力からS3バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name NeatMemoApiStack \
    --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
    --output text)

FRONTEND_URL=$(aws cloudformation describe-stacks \
    --stack-name NeatMemoApiStack \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
    --output text)

if [ -z "$BUCKET_NAME" ]; then
    echo "Error: Could not find S3 bucket. Run deploy.sh first."
    exit 1
fi

echo "Uploading to bucket: $BUCKET_NAME"

# S3にアップロード
aws s3 sync "$UI_DIR" "s3://$BUCKET_NAME" --delete

echo -e "\nFrontend deployed successfully!"
echo "URL: $FRONTEND_URL"
