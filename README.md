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

## ビルドと起動（確認方法）

- このアプリは `HTML/CSS/JavaScript` の静的アプリなので、ビルドは不要です
- `docs/` 配下をそのまま配信して動作します

### ローカル起動（簡易確認）

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev_server.ps1
```

Bash:

```bash
bash scripts/dev_server.sh
```

- `http://localhost:8000` を開いて確認できます

### Firebase Hosting でローカル確認

`firebase.json` の Hosting 設定（`public: docs`）で起動します。

```bash
firebase emulators:start --only hosting
```

- 表示URLは通常 `http://127.0.0.1:5000`（または `http://localhost:5000`）です
- 静的ファイルはローカル配信ですが、Firestore/Auth は通常どおり Firebase 本番プロジェクトを参照します

### Firebase Hosting へ本番デプロイ

`live` ターゲット（`twinrecho`）へデプロイする場合は、以下を実行します。

```bash
firebase deploy --only hosting:live
```

## 使い方

- 初回は「家族を作る」を押して家族コードを作成
- 共有したい端末には「招待リンク」を送る（`?family=...` 付き）
- 健診データを追加するとリアルタイムで反映
- 設定画面から JSON のエクスポート／インポートが可能

## データ構造（Firestore）

- `families/{familyId}`
- `families/{familyId}/visits/{visitId}`

詳しくは `AGENTS.md` を参照してください。
