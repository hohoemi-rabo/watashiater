# 20. web：基盤（slug検証・noindex）

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.6 / §6 末尾（slug 検証はサーバー側。anon キー直読み禁止） / DESIGN.md §12（トークン共有） / CLAUDE.md「アーキテクチャ」
- 依存: 08, 17

## 目的

閲覧 Web のデータ経路とページ土台を作る。見た目の作り込みはチケット21。

## Todo

- [x] Next.js テンプレートのサンプルページを削除
- [x] 全ページ noindex（metadata の robots 設定）
- [x] next/font で Zen Maru Gothic / Noto Sans JP / Shippori Mincho を導入し、CSS 変数経由で tailwind の fontFamily トークンに接続
- [x] `/w/[slug]`：サーバー側で slug を検証（service role キー使用）。無効・失効スラッグは404
- [x] 対象 subject の回答・写真・じぶん史・配置データの取得（サーバー側のみ）
- [x] worker から閲覧用署名URLを取得する経路（`WORKER_URL`。サーバー側で取得しクライアントへ渡す）

## 完了条件

有効な slug で博物館データ（生データ表示でよい）が表示され、無効 slug は404。service role キーがクライアントに漏れていない。

## メモ

### 設計判断

- **Supabase は素の fetch で読む**（`lib/supabase-server.ts`。`@supabase/supabase-js` を追加しない）。
  worker/src/supabase.ts と同型。必要なのは数本の SELECT だけで依存を増やす理由にならず、
  `database.types.ts` を web に複製せずに済む（行の型は「使う列だけの狭い型」を web 側に置く）。
  secret キーは **apikey ヘッダーのみ**で送る（新形式 `sb_secret_...` の仕様。worker と同じ）
- **認可はスラッグ照会の1行だけ**：service role キーは RLS をバイパスするので、
  「どの subject を読んでよいか」の判定は `lib/museum.ts` の `view_links?slug=…&is_active=is.true` に集約し、
  そこで得た subject_id 以外は読まない。ページ側は「null なら `notFound()`」だけを見る
- **slug の形式検証を DB 照会の前に置く**（`/^[a-z2-7]{16}$/`。app/lib/view-link.ts の生成規則と一対）。
  PostgREST と worker に不正な文字列を渡さない
- **`order=created_at.asc,id.asc` の id タイブレークは必須**。全順序でないと
  「同じ seed で毎回同じ配置」が壊れる（app/lib/board-layout.ts の契約。効いてくるのはチケット21）
- **署名URLの取得は `cache()` に含めない**：`getMuseumBySlug` は generateMetadata とページ本体から
  呼ぶので React の `cache()` でメモ化するが、期限つきの署名URLはメモ化対象にしない
- **worker 呼び出しは失敗しても throw しない**（`{}` を返す）。写真が出なくても回答本文と
  じぶん史は読める＝チケット19で確立した「見せるものがあるなら全滅させない」契約の閲覧Web版。
  URL が欠けた写真だけ「写真をよみこめませんでした」と出す
- **写真は `next/image` を使わず素の `<img>`**。署名URLは毎回変わり1時間で失効するため、
  URL をキーにする画像最適化キャッシュとは相性が悪い（毎回ミス＋課金）
- **`/` にページを置かない**（テンプレートの `app/page.tsx` を削除＝404）。閲覧Webに入口は要らない
- **404 と エラーの受け皿を自前で持つ**（`app/not-found.tsx` / `app/error.tsx`）。
  孫が LINE で受け取ったリンクを開く画面なので Next の素の画面を見せない。
  文言は「消えた」ではなく「いまは見られない」（DESIGN §10：終わりを連想させる語を避ける）
- **演目札の閲覧版は「書いたものだけ」**を並べる（未回答の空札を出さない）。
  アプリの一覧と違い、閲覧側に空札を見せると書き手の宿題を家族に晒すことになり、
  そこから書き始める導線も無いため

### next/font と日本語グリフ（重要）

`subsets` に `'japanese'` は**指定できない**（next 15.5 の font-data.json に3書体とも無い）。
しかし `subsets` は **プリロード対象の選択にしか使われず**、Google Fonts の CSS に載る
unicode-range 全ぶんのファイルは next/font が自前ホストする
（`node_modules/next/dist/compiled/@next/font/dist/google/find-font-files-in-css.js` で確認）。
したがって `subsets: ['latin']` で日本語は問題なく表示される。
日本語チャンク（1書体あたり100個以上）をプリロードしない今の挙動がむしろ望ましい。
ビルド後 `.next/static/media` に368ファイル生成されることを確認済み。

ウェイトは app/constants/tokens.ts と揃える：Zen Maru Gothic=700 / Noto Sans JP=可変（400・500を1セット）/
Shippori Mincho=400。

### ボーイスカウト修正

- `eslint.config.mjs` が eslint-config-next **16系**のフラット設定を直接 import する形で生成されており、
  固定バージョンの 15.5.22（eslintrc 形式しか配らない）では `npm run lint` がまったく動いていなかった
  （`ERR_MODULE_NOT_FOUND` → `nextVitals is not iterable`）。FlatCompat 経由に直し、
  `@eslint/eslintrc` を devDependency に明示追加（eslint の推移的依存に頼らない）

### 申し送り

- **`EXPO_PUBLIC_WEB_URL` は暫定値のまま**（`https://watashiater.vercel.app`）。
  Vercel デプロイは**チケット21の完了時**に行い、そこで実ドメインを確定させて
  app/.env・app/.env.example・docs/17・CLAUDE.md を更新する（2026-08-13 ユーザー判断。
  生データ表示の段階でデプロイしても得るものが少ないため）
- 生データ表示（写真の board 座標の数値併記など）はチケット21のボード実装で置き換える

### 検証結果

- `npm run build` / `npm run lint` / `npx tsc --noEmit` クリーン
- ローカル `npm run dev` に対する実データ疎通（2026-08-13。slug `kk76qg4pww5du2e4`＝回答8・写真7・録音4・じぶん史1）
  - `/w/<有効slug>` … 200／`<title>` にニックネーム／`robots: noindex, nofollow`／
    `<img>` 7個・`<audio>` 5個・「よみこめませんでした」0件（**署名URLは全件取得できた**）
  - 署名URLの実体 … 写真 200 `image/jpeg` 245,927 バイト／音声 200 `audio/mp4` 46,357 バイト
    （**worker の slug 経路が閲覧Webから通ることを確認**）
  - じぶん史・演目札8枚（sort_order 順）を描画
  - **404**：存在しないslug／短いslug／`../../etc/passwd`／`ABC%20DEF`／`/`／**無効化済みslug**（`3ilo7ms55xndm4qt`）
    …すべて404で、Next の既定404文言は出ず自前の文言が出る
- service role キー非漏洩（完了条件）
  - 本番ビルドの `.next` 全体を実キーで grep して0件（`.next/static` も `sb_secret` 0件）
  - `server-only` の効きを実測：`'use client'` のコンポーネントから `lib/museum.ts` を import すると
    **ビルドが失敗する**ことを一度作って確認し、確認用ファイルは削除済み
