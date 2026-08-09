# 01. Supabase・Google OAuth 準備（一部手作業）

- ステータス: 完了
- 種別: Supabase 側は Claude が supabase MCP で実行。Google OAuth 設定のみユーザーの手作業
- 参照: REQUIREMENTS.md §2.1 / §5 / CLAUDE.md「環境変数の命名」「Git・外部ツール」
- 依存: なし

## 目的

app の認証（Google OAuth / Supabase Auth）と DB 接続に必要な外部サービスを準備する。

## Todo

### Claude が MCP で実行

- [x] Supabase プロジェクトを作成（`create_project`。コスト確認を挟む）
- [x] プロジェクト URL・anon キーを取得し `app/.env` に記入（`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`）
- [x] `web/.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を記入（web 着手（20）までに済んでいればよい）※URL のみ記入。service キーは MCP で取得不可のため空欄（メモ参照）

### ユーザーの手作業（MCP では不可）

- [x] Google Cloud Console で OAuth クライアントを作成（Web 用のみ。Android 用は延期 → メモ参照）
- [x] Supabase ダッシュボードで Auth の Google プロバイダを有効化・設定

## 完了条件

app から Supabase への接続とテストログインが通る状態（接続確認はチケット04の冒頭で行う）。

## メモ

### 作成したプロジェクト（2026-08-09）

- 名前: `watashiater` / ref: `shqkwdxpjnfnctatukqn` / リージョン: `ap-northeast-1`（東京）
- 組織: `create-hohoemi`。無料枠（$0/月、`get_cost`→`confirm_cost` を経て作成）
- Postgres 17（GA チャネル）。作成直後から ACTIVE_HEALTHY
- URL: `https://shqkwdxpjnfnctatukqn.supabase.co`

### API キーの形式

- `app/.env` の `EXPO_PUBLIC_SUPABASE_ANON_KEY` には**新形式の publishable キー**（`sb_publishable_...`）を記入した。legacy の anon JWT も有効だが、新規アプリには publishable が推奨（ローテーション独立・supabase-js はどちらも受け付ける）。環境変数名は CLAUDE.md の規約どおり据え置き
- **service role / secret キーは MCP では取得できない**。`web/.env.local` は URL のみ記入し、キーはチケット20（web 着手）までにユーザーがダッシュボード（Project Settings → API Keys）から貼る
- worker（チケット08）が使う `SUPABASE_JWT_SECRET` も同様にダッシュボードから取得する（08 の段階で対応）

### Android 用 OAuth クライアントを作らない判断

チケット原文は「Android 用＋Web 用」だったが、**Web 用のみ**に変更した。

- Android 用クライアント（SHA-1 指紋つき）が要るのはネイティブ Google Sign-In（`signInWithIdToken`）だけで、これは **Expo Go では動かない**（カスタムネイティブモジュールが必要）
- 本プロジェクトは Expo Go 実機検証が前提（CLAUDE.md「既知の注意点」）のため、チケット04 のログインはブラウザ経由の `signInWithOAuth`（expo-web-browser）で実装する。この方式で必要なのは Web クライアントのみ
- リリースビルド（チケット23）でネイティブサインインに切り替えたくなった場合にのみ、Android クライアントを追加する

### ユーザーへ依頼した手順（Google OAuth）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを用意（新規作成でよい。例: `watashiater`）
2. 「API とサービス」→「OAuth 同意画面」: External / アプリ名・サポートメールを設定（テスト公開のままでよい）
3. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ 種類「**ウェブ アプリケーション**」
   - 承認済みのリダイレクト URI: `https://shqkwdxpjnfnctatukqn.supabase.co/auth/v1/callback`
4. 発行されたクライアント ID とシークレットを、[Supabase ダッシュボード](https://supabase.com/dashboard/project/shqkwdxpjnfnctatukqn/auth/providers) → Authentication → Sign In / Providers → Google に貼って有効化（Save）

→ 2026-08-09 ユーザーが設定完了を報告。実際のテストログインはチケット04冒頭で確認する（完了条件のとおり）。
