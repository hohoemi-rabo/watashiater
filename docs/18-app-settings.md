# 18. せってい（ニックネーム・アカウント削除）

- ステータス: 完了
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
- 実機（2026-08-12・家族テスト用アカウントで実施・ユーザー確認済み）：ニックネーム変更の保存・反映 OK。家族専用アカウントの削除（/family ハブから・二重確認 → オンボーディングへ）OK
- 削除後の DB 検証（execute_sql）：auth.users は本人1件のみ（テストアカウント消滅）・family_members / reactions 0件（カスケード）・本人の博物館は無傷（answers 7 / photos 6 / recordings 3 / life_story 1）。**消費済み招待コードは used_by が set null で戻ったが expires_at 失効済み＝再利用不可（復活バグ修正の本番確認）**
- R2：本人メディアのスポットチェック無傷（`wrangler r2 object get --remote` 取得成功）。テストアカウントは家族専用で R2 を持たないため wipe 経路の網羅性は vitest（実 miniflare R2・prefix 空検証）が担保
- 削除方針の確認（ユーザーと合意）：**即時・完全削除・復活不可**（猶予付きソフトデリートは採らない。誤操作対策は二重確認）。インフラ層のバックアップ保持だけは各社ポリシーに従い日数で消える旨を説明済み
