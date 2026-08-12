# 18. せってい（ニックネーム・アカウント削除）

- ステータス: 進行中（実装済み・実機確認待ち）
- 参照: REQUIREMENTS.md §3.1（ニックネーム変更） / §4.3（アカウント削除は MVP に含む） / §7-8
- 依存: 04（完全削除の確認は 09・10 実装後）

## 目的

せってい画面と、本人データの完全削除を作る。

## Todo

- [x] ニックネーム変更
- [x] ログアウト（チケット04で実装済み）
- [x] アカウント削除：確認ダイアログ → Supabase の本人データ全削除＋R2 の写真・音声の完全削除
- [x] R2 オブジェクト削除の経路は worker の「メディアの門番」役割の範囲で実装時に判断し、判断をコメントに残す
- [x] 削除後はオンボーディングに戻る

## 完了条件

削除実行後、DB・R2 のどちらにも本人データが残っていないことを確認できる。

## メモ

### 設計判断

- **R2 削除の経路＝worker `POST /media/wipe`**（判断コメントは `worker/src/media.ts` の handleWipeMedia 冒頭）：「R2 アクセスは必ず worker を通す」門番の不変条件そのものなので役割2の範囲内。prefix `subjects/<id>/` は JWT からサーバー側で導出（クライアントから受け取らない）。**DB の行削除は worker にやらせない**（`src/supabase.ts` は読み取り専用の設計。行削除は RPC の責務）。docs/09・10 が許容してきた**孤児オブジェクトもこの prefix 一括削除が回収**する
- **DB 削除＝RPC `delete_own_account`**（`supabase/migrations/20260812000200`）：`auth.users` の DELETE 1文で全テーブルへ CASCADE（家族側の membership・reactions も）。**先に `invite_codes.expires_at = now()`（used_by が自分の行）**：used_by は on delete set null のため、放置すると削除者が使った「他人の」コードが未使用へ戻り期限内は再引き換え可能になるバグを防ぐ
- **順序は wipe → RPC → signOut**。逆順だと subject_id が消えて prefix を導出できず孤児が永久に残る。wipe 後に RPC が失敗しても行は残る＝「もういちど押すとつづきから削除できます」でリトライ（空 prefix の wipe は冪等）。signOut は明示的に呼ぶ（AsyncStorage のセッションはサーバー側削除では消えない）
- **二重確認ダイアログ**（Alert 2連鎖）：最重度の破壊的操作なので §4.1 の確認を2段にした
- **家族専用アカウントにも削除手段**：settings は subject 前提で到達できないため、/family ハブに同じボタン（wipe スキップ＝R2 を持ち得ない）。アカウント削除はどの種類のアカウントにも必要（Google Play 要件・チケット23）
- SecondaryButton に `destructive` prop 追加（errorRed。curtainRed と区別＝DESIGN §3）
- ニックネーム変更はプロジェクト初の subjects UPDATE（RLS subjects_owner_update・チケット02整備済み）。空・未変更は保存 disabled
- 検証手段の注意：`wrangler r2 object list` コマンドは存在しない（get/put/delete のみ）。R2 側の確認は vitest（実 miniflare R2 で prefix 空を検証）＋ `wrangler r2 object get --remote` のスポットチェック方式

### 検証結果

- worker：`npm test -- --run` 53件全通過（wipe.spec.ts 新規4件＋ルーティング1件含む）。本番デプロイ済み
- app：tsc / lint / expo export クリーン
- MCP：apply_migration・advisors（definer WARN は redeem と同様に意図どおり）・types 再生成済み
- 実機：未実施。**家族テスト用 Google アカウントで行う**（メインの実データは消さない）。手順は plans 参照（テスト用博物館作成 → 写真＋録音 → r2_key を控える → アプリから削除 → execute_sql で全テーブル 0 件・`wrangler r2 object get` で not found・オンボーディングへ戻る）
