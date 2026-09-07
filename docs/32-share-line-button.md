# 32. みんなに見せる：「LINEで送る」を LINE 色の直通ボタンに

- ステータス: 未着手
- 参照: REQUIREMENTS.md §3.5（共有）/ DESIGN.md §3 使い方のルール（本チケットで補助色 `line-green` を追加）/ §11-6（1画面3色まで）。実装は `app/app/share.tsx` の2か所（招待コード・見せる用リンク）
- 依存: なし
- 由来: クローズドテストの声（2026-09-08 ユーザー依頼「LINEで送るボタンに色をつける（LINE のイメージ色）」）

## 目的

今の「LINEなどで おくる」は白い補助ボタンで、押すと Android の共有シート（LINE・メール・その他が並ぶ画面）が開く。生徒さんの送り先は事実上 LINE なので、LINE の緑のボタンで LINE を直接開く。

## 決定事項（2026-09-08 ユーザー確認済み）

- **「LINEで送る」＝LINE の緑（`#06C755`）の主役級ボタン**。押すと共有シートを経ずに LINE が開く（送り先の選択は LINE 側）
- その下に「ほかの方法で送る」（今までの共有シート）を補助ボタンで残す（LINE を使わない家族向け）
- LINE 未インストール等で開けなければ、黙って共有シートに落とす（エラーを見せない）
- 緑は新しい補助色 `line-green`（app `tokens.ts` ⇄ web `tailwind.config.js` に追加し値を一致。用途は LINE ボタンのみ）。みんなに見せる画面のアクセントは curtain-red（招待コードをつくる）＋ line-green の2色＝§11-6 の範囲内
- LINE のロゴ画像は使わない（商標ガイドラインの制約を持ち込まない）。緑地に白文字「LINEで送る」＋汎用の吹き出しアイコン（lucide `MessageCircle`）

## 実装方針

- `lib/line-share.ts`：`shareViaLine(text)`。ネイティブは `Linking.openURL('line://msg/text/' + encodeURIComponent(text))`（LINE 公式の URL スキーム。未インストールなら openURL が reject する → `Share.share` にフォールバック）。Web（PWA）は `https://line.me/R/share?text=…`（ユニバーサルリンク。iPhone は LINE が入っていればアプリが開く）。分岐は処理の一部だけなので `Platform.OS`（CLAUDE.md のプラットフォーム分岐の順序 2）
- `components/line-button.tsx`：PrimaryButton と同じ寸法・影・押下挙動で、地色だけ `lineGreen`。PrimaryButton に色 prop を足さない（curtain-red の「最重要アクション1つ」規約を薄めない）
- `Linking.canOpenURL` は使わない（Android 11+ はマニフェストの `<queries>` が無いと常に false を返し、判定に使えない。openURL の失敗で判定する）

## Todo

- [ ] トークン追加：`lineGreen`（app）⇄ `line-green`（web）。DESIGN §3 に補助色として追記（用途を LINE ボタン限定と明記）
- [ ] `lib/line-share.ts`（URL スキーム・フォールバック・Web 分岐。理由をコメントに）
- [ ] `components/line-button.tsx`
- [ ] `share.tsx`：招待コードと見せる用リンクの両カードを「LINEで送る（緑）」＋「ほかの方法で送る（補助）」に置き換え。送る本文は今のまま
- [ ] `npx tsc --noEmit`・`npm run lint`
- [ ] 実機（Expo Go）で確認：LINE が直接開き本文が入っている／「ほかの方法で送る」で共有シートが開く。可能なら LINE 未インストール端末（またはアンインストール）でフォールバックも確認

## 完了条件

みんなに見せる画面で、招待コード・見せる用リンクのどちらも「LINEで送る」の緑ボタンから LINE が直接開き、本文が入った状態で送り先を選べる。LINE が無い端末では共有シートが開く。

## メモ

（作業中の記録）
