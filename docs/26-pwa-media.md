# 26. 書き手Web（PWA）：メディア実装の差し替え

- ステータス: 未着手
- 参照: REQUIREMENTS.md §3.7 / §3.2（写真5枚・録音1本） / §4.2（圧縮規格・AAC 3分） / docs/24（確定した方式）
- 依存: 25

## 目的

ネイティブ前提のメディア実装（写真選択・圧縮・アップロード・録音）を、Web でも動くよう差し替える。
DB・R2 のキー設計とスキーマは無変更のまま。

## Todo

- [ ] プラットフォーム分岐の形（`.web.ts` 差し替えか `Platform.OS` 分岐か）を決めて確立し、判断をコードコメントに残す（24 で `auth-context.tsx` に入れた分岐の基準を引き継ぐ）
- [ ] 写真：選択と圧縮（長辺1600px / JPEG品質80）の Web 実装（24 で確定した方式）
- [ ] アップロード：`FileSystem.uploadAsync` の Web 代替（`fetch` PUT。worker の Content-Length 必須を満たす）
- [ ] 録音：24 で確定した形式・経路（expo-audio の Web recorder か自前 MediaRecorder か）で実装。3分上限・アップロードまで
- [ ] マイク許可を「画面を開いただけで求めない」形にする（Web の `getRecordingPermissionsAsync` は即 `getUserMedia` を呼ぶ。24 のメモ参照）
- [ ] 録音中の波形の Web での代替（Web に metering が無い。reduced-motion 経路の流用で足りるか判断する）
- [ ] 回答画面・recording-box・写真添付まわりの UI が Web でも操作できることを確認
- [ ] `app/app/web-check.tsx`（24 の一時検証画面）を削除する

## 完了条件

PC ブラウザで「回答を書く＋写真をのせる＋声を録る」が一通り保存でき、その結果が
Android アプリと閲覧Webの両方から見える。

※ 起票時の完了条件にあった「worker のコード・テストは無変更のまま」は
**チケット24 で取り下げた**：ブラウザから worker を直接叩くには CORS が要り、
それ無しでは 24 の検証すら成立しなかったため、CORS だけは 24 で worker に入れてある
（`worker/src/cors.ts`）。26 では worker を触らない、が正しい読み替え。

## メモ

（作業中の記録）
