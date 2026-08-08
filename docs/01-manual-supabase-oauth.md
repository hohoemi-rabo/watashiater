# 01. Supabase・Google OAuth 準備（一部手作業）

- ステータス: 未着手
- 種別: Supabase 側は Claude が supabase MCP で実行。Google OAuth 設定のみユーザーの手作業
- 参照: REQUIREMENTS.md §2.1 / §5 / CLAUDE.md「環境変数の命名」「Git・外部ツール」
- 依存: なし

## 目的

app の認証（Google OAuth / Supabase Auth）と DB 接続に必要な外部サービスを準備する。

## Todo

### Claude が MCP で実行

- [ ] Supabase プロジェクトを作成（`create_project`。コスト確認を挟む）
- [ ] プロジェクト URL・anon キーを取得し `app/.env` に記入（`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`）
- [ ] `web/.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を記入（web 着手（20）までに済んでいればよい）

### ユーザーの手作業（MCP では不可）

- [ ] Google Cloud Console で OAuth クライアントを作成（Android 用＋Web 用）
- [ ] Supabase ダッシュボードで Auth の Google プロバイダを有効化・設定

## 完了条件

app から Supabase への接続とテストログインが通る状態（接続確認はチケット04の冒頭で行う）。

## メモ

（作業中の記録）
