# ワタシアター

「自分の博物館（劇場）をつくる」アプリ。固定のお題に答える形でエピソード・写真・声を残し、AIが「じぶん史」を紡ぐ。完成した博物館はURLひとつで家族に共有できる。

- 仕様: [REQUIREMENTS.md](./REQUIREMENTS.md)
- デザイン: [DESIGN.md](./DESIGN.md)
- 実装ルール: [CLAUDE.md](./CLAUDE.md)

## 構成（モノレポ）

| ディレクトリ | 内容 | 技術 |
|---|---|---|
| `app/` | 書き手用アプリ（Android先行） | Expo SDK 56 / TypeScript |
| `web/` | 閲覧専用Webページ（`/w/[slug]`） | Next.js 15.5.22 / Tailwind CSS 3.4.17 |
| `worker/` | AI生成プロキシ＋R2署名URL発行 | Cloudflare Workers / wrangler 4 |

バージョン固定: next **15.5.22**（16系に上げない）、tailwindcss **3.4.17**（v4を使わない）。詳細は CLAUDE.md 参照。

> **既知の技術的負債**: `npm audit` が next 15.5.22 同梱の postcss / sharp の脆弱性を報告するが、修正には next 16 への更新が必要なため対応不可（バージョン固定ルールによる意図的な妥協。2026-08-08 時点）。閲覧Webは信頼できないCSS/画像を処理しないため実影響は限定的。

## セットアップ

各ディレクトリで `npm install` を実行し、環境変数の例ファイルをコピーして値を設定する。

```bash
cd app && npm install && cp .env.example .env
cd web && npm install && cp .env.example .env.local
cd worker && npm install && cp .dev.vars.example .dev.vars
```

Worker の本番シークレットは `wrangler secret put GEMINI_API_KEY` / `wrangler secret put SUPABASE_JWT_SECRET` で設定する。

## 開発コマンド

```bash
cd app && npx expo start      # Expo 開発サーバー
cd web && npm run dev         # Next.js 開発サーバー
cd worker && npm run dev      # wrangler dev
cd worker && npm test         # Worker のテスト（vitest）
```

## デザイントークン

DESIGN.md のトークン（色8・影3・フォント3・サイズ表）は以下に定数化してあり、生値のハードコードは禁止。app と web で値を一致させること。

- app: `app/src/constants/tokens.ts`
- web: `web/tailwind.config.js`（`theme.extend`）
