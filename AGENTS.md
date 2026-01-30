# AGENTS.md — Twin Growth Tracker (GitHub Pages + Firebase/Firestore, CLI-first)

## 目的

双胎妊娠の健診データ（A/B）をスマホで入力・閲覧でき、夫婦の端末で自動同期するWebアプリを完成させる。
配布は GitHub Pages（/docs）で行う。サーバー構築はしない。
データは Firebase（Cloud Firestore）に保存し、匿名ログインで読み書きする（ログイン画面なし）。:contentReference[oaicite:2]{index=2}

家族コードは「0817」。暗号化はしない（コードが見られてもOK）。

---

## 絶対条件

- フロントは HTML / CSS / JavaScript のみ（フレームワークなし）
- GitHub Pages（/docs）で動く完成形を作る
- Firebase Authentication（Anonymous）を使用（ログイン画面なし）:contentReference[oaicite:3]{index=3}
- Cloud Firestore に保存し、リアルタイム同期（両端末で即反映）
- オフライン入力→復帰後同期（Firestoreのオフライン機能を使う）
- Firebase CLI 前提で、以下ファイルも生成する：
  - firebase.json
  - .firebaserc
  - firestore.rules
  - firestore.indexes.json
- エクスポート/インポート（JSON）を実装
- 体重差%（discordance）と前回比（g/日）を自動計算して表示

---

## 重要：CLIで「自動化できる所」と「できない所」

### CLIで自動化する（Codexがやる）

- `firebase projects:create` でFirebaseプロジェクト（=GCPプロジェクト）作成 :contentReference[oaicite:4]{index=4}
- `firebase apps:create` でWebアプリ作成 :contentReference[oaicite:5]{index=5}
- `firebase apps:sdkconfig web --json` でWeb設定（firebaseConfig）をJSONとして取得し、/docs/firebase-config.js を自動生成 :contentReference[oaicite:6]{index=6}
- `firebase init` で Firestore（rules/indexes）設定を作る :contentReference[oaicite:7]{index=7}
- `firebase deploy --only firestore:rules,firestore:indexes` でルールとインデックスを反映 :contentReference[oaicite:8]{index=8}

### 人が1回だけ触る（READMEに最短手順を書く）

- Firestore の「データベース作成（ロケーション選択）」：最初の1回必要になることがある :contentReference[oaicite:9]{index=9}
- Authentication の「匿名ログイン」を有効化：最初の1回必要 :contentReference[oaicite:10]{index=10}

※ここは隠さず、READMEで「ここだけやって」と明確に案内する。

---

## 画面（最小）

1) セットアップ
- 「家族を作る」：familyId を生成して保存
- 「家族に参加」：familyId を入力 or 招待リンク(?family=...)で参加
2) 一覧
- 日付/週数、A/Bの推定体重、体重差% を並べる
- 追加、エクスポート、インポート、設定へ行ける
3) 追加/編集
- Visit（健診）を入力
- AとBの計測値を入力
- 保存
4) 詳細/グラフ
- 詳細：差分、前回比、メモなど
- グラフ：推定体重（A/B）と体重差%

---

## データモデル（Firestore）

- families/{familyId}
  - createdAt, createdByUid
  - members: array<string>
  - lockCode: "0817"（誤操作防止用として置いてもよい）
- families/{familyId}/visits/{visitId}
  - date: "YYYY-MM-DD"
  - gaText: "22w1d"
  - cervixMm: number|null
  - memo: string
  - fetuses:
    - A: { bpdMm, ofdMm, hcMm, bpdGaText, bpdSd, acMm, acGaText, acSd, flMm, flGaText, flSd, efwG, efwGaText, efwSd }
    - B: { 同上 }
  - createdAt, updatedAt
  - createdByUid, updatedByUid

---

## 計算

- 体重差%（discordance）
  bigger = max(A.efwG, B.efwG)
  smaller = min(A.efwG, B.efwG)
  pct = bigger>0 ? ((bigger-smaller)/bigger)*100 : 0

- 前回比（g/日）
  直前のVisitとの差分 / 日数（小数は1桁程度に丸める）

---

## リポジトリ構成（必須）

GitHub Pages は /docs を公開対象にする。

/docs
  index.html
  styles.css
  app.js            (entry)
  firebase-config.js  (自動生成：firebase apps:sdkconfig の結果をJSに整形)
  firebase.js       (firebase初期化・API)
  store.js          (CRUD・購読)
  ui.js             (DOM描画)
  calc.js           (計算)
  chart.js          (グラフ: Chart.jsをCDN利用)
  manifest.json     (PWA)
  service-worker.js (静的資産キャッシュ)
  icons/...

