# 00. 技術検証：録音＋手動テキストの2本立て

- ステータス: 進行中（のこりは「権限拒否時の案内」と「metering の値」の確認のみ）
- 参照: REQUIREMENTS.md §3.2 / §4.2（AAC・最長3分） / CLAUDE.md「技術検証を最初にやること」
- 依存: なし

## 目的

expo-audio による録音が実機で安定動作することを確認し、回答入力を「録音＋手動テキスト」の2本立てで進める前提を固める。音声認識との同時動作の検証は**ここではやらない**（→ チケット22）。

## Todo

- [x] expo-audio を導入し、録音→停止→再生の最小プロトタイプを作る（検証用の仮画面でよい）
- [x] AAC 形式・最長3分の制限つきで録音できることを確認
- [x] 録音ファイルの形式・サイズ感を計測して「検証結果」に記録（アップロード設計の入力にする）
- [x] Android 実機（Expo Go）で動作確認 ※エミュレータから変更。理由はメモ参照
- [ ] マイク権限の許可フロー（拒否時のやさしい日本語案内を含む）を確認 ※許可する側の流れは確認済み。拒否時の案内画面が未確認

## 完了条件

録音の基本動作が確認でき、検証結果が下記に記録されている。

## 実機での確認手順

`cd app && npx expo start --clear` →（つながらなければ `--tunnel`）→ Expo Go で読み込み →「ろくおん検証」タブ。

1. 「録音をはじめる」をタップ → マイク許可ダイアログが出る（**画面を開いただけでは出ない**こと）
2. 声を出すと spot-yellow の波形が動く／metering に数値が出る
3. 「とめる」→「聞いてみる」で**スピーカーから**聞こえる（受話口の小さい音になっていない）
4. 「計測けっか」カードの数値を控える（MIME・長さ・サイズ・実測ビットレート・3分見つもり）
5. 3分こえるまで放置し、自動停止と「とまりかた」の表示を確認（forDuration と JS 予備処理のどちらが効いたか）
6. 録音中に Home タブへ切り替え→戻る／アプリを背面に回して戻る、で録音が続くか
7. 2本目を録音して「聞いてみる」で**2本目**が鳴るか（1本目が鳴る場合は player の作り直しが必要）
8. Android の設定で Expo Go のマイクを拒否に固定 → 再度開いて `blocked` 画面と「設定をひらく」を確認、許可して戻ると自動で復帰するか
9. 録音中に画面を離れて例外・クラッシュが起きないか
10. 影・空グラデ・押した時の沈み込みが実機で意図通りか目視（DESIGN.md §5）

## 検証結果

（2026-08-09 実機で実施。スクリーンショット2枚から転記）

### 環境

- 端末: Android 実機（機種未記録）
- 実行: Expo Go（SDK 54）
- パッケージ: expo-audio ~1.1.1 / expo-file-system ~19.0.23

### 形式

- コンテナ/エンコーダ（設定値）: mpeg4 + aac（`.m4a`）→ **録音・再生とも正常動作**
- 実測 MIME（`File.type`）: **`audio/mpeg`**。`audio/mp4` ではない点に注意。Android の
  `MimeTypeMap` が拡張子 `.m4a` をこう対応づけるためで、中身の判定（スニッフィング）ではない。
  エンコーダ設定は mpeg4+aac なので中身は AAC で問題ないが、**アップロード時の Content-Type に
  `File.type` を使ってはいけない**（→ 申し送り）
- 保存先: `file:///data/user/0/host.exp.exponent/cache/Audio/recording-<uuid>.m4a`
  （アプリのキャッシュ領域。`host.exp.exponent` は Expo Go のパッケージ名）

### サイズ計測

| 長さ | サイズ | 実測ビットレート | 3分ぶんの見つもり |
|---|---|---|---|
| 8.6 秒（手動停止） | 136.4 KB（139,636 バイト） | 129.6 kbps | 2.78 MB |
| 179.9 秒（3分自動停止） | **2.78 MB（2,912,789 バイト）** | 129.5 kbps（逆算） | （これが実測値） |

- 理論値（128kbps ＝ 3分で 2.88MB）にほぼ一致。コンテナのオーバーヘッドは誤差程度
- 短い録音からの外挿（2.78MB）と3分の実測（2.78MB）が **0.5% 以内で一致**。
  今後の見積もりは短時間サンプルの外挿で信頼してよい

### 3分制限

- **native の `record({ forDuration: 180 })` が効いた**（画面表示「3分で自動停止（expo-audio の
  forDuration が効いた）」）。JS の予備処理（181秒）は出番なし
- 超過なし：再生の長さ 179.9 秒＝180秒の手前で停止
- 発見：**自動停止の直後に `recorder.getStatus().durationMillis` を読むと 0 が返る**
  （画面の「録音の長さ 0.0 秒」）。長さはポーリング中に控えた値か、再生側の
  `playerStatus.duration`（179.9秒が取れていた）から取ること。仮画面はポーリングの控えを
  使うよう修正済み
- 背面に回したときの挙動: 未確認（チケット10で必要になったら確認）
- 2本目の録音後、再生は正しく2本目のファイルを読み込んだ（`useAudioPlayer` の
  ソース差し替えは URI 変更で機能する）

### マイク権限

- 許可する側の流れ（初回タップでダイアログ → 許可 → 録音開始）: 動作確認済み
- 拒否固定（`canAskAgain: false`）時の案内と `Linking.openSettings()`: 未確認

