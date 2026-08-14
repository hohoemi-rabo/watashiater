# 28. デザイン刷新：背景・影のパレット変更

- ステータス: 進行中
- 参照: DESIGN.md §1 / §3 / §5 / §7（本チケットで改訂する）。元ネタはローカルの `design/`（コミットしない・.gitignore 済み）にあるデザイン案の背景配色
- 依存: 27

## 目的

背景を「桜色 → ラベンダー → 淡い空色」の3色グラデーションへ変更し、影・派生色・PWA メタ・仮アイコンを新パレットに追随させる（2026-08-14 ユーザー決定）。UI 構造・文言・アクセント色（curtain-red / spot-yellow）は変えない。

## 決定事項（ユーザー確認済み）

- 背景: `#FFD6E8`（桜色）→ 60% `#E0D4FF`（ラベンダー）→ `#C4E8FF`（淡い空色）の3色。`sky-mid` トークンを新設
- 影: ネイビー（stage-navy）から**紫 `#8C3CB4`** に変更（桜系背景に青い影は濁って見えるため。不透明度・オフセットの3段階は不変）
- 仮アイコン: 色だけでなく**新パレットで全面作り直し**（空=新3色・幕=ローズ→紫のグラデ。構図の緞帳モチーフは維持）

## Todo

- [x] トークン更新（`app/constants/tokens.ts` ⇄ `web/tailwind.config.js` の値一致）：sky 3色＋影色
- [x] `SkyBackground` と web の `bg-sky` を3ストップ化（60% 位置も一致させる）
- [x] 混色派生の再計算：`PAPER_TINT`（紙色。混色元を skyTop に変更＝`#FFF9FC`）／`DIMMED_SKY`（拡大表示の背景＝`#DFBFD2`）— app と web の両方
- [x] PWA メタ追随：`public/index.html` のグラデ・`manifest.json` の theme_color(#FFD6E8) / background_color(#C4E8FF)・`app.json` の themeColor と adaptiveIcon backgroundColor(#FFE4F1)
- [x] 仮アイコン再生成（`scripts/gen-icons.mjs` を新パレットで書き換え → 生成物をコミット）。空はトークンそのままだと白飛びするためアイコン用の濃いめトーン・幕はローズ→紫（判断はスクリプトのコメント）
- [x] DESIGN.md 改訂（§1 の空の記述・§3 パレット表とルール・§5 影の値・§7 拡大表示の文言。バージョン 1.1）
- [x] `design/` を .gitignore に追加（コミットしない・ユーザー指示）
- [ ] 実機・本番での目視確認（Android=Expo Go／書き手Web・閲覧Web=本番URL）

## 完了条件

書き手アプリ（Android・Web）と閲覧Webの全画面が新しい背景・影で表示され、
PWA のテーマ色・アイコンも一致している。DESIGN.md が新パレットを唯一の情報源として記述している。

## メモ

（作業中の記録）
