# 24. 書き手Web（PWA）：技術検証（録音・写真・ログイン）

- ステータス: 進行中（検証の足場は用意ずみ。実機での計測待ち）
- 参照: REQUIREMENTS.md §3.7 / §4.2（写真圧縮規格） / docs/00（検証チケットのやり方）
- 依存: 21（録音の再生確認に閲覧Webを使う）

## 目的

PWA 化の前提となる3つの未知（録音形式・写真の選択と圧縮・OAuth リダイレクト）を
ブラウザの実挙動で確定させ、25・26 の設計判断に落とす。本実装はしない（00 と同じ検証チケット）。

## Todo

- [ ] 録音：`MediaRecorder`（`audio/mp4`）で録音 → worker の署名URLへ PUT → 閲覧Web `/w/[slug]` で再生、を **PC Chrome と iPhone Safari の両方**で通す。worker の `.m4a`/`audio/mp4` 固定を変えずに済むかを確定する
- [ ] 録音の3分上限（`forDuration` 相当の自動停止）と、3分録ったときのサイズ感を確認
- [ ] 写真：`expo-image-picker` / `expo-image-manipulator` が Web でどこまで動くか確認。不足なら `<input type="file">`＋Canvas（長辺1600px / JPEG品質80）の方式を確定
- [ ] ログイン：`signInWithOAuth` を Web のリダイレクト（`http://localhost:8081` → 本番 `https://`）で通す（Supabase の Redirect URLs 追加はユーザー作業。該当箇所に来たら依頼する）
- [ ] 主要画面（ホーム・お題一覧・回答・ギャラリー・じぶん史・共有・せってい）の RN Web 描画をざっと確認し、崩れ・操作不能の箇所を洗い出してメモに列挙する

## 完了条件

録音が「iPhone Safari で録れて、worker 経由で保存でき、閲覧Webで再生できる」ところまで実証されて
形式が確定している。写真・ログインの実装方式が決まり、画面の課題一覧がメモに残っている。

## 検証のやりかた

検証用 URL：**https://watashiater-app.vercel.app**（Vercel プロジェクト `watashiater-app`。
閲覧Web の `watashiater` とは別プロジェクト）。検証画面は **`/web-check`**。

1. 上の URL を開いて「Google でログイン」。ページごと Google へ飛んで戻ってくる
2. `https://watashiater-app.vercel.app/web-check` を開く
3. **開いた直後にマイクの許可ダイアログが出るかどうかを先に見る**（出たらそれ自体が結果）
4. 画面のカードを上から順に押していく（A → B の録音、閲覧URL、回答への紐づけ、写真）
5. いちばん下の「ログをコピー」で全文をコピーして貼り戻す
6. 3分の自動停止は、録音を始めて放置して確かめる
7. 回答に紐づけたら、閲覧Web `https://watashiater.vercel.app/w/<slug>` を開いて声が鳴るか確かめる
8. 最後に主要画面（ホーム・お題一覧・回答・ギャラリー・じぶん史・共有・せってい）を
   ひととおり触って、崩れ・操作できないところを控える

### 検証のために先に入れたもの（本実装ではないもの／あるもの）

| もの | 位置づけ |
|---|---|
| worker の CORS（`worker/src/cors.ts`） | **本実装**。ブラウザから worker を叩けないと検証が1つも成立しないため先に入れた。許可オリジンは `wrangler.jsonc` の `vars.ALLOWED_ORIGINS` に完全一致で列挙。本番デプロイ済み・動作確認済み |
| Web のログイン（`lib/auth-context.tsx` の `Platform.OS === 'web'` 分岐） | **本実装**。ログインできないと DB も worker も叩けないため。整理は 25 |
| `app/vercel.json` | 暫定。`web.output: "single"` なので全パスを `/index.html` に rewrite しないと `/web-check` の直リンクが 404 になる。25 で PWA 設定と一緒に見直す |
| `app/app/web-check.tsx` | **一時**。docs/00 の `recording-check.tsx` と同じ扱いで、チケット26 でファイルごと削除する |

