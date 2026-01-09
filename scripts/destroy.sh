#!/bin/bash
# CDKスタック削除スクリプト
# Usage: ./scripts/destroy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_DIR/infra"

echo "Destroying NeatMemo CDK Stack..."

cd "$INFRA_DIR"

cdk destroy --force

echo -e "\nStack destroyed successfully!"
