# 21. web：閲覧ページUI

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.6（構成・レスポンシブ） / DESIGN.md §6.1（開幕演出） / §7（閲覧Web） / §4（Web 用サイズスケール）
- 依存: 20

## 目的

孫が URL を開いたときの閲覧体験を完成させる。アプリとトークン完全共有（Webだけ雰囲気が変わることの禁止）。

## Todo

- [x] 開幕演出：初回訪問のみ朱色の緞帳が左右に開く（1.2秒・タップでスキップ・`prefers-reduced-motion` 時は最初から開いた状態）
- [x] 表紙（名前・代表写真）
- [x] 机の上ボードの閲覧版（座標・傾き・重なり・ポラロイド・スピーカーバッジを app と同じ見た目で再現）
- [x] 写真タップ → 拡大＋HTML5 audio で本人音声を再生（録音なしはテキストエピソード表示）
- [x] じぶん史（Shippori Mincho・紙背景・本文18px・行間2.0）
- [x] お題カード一覧（演目札の閲覧版）
- [x] スマホ最優先のレスポンシブ確認
- [x] Vercel デプロイ → `EXPO_PUBLIC_WEB_URL` を実ドメインに確定（チケット20からの申し送り）
- [x] 実機スマホブラウザでの通し確認（完了条件）

## 完了条件

実機スマホブラウザで、開幕 → 表紙 → ギャラリー → じぶん史 → お題一覧が一通り閲覧でき、音声も再生できる。

## メモ

### 設計判断

- **座標契約は CSS だけで満たす**（JS で寸法を測らない）。`board-layout.ts` の
  「ボード幅=1の正規化値・中心座標・度」を次の対応で写す：
  ボード高さ=`aspect-ratio: 1 / H`／ポラロイド幅=`width: 42%`／
  中心座標=`left: x*100%` `top: (y/H)*100%` ＋ `transform: translate(-50%,-50%) rotate(Ndeg)`。
  **`top` の % がコンテナ高さ基準になるぶんを y/H で吸収する**のが要。
  ポラロイドの全高（幅+20px）は「写真 aspect-square ＋ 白フチ padding」で CSS が自動で満たす
- **配置計算はサーバー側**（`page.tsx` が `resolveBoardPlacements` を呼ぶ）。
  クライアントには確定した数値だけ渡すので `board-layout.ts` はクライアントバンドルに入らない
- **`board-layout.ts` は逐語コピー**（`diff app/lib/board-layout.ts web/lib/board-layout.ts` が
  ヘッダーだけになる状態を保つ）。共有パッケージにしない：3つの独立した npm プロジェクト構成を
  このファイル1枚のために崩さない。両方の冒頭に相互参照コメントを入れた
- **重なりは z 昇順の描画順**（`z-index` を使わない＝app と同じ）
- **開幕の赤いチラつきを構造で防ぐ**：幕はサーバー側で「閉じた姿」として描き、
  ページ先頭の小さなインラインスクリプトが**描画前に** localStorage を見て
  `<html data-curtain="seen">` を立てる。CSS が即座に `display:none` にする。
  JS で後から消すとハイドレーション前に赤画面が1フレーム出る。
  `prefers-reduced-motion` も同じく CSS だけで消す（JS 経路を増やさない）。
  この属性はサーバーHTMLに無いので `<html>` に `suppressHydrationWarning` が要る
- **開幕は localStorage に slug ごとの旗**（2026-08-13 ユーザー判断）。
  別の博物館を開けば、その館の開幕は見られる
- **表紙の代表写真は「cover_photo_id → 無ければ机の上の1枚目」**（2026-08-13 ユーザー判断）。
  `cover_photo_id` を選ぶ導線はアプリに無く常に null のため
- **演目札の切り欠きは CSS マスク**（`mask-image` の radial-gradient 2枚＋`mask-composite: intersect`）。
  本文で高さが伸びるので SVG の固定 viewBox より素直。**マスクは影も削る**ため、
  影は外側の要素に持たせ、紙の面だけをマスクする。切り欠き部分は影が直線のまま通るが
  半径9px なので許容（app/components/prompt-card.tsx と同じ判断）