/
  scripts/
    bootstrap_firebase.sh   (CLIでFirebase作成～設定生成まで)
    deploy_firestore.sh     (rules/indexes反映)
    dev_server.sh           (ローカル確認用)
  firebase.json
  .firebaserc
  firestore.rules
  firestore.indexes.json
  README.md
  AGENTS.md

---

## Firebase CLI 自動化（Codexが作るスクリプト仕様）

### scripts/bootstrap_firebase.sh

- 前提チェック：
  - firebase コマンドの存在確認
  - ログイン確認（必要なら `firebase login` を促す）:contentReference[oaicite:11]{index=11}
- projectId を決める：
  - できればリポジトリ名から生成（英小文字+数字+ハイフン）
  - 既に存在していたら別名候補を出す（末尾に数字）
- Firebaseプロジェクト作成：
  - `firebase projects:create <projectId> ...` を使用（オプションは `firebase projects:create --help` を見て確定する）:contentReference[oaicite:12]{index=12}
- そのプロジェクトを使う：
  - `firebase use --add <projectId>` で紐付け（.firebaserc に反映）
- Webアプリ作成：
  - `firebase apps:create web <nickname> --project <projectId>`（正確な引数は `--help` を見て確定）:contentReference[oaicite:13]{index=13}
- firebaseConfig 自動生成：
  - `firebase apps:sdkconfig web --project <projectId> --json` を使って取得し、/docs/firebase-config.js にJSとして書き出す :contentReference[oaicite:14]{index=14}
- `firebase init`（Firestore + (任意でHosting)）：
  - Firestoreの rules/indexes を生成する :contentReference[oaicite:15]{index=15}
- 最後に「人が1回だけやる所」を表示：
  - Firestoreのロケーション選択（未作成なら） :contentReference[oaicite:16]{index=16}
  - Authenticationの匿名ログイン有効化 :contentReference[oaicite:17]{index=17}

### scripts/deploy_firestore.sh

- `firebase deploy --only firestore:rules,firestore:indexes` を実行 :contentReference[oaicite:18]{index=18}

### scripts/dev_server.sh

- `python -m http.server 8000`（docsを確認できるよう案内）

---

## 生成する設定ファイル（Codexが作る）

### firebase.json（例）

{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "docs",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}

※Hostingは「将来Firebase Hostingに切り替える」ために置くだけ。今はGitHub Pagesを使う。

### .firebaserc（例）

{
  "projects": {
    "default": "REPLACE_WITH_YOUR_PROJECT_ID"
  }
}

### firestore.rules（例：簡単運用優先）

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    match /families/{familyId} {
      allow read, create, update: if signedIn();
      allow delete: if false;

      match /visits/{visitId} {
        allow read, write: if signedIn();
      }
    }

  }
}

### firestore.indexes.json（例）

{
  "indexes": [
    {
      "collectionGroup": "visits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}

---

## 実装上の要点（Codexが守る）

- Firebase SDK は公式CDN（ES Modules）で読む
- 起動時に匿名ログイン → familyIdが無ければセットアップへ :contentReference[oaicite:19]{index=19}
- familyId が URL クエリ `?family=` にあれば参加できる
- visits は date 降順で購読（リアルタイム同期）
- JSONエクスポート/インポート：
  - export: families/{familyId}/visits 全件をJSONでダウンロード
  - import: JSONを検証してFirestoreへ反映（重複は上書きでOK）
- localStorage：
  - ttt_family_id / ttt_lock_enabled / ttt_lock_code（初期0817）/ ttt_due_date

---

## README（Codexが書く：日本語）

READMEには以下を必ず書く：

- 前提：Node.js、firebase-tools（インストール方法含む）:contentReference[oaicite:20]{index=20}
- セットアップ（コマンドコピペ中心）
  - `bash scripts/bootstrap_firebase.sh`
  - （必要なら）コンソールで匿名ログインON
  - （必要なら）Firestore作成
  - `bash scripts/deploy_firestore.sh`
- GitHub Pagesの設定（/docs を公開）
- 夫婦共有の手順（招待リンクの使い方）

---

## 受け入れ基準（Done）

- GitHub Pages で /docs/index.html を開くとスマホで使える
- 夫の端末で作成→妻の端末で参加（招待リンク）→同じデータが見える
- Visit追加がリアルタイム反映する
- オフライン入力→復帰後同期する
- エクスポート/インポートが動く
- 体重差% と前回比が表示される
- READMEどおりの手順で再現できる

---

## Codexへの指示（重要）

追加の質問は極力しない。
CLIコマンドの引数が曖昧な場合は、`firebase <command> --help` の出力で確定してからスクリプトに組み込む。:contentReference[oaicite:21]{index=21}
迷ったら「最小で動く」方を選ぶ。
まず完成形を作り、見た目の微調整は後回し。
