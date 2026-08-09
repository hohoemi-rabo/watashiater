# 03. app 基盤（フォント・共通UI・画面骨格）

- ステータス: 進行中（実機での見た目・遷移確認まち）
- 参照: DESIGN.md §3〜§5（トークン・影・質感） / §9（アイコン） / REQUIREMENTS.md §7（画面一覧） / `app/constants/tokens.ts`
- 依存: なし（00 と並行可）

## 目的

全画面の土台になる共通UI（トークン参照のみで組む）と、expo-router の画面骨格を作る。

## Todo

- [x] Expo テンプレートのサンプル画面・コンポーネントを削除
- [x] @expo-google-fonts で Zen Maru Gothic / Noto Sans JP / Shippori Mincho を導入し、`tokens.ts` の fonts 名でロード
- [x] 背景グラデ（sky-top → sky-bottom）の共通レイアウトコンポーネント
- [x] 共通コンポーネント：カード（上辺1pxハイライト＋影3段階）／主ボタン（curtain-red・タップで沈む scale 0.98）／見出し・本文テキスト
- [x] REQUIREMENTS §7 の8画面の骨格（空画面＋遷移）を expo-router で作る
- [x] ラウンドライン系アイコン（lucide トーン）の導入
- [ ] 実機（Expo Go）で遷移・フォント・影の見た目を確認

## 完了条件

全画面が（中身は空でも）遷移でき、共通UIが生値ハードコードなしでトークンだけで組まれている。

## メモ

### ナビゲーション：タブではなく「ホーム＝ハブ＋Stack」

- DESIGN.md §7 のホーム定義（中央に進捗、下部にギャラリーへの入り口）はハブ型の記述で、
  REQUIREMENTS §4.1「1画面1目的」にも合う。タブバーは常時表示の小さなタップ領域になるため不採用
- ネイティブヘッダも不使用（headerShown: false）。各画面が共通の大きな「← もどる」
  （`components/back-button.tsx`、48dp以上）を持つ

### ルート構成（8画面 = REQUIREMENTS §7）

`index`（ホーム）/ `onboarding` / `prompts` / `answer/[promptId]`（'1'〜'10' | 'free'）/
`gallery` / `story` / `share` / `settings`。
onboarding へは settings の「つかいかたを見る」から到達（チケット04で初回起動フローに組み込む）。

### 共通コンポーネント

`sky-background`（空グラデ＋SafeArea）/ `app-text`（variant: screenTitle・cardTitle・body・
bodyMedium・caption・story）/ `app-card`（影3段階＋上辺1pxハイライト）/ `primary-button` /
`secondary-button` / `back-button`。すべて tokens 参照のみ。

- カードの「ベタの白矩形にしない」（DESIGN §5）は、カード地を cardWhite 85%＋skyBottom 15% の
  混色（#FFFEFC。トークン由来の導出値としてコメント記録）にし、上辺に cardWhite の 1px ラインを
  重ねる実装
- じぶん史画面だけ空グラデではなく story-paper のベタ＋Shippori Mincho（DESIGN §4 の例外指定）

### tokens.ts への追加（チケット00の申し送りの決着）

`spacing`（4/8/12/16/20/24/32）と `radii`（button 12 / card 16）を **app 側の実装規約**として追加。
DESIGN.md §3 の「web と値一致必須」の対象ではない（web は Tailwind 標準スケール）。

### フォント

- `@expo-google-fonts/*` の4書体（ZenMaruGothic_700Bold / NotoSansJP_400Regular /
  NotoSansJP_500Medium / ShipporiMincho_400Regular）。TTF 合計約23MB
- Expo Go ではネイティブ埋め込み（config plugin）が使えないため `useFonts` の実行時ロード。
  読み終わるまでスプラッシュ保持。オフライン閲覧要件（§4.2）的にも同梱が正しい
- 本番ビルド時は `expo-font` の config plugin への切り替えを検討してよい（起動が速くなる。チケット23）

### その他の判断

- `app.json` の `userInterfaceStyle` を `light` に固定（DESIGN §11「夜の劇場化」禁止。
  チケット00で見えていた「ダーク端末でタブバーだけ暗い」問題も解消）
- チケット00の仮画面（recording-check）・テンプレ一式・`scripts/reset-project.js`・
  未使用テンプレ画像を削除
- お題一覧はプレースホルダ10枚（実文言は DB が唯一の情報源。チケット05で取得）

### 検証（2026-08-09）

- `npx expo export --platform android` 成功（typed routes 再生成込み）
- `npx tsc --noEmit` / `npm run lint` クリーン
- 生値グレップ：`#`色コードは app-card の導出コメントのみ（実値はトークン由来）
- 実機確認：（実施後に記録）
