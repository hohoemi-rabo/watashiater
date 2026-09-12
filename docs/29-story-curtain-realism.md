# 29. 自分史の幕：質感を本物の緞帳に近づけ、開幕をゆっくりに

- ステータス: 完了
- 参照: DESIGN.md §3（カラー。本チケットで補助色 `curtain-gold` を追加）/ §7 じぶん史 / §8 モーション（本チケットで改訂）。実装は `app/components/curtain-overlay.tsx`（幕）と `app/app/story.tsx`（フェーズ進行の所要時間）
- 依存: 28
- 由来: クローズドテストの声（2026-09-08 ユーザー依頼「AI の挙動のカーテンアニメーションをもう少しリアルに。開ける動作を遅めに」）

## 目的

今の幕は「真っ赤で平らな板2枚が左右にスライドするだけ」。これを布の緞帳に見せ、開く動きを重く・ゆっくりにする。自分史の生成中（幕が閉じている間）と開幕の見せ場を、劇場の「これから始まる」高揚感に近づける（DESIGN §1）。

## 決定事項（2026-09-08 ユーザー確認済み）

4案すべて採用：

1. **縦のひだ**：幕に縦方向の明暗の縞を入れ、布のドレープに見せる。色は `curtain-red` を基調に、明部・暗部はトークン由来の混色で作る（`DIMMED_SKY` / `PAPER_TINT` と同じ流儀＝生値の発明ではなく混色式をコメントに残す）
2. **開くときに束ねられて縮む**：左右へただ退場するのではなく、外側の端へ寄りながら幅が縮む（ひだが詰まる）。閉じるときはその逆
3. **上部の飾り幕（バランス）**：画面上端に弧を並べた短い飾り幕を置く。開幕の終盤でフェードアウトし、本文の上を隠さない
4. **金色の縁・房**：幕の内側（中央側）の縁に細い金のライン、飾り幕の下に短い房（フリンジ）。控えめに
- **開幕は 1.2秒 → 2秒**。閉幕は 0.9秒 → 1秒（重い布らしさ。生成待ちを長引かせないため大きくは延ばさない）
- 対象は**アプリ内の緞帳（自分史画面）だけ**。ギャラリーの拡大表示の「幕」（背景色の面）と閲覧Web の開幕演出は別物のまま（DESIGN §7）
- 金色は新しい補助色 `curtain-gold`（app `tokens.ts` ⇄ web `tailwind.config.js` の両方に追加し値を一致させる。用途は緞帳の縁と房のみ）。自分史画面のアクセント色は curtain-red・curtain-gold の2色で §11-6（1画面3色まで）の範囲内

## 実装方針

- 幕1枚＝`overflow: hidden` の枠に、横方向グラデーション（明→基調→暗）の縦縞を N 本並べる。グラデは既存依存の `expo-linear-gradient`（story.tsx が既に使用。Web でも動く）
- 束ね縮みは **`transformOrigin` を外側の端**（左幕＝left、右幕＝right）にして、`translateX` と `scaleX` を同じキーフレームで動かす。左幕なら終わりの姿は `scaleX: s`・`translateX: -s × 半幅`（scale してから translate するので、この組み合わせで画面外に出切る）。ひだの縞は scaleX で自然に詰まる
- Reanimated の CSS アニメは完了コールバックが無いので、フェーズ進行は今までどおり story.tsx の setTimeout（`CURTAIN_CLOSE_MS` / `CURTAIN_OPEN_MS` を更新するだけで追随）。**`animationFillMode: 'backwards'` を必ず付ける**（チケット23の教訓。最初の1フレームだけ終わりの姿が出る）
- reduced-motion 時は「ひだ付きの閉じた幕」を静止で出すだけ（今と同じ方針）
- 飾り幕は overlay 内の別レイヤー。閉幕〜閉幕済みは不透明で固定、開幕フェーズの終盤（`animationDelay`）で opacity 1→0。overlay ごとアンマウントされるのでフェード後の後始末は不要

## Todo

