# 08. worker：JWT検証＋R2署名URL

- ステータス: 完了
- 参照: REQUIREMENTS.md §5（worker の役割2「メディアの門番」） / §4.3（直リンク不可・有効期限） / CLAUDE.md 実装ルール5
- 依存: 07

## 目的

R2 への唯一の入口となる「メディアの門番」を作る。アップロードも閲覧も必ずここを通す。

## Todo

- [x] wrangler.jsonc に R2 バケットを設定（binding `MEDIA`。`cf-typegen` で型再生成済み。worker 名も `watashiater-worker` に確定）
- [x] Supabase JWT 検証の共通ミドルウェア（`src/auth.ts`。SUPABASE_JWT_SECRET ではなく**公開 JWKS・ES256** で検証 — docs/07 の確定事項）
- [x] アップロード用署名URL発行エンドポイント（`POST /media/upload-urls`。キー設計は subject 単位 — メモ参照、判断は `src/media.ts` のコメントに記載）
- [x] 閲覧用署名URL発行エンドポイント（`POST /media/view-urls`。本人・家族の JWT または有効な閲覧スラッグ）
- [x] 署名URLの実現方式 → **Worker 経由ストリーム＋自前HMACトークン**に決定（判断は `src/media.ts` 冒頭コメントに記載。メモ参照）
- [x] 有効期限付きであること・R2 直リンクでは取得できないことを確認（メモ参照）
- [x] vitest：JWT不正／期限切れ／無効スラッグ／正常系のテスト（36ケース。prefix-escape・サイズ超過・Range 206・304 等も網羅）

## 完了条件

app から安全にアップロード・閲覧できる API が揃い、`npm test -- --run` が通る。

## メモ

### 設計判断（2026-08-11）

- **署名URLの実現方式＝Worker 経由ストリーム＋自前HMACトークン**（S3互換 presign は不採用）。
  理由：R2 バインディングだけで完結し S3互換キーの発行・保管が不要／vitest-pool-workers の
  R2 シミュレーションで認可・期限切れ含むフル統合テストが書ける／`MEDIA.get(key, {range, onlyIf})`
  で Safari の `<audio>` に必須の Range（206）対応がほぼ無料。詳細は `src/media.ts` 冒頭コメント
- **R2 キー設計＝subject 単位プレフィックス** `subjects/<subject_id>/photos|recordings/<uuid>.<ext>`。
  認可単位が subject（家族・スラッグは subject 全体を閲覧）なのでプレフィックス一致だけで判定でき、
  アカウント削除も prefix 一括削除で完結する。answer との紐付けは DB 行が持つ
- 認可データは PostgREST を **sb_secret キー（`apikey` ヘッダーのみで送る。Authorization に入れない）**
  で照会。DB の private スキーマの判定関数は auth.uid() 前提のため REST からは再利用できない
- 有効期限：アップロード15分／閲覧1時間。Content-Type はサーバー側固定（`image/jpeg` / `audio/mp4`）

### テストで判明した実装上の注意

- miniflare は `get(key, { range: Headers })` で Range ヘッダーが無くても `object.range` を全域で
  埋めるため、**206 にするのは `request.headers.has("range")` のときだけ**にした
- R2 由来のボディストリームを消費しないと isolated storage の後始末が失敗する
  （テストでは `head()` を使うか必ず `arrayBuffer()` で消費）
- jose の JWKS はモジュール内にキャッシュされるため、fetchMock の JWKS モックは `.persist()` が必須

### デプロイ（2026-08-11）

- 本番 URL：**https://watashiater-worker.rabo-hohoemi.workers.dev**
  （チケット09の `EXPO_PUBLIC_WORKER_URL`・チケット20の `WORKER_URL` はこれを使う）
- シークレット設定済み：`SIGNING_SECRET` / `SUPABASE_SECRET_KEY`（`GEMINI_API_KEY` はチケット11で）
- 本番スモーク：未知パス404／認証なし upload-urls 401／無効スラッグ view-urls 403
  （403 は本番 PostgREST 疎通の証明。sb_secret キーは事前に curl で有効性確認済み）
- **直リンク不可を確認**：r2.dev の公開URLは無効・カスタムドメイン未接続。R2 への入口はこの worker のみ
- `npm audit` は dev 依存（esbuild/miniflare/wrangler/vitest-pool-workers の連鎖）の脆弱性を報告するが、
  いずれも開発時ツールで実行環境には乗らない。修正には各パッケージのメジャー更新が必要なため保留
