# TwinRecho

双胎妊娠の健診データをスマホで入力し、夫婦の端末でリアルタイム同期するWebアプリです。GitHub Pages の `docs/` で動作し、Firebase Authentication（匿名ログイン）+ Firestore を使用します。

## 前提

- Node.js のインストール
- Firebase CLI のインストール
  - `npm install -g firebase-tools`
- Firebase へログイン
  - `firebase login`

## セットアップ

1) Firebase プロジェクト作成と SDK 設定生成

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap_firebase.ps1
```

Bash:

```bash
bash scripts/bootstrap_firebase.sh
```

2) 初回のみコンソールで手動作業

- Firestore データベース作成（ロケーション選択）
- Authentication の匿名ログインを有効化

3) ルールとインデックスを反映

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy_firestore.ps1
```

Bash:

```bash
bash scripts/deploy_firestore.sh
```

4) GitHub Pages の設定

- GitHub Pages の公開対象を `docs/` に設定

## 使い方

- 初回は「家族を作る」を押して家族IDを生成
- 共有したい端末には「招待リンク」を送る（`?family=...` 付き）
- 健診データを追加するとリアルタイムで反映
- 設定画面から JSON のエクスポート／インポートが可能

## ローカル確認

```bash
bash scripts/dev_server.sh
```

`http://localhost:8000` を開いて確認できます。

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev_server.ps1
```

## データ構造（Firestore）

- `families/{familyId}`
- `families/{familyId}/visits/{visitId}`

詳しくは `AGENTS.md` を参照してください。