- [x] トークン追加：`curtainGold`（app）⇄ `curtain-gold`（web）。DESIGN §3 の表に補助色として追記（用途を緞帳限定と明記）
- [x] `curtain-overlay.tsx`：ひだ（縦縞グラデ）・金の縁・飾り幕＋房を実装。混色の式と本数の判断をコメントに残す
- [x] `curtain-overlay.tsx`：束ね縮みのキーフレーム（transformOrigin＋translateX/scaleX）。閉幕は逆再生
- [x] 所要時間の更新：`CURTAIN_CLOSE_MS = 1000` / `CURTAIN_OPEN_MS = 2000`。story.tsx 側は定数参照のみで変更不要なことを確認
- [x] reduced-motion の静止表示を確認（ひだ・飾り幕は出す、動かさない）
- [x] `npx tsc --noEmit`・`npm run lint`・`npx expo export --platform android`（Web 出力も1回：LinearGradient と transformOrigin が Web で崩れないか）
- [x] DESIGN.md 改訂：§7 じぶん史（幕の見た目）・§8（開幕 2秒の例外を明記）
- [x] 実機（Expo Go）で目視確認 → ユーザー判断：ひだの本数・縮み具合・飾り幕の高さの微調整

## 完了条件

自分史の「作る／もう一度作る」で、ひだのある朱色の緞帳が約1秒で閉じて「準備中」を見せ、生成後に約2秒かけて両端へ束ねられながら開く。開き切ったあと画面に幕の名残（飾り幕を含む）が残らない。reduced-motion では静止した閉幕→本文の切替になる。

## メモ

### 決めた値と、その根拠

新しい補助色 `curtain-gold = #E3AD4E` は `spot-yellow` 60% + `desk-wood` 40% の混色。
幕のひだも同じ流儀でトークンから作る：山（明部）`#E66C59` ＝ curtain-red 80% + card-white 20%、
谷（暗部）`#B84437` ＝ curtain-red 78% + stage-navy 22%（黒で落とさないのは DESIGN §11-4）。
生値を発明せず混色式をコメントに残すのは `PAPER_TINT`（app-card）・`DIMMED_SKY`（photo-lightbox）と同じ。

見た目のつまみは `curtain-overlay.tsx` 冒頭に集約した（実機で触るのはそこだけ）。初期値は
`GATHER_SCALE 0.5` / `FOLDS_PER_PANEL 6` / `VALANCE_HEIGHT 38` / `VALANCE_SCALLOPS 4` /
`SCALLOP_DEPTH 34` / `FRINGE_LENGTH 10` / `VALANCE_FADE_MS 600`。

### transform の並び順（ここを間違えると幕が画面外に出切らない）

束ね縮みは `transformOrigin` を外側の端（左幕 `left center` / 右幕 `right center`）に置き、
`transform: [{ translateX }, { scaleX }]` の順で書く。RN は配列の**先頭が最後に適用される**（CSS と同じ）ので、
この順なら translateX は縮む前の座標で効き、`translateX = ±GATHER_SCALE × 半幅` でちょうど画面外に出切る。
逆順にすると移動量まで縮んで幕の帯が残る。`from` と base の transform は同じ並びにすること
（Reanimated は配列を要素ごとに補間するため、形が違うと途中で飛ぶ）。

### 飾り幕を「別の布」に見せるのに要ったもの

最初の実装（弧が浅い・幕と同じひだ間隔）では、飾り幕が幕と地続きの一枚に見えて金の線だけが浮いた。
sharp で同じ数値の SVG を書き出して見比べ、次の3点で分かれた：

1. 弧を深く・数を減らす（7本×深さ14 → 4本×深さ34）。浅い弧は「波打つ帯」にしか見えない
2. 飾り幕のひだを幕の3倍の密度にする（同じ間隔だと縞がつながって見える）
3. 弧の下に影を1本入れる（`VALANCE_SHADOW_DROP`／`PLEAT_SHADOW` を opacity 0.26）

### 検証したこと

`npx tsc --noEmit` / `npm run lint` / `expo export --platform android` / `--platform web` はすべて通った。
束ね縮みの座標は、同じ計算式の SVG をレンダリングして「開き切りで幕が画面外に出切る」ことを先に確認した。

**2026-09-12 実機（Expo Go・Android）で目視確認ずみ＝OK**。`transformOrigin` は実機の Reanimated で
効いており、上記の初期値のまま微調整は不要だった（開幕2秒の体感・飾り幕の高さ・ひだの本数とも指摘なし）。

参考：もし `transformOrigin` が効かない環境に当たった場合は、原点中央のまま
`translateX = outward × 半幅 × (1 + GATHER_SCALE) / 2` にすれば終わりの位置は同じになる
（束ねられる支点が幕の中央に変わるだけ）。
