#!/bin/bash
# CDKスタック削除スクリプト
# Usage: ./scripts/destroy.sh [stage_name]

set -e

STAGE=${1:-dev}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_DIR/infra"

echo "Destroying NeatMemo CDK Stack (Stage: $STAGE)..."

cd "$INFRA_DIR"

cdk destroy --force -c stage=$STAGE

echo -e "\nStack destroyed successfully!"
