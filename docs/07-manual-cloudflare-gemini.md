# 07.【手作業】Cloudflare R2・Gemini 準備

- ステータス: 未着手
- 種別: 手作業（ユーザーのコンソール操作が必要。Claude は手順案内と設定値の確認を行う）
- 参照: REQUIREMENTS.md §5 / CLAUDE.md「環境変数の命名」
- 依存: なし（08 の直前までに完了していればよい）

## 目的

worker の2つの役割（AI生成プロキシ／R2署名URL発行）に必要な外部リソースを準備する。

## Todo

- [ ] Cloudflare アカウントで R2 バケットを作成
- [ ] R2 のアクセス方式に必要な認証情報を用意（S3互換キー or バインディング。方式の確定はチケット08で行い、必要になったものを追加取得）
- [ ] Gemini API キーを取得
- [ ] Supabase ダッシュボードから JWT Secret を取得
- [ ] `worker/.dev.vars` に `GEMINI_API_KEY` / `SUPABASE_JWT_SECRET` を記入
- [ ] 本番用シークレットを設定：`wrangler secret put GEMINI_API_KEY` / `wrangler secret put SUPABASE_JWT_SECRET`（初回デプロイ時でも可）

## 完了条件

worker のローカル開発（wrangler dev）に必要な値が揃っている。

## メモ

（作業中の記録）
