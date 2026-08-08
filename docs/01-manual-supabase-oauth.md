# 01.【手作業】Supabase・Google OAuth 準備

- ステータス: 未着手
- 種別: 手作業（ユーザーのコンソール操作が必要。Claude は手順案内と設定値の確認を行う）
- 参照: REQUIREMENTS.md §2.1 / §5 / CLAUDE.md「環境変数の命名」
- 依存: なし

## 目的

app の認証（Google OAuth / Supabase Auth）と DB 接続に必要な外部サービスを準備する。

## Todo

- [ ] Supabase プロジェクトを作成
- [ ] Google Cloud Console で OAuth クライアントを作成（Android 用＋Web 用）
- [ ] Supabase Auth の Google プロバイダを有効化・設定
- [ ] `app/.env` に `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` を記入
- [ ] `web/.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を記入（web 着手（20）までに済んでいればよい）

## 完了条件

app から Supabase への接続とテストログインが通る状態（接続確認はチケット04の冒頭で行う）。

## メモ

（作業中の記録）
