#!/bin/bash
set -e

# プロジェクトルートの判定
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

# Python実行コマンドの決定
if [ -f "$PROJECT_ROOT/.venv/bin/python" ]; then
    echo "Using virtual environment: .venv"
    PYTHON_CMD="$PROJECT_ROOT/.venv/bin/python"
else
    echo "Virtual environment not found in project root. Using system python."
    PYTHON_CMD="python3"
fi

# Python Lint (Ruff) の実行
echo "--- Running Python Lint (Ruff) ---"
cd "$PROJECT_ROOT"
"$PYTHON_CMD" -m ruff check .

# Frontend Lint (ESLint) の実行
echo "--- Running Frontend Lint (ESLint) ---"
cd "ui"
npm run lint

echo "Linting passed!"