#!/bin/bash
# CDKデプロイスクリプト
# Usage: ./scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_DIR/infra"

echo "Deploying NeatMemo CDK Stack..."

cd "$INFRA_DIR"

# 依存関係のインストール
echo -e "\n[1/3] Installing dependencies..."
pip install -r requirements.txt -q --break-system-packages

# CDK Bootstrap (初回のみ必要、既に実行済みならスキップされる)
echo -e "\n[2/3] Running CDK bootstrap..."
cdk bootstrap

# デプロイ
echo -e "\n[3/3] Deploying stack..."
cdk deploy --require-approval never

echo -e "\nDeployment completed successfully!"
