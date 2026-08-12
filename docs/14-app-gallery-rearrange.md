# 14. ギャラリー：ならべかえ

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.4①（ならべかえモード） / DESIGN.md §7（ドラッグ中は shadow-lifted）
- 依存: 13

## 目的

「ならべかえ」モードでのみ写真を自由配置できるようにする。

## Todo

- [x] 「ならべかえ」ボタンでモード切替（通常の閲覧モードではドラッグ不可）
- [x] ドラッグで位置移動（ドラッグ中は shadow-lifted で浮き上がる）
- [x] 写真ごとに x / y / 回転角 / 重なり順を `photos.board_*` に保存
- [x] 「もとにもどす」で `board_*` を null に戻し自動整列へ（破壊的操作なので確認ダイアログ）

## 完了条件

並べ替えた配置がアプリ再起動後も再現され、「もとにもどす」で自動整列に戻る。

## メモ

### 設計判断（詳細は `app/components/draggable-polaroid.tsx` 冒頭コメント）

- **見た目の位置＝基準位置（resolveBoardPlacements の結果）＋ offset 共有値**。ドロップは onFinalize ワークレット内で translation を offset に畳み込む（同一フレーム）ため、React の再描画を待つ方式で起きる「1フレームの跳ね戻り」が構造的に起きない。React state（overrides）は z ソート・ボード高さ・DB保存にだけ使う
- **長押し 220ms でつまむ**（`Gesture.Pan().activateAfterLongPress(220).maxPointers(1)`）。待機中に指が動くと Pan が fail して ScrollView が普通に勝つ＝スクロールとの取り合いは長押しで解決。持ち上げ時に `Haptics.impactAsync(Light)`（expo-haptics 初使用）
- **最前面は zIndex（ドラッグ中の1枚だけ）**。ジェスチャー中に兄弟の並べ替えをしない（GestureDetector の再アタッチ回避）。静止時は13の「描画順=重なり」を維持。ドロップで z=maxZ+1 の override と draggingId クリアを同一コミットで行う
- **保存はドロップ毎**（4項目セット）。失敗時は override を捨てて `revertSignal` で元の位置へ滑って戻す（嘘の配置を見せない）。**後続の保存が成功したらエラー表示を消す**（実機フィードアック反映：機内モード解除後に出しっぱなしだった）
- **回転はドラッグで変えない**（現在の実効値を書き戻す。2本指回転はシニアの書き手向けに不採用——意図的判断）
- `GestureHandlerRootView` を `_layout.tsx` 最外殻に追加（RNGH 初使用。Android でジェスチャー活性化時にネイティブスクロールを取り消す役目も担う）。babel 設定は不要（babel-preset-expo が worklets plugin を自動適用）
- React Compiler 対応：共有値は `.get()/.set()`・gesture オブジェクトを手動 memo しない・コールバックに `'worklet'` 明示

### 検証結果

- tsc / lint / expo export クリーン
- 実機（Expo Go・2026-08-12）：長押しつまみ・追従・跳ね戻りなし・再起動後の配置再現（完了条件）・もとにもどす・機内モードの失敗→復帰、すべて動作OK（ユーザー確認済み）

### チケット15への申し送り

- タップ拡大は `DraggablePolaroid` の内側（BoardPolaroid）を Pressable で包むか、Tap ジェスチャーを Pan と `Gesture.Exclusive` で組む。閲覧モードでは Pan が disabled なのでタップは自由
- 拡大表示の背景は「空色を少し濃くする」程度（DESIGN §7。夜にしない）
