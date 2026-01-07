#!/bin/bash

# Dev Containerを開くスクリプト
# Usage: ./scripts/open-devcontainer.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Opening Dev Container for neat-memo..."

# VS Codeがインストールされているか確認
if ! command -v code &> /dev/null; then
    echo "Error: VS Code CLI (code) is not installed or not in PATH"
    echo "Please install VS Code and add it to PATH"
    exit 1
fi

# Dev Container拡張機能を使ってコンテナ内で開く
code --folder-uri "vscode-remote://dev-container+$(printf '%s' "$PROJECT_DIR" | xxd -p -c 256)/workspace"

echo "VS Code should now open the project in a Dev Container."
echo "If the container doesn't start automatically, use:"
echo "  Command Palette > 'Dev Containers: Reopen in Container'"
