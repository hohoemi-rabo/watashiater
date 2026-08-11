# 10. 録音の保存

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.2（録音データの保存・明示） / §4.2（AAC・最長3分） / DESIGN.md §7（録音中は spot-yellow の波形アニメ）
- 依存: 00, 06, 08

## 目的

回答画面の音声モードで録音を保存できるようにする（「写真が語る」の素材になる）。

## Todo

- [x] 回答画面の音声モード：録音開始・停止 UI（録音中は spot-yellow の波形アニメ＝metering 実データ駆動。`components/recording-box.tsx`）
- [x] 録音保存を都度ユーザーに明示（「この声は写真の説明として使えます」を録音前とプレビューの両方に表示）
- [x] AAC・最長3分制限。worker の署名URLでアップロード → `recordings` レコード作成（`lib/recording-attach.ts`）
- [x] 録音の再生・録り直し・削除（削除は確認ダイアログ。録り直しは upsert で行置き換え）
- [x] このチケットでは文字起こしをしない（音声認識はチケット22。テキストは手動入力のまま）

## 完了条件

録音付き回答が作成でき、再生・録り直し・削除が動く。

## メモ

### 設計判断（2026-08-11）

- **プリセットは HIGH_QUALITY ベースの 1ch/64kbps**（`{...HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true}`）。
  android サブ設定（mpeg4/aac）は無傷なので AAC/.m4a のまま。3分≈1.4MB（HIGH_QUALITY 実測 2.78MB の半分）。
  **実機の耳確認で音質は問題なしとユーザー確認済み**。戻す場合は recording-box.tsx の2行を消すだけ
- **保存順序は「R2 へ PUT → answers 行の用意 → recordings upsert」**。いちばん多い失敗（電波）が
  PUT で出尽くすため、空の answers 行が残る失敗経路がほぼ無く、写真で必要だった失敗時
  cleanup 分岐が要らない。リトライは毎回この順で通す
- **recordings は upsert（`onConflict: 'answer_id'`）**。answer_id は素の UNIQUE 制約なので使える
  （answers が upsert を避けたのは自由お題の unique が部分インデックスのため。recordings は該当しない）。
  録り直し＝新 r2_key で行置き換え。旧 R2 オブジェクトは孤児化を許容（docs/09 の方針・チケット18で回収）
- **録音の進行中（録音・未保存プレビュー・アップロード）はモード切替を無効**にする割り切り。
  切替で RecordingBox がアンマウントされ未保存テイクが消えるのを防ぐ。プレビューの破棄は
  back の離脱ガード（「のこさないで もどる」）に一本化
- 3分の多段防衛：native `record({forDuration:180})`（主）→ JS 予備停止181秒 → アプリ側クランプ 0..181 →
  DB CHECK → worker 10MB 上限

### 実機検証（2026-08-11、Expo Go / Android）

- 録音→波形→プレビュー再生（スピーカー）→のこす→保存済み表示・済スタンプ／再入場での署名URL再生／
  とりなおし置き換え／削除と済解除／機内モード失敗→リトライ／離脱ガード・モード切替無効／
  **音質（1ch/64kbps）はユーザーの耳確認で問題なし**
- 録音中の背面化の挙動は明示的な確認報告なし（docs/00 の未確認フラグは残す。問題が出たら追調査）