## メモ

### 事前調査（2026-08-13。チケット起票前の下書き検証）

- `app.json` の `web.output` を `"single"`（SPA）にすると `npx expo export --platform web` が通る
  （既定の `"static"` は静的レンダリング時に Supabase 認証が Node 上で `window` を触って落ちる）。
  変更・コミット済み
- 出力をブラウザで開くと**オンボーディングがアプリと同等に描画される**
  （コンソールエラー0・失敗リクエスト0。react-native-svg / reanimated / gesture-handler 込み）
- Chromium の MediaRecorder 対応：`audio/mp4` **true** / `audio/webm;codecs=opus` true /
  `audio/mp4;codecs=mp4a.40.2` **false**（コーデックまで指定すると弾かれる。mimeType は `audio/mp4` までにする）/
  `audio/ogg;codecs=opus` false
- フォントは使う4ウェイトだけでも TTF 23MB。Web 配信ではサブセット woff2 への分岐が必須（チケット25の仕事）
- Firefox の MediaRecorder は webm/opus のみの可能性が高い。対象（iPhone Safari・PC Chrome/Edge）を
  優先し、Firefox はフォールバック（録音不可の案内 or webm 許容）をこのチケットで判断する

### コードを実読して分かったこと（2026-08-13。実機検証の前提になる事実）

`app/node_modules` の Web 実装をそのまま読んで確認した。実機で覆る可能性があるものは
「検証結果」で上書きする。

- **worker には CORS が無かった**（`src/index.ts` 冒頭に「付けていない」と明記されていた）。
  ブラウザから `/media/upload-urls` と署名URL `PUT` を叩く＝プリフライトが飛ぶので、
  これが無いと検証が1つも通らない。**チケット26 の完了条件「worker のコード・テストは
  無変更のまま」はこの時点で成立しない**（→ 26 を改訂した）
- **`expo-audio` には Web の録音実装がある**（`AudioModule.web.js` の `AudioRecorderWeb`＝
  MediaRecorder のラッパー）。ただし次の4点があるので、そのままでは使えない：
  - 既定の mimeType は `RecordingPresets.HIGH_QUALITY.web.mimeType = 'audio/webm'`。
    **Chrome では webm になる**が worker は `audio/mp4` 固定で保存するので中身と宣言がずれる
  - `createMediaRecorder` は型に定義された `options.web.mimeType` を読まず、
    **トップレベルの `options.mimeType`** を見る（型に無い）。`audio/mp4` を通すにはキャストが要る
  - `getRecordingPermissionsAsync()` は Permissions API で判定できないと
    **その場で `getUserMedia` を呼ぶ**。Safari は microphone の query に未対応なので、
    回答画面を開いた瞬間にマイク許可ダイアログが出る（「文脈なしにダイアログを出さない」に反する）
  - Web の `RecorderState` に **`metering` が無い**（波形は動かない）／`uri` は `blob:` URL
  - `forDuration` は setTimeout で実装されている（3分の自動停止は効くはず）
- **`expo-image-picker` は Web 実装あり**（隠し `<input type="file">`）。`uri` は `blob:` で
  width/height も取れる。ただし **`selectionLimit` は無視される**（`pickPhotos` の
  `.slice(0, remaining)` の保険がそのまま効く）
- **`expo-image-manipulator` は Web 実装あり**（canvas）。`saveAsync` は
  `canvas.toBlob(cb, 'image/jpeg', compress)` なので、`compressPhoto()`（長辺1600px・品質80）は
  無改造で動く見込み
- **`expo-file-system` の legacy は Web では全メソッドが throw する shim**
  （`ExponentFileSystemShim`）。`putObject()` の `FileSystem.uploadAsync` は確実に差し替えが要る
- **`expo-web-browser` の Web 版 `openAuthSessionAsync` は `window.open` のポップアップ**＋
  postMessage。iPhone Safari でブロックされうるので、Web はフルページリダイレクトにした

### 検証結果

（実機で計測したら、docs/00 と同じ形式でここに書く）
