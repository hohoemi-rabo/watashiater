# CLAUDE.md — ワタシアター プロジェクト指示

このリポジトリは「ワタシアター」のモノレポです。
仕様は **REQUIREMENTS.md**、見た目は **DESIGN.md** に従うこと。両方を必ず先に読むこと。

---

## ディレクトリ構成（この形にセットアップする）

```
watashiater/
├── CLAUDE.md
├── REQUIREMENTS.md
├── DESIGN.md
├── app/        ← Expo（書き手用 Androidアプリ）
├── web/        ← Next.js（閲覧専用Webページ）
└── worker/     ← Cloudflare Worker（AI生成プロキシ＋R2署名URL発行）
```

---

## バージョン固定（変更禁止）

| パッケージ | バージョン | 備考 |
|---|---|---|
| next | **15.5.22** | 16系にアップグレードしない |
| tailwindcss | **3.4.17** | **v4を使わない（重要・下記参照）** |
| react (web) | next 15.5.22 の peerDependencies に従う | |
| Expo SDK | セットアップ時点の最新安定版 | TypeScript テンプレート |

### Tailwind v3 の注意（最重要）

`create-next-app` のデフォルトは Tailwind **v4** を入れてくる。使わないこと。

- `create-next-app` は `--no-tailwind` で作成し、その後 **手動で v3.4.17 を導入**する：
  ```bash
  npm install -D tailwindcss@3.4.17 postcss autoprefixer
  npx tailwindcss init -p
  ```
- 設定は v3 方式（`tailwind.config.js` + `content` 配列 + `globals.css` に `@tailwind base/components/utilities`）
- `@import "tailwindcss";`（v4方式）を書かない
- DESIGN.md §3 のカラートークンは `tailwind.config.js` の `theme.extend.colors` に定義する

---

## セットアップ手順（この順番で）

```bash
# ① Expo アプリ
npx create-expo-app@latest app --template

# ② 閲覧Web（Tailwindなしで作成 → v3を手動導入）
npx create-next-app@latest web --typescript --app --no-tailwind --eslint
cd web && npm install next@15.5.22 && npm install -D tailwindcss@3.4.17 postcss autoprefixer && npx tailwindcss init -p && cd ..

# ③ Cloudflare Worker
npm create cloudflare@latest worker
```

実装の着手順も **app → worker → web**。
（appのローカル動作を先に作り、写真アップロード・AI生成が必要になった段階でworker、最後にweb）

---

## 環境変数の命名

| 場所 | 変数 |
|---|---|
| app (.env) | `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_WORKER_URL` |
| web (.env.local) | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（サーバー側のみ） / `WORKER_URL` |
| worker (wrangler secret) | `GEMINI_API_KEY` / `SUPABASE_JWT_SECRET` |

- APIキー類をクライアントコードに直書きしない
- `.env*` は `.gitignore` に含める（`.env.example` を各ディレクトリに置く）

---

## 実装ルール（要点の再掲）

1. **MVPスコープ厳守**：REQUIREMENTS.md §2.2 の項目（ペット・課金・通知・コメント・iOS・会話型AI）を実装しない。先回りの抽象化もしない（`subject_type` カラムのみ例外）
2. **デザイントークン**：DESIGN.md の色8・影3・フォント3・サイズ表を定数ファイル化し、生値ハードコード禁止。app と web でトークン値を一致させる
3. **文字サイズ変更機能を作らない**（DESIGN.md §11-3）
4. **UI文言は日本語・やさしい言葉**。REQUIREMENTS.md の文言（「みたよ」「ならべかえ」「じぶん史をつくる」）をそのまま使う
5. AI呼び出し・R2アクセスは必ず worker 経由。レート制限は 1日3回/ユーザー・JST 0時リセット
6. 迷ったら判断基準は「シニアの書き手が一人で迷わず使えるか」。判断内容はコードコメントに残す

## 技術検証を最初にやること

音声入力（テキスト化）と録音（expo-audio）の同時動作は端末依存の恐れがある。
**まず「録音＋手動テキスト」の2本立てで実装し、同時動作は実機検証後に統合する**（REQUIREMENTS.md §3.2）。
