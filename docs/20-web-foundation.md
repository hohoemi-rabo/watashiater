# 20. web：基盤（slug検証・noindex）

- ステータス: 未着手
- 参照: REQUIREMENTS.md §3.6 / §6 末尾（slug 検証はサーバー側。anon キー直読み禁止） / DESIGN.md §12（トークン共有） / CLAUDE.md「アーキテクチャ」
- 依存: 08, 17

## 目的

閲覧 Web のデータ経路とページ土台を作る。見た目の作り込みはチケット21。

## Todo

- [ ] Next.js テンプレートのサンプルページを削除
- [ ] 全ページ noindex（metadata の robots 設定）
- [ ] next/font で Zen Maru Gothic / Noto Sans JP / Shippori Mincho を導入し、CSS 変数経由で tailwind の fontFamily トークンに接続
- [ ] `/w/[slug]`：サーバー側で slug を検証（service role キー使用）。無効・失効スラッグは404
- [ ] 対象 subject の回答・写真・じぶん史・配置データの取得（サーバー側のみ）
- [ ] worker から閲覧用署名URLを取得する経路（`WORKER_URL`。サーバー側で取得しクライアントへ渡す）

## 完了条件

有効な slug で博物館データ（生データ表示でよい）が表示され、無効 slug は404。service role キーがクライアントに漏れていない。

## メモ

（作業中の記録）
