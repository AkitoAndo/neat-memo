# neat-memo

## 開発環境のセットアップ

### 必要なもの

- Docker Desktop
- VS Code + Dev Containers 拡張機能

### Dev Container を開く

**PowerShell:**
```powershell
.\scripts\open-devcontainer.ps1
```

**Git Bash / WSL:**
```bash
./scripts/open-devcontainer.sh
```

**手動:**
1. VS Code でこのフォルダを開く
2. `F1` → `Dev Containers: Reopen in Container`

### 開発環境の内容

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 20 | React フロントエンド |
| Python | 3.12 | Lambda バックエンド |
| AWS CLI | latest | AWS リソース管理 |
| SAM CLI | latest | Lambda ローカル開発 |

## CI/CDテスト