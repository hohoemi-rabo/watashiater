# 03. app 基盤（フォント・共通UI・画面骨格）

- ステータス: 未着手
- 参照: DESIGN.md §3〜§5（トークン・影・質感） / §9（アイコン） / REQUIREMENTS.md §7（画面一覧） / `app/src/constants/tokens.ts`
- 依存: なし（00 と並行可）

## 目的

全画面の土台になる共通UI（トークン参照のみで組む）と、expo-router の画面骨格を作る。

## Todo

- [ ] Expo テンプレートのサンプル画面・コンポーネントを削除
- [ ] @expo-google-fonts で Zen Maru Gothic / Noto Sans JP / Shippori Mincho を導入し、`tokens.ts` の fonts 名でロード
- [ ] 背景グラデ（sky-top → sky-bottom）の共通レイアウトコンポーネント
- [ ] 共通コンポーネント：カード（上辺1pxハイライト＋影3段階）／主ボタン（curtain-red・タップで沈む scale 0.98）／見出し・本文テキスト
- [ ] REQUIREMENTS §7 の8画面の骨格（空画面＋遷移）を expo-router で作る
- [ ] ラウンドライン系アイコン（lucide トーン）の導入

## 完了条件

全画面が（中身は空でも）遷移でき、共通UIが生値ハードコードなしでトークンだけで組まれている。

## メモ

（作業中の記録）