### metering（チケット10の波形向け）

- `isMeteringEnabled: true` で値が来るか: 確認まち（録音中に波形の棒が声で動いたかで判定）

### チケット09/10 への申し送り

- **Content-Type は自前で固定すること**。Android の `File.type` は `.m4a` に対して
  `audio/mpeg` を返す。R2 へのアップロード（署名付きURL）と閲覧側の配信では
  `audio/mp4` を明示的に指定する（`File.type` をそのまま流用しない）
- **3分の実測は 2.78MB（HIGH_QUALITY: 44.1kHz/2ch/128kbps）**。声の記録には過剰で、
  シニアのモバイル回線アップロードには重い。チケット10でモノラル・低ビットレートの
  カスタム AAC プリセット（例: 1ch/64kbps → 約1.4MB）を検討し、音質は耳で判断する
- **3分制限は `record({ forDuration: 180 })` を主にしてよい**（Android 実機で動作確認済み）。
  JS の予備処理は安価なので保険として残す
- **native 自動停止後は `getStatus().durationMillis` が 0**。録音長は
  ポーリング（`useAudioRecorderState`）中に控えるか、停止後に `player.duration` から取る
- 録音の URI は `await recorder.stop()` の後（または statusListener の `url`）で確定
- 保存先はキャッシュ領域なので OS に消されうる。アップロード前提の設計でよい
  （端末に永続保存しない）

## メモ（設計判断・調査結果）

### エミュレータ→実機に変更した理由

開発機（WSL2）に Android SDK・`adb`・AVD がなく、エミュレータの仮想マイクも WSL2 経由では音声入力が通りにくい。動作実績のある Expo Go の実機検証に切り替えた。

### プリセットは HIGH_QUALITY 一択

`RecordingPresets.LOW_QUALITY` は Android では **3gp / amr_nb** になり、REQUIREMENTS §4.2 の「AAC」を満たさない。AAC(.m4a) になるのは HIGH_QUALITY のみ。ただし 44.1kHz ステレオ 128kbps は声の記録には過剰なので、実測値を見てチケット10でモノラル・低ビットレート化を判断する（このチケットでは計測のみ。先回りして変えない）。

### expo-audio 1.1.1 の API で注意すること

- `RecorderState` に **`fileSize` は無い**。サイズは `expo-file-system` の `new File(uri).size` からしか取れない
- `uri` は `await recorder.stop()` の**後**にしか確定しない。長さ（`getStatus().durationMillis`）は stop の**前**に読む
- `prepareToRecordAsync()` は録音の**たびに**必要（stop で MediaRecorder がリセットされる）
- `record()` は同期・`stop()` は Promise
- `useAudioRecorder` の options は中身が変わると native recorder を作り直すので、モジュールスコープの定数を渡す
- `useAudioRecorderState(recorder, interval)` の interval はマウント時の値で固定される
- statusListener は `recorder.id` が変わるまで再登録されない＝古いクロージャが残るため、ref 経由で最新の処理を呼ぶ
- 停止は「タップ」「native 自動停止」「JS 予備処理」の3経路から来るので、`useRef` の同期ガードで冪等にする（state ガードでは間に合わない）
- `reactCompiler: true` の下では recorder / player のインスタンスプロパティを **render 中に読まない**（インスタンスの同一性が変わらずコンパイラが読み取りを記憶しうる）。表示は `useAudioRecorderState` / `useAudioPlayerStatus` を使う
- 未使用だが使える選択肢：`android.maxFileSize`（native の容量上限）

### 再生時の音声ルーティング

`stop()` のあとに `setAudioModeAsync({ allowsRecording: false, shouldRouteThroughEarpiece: false })` を呼んで録音モードを戻す。戻さないと再生が受話口から小さく鳴り、「アプリが壊れている」と受け取られる。

### Expo Go での制限

- `app.json` の config plugin（`microphonePermission` / `recordAudioAndroid`）は **Expo Go では効かない**。許可ダイアログの文言は Expo Go 自身のもの。`npx expo config --type introspect` で `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` が入ることは確認済みだが、実挙動の最終確認は dev build / 本番ビルドまで持ち越し
- 同様に `Linking.openSettings()` は **Expo Go の**設定画面を開き、切り替わるのは Expo Go の権限。コード経路の検証にはなるが最終確認ではない
- 端末がダークモードだとタブバーだけ暗くなる（`userInterfaceStyle: "automatic"` のまま）。チケット03でライト固定にするので、この仮画面での見た目のずれは不具合ではない

### 仮画面について

`app/app/(tabs)/recording-check.tsx`（テンプレの `explore.tsx` を置き換え）。チケット03で本物の共通UIを作るときに**このファイルごと削除**する。

- 新規ルートを足していないのは、`.expo/types/router.d.ts` が閉じたルート型の union で、`expo start` を通すまで型エラーになるため（`.expo/` は gitignore なので新規クローンでも起きる）
- フォントは `tokens.fonts` を参照していない（`@expo-google-fonts` の導入はチケット03の範囲。未導入のフォント名を指定すると意図しないフォントに落ちて検証を誤らせる）
- **余白・角丸のスケールが DESIGN.md にも `tokens.ts` にも無い**。この仮画面ではローカル定数に閉じ込めてある。共通のスペーシングスケールを `tokens.ts` に持たせるかはチケット03で判断する
