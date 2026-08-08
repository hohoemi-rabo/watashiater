# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このリポジトリは「ワタシアター」（60〜80代シニアが自分の博物館を作るアプリ）のモノレポ。
仕様は **REQUIREMENTS.md**、見た目は **DESIGN.md** に従うこと。両方を必ず先に読むこと。

---

## 構成（セットアップ済み）

3つの**独立した npm プロジェクト**。ルートに package.json はない（workspaces 不使用）。コマンドは必ず各ディレクトリ内で実行する。

| ディレクトリ | 役割 | 技術 |
|---|---|---|
| `app/` | 書き手用アプリ（Android 先行） | Expo SDK 57 / expo-router / TypeScript。コードは `src/` 配下、エイリアス `@/*` → `src/*` |
| `web/` | 閲覧専用 Web（`/w/[slug]`。家族が URL で見るだけ） | Next.js 15.5.22 App Router / Tailwind CSS 3.4.17 |
| `worker/` | AI 生成プロキシ＋R2 署名 URL 発行 | Cloudflare Workers / wrangler 4 / vitest |

実装の着手順は **app → worker → web**（app のローカル動作を先に作り、写真アップロード・AI 生成が必要になった段階で worker、最後に web）。

## 開発コマンド

```bash
# app/
npm start                     # Expo 開発サーバー（npm run android で Android 起動）
npm run lint                  # expo lint
npx tsc --noEmit              # 型チェック

# web/
npm run dev                   # 開発サーバー
npm run build                 # 本番ビルド（動作検証にも使う）
npm run lint                  # eslint

# worker/
npm run dev                   # wrangler dev（.dev.vars を読む）
npm test -- --run             # vitest を1回実行（watch にしない）
npx vitest run test/index.spec.ts   # 単一テスト
npm run cf-typegen            # wrangler.jsonc 変更後に型を再生成
npm run deploy                # wrangler deploy
```

- app の型チェックには `expo-env.d.ts`（CSS モジュール等の型宣言。gitignore 対象）が必要。無ければ `expo start` を一度起動すると自動生成される

---

## チケット運用（docs/）

実装は `docs/` の連番チケットに沿って進める。**番号順＝実装順**（一覧は docs/README.md）。

- 着手前に、チケットの「参照」が指す REQUIREMENTS.md / DESIGN.md の該当節を必ず読む
- 各チケットの Todo は `- [ ]` で管理し、**完了したら `- [x]` に書き換える**。ファイル冒頭のステータス行（未着手／進行中／完了）も随時更新する
- 仕様をチケットに書き写さない。REQUIREMENTS.md / DESIGN.md が唯一の情報源（チケットは参照＋Todo＋完了条件のみ）
- 【手作業】チケット（01・07）はユーザーのコンソール操作が必要。該当番号に来たら作業を依頼して完了を待つ
- 実装中に生じた検証結果・設計判断は該当チケットの「メモ」「検証結果」節に追記する

---

## バージョン固定（変更禁止）

| パッケージ | バージョン | 備考 |
|---|---|---|
| next | **15.5.22** | 16 系にアップグレードしない |
| tailwindcss | **3.4.17** | **v4 を使わない（重要・下記参照）** |
| react (web) | next 15.5.22 の peerDependencies に従う | |
| Expo SDK | 57（導入済み） | |

### Tailwind v3 の注意（最重要）

- 設定は v3 方式（`tailwind.config.js` + `content` 配列 + `globals.css` に `@tailwind base/components/utilities`）
- `@import "tailwindcss";`（v4 方式）を書かない
- DESIGN.md §3 のカラートークンは `tailwind.config.js` の `theme.extend.colors` に定義済み

---

## アーキテクチャ

### データフロー（全体像）

- **認証・DB**: Supabase（Google OAuth / Postgres / RLS）。Supabase Storage は使わない
- **メディア（写真・音声）**: Cloudflare R2。クライアントから直接触らせない。アップロードも閲覧も必ず worker が発行する**署名付き URL** 経由
- **AI（Gemini）**: worker 経由のみ。レート制限は 1日3回/ユーザー・JST 0時リセット
- **worker の役割はこの2つだけ**（AI 生成プロキシ／R2 署名 URL 発行）。それ以外を持たせない
- **認可の2経路**: app は Supabase JWT を worker に渡して検証させる。web の閲覧 URL（`/w/[slug]`）は Next.js サーバー側で slug を検証して service role キーで読む（anon キーでの直接読み取り禁止）。閲覧 Web は全ページ noindex
- データモデルの意図は REQUIREMENTS.md §6 に固定済み（subjects / prompts / answers / recordings / photos / life_story / family_members / invite_codes / view_links / reactions）

### デザイントークン（二重管理・値の一致必須）

- app: `app/src/constants/tokens.ts`
- web: `web/tailwind.config.js` の `theme.extend`

DESIGN.md の色8・影3・フォント3・サイズ表を定数化してある。生値のハードコード禁止。片方を変えたら必ずもう片方も合わせる（フォントサイズのスケールだけは DESIGN.md §4 の指定でアプリと Web が意図的に別）。

---

## 環境変数の命名

| 場所 | 変数 |
|---|---|
| app (.env) | `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_WORKER_URL` |
| web (.env.local) | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（サーバー側のみ） / `WORKER_URL` |
| worker | ローカルは `.dev.vars`（`.dev.vars.example` をコピー）。本番は `wrangler secret put GEMINI_API_KEY` / `wrangler secret put SUPABASE_JWT_SECRET` |

- API キー類をクライアントコードに直書きしない。各ディレクトリの `.env.example` / `.dev.vars.example` だけをコミットする
- ルートの `.mcp.json` は Supabase アクセストークンを含むため gitignore 済み。コミットしないこと

---

## 実装ルール（要点の再掲）

1. **MVP スコープ厳守**：REQUIREMENTS.md §2.2 の項目（ペット・課金・通知・コメント・iOS・会話型 AI）を実装しない。先回りの抽象化もしない（`subject_type` カラムのみ例外）
2. **デザイントークン**：上記の定数ファイルから参照する。生値ハードコード禁止
3. **文字サイズ変更機能を作らない**（DESIGN.md §11-3）
4. **UI 文言は日本語・やさしい言葉**。REQUIREMENTS.md の文言（「みたよ」「ならべかえ」「じぶん史をつくる」）をそのまま使う
5. AI 呼び出し・R2 アクセスは必ず worker 経由。レート制限は 1日3回/ユーザー・JST 0時リセット
6. 迷ったら判断基準は「シニアの書き手が一人で迷わず使えるか」。判断内容はコードコメントに残す

## 技術検証を最初にやること

音声入力（テキスト化）と録音（expo-audio）の同時動作は端末依存の恐れがある。
**まず「録音＋手動テキスト」の2本立てで実装し、同時動作は実機検証後に統合する**（REQUIREMENTS.md §3.2）。

---

## 既知の注意点

- `worker/wrangler.jsonc` の `compatibility_date` はローカル workerd の対応上限（2026-03-10）に合わせてある。無闇に上げない（テストで警告が出て本番と挙動が乖離する）
- `npm audit` が next 15.5.22 同梱の postcss / sharp の脆弱性を報告するが、修正には next 16 が必要なため対応不可（意図的な妥協。README 参照）
- `app/AGENTS.md`（Expo SDK 57 ドキュメント参照）と `worker/AGENTS.md`（Cloudflare 向け）はスキャフォールド生成物で有効。web 側の AGENTS.md は Next 16 向けの内容だったため削除済み — 復活させない
