# 25. 書き手Web（PWA）：基盤（フォント・PWA・デプロイ）

- ステータス: 未着手
- 参照: REQUIREMENTS.md §3.7 / DESIGN.md §3（テーマ色）・§12（トークン） / CLAUDE.md「アーキテクチャ」
- 依存: 24

## 目的

書き手 Web を配れる土台を作る。iPhone で「ホーム画面に追加」すればアプリのように起動する状態まで。

## Todo

- [ ] フォント読み込みの Web 分岐：Web ではサブセット woff2 を使う（TTF 23MB を配らない）。app のネイティブ経路（useFonts＋サブパス import）は変えない
- [ ] PWA マニフェスト（名前「ワタシアター」・アイコン・`display: standalone`・テーマ色は tokens から）
- [ ] Service Worker（最小構成。**署名URLはキャッシュしない**原則を守る）
- [ ] Vercel に**新規プロジェクト**としてデプロイ（閲覧Web `watashiater` とは別。Expo の静的出力）
- [ ] `EXPO_PUBLIC_*` 環境変数のビルド時埋め込みを本番用に設定
- [ ] Supabase の Redirect URLs に本番 URL を追加（ユーザー作業）

## 完了条件

本番 URL をブラウザで開いて Google ログインができ、iPhone で「ホーム画面に追加」すると
standalone（アドレスバーなし）で起動する。

## メモ

（作業中の記録）
