# 09. 写真添付（圧縮・アップロード）

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.2（1お題5枚まで） / §4.2（長辺1600px・JPEG品質80） / DESIGN.md §7（回答画面のポラロイド空枠）
- 依存: 06, 08

## 目的

回答への写真添付を完成させる（ギャラリーの素材になる）。

## Todo

- [x] 写真選択（expo-image-picker）。1お題あたり上限5枚（UI 非表示・selectionLimit・取得後 slice・worker 400 の4段防衛）
- [x] アップロード前にクライアント側で圧縮（長辺1600px / JPEG品質80。`lib/photo-attach.ts`）
- [x] worker の署名URLでアップロード → `photos` レコード作成（`lib/worker-api.ts`）
- [x] 回答画面での添付済み写真の表示と削除（ポラロイド表示・削除は確認ダイアログ。`components/photo-strip.tsx`）
- [x] アップロード失敗時のリトライとやさしい日本語エラー（「もういちど のせる」＝署名URL取り直しで再実行）

## 完了条件

写真の添付・表示・削除が一通り動き、R2 に圧縮済み画像が保存される。

## メモ

### 設計判断（2026-08-11）

- **アップロード経路は legacy `FileSystem.uploadAsync`**（`expo-file-system/legacy`・PUT・BINARY_CONTENT）。
  native スタックが既知長ファイルを送るため worker 必須の Content-Length が確実に付く。
  SDK 54 の `expo/fetch`＋File は Content-Length 送出が docs 非明記のため不採用（`lib/worker-api.ts` コメント）
- **answers 行の自動作成**：photos の RLS は answer_id 必須のため、未保存の回答に写真をのせたときは
  `body_text: ''` の行を自動作成（写真だけでも「回答済み」＝仕様どおり）。自由お題はタイトル未入力なら
  ピッカー前にガード。全滅・最後の1枚削除では `cleanupEmptyAnswer` が DB 実測（本文空・写真0・録音0）
  のときだけ行を回収する（確認失敗時は消さない側に倒す＝チケット06と同じ守り）
- **削除は DB 行の物理削除。R2 オブジェクトはその場では消さず孤児化を許容**。
  行が消えれば署名URLは二度と発行されず（発行済みも1時間で失効）到達不能。
  worker の役割2つ（AI生成プロキシ／署名URL発行）を守るため削除エンドポイントは持たせず、
  アカウント削除（チケット18）の `subjects/<id>/` prefix 一括削除で回収する。
  PUT 成功後に INSERT だけ失敗→リトライのケースでも孤児1つを許容（同じ回収経路）
- **画像キャッシュ**：署名URLはクエリが毎回変わるため、expo-image の `cacheKey` に `r2_key` を使って
  ディスクキャッシュを再利用（`cachePolicy="memory-disk"`）。署名URL自体はキャッシュしない
- expo-image-picker の config plugin（写真権限の文言）は **Expo Go では効かない**（リリースビルドで有効。
  チケット23で実機確認）。Android の Photo Picker はそもそも権限リクエスト不要

### 実機検証（2026-08-11、Expo Go / Android）

- チェックリスト（1枚・写真のみ回答・5枚上限・自由お題ガード・機内モード失敗→リトライ・
  削除と済解除・書きかけ保護・アップロード中の離脱ガード）を全項目ユーザー確認済み
- 発覚したバグ1件：行の自動作成直後、`refetchPhotos` が古い closure の answerId(null) を見て
  空振りし「のせた直後に写真が出ない」。**作りたての id を引数で明示的に渡す**形で修正
  （非同期の値は state/closure でなく引数・戻り値で流す — チケット04の教訓の再確認）
