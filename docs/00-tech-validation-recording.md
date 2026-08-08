# 00. 技術検証：録音＋手動テキストの2本立て

- ステータス: 進行中（実機での動作確認まち）
- 参照: REQUIREMENTS.md §3.2 / §4.2（AAC・最長3分） / CLAUDE.md「技術検証を最初にやること」
- 依存: なし

## 目的

expo-audio による録音が実機で安定動作することを確認し、回答入力を「録音＋手動テキスト」の2本立てで進める前提を固める。音声認識との同時動作の検証は**ここではやらない**（→ チケット22）。

## Todo

- [x] expo-audio を導入し、録音→停止→再生の最小プロトタイプを作る（検証用の仮画面でよい）
- [ ] AAC 形式・最長3分の制限つきで録音できることを確認
- [ ] 録音ファイルの形式・サイズ感を計測して「検証結果」に記録（アップロード設計の入力にする）
- [ ] Android 実機（Expo Go）で動作確認 ※エミュレータから変更。理由はメモ参照
- [ ] マイク権限の許可フロー（拒否時のやさしい日本語案内を含む）を確認

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

（実機実行後に記録）

### 環境

- 端末:
- 実行: Expo Go（SDK 54）
- パッケージ: expo-audio 1.1.x / expo-file-system 19.0.x

### 形式

- コンテナ/エンコーダ（設定値）: mpeg4 + aac（`.m4a`）
- 実測 MIME（`File.type`）:  ← AAC であることの確認
- 保存先:

### サイズ計測

| 長さ | サイズ | 実測ビットレート | 3分ぶんの見つもり |
|---|---|---|---|
|  |  |  |  |

理論値の目安：44.1kHz / 2ch / 128kbps ＝ 16 KB/秒 ＝ **3分で約2.88MB**。

### 3分制限

- `record({ forDuration: 180 })`（native）と JS 予備処理（181秒）のどちらが効いたか:
- 実測の超過:
- 背面に回したときの挙動:

### マイク権限

- 起動時は無音チェック（`getRecordingPermissionsAsync`）→ 初回タップで `requestRecordingPermissionsAsync`
- 拒否固定（`canAskAgain: false`）時の案内と `Linking.openSettings()`:

### metering（チケット10の波形向け）

- `isMeteringEnabled: true` で値が来るか:

### チケット09/10 への申し送り

-

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
