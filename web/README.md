# ワタシアター 閲覧Web

家族が URL だけで博物館を見るための、**閲覧専用**の Next.js アプリ。
書き手用アプリ（`app/`）が発行した「見せる用リンク」`/w/<slug>` を開く先。

仕様は リポジトリルートの **REQUIREMENTS.md**、見た目は **DESIGN.md**、
運用は **CLAUDE.md** に従う。

## 起動

```bash
npm install
npm run dev      # http://localhost:3000/w/<slug>
npm run build    # 本番ビルド（動作検証にも使う）
npm run lint
npx tsc --noEmit
```

`/` にページは無い（閲覧Webに入口は要らないため意図的に404）。

## 環境変数（`.env.local`）

`.env.example` をコピーして作る。**コミットしない**。

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバー側のみ**。ダッシュボード → Project Settings → API Keys の secret キー（`sb_secret_...`） |
| `WORKER_URL` | Cloudflare Worker（閲覧用署名URLの発行元） |

## 作りの要点

- **Server Components が既定**。`'use client'` は操作が必要な末端だけに付ける
- 閲覧URLはログインしない相手が開くので RLS を当てる主体がいない。
  **Next.js サーバー側で slug を検証し、service role キーで読む**（anon キーでの直接読み取り禁止）。
  検証と読み取りは `lib/museum.ts` の `getMuseumBySlug()` 1本に閉じている
- `SUPABASE_SERVICE_ROLE_KEY` を触るモジュール（`lib/supabase-server.ts` / `lib/museum.ts` /
  `lib/worker-api.ts`）は `server-only` を import している。クライアントから import すると**ビルドが失敗する**
- 写真・音声は R2 に直リンクできない。`lib/worker-api.ts` が worker に slug を渡して
  **署名付きURL（有効期限1時間）** を取る。**Authorization ヘッダーを付けないこと**
  （worker は「ヘッダーがあれば JWT 経路・無ければ slug 経路」で分岐しフォールバックしない）
- 署名付きURLはキャッシュしない。写真は `next/image` を通さず素の `<img>` で出す
  （URL が毎回変わるため画像最適化キャッシュと相性が悪い）
- **全ページ noindex**（`app/layout.tsx` の `metadata.robots`。REQUIREMENTS §3.6）
- 色・影・フォント・サイズは `tailwind.config.js` のトークンから引く（生値のハードコード禁止）。
  値は `app/constants/tokens.ts` と一致させること（DESIGN.md §12）

## バージョン固定（変更禁止）

- **next 15.5.22**（16 系に上げない）
- **tailwindcss 3.4.17**（v4 を使わない。`@import "tailwindcss";` と書かない）

`npm audit` が next 15.5.22 同梱の postcss / sharp の脆弱性を報告するが、
修正には next 16 が必要なため対応しない（意図的な妥協）。
