# 個別テスト環境の利用ガイド

このプロジェクトでは、本番環境を壊さずに開発者が個別にテストを行えるよう、AWS上に自分専用の環境（サンドボックス）を簡単に構築できるようになっています。

## 1. 個別環境の仕組み

デプロイ時に「ステージ名（自分の名前など）」を指定することで、独立したスタックが作成されます。

- **スタック名**: `NeatMemoApiStack-<ステージ名>`
- **API名**: `NeatMemo API (<ステージ名>)`

これにより、他の開発者の環境や本番環境とリソースが衝突することはありません。

## 2. 環境の構築 (デプロイ)

ターミナルで以下のコマンドを実行します。`<ステージ名>` は自分の名前（例: `user-tanaka`）などに置き換えてください。

### Windows (PowerShell)
```powershell
.\scripts\deploy.ps1 -Stage <ステージ名>
```

### Mac / Linux (Bash)
```bash
./scripts/deploy.sh <ステージ名>
```

> [!TIP]
> 引数を省略した場合は、デフォルトの `dev` 環境としてデプロイされます。

## 3. テストの実行手順例

新機能の実装やバグ修正を行った際の、標準的なテストフローです。

### STEP 1: 専用環境へのデプロイ
自分の環境を作成または更新します。
```powershell
.\scripts\deploy.ps1 -Stage test-user
```
完了時に表示される `ApiUrl` と `FrontendUrl` を確認してください。

### STEP 2: UI (画面) の確認
表示された `FrontendUrl`（例: `https://xxxx.cloudfront.net`）にブラウザでアクセスし、動作を確認します。

### STEP 3: API の直接確認 (必要に応じて)
APIのレスポンスを直接確認したい場合は、`ApiUrl` を使用します。
```powershell
# PowerShellでの確認例
Invoke-RestMethod -Uri "https://<あなたのAPI_URL>/hello"
```

### STEP 4: 修正と再デプロイ
コードを修正した場合は、再度 STEP 1 のコマンドを実行します。
CDKが差分を検知し、変更があった箇所だけを高速に更新します。

## 4. 環境の削除 (クリーンアップ)

テストが完了し、環境が不要になったら必ず削除してください。これにより、AWSリソースの無駄な消費を抑えられます。

### Windows (PowerShell)
```powershell
.\scripts\destroy.ps1 -Stage <ステージ名>
```

### Mac / Linux (Bash)
```bash
./scripts/destroy.sh <ステージ名>
```

---

## 注意事項
- ステージ名には半角英数字とハイフンを使用してください。
- 環境を放置すると料金が発生し続ける可能性があるため、長期間使わない場合は `destroy` してください。