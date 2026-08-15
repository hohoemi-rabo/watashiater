# 23. リリース準備（Google Play）

- ステータス: 進行中
- 種別: 一部手作業（Google Play Console の操作にユーザーの協力が必要）
- 参照: REQUIREMENTS.md §1.1（禁止語彙） / §1.3（一般公開アプリ） / DESIGN.md §1
- 依存: 00〜22 の完了

## 目的

Google Play の内部テスト配信までを整える。

## Todo

- [x] アプリアイコン・スプラッシュ（DESIGN.md のトーン。マチネの明るさ）
- [x] app.json の整備（表示名・Android パッケージID・権限：マイク／写真）
- [ ] EAS Build で AAB を作成（preview APK はビルド済み。実機スモーク通過後に production AAB）
- [x] ストア掲載文の作成（**「終活」「メモリアル」「追悼」「遺す」等の葬送系語彙を使わない**。位置づけは「自分の博物館づくり」）→ docs/store-listing.md
- [x] プライバシーポリシーの用意（録音・写真・アカウント削除に触れる）→ https://watashiater.vercel.app/privacy
- [ ] Google Play Console で内部テスト配信

## 完了条件

内部テストトラックで実機インストール・動作確認ができる。

## メモ

### 決定事項（2026-08-15）

- **Android パッケージID**: `com.hohoemirabo.watashiater`（ユーザー決定。公開後変更不可）
- **name/slug/scheme**: スキャフォールドの `app` から `ワタシアター` / `watashiater` / `watashiater` へ変更。scheme 変更により**リリースビルドのログイン戻り先が `watashiater://` になる**（`makeRedirectUri()` が scheme から導く。Expo Go は従来どおり `exp://`）→ Supabase の Redirect URLs に `watashiater://**` の追加が必要
- **Android 用 OAuth クライアント（SHA-1）は作らない**：ログインはブラウザ経由 `signInWithOAuth` のまま（docs/01 の判断どおり）。ネイティブ `signInWithIdToken` に切り替える場合にのみ必要になる
- **連絡先メール**（掲載・ポリシー共通）: rabo.hohoemi@gmail.com
- スプラッシュ: 背景 #FFD6E8（sky-top）・dark 変種は削除（light 固定のアプリで黒スプラッシュは DESIGN §11 違反だった）
- 許可文言をチケット06の方針（日常漢字・分かち書きしない）に合わせて書き直した

### アイコン・ストア素材（gen-icons.mjs を拡張）

- PNG エンコーダに RGBA（color type 6）パスを追加し、舞台の絵をアスペクト・房数などでパラメータ化。**既存 PWA アイコン5点はバイト不変**（リファクタ検証済み）
- アダプティブアイコンの構成：background=パステル空グラデ（トークンそのまま）／foreground=安全領域（66/108 の円）内の**白フチつき丸バッジ**／monochrome=円から舞台開口部をくり抜いた白シルエット。全面絵を foreground にするとマスクで幕が欠けるため
- フィーチャーグラフィック（1024×500・テキストなし）は `docs/store/feature-graphic.png`（ビルド入力ではないので docs 配下）
- Play Console 用の 512×512 アイコンは `app/public/icons/icon-512.png` を流用

### EAS（2026-08-15 設定）

- プロジェクト: `@hohoemirabo/watashiater`（projectId は app.json の `extra.eas`）。Expo アカウントは hohoemirabo でログイン済みだった
- キーストアは初回ビルド時に**クラウドで自動生成**（EAS managed。ローカル keytool なし）。実体は EAS サーバー上＝アップロードキー。Play App Signing 前提
- `eas.json` の env に `EXPO_PUBLIC_*` 4変数を直書きした理由：`.env` は gitignore で EAS Build にアップロードされないため。4つとも JS バンドルに埋め込まれる公開前提の値なのでコミットして問題ない（eas.json はコメントを書けないのでここに記録）
- バージョンは `appVersionSource: "remote"`＋production の `autoIncrement`（app.json に versionCode を書かない）
- ビルドコマンド: `npx eas-cli build --platform android --profile preview`（実機スモーク用 APK）→ 通過後 `--profile production`（AAB）

### 将来の申し送り

- **製品版（一般公開）トラックへ進むには、新規個人デベロッパーアカウントは「テスター12人以上×14日間」のクローズドテスト実績が必要**。内部テスト（本チケットの完了条件）には不要
- EAS 無料枠はビルドキュー待ちが発生しうる

### 他チケットからの申し送り（リリースビルドでしか確認できないもの）

- **チケット19：オフラインのコールドスタート**。「最後のオンライン利用から1時間以上あけて機内モード → アプリを完全終了 → 起動 → ログイン画面に飛ばされず博物館（回答・じぶん史・写真）が見える」を確認する。Expo Go では機内モードでアプリを起動できず検証不可能だった（迂回策も不成立。理由は docs/19 検証結果）。あわせて「ログアウト → 機内モード → 起動 → onboarding が出る（前の人の博物館が残らない）」も確認する
