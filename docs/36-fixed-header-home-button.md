# 36. 「戻る」を画面上部に固定し、深い画面に「ホーム」を足す

- ステータス: 完了
- 参照: REQUIREMENTS.md §4.1（1画面1目的・タップターゲット48dp以上）/ DESIGN.md §7（各画面）。実装は新規 `app/components/screen-header.tsx` と、`BackButton` を使っている13画面
- 依存: なし（34 のあと）
- 由来: 2026-09-12 ユーザー指摘「一つのお題を書いてギャラリーで確認したいとき、戻るを何回か押さないといけない」「戻るボタンは固定したほうがいいのでは」

## 目的

**移動が遠い**：全画面が1枚ずつ積み重なる構造で、`BackButton` は `router.back()` を1回ぶんしか戻らない。
回答画面からギャラリーまで3タップ（戻る → ホーム → ギャラリー）かかる。

**戻るが画面から消える**：`BackButton` はスクロールの中にあるので、長い画面（回答・自分史・
みんなに見せる・設定）で下まで読むと画面から消える。Android の戻るジェスチャーを知らない人は
行き止まりに感じる。

## 決定事項（2026-09-12 ユーザー確認済み）

- **「戻る」を画面上部に固定する**（スクロールの外へ出す）。対象は `BackButton` を使う全画面
- **2階層目より深い画面には「ホーム」を戻るの隣に置く**。これでどの画面からもホームへ1タップ、
  ギャラリーまで2タップになる
- **画面下のメニュー帯（タブ）は作らない**。「1画面1目的」というこのアプリの作りから大きく外れ、
  クローズドテスト中の生徒さんにとって見た目の変化が大きすぎる
- 1階層目の画面（お題一覧・ギャラリー・自分史・みんなに見せる・設定・家族の博物館）に
  「ホーム」は**置かない**。戻る＝ホームなので二重になる

## 実装方針

- `components/screen-header.tsx`：`ScreenHeader({ showHome })`。中は `BackButton` と「ホーム」を
  横に並べた行。`showHome` が無いときは戻るが今までどおり横幅いっぱい＝見た目を変えない
- **深さは props で明示する**（ナビゲーション状態から推測しない）。どの画面が深いかはコードを読んで
  分かるほうがよい
- 「ホーム」は `router.dismissAll()`＝スタックの根に戻す。**書き手の根は `/`、家族だけの人の根は
  `/family`**（`_layout.tsx` の AuthGate が subject 無しなら `/family` へ replace する）ので、
  行き先を決め打ちにせず `dismissAll` に任せると両方で正しくなる。`canDismiss()` が false のときだけ
  `replace` で補う
- 置き場所はスクロールの外。各画面の `contentContainerStyle` の上余白を、ヘッダーに移したぶん調整する

### 「ホーム」を出す画面

| 画面 | 深さ |
|---|---|
| `answer/[promptId]` | 2 |
| `family/[subjectId]/index` | 2 |
| `family/[subjectId]/gallery` / `story` / `prompts` | 3 |
| `join` | 2 |
| `onboarding`（設定からの「使い方」。`session` があるときだけ戻るを出している） | 2 |

## Todo

- [x] `components/screen-header.tsx`（戻る＋ホームの行。dismissAll の判断をコメントに残す）
- [x] 1階層目の画面をヘッダー固定に差し替え：`prompts` / `gallery` / `story` / `share` / `settings` / `family/index`
- [x] 2階層目以降を差し替え＋`showHome`：`answer/[promptId]`（読み込み失敗・お題なし・通常の3か所）/ `family/[subjectId]/*` / `join` / `onboarding`
- [x] `gallery` は `DeskBoard`＋自前 inset、`story` は自前 SafeAreaView＋編集モードがあるので個別に確認
- [x] `components/back-button.tsx` は参照が無くなったので削除
- [x] `npx tsc --noEmit`・`npm run lint`・`npx expo export`（android / web）
- [x] DESIGN.md §7 に「戻るは上部固定。深い画面はホームを併記」を追記
- [x] 実機（Expo Go）で確認：長い画面で下までスクロールしても戻るが見える／回答画面からホーム1タップ／家族だけの人はホームが `/family` に戻る

## 完了条件

どの画面でも「戻る」が画面上部に見えたままで、2階層目より深い画面では「ホーム」が隣にある。
回答画面からギャラリーまで2タップで行ける。家族としてだけ使っている人の「ホーム」は家族の一覧に戻る。

## メモ

**2026-09-12 実機（Expo Go・Android）で確認ずみ＝OK**。戻るの固定・ホームの併記・余白とも
指摘なし。ギャラリー2画面の戻るが流れる件は残したまま（下記）。

### `BackButton` は削除した

全画面が `ScreenHeader` を通すようになり、`components/back-button.tsx` は参照が無くなったので消した
（使われていないコードを残さない）。戻る1つだけの画面でも `ScreenHeader` は横幅いっぱいの
「戻る」を出すので、見た目は今までと変わらない。

### 上余白の付け替え

「戻る」を ScrollView の外へ出したぶん、上余白の持ち主が変わる。ヘッダーが `paddingTop: spacing.xl`
を持ち、本文側の `content` には `paddingTop: spacing.xxl`（＝以前の「戻る」と見出しの間）を明示した。
`padding: spacing.xl` の後ろに書くので上だけ上書きされる。

### 個別に手を入れた画面

- `story.tsx`：閲覧モードが `<ScrollView>` 1つだけの三項分岐だったので、ヘッダーを足すために
  フラグメントで包んだ
- `gallery.tsx` / `family/[subjectId]/gallery.tsx`：もともと木目を敷くために ScrollView の中へ
  ヘッダー行を置いている（`DeskGrain` を写真と一緒にスクロールさせる都合。docs/13）。
  ここは構造を変えず `ScreenHeader` に差し替えただけ＝**この2画面だけ戻るがスクロールで流れる**。
  木目の敷き方と一緒に直す必要があるので、気になるようなら別途
- `onboarding.tsx`：ログイン前は戻る先が無いので、`session` があるときだけヘッダーごと出す
