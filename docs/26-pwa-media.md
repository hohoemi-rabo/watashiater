# 26. 書き手Web（PWA）：メディア実装の差し替え

- ステータス: 進行中
- 参照: REQUIREMENTS.md §3.7 / §3.2（写真5枚・録音1本） / §4.2（圧縮規格・AAC 3分） / docs/24（確定した方式）
- 依存: 25

## 目的

ネイティブ前提のメディア実装（写真選択・圧縮・アップロード・録音）を、Web でも動くよう差し替える。
DB・R2 のキー設計とスキーマは無変更のまま。

## Todo

- [x] プラットフォーム分岐の形（`.web.ts` 差し替えか `Platform.OS` 分岐か）を決めて確立し、判断をコードコメントに残す（24 で `auth-context.tsx` に入れた分岐の基準を引き継ぐ）
- [x] 写真：選択と圧縮（長辺1600px / JPEG品質80）の Web 実装（24 で確定した方式）→ **コード変更なし**（`lib/photo-attach.ts` は 24 で無改造で規格を満たすと実測済み）
- [x] アップロード：`FileSystem.uploadAsync` の Web 代替（`fetch` PUT。worker の Content-Length 必須を満たす）
- [x] 録音：24 で確定した形式・経路（expo-audio の Web recorder か自前 MediaRecorder か）で実装。3分上限・アップロードまで
- [x] マイク許可を「画面を開いただけで求めない」形にする（Web の `getRecordingPermissionsAsync` は即 `getUserMedia` を呼ぶ。24 のメモ参照）
- [x] 録音中の波形の Web での代替（Web に metering が無い。reduced-motion 経路の流用で足りるか判断する）→ **流用では足りず、AnalyserNode の実レベルで既存描画を駆動**（メモ参照）
- [ ] 回答画面・recording-box・写真添付まわりの UI が Web でも操作できることを確認
- [x] `app/app/web-check.tsx`（24 の一時検証画面）を削除する

## 完了条件

PC ブラウザで「回答を書く＋写真をのせる＋声を録る」が一通り保存でき、その結果が
Android アプリと閲覧Webの両方から見える。

※ 起票時の完了条件にあった「worker のコード・テストは無変更のまま」は
**チケット24 で取り下げた**：ブラウザから worker を直接叩くには CORS が要り、
それ無しでは 24 の検証すら成立しなかったため、CORS だけは 24 で worker に入れてある
（`worker/src/cors.ts`）。26 では worker を触らない、が正しい読み替え。

## メモ

### 分岐の判断（CLAUDE.md の基準を適用）

- **`lib/upload-binary.ts` / `.web.ts`（新規・基準1）**：`putObject` の転送プリミティブだけを分離。
  公開シグネチャとエラーマッピング（`WorkerApiError` 変換）は `worker-api.ts` に残したので、
  呼び出し元（photo-attach / recording-attach）は無改造。Web バンドルから
  `expo-file-system` の shim が消えたことを export 後の grep で確認済み
- **`lib/mic-level.ts` / `.web.ts`（新規・基準1）**：波形のレベル源。native はスタブ
  （metering が担う）、Web だけ実体
- **`components/recording-box.tsx`（基準2＝`Platform.OS`）**：大半が共通で、違うのは
  許可の取り方・レベル源・blocked 画面だけ

### 録音形式と `web.bitsPerSecond` の罠（新発見）

`web: { mimeType: 'audio/mp4;codecs=mp4a.40.2' }` は**プリセットの `web` キーをオブジェクトごと
潰す形**で書くこと。`RecordingPresets.HIGH_QUALITY.web = { mimeType:'audio/webm',
bitsPerSecond:128000 }` が入っており、**`web.bitsPerSecond` はトップレベルの `bitRate` より
優先される**（`AudioModule.web.js` の `createMediaRecorder` を実読）。潰さないと 64kbps 指定が
Web で黙って無視される。`web` に `bitsPerSecond` を書き足すのも不可（実測済み構成から外れる）。

### 波形（案B・ユーザー決定）

reduced-motion 経路の流用は**不可**だった：あちらのメーターも metering 駆動で、Web では常に
0% になる。採ったのは AnalyserNode 案（`lib/mic-level.web.ts`）：

- expo-audio 内部の `recorder.mediaRecorder`（**TS 上は private・ランタイムでは public**）
  → `.stream`（標準プロパティ）に `createMediaStreamSource` + `AnalyserNode` を接続。
  **同一ストリームなので2本目の getUserMedia 不要**（iOS Safari の複数ストリーム無音化を回避）
- AudioContext は**ユーザージェスチャの同期スタック内**で生成（`prime()`。await 後だと Safari が
  suspended のまま戻さないことがある）。モジュールで1個を使い回す（Safari の生成数上限）
- expo-audio 更新で内部が変わったら `read()` が undefined → **波形領域ごと非表示に劣化**
  （フラットな偽バーを出さない）。録音そのものは壊れない
- RMS → dBFS → native の `toLevel` と同じ床（60dB）で 0〜1 正規化＝見た目のスケールが揃う

### マイク許可（Web）

- Web の `requestRecordingPermissionsAsync` は**成功・失敗とも `canAskAgain: true` の
  ハードコード**（実読）＝判定材料にならない。拒否は無条件で 'blocked'（鍵マーク案内）へ
- `ensurePermission` の Web は先頭の `getRecordingPermissionsAsync` を**飛ばして request 直行**：
  get は prompt 状態だと内部で request へ落ちるため、続けて request すると1押下でダイアログが
  2回出うる。許可済みなら getUserMedia はダイアログなしで解決する
- blocked 画面の Web 版は「もういちど ためす」（→ `startRecording`）が回復経路。
  Web には AppState 復帰の自動回復（`refreshPermission`）が無い（そもそも Web では
  `refreshPermission` を early return させている＝「静かに状態を見る」手段が無いため）

### 確認ダイアログが Web で出ない（本番検証で発覚 → 修正済み）

- react-native-web の `Alert.alert` は **no-op**。確認が出ないままナビゲーションだけが
  差し止められ、回答画面の離脱ガード（`usePreventRemove`）から出られなくなっていた
  （PC Chrome で実測：録音を保存しない限り「もどる」が効かない）
- `lib/app-alert.ts` / `.web.ts` の `showAlert`（`Alert.alert` と同シグネチャ）へ**全画面で**
  差し替えた（answer / story / settings / family / share / gallery の6ファイル。
  離脱ガードだけでなく、写真・声・アカウントの削除確認なども Web では全部死んでいた）。
  Web 実装は `window.confirm` / `window.alert`。ボタン文言が OK/キャンセル固定になるため、
  元の文言を「OK＝〜 ／ キャンセル＝〜」として本文末尾に添える
- 契約：ボタンは最大2つ・`style:'cancel'` は1つまで。2段確認は onPress の中で
  `showAlert` を重ねる（settings のアカウント削除が実例。Web は同期なのでそのまま動く）
