# 実装チケット一覧

**番号順＝実装順**。書き手Web（24〜27）は 22・23 より先に実装し**完了済み**
（2026-08-13 ユーザー決定：iPhone の書き手向け PWA を先に用意する。Android のネイティブ版はそのまま）。
残りの実装順：**23**（28＝デザイン刷新まで完了済み）。
運用ルールは CLAUDE.md「チケット運用」を参照。

| # | チケット | フェーズ |
|---|---|---|
| 00 | [技術検証：録音＋手動テキスト](./00-tech-validation-recording.md) | 検証 |
| 01 | [Supabase・Google OAuth 準備（一部手作業）](./01-manual-supabase-oauth.md) | 準備 |
| 02 | [DBスキーマ＋RLS＋お題シード](./02-supabase-schema-rls.md) | 準備 |
| 03 | [app 基盤（フォント・共通UI・画面骨格）](./03-app-foundation.md) | app コア |
| 04 | [認証・オンボーディング](./04-app-auth-onboarding.md) | app コア |
| 05 | [ホーム＋お題一覧](./05-app-home-prompt-list.md) | app コア |
| 06 | [回答画面（テキスト）](./06-app-answer-text.md) | app コア |
| 07 | [【手作業】Cloudflare R2・Gemini 準備](./07-manual-cloudflare-gemini.md) | 準備 |
| 08 | [worker：JWT検証＋R2署名URL](./08-worker-signed-urls.md) | worker |
| 09 | [写真添付（圧縮・アップロード）](./09-app-photo-attach.md) | app メディア |
| 10 | [録音の保存](./10-app-recording.md) | app メディア |
| 11 | [worker：Gemini生成＋レート制限](./11-worker-ai-proxy.md) | worker |
| 12 | [じぶん史（生成・閲覧・編集）](./12-app-life-story.md) | app AI |
| 13 | [ギャラリー：机の上ボード](./13-app-gallery-board.md) | app ギャラリー |
| 14 | [ギャラリー：ならべかえ](./14-app-gallery-rearrange.md) | app ギャラリー |
| 15 | [写真が語る](./15-app-photo-speaks.md) | app ギャラリー |
| 16 | [共有：招待コード・家族・みたよ](./16-app-sharing-family.md) | app 共有 |
| 17 | [共有：閲覧専用URL](./17-app-view-link.md) | app 共有 |
| 18 | [せってい（ニックネーム・アカウント削除）](./18-app-settings.md) | app 仕上げ |
| 19 | [オフラインキャッシュ](./19-app-offline-cache.md) | app 仕上げ |
| 20 | [web：基盤（slug検証・noindex）](./20-web-foundation.md) | web |
| 21 | [web：閲覧ページUI](./21-web-viewer-ui.md) | web |
| 22 | [音声入力（音声認識）の実機検証・統合](./22-app-voice-input.md) | 実機検証 |
| 23 | [リリース準備（Google Play）](./23-release-prep.md) | リリース |
| 24 | [書き手Web：技術検証（録音・写真・ログイン）](./24-pwa-tech-validation.md) | 書き手Web（PWA） |
| 25 | [書き手Web：基盤（フォント・PWA・デプロイ）](./25-pwa-foundation.md) | 書き手Web（PWA） |
| 26 | [書き手Web：メディア実装の差し替え](./26-pwa-media.md) | 書き手Web（PWA） |
| 27 | [書き手Web：iPhone 通し確認](./27-pwa-iphone-e2e.md) | 書き手Web（PWA） |
| 28 | [デザイン刷新：背景・影のパレット変更](./28-design-refresh.md) | デザイン |
