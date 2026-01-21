#!/bin/bash
# CDKデプロイスクリプト
# Usage: ./scripts/deploy.sh [stage_name]

set -e

STAGE=${1:-dev}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_DIR/infra"

echo "Deploying NeatMemo CDK Stack (Stage: $STAGE)..."

cd "$INFRA_DIR"

# 依存関係のインストール
echo -e "\n[1/3] Installing dependencies..."
pip install -r requirements.txt -q --break-system-packages

# CDK Bootstrap (初回のみ必要、既に実行済みならスキップされる)
echo -e "\n[2/3] Running CDK bootstrap..."
cdk bootstrap

# デプロイ
echo -e "\n[3/3] Deploying stack..."
cdk deploy --require-approval never -c stage=$STAGE

echo -e "\nDeployment completed successfully!"
