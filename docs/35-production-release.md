# 35. 製品版（一般公開）の申請

- ステータス: 進行中（審査まち／製品版アクセスの申請まち）
- 参照: docs/23-release-prep.md（ビルド・トラック・オプトインの手順とメモ）/ docs/store-listing.md / CLAUDE.md「リリース」「製品版への道のり」
- 依存: 29〜34・36・37 がすべて完了し、実機（Expo Go）で確認済みであること
- 由来: 2026-09-08 ユーザー方針「修正が終わったら本番申請作業に入る」

## 目的

クローズドテストの声を反映した修正版を配信し、Google Play の製品版アクセスを申請する。承認後に一般公開する。

## 進め方（順序）

1. **ビルド前の検査**：`npx expo-doctor`・`npx tsc --noEmit`・`npm run lint`・`npx expo export --platform android`。**アイコンは変わった**（チケット37）＝ビルド入力なのでこの版に載る。権限・package・scheme は不変。ネイティブ依存も増えていない（sharp は devDependencies でアプリには積まれない）
2. **production ビルド（AAB）**：`npx eas-cli build --platform android --profile production`。**EAS ビルドは実行前に必ずユーザーの許可を取る**（回数制限のある有料資源）。versionCode は EAS の remote 管理で自動的に 5 になる
3. **クローズドテストへ配信**：Alpha と 生徒テスト の両トラックに同じ AAB を上げる（どちらも同じテスターリスト。片方だけ更新すると versionCode が食い違う）。**オプトアウトやトラックの停止は絶対にしない**（12人×14日の実績がリセットされる）
4. **ストア掲載の更新**：`docs/store-listing.md` の変更（「自分史」表記）を Play Console に反映。**スクリーンショットは撮り直し**（画面の文言が変わったため。ホーム・お題・回答・ギャラリー・自分史・みんなに見せるの6枚目安。Expo Go ではなく配信ビルドで撮る）
5. **製品版へのアクセスを申請**：ダッシュボード → 製品版 → 製品版へのアクセスの申請。質問には「クローズドテストで得た声（幕の速さ・写真の入り口・LINE・文言）をこの版で直した」と具体的に答える
6. 承認後：製品版トラックへリリース → 重複しているクローズドトラックの整理（承認前には触らない）→ CLAUDE.md「現在地」を更新

## Todo

- [x] 1. ビルド前の検査（Claude）
- [x] 2. production ビルド（ユーザー許可 → Claude が実行）
- [x] 3. クローズドトラックへ配信（ユーザー：Play Console。2026-09-12 送信 → 審査中）
- [x] 4. 掲載文・アイコン・バナー・スクリーンショットの更新（ユーザー：Play Console。2026-09-12 審査へ送信）
- [ ] 5. 製品版アクセス申請（ユーザー：Play Console）
- [ ] 6. 承認後の製品版リリースとトラック整理、CLAUDE.md 更新

## 完了条件

Google Play で「ワタシアター」が一般公開され、ストアから誰でもインストールできる。

## メモ

### ビルド前の検査（2026-09-12）

`expo-doctor` が expo / expo-constants / expo-file-system のパッチずれを指摘したので
`npx expo install --fix` で揃えた（54.0.36→54.0.37 など）。チケット23で起動時クラッシュを
起こしたのと同じ種類のずれなので、AAB を切る前に解消しておく。そのうえで **18/18 通過**、
`tsc --noEmit`・`lint`・`expo export`（android / web）も通過。

### production ビルド（2026-09-12）

- versionCode: **4 → 5**（EAS の remote 管理で自動）／version: 1.0.0
- ビルド: https://expo.dev/accounts/hohoemirabo/projects/watashiater/builds/71565c8b-8942-4d6c-95cf-d973cc5ff9bf
- AAB: https://expo.dev/artifacts/eas/zWPmwYY0AvucGCbJEY_3oHxJ2BRdyI-r3GeA3xtnkto.aab
- キーストアは EAS の既存のもの（Build Credentials MoilovH8fC）＝署名は前回と同じ
- `.env` は EAS に上がらないので `EXPO_PUBLIC_*` は eas.json の env から入る（4件とも読まれたことをログで確認）

### この版に載っているもの

29〜34（幕の質感と速さ・拡大表示の幕・写真の枠タップ・LINEで送る・補助ボタンの枠・文言の全面改訂）／
36（戻るの固定とホームボタン）／37（新しいアイコン）／ログイン後のちらつき修正。

### スクリーンショットは Expo Go で撮ってよい

「配信ビルドで撮る」と書いていたが、29〜37 の変更はすべて JavaScript 側で、アイコンは
スクリーンショットに写らない。Expo Go の画面と配信ビルドの画面は同じなので、審査を待つ必要はない。
（2026-09-12 の実作業でそう判断した）

### ストアに出す素材の置き場所

| 用途 | ファイル | 形式 |
|---|---|---|
| アプリアイコン 512×512 | `docs/store/app-icon-512.png` | 32bit PNG（アルファあり）・542KB |
| フィーチャーグラフィック 1024×500 | `docs/store/feature-graphic.png` | 24bit PNG（アルファなし）・660KB |
| 掲載文 | `docs/store-listing.md` | |

**アプリ用の `app/public/icons/icon-512.png` を Play に出さないこと**：あちらはアプリを軽くするため
256色のパレット PNG にしてある。Play のアプリアイコンは 32bit PNG が条件なので弾かれうる。
ストア用は `docs/store/` の2枚（アプリに積まれないので重さを気にしなくてよい）。
バナーは透過を持たせない（全面不透明でもアルファが残っていると弾く検証系があるため落としてある）。

スクリーンショットは**撮り直しが必要**（文言が全面的に変わり、戻るボタンの位置も変わったため）。
Expo Go ではなく配信したビルドで撮る。
