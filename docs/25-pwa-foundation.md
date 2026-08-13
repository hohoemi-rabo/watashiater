# 25. 書き手Web（PWA）：基盤（フォント・PWA・デプロイ）

- ステータス: 進行中
- 参照: REQUIREMENTS.md §3.7 / DESIGN.md §3（テーマ色）・§12（トークン） / CLAUDE.md「アーキテクチャ」
- 依存: 24

## 目的

書き手 Web を配れる土台を作る。iPhone で「ホーム画面に追加」すればアプリのように起動する状態まで。

## Todo

- [ ] フォント読み込みの Web 分岐：Web ではサブセット woff2 を使う（TTF 23MB を配らない）。app のネイティブ経路（useFonts＋サブパス import）は変えない
- [ ] PWA マニフェスト（名前「ワタシアター」・アイコン・`display: standalone`・テーマ色は tokens から）
- [ ] Service Worker（最小構成。**署名URLはキャッシュしない**原則を守る）
- [ ] `<title>` を「ワタシアター」にする（いまは Expo 既定の `app`）
- [x] Vercel に**新規プロジェクト**としてデプロイ（閲覧Web `watashiater` とは別。Expo の静的出力）→ チケット24 で先行。`watashiater-app`（https://watashiater-app.vercel.app）。`app/vercel.json` に build/output と SPA rewrite
- [x] `EXPO_PUBLIC_*` 環境変数のビルド時埋め込みを本番用に設定 → 24 で Production に4本登録ずみ。**Preview 環境は未登録**（CLI が対話を要求して入らなかった。GitHub 連携するときに入れる）
- [ ] Supabase の Redirect URLs に本番 URL を追加（ユーザー作業）→ 24 のログイン検証で依頼ずみ。済んだらここも [x] にする
- [ ] Vercel プロジェクトを GitHub 連携にする（24 は CLI からの直接デプロイ。main への push で自動デプロイにしたい）

## 完了条件

本番 URL をブラウザで開いて Google ログインができ、iPhone で「ホーム画面に追加」すると
standalone（アドレスバーなし）で起動する。

## メモ

（作業中の記録）