- **演目札に「済」スタンプを出さない**：閲覧側に並ぶのは回答済みのカードだけなので、
  全枚に付くと情報量ゼロのノイズになる（DESIGN §6.2 はアプリの一覧の話）。
  代わりに半券部へ DESIGN §6.2 のもう一方の要素＝その回答の写真サムネイルを置き、
  写真が無く声だけの回答にはスピーカーバッジを出す
- **自動再生の拒否に備える**：Web の `play()` はユーザー操作から離れると reject される。
  写真タップ直後なので通ることが多いが、reject されたら無音で放置せず「声を聞く」ボタンに落とす
- **署名URLの失効（1時間）からの復帰は `router.refresh()`**。サーバーコンポーネントを流し直して
  新しい署名URLを props に流し込む（app の refetch に相当）
- ライトボックスは **Esc でも閉じる**／開いている間は背面をスクロールさせない（Web では当然の期待）
- 1ページ構成（REQUIREMENTS §7 が明示的に許容）。ページ全体を `max-w-[520px]` の1カラムにして
  デスクトップでもスマホの見え方を再現する

### ボーイスカウト修正

- **favicon の 404 を解消**：チケット20で Next ロゴの favicon を消したまま代わりを置いておらず、
  ページを開くたび `/favicon.ico` が404していた。`app/assets/images/favicon.png` を
  `web/app/icon.png` に置いた（App Router の規約で `<link rel="icon">` が自動で入る）

### 検証結果

- `npm run build` / `npm run lint` / `npx tsc --noEmit` クリーン
- SSR 出力（slug `kk76qg4pww5du2e4`）：ポラロイド7枚・演目札8枚・じぶん史・
  `aspect-ratio:1 / 2.468`・各ポラロイドの `left/top/width/transform` が
  `resolveBoardPlacements` の値と一致。開幕スクリプトが幕の markup より前に出ている
- `diff` で `board-layout.ts` の**本体がアプリと完全一致**していることを確認
- ヘッドレス Chromium（390×844）での実挙動：
  - 開幕 … `closed`（transform なし）→ `opening`（-34px → -138px → -195px と滑る）→ 1.2秒で unmount。
    タップで即 unmount。`prefers-reduced-motion` で `display:none`。**再訪でも `display:none`**
  - 写真タップ → ライトボックス → **音声が自動再生された**（`paused:false` / `currentTime:0.57` /
    `readyState:4`）。とじる → `<audio>` ごと消える＝音が止まる
  - コンソールエラー0件・失敗リクエスト0件
  - 横スクロール 0px（390px 幅・1280px 幅とも）
- 本番（2026-08-13 デプロイ済み）でも同じ通し確認を実施：
  タイトル・`noindex, nofollow`・ポラロイド7枚・演目札8枚・署名URLエラー0件、
  無効slug／無効化済みslug／`/` はすべて404、音声の自動再生とじる動作・開幕の再訪非表示もローカルと同じ
- **実機スマホブラウザでの通し確認：問題なし**（2026-08-13 ユーザー確認済み＝完了条件を満たす）

### デプロイ

- Vercel プロジェクト **`watashiater`**（`rabohohoemi-6774s-projects`）。CLI から
  `web/` をリンクして作成したので **Root Directory は `web/`**（モノレポのルートを指さない）
- 環境変数 `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `WORKER_URL` を
  Production・Preview に登録済み（Sensitive 扱い）
- **本番エイリアスは `https://watashiater.vercel.app`**。2026-08-12 に暫定値として
  app/.env に置いた URL がそのまま本番になったため、`EXPO_PUBLIC_WEB_URL` は変更不要だった
- `web/.vercel/` は gitignore 済み。`vercel link` が `.env.local` に付け足す
  `VERCEL_OIDC_TOKEN`（短命・開発用）もコミット対象外
