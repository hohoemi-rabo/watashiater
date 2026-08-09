# 04. 認証・オンボーディング

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.1 / §7-1 / DESIGN.md §7・§10（文言トーン）
- 依存: 01, 02, 03

## 目的

Google OAuth のみの認証と、初回起動フロー（説明→ログイン→ニックネーム→ホーム）を作る。

## Todo

- [x] supabase-js を導入し Google OAuth ログインを実装
- [x] 初回起動：3枚以内のかんたん説明 → ログイン → ニックネーム登録 → ホーム
- [x] 初回ログイン時に `subjects` レコードを作成（`subject_type`='self'）
- [x] セッション永続化と自動ログイン
- [x] ログイン失敗・通信エラー時のやさしい日本語表示
- [x] Supabase ダッシュボードの Redirect URLs に `exp://**` を追加（ユーザー作業）
- [x] 実機（Expo Go）でログイン→ニックネーム→ホーム→再起動の自動ログインを確認

## 完了条件

新規ユーザーがログイン→ニックネーム登録→ホーム到達でき、再起動時は自動ログインされる。

## メモ

### 実装構成

- `lib/supabase.ts`：唯一の共有クライアント。AsyncStorage 永続化＋AppState 連動で
  `startAutoRefresh()/stopAutoRefresh()`（RN 向けの Supabase 公式パターン）。
  env 未設定時は起動時に明確なエラーを投げる（新規クローン対策）
- `lib/auth-context.tsx`：`AuthProvider` / `useAuth()`。session と自分の subject を配る。
  ログインはブラウザ経由 OAuth：`signInWithOAuth`（`skipBrowserRedirect: true`）→
  `WebBrowser.openAuthSessionAsync` → 戻り URL のトークンで `setSession`
  （公式 createSessionFromUrl パターン。redirectTo は `makeRedirectUri()`）
- ガード（`app/_layout.tsx` の AuthGate）：未ログイン→`/onboarding`、
  ログイン済みで subject 未登録→`/nickname`。**subject 取得失敗時は誘導せず
  リトライ画面で止める**（通信失敗で既存ユーザーをニックネーム登録へ誤誘導しない）。
  ログイン済み＋登録済みは強制遷移なし（onboarding は「つかいかた」として閲覧可）
- ログイン成功直後の遷移はガード任せにせず onboarding 側で明示的に replace
  （リアクティブな取り合いを避ける）
- ブラウザを閉じただけ（dismissed）はエラー表示しない
- `settings` にログアウト（確認ダイアログつき）。テストと家族アカウント切替に必要な
  認証の最小機能として 04 の範囲に含めた
- ホームのカードタイトルを「◯◯さんの博物館」に（subject.nickname）

### Expo Go でのログインの仕組み（なぜ Redirect URLs 追加が要るか）

Expo Go はネイティブ Google Sign-In を使えないため、システムブラウザで
Google → Supabase コールバック → アプリへ戻る、という流れになる。この最後の
「アプリへ戻る」先が `exp://<開発機のIP>:8081` 形式で端末・ネットワークごとに変わるため、
Supabase の Authentication → URL Configuration → **Redirect URLs に `exp://**`
（ワイルドカード）を追加**しておく必要がある。未設定だとログイン後にアプリへ戻れない。
本番ビルド（チケット23）では `app://**`（app.json の scheme）を追加し、`exp://**` は
開発用として残すか判断する。

### 検証（2026-08-09・実機 Expo Go）

- 初回ログイン → ニックネーム登録 → ホーム到達 OK。subjects に行が作成されたことを MCP で確認
  （nickname・subject_type='self'。チケット01の完了条件「テストログインが通る」もこれで実証済み）
- アプリ再起動 → 自動ログインでホーム直行 OK
- ログアウト → 再ログイン → ニックネームを聞かれずホームへ OK
- せっていから「つかいかたを見る」（ログイン済みでの onboarding 閲覧）OK

### 実機テストで見つかったバグと修正（コミット 8e456b8）

ログアウト→再ログインで登録済みユーザーがニックネーム画面へ誤誘導された。
原因は、ログイン後の遷移判定が context の subject state（ボタン押下時点の古いクロージャ値
＝ログアウト直後の null）を読んでいたこと。修正は3段構え：

1. `signInWithGoogle` が**いま取得した結果**（`hasSubject`）を返し、遷移は必ずそれで判定
2. AuthGate に安全網：登録済みユーザーが `/nickname` に居たらホームへ返す
3. ニックネーム保存が unique 制約違反（23505）になったら、エラー表示ではなく
   既存 subject を読み直してホームへ（自己回復）

教訓：**setState 直後の判定に state を使わない**。非同期処理の直後の分岐は、その処理自身の
戻り値で行う。同種の場面（回答保存→遷移など後続チケット）でも同じ原則を守ること。
