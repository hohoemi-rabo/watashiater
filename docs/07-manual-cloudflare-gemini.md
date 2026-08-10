# 07.【手作業】Cloudflare R2・Gemini 準備

- ステータス: 完了
- 種別: 手作業（ユーザーのコンソール操作が必要。Claude は手順案内と設定値の確認を行う）
- 参照: REQUIREMENTS.md §5 / CLAUDE.md「環境変数の命名」
- 依存: なし（08 の直前までに完了していればよい）

## 目的

worker の2つの役割（AI生成プロキシ／R2署名URL発行）に必要な外部リソースを準備する。

## Todo

- [x] Cloudflare アカウントで R2 バケットを作成（`watashiater-media` / APAC / Standard。メモ参照）
- [x] R2 のアクセス方式に必要な認証情報を用意 → 07 では追加取得なし（wrangler は OAuth ログイン済みで、バインディング方式ならこれで足りる。S3互換キーが必要になった場合のみ 08 で取得）
- [x] Gemini API キーを取得（新形式 `AQ.` プレフィックスのキー。モデル一覧 API で有効性を確認済み）
- [x] Supabase ダッシュボードから JWT Secret を取得 → **不要と確定**（署名鍵は ECC P-256。メモ参照）
- [x] `worker/.dev.vars` に記入（`GEMINI_API_KEY` のみ。`SUPABASE_JWT_SECRET` は不要のためコメントで明記）
- [x] 本番用シークレットを設定 → **初回デプロイ時（08 or 11）に繰り延べ**（いま `wrangler secret put` を実行すると汎用名 `worker` のドラフト Worker が作られてしまう。Worker 名の確定と合わせて 08 で行う）

## 完了条件

worker のローカル開発（wrangler dev）に必要な値が揃っている。

## メモ

- **R2 を有効化しバケットを作成**（2026-08-11）。ユーザーがダッシュボードで R2 サブスクリプションを
  追加（無料枠：ストレージ10GB/月・クラスA 100万回/月・クラスB 1,000万回/月。超過分のみ課金）。
  バケットは Claude が CLI で作成：`wrangler r2 bucket create watashiater-media --location apac`
  （写真・音声を1バケットに集約しキーのプレフィックスで分ける方針。キー設計はチケット08）
- **SUPABASE_JWT_SECRET は不要と確定**（2026-08-11）。JWKS エンドポイント
  `https://shqkwdxpjnfnctatukqn.supabase.co/auth/v1/.well-known/jwks.json` が ES256（EC P-256）の
  公開鍵を返し、ダッシュボードでも現在の署名鍵が ECC P-256 であることをユーザーが確認済み。
  アクセストークンは非対称鍵で署名されるため、worker の JWT 検証は共有シークレットではなく
  **公開 JWKS で行う**（実装はチケット08。`.dev.vars.example`・CLAUDE.md 環境変数表の追随も08で行う）
- **ローカル開発の動作確認済み**（2026-08-11）。`wrangler dev` を起動し
  「Using secrets defined in .dev.vars」と `env.GEMINI_API_KEY` の読み込み、`http://localhost:8787`
  の応答（スキャフォールドの Hello World!）を確認。Gemini API キーは
  `GET /v1beta/models`（無料の読み取り）で HTTP 200 を確認済み。`.dev.vars` は gitignore され
  `git status` に現れないことも確認
