# 24. 書き手Web（PWA）：技術検証（録音・写真・ログイン）

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.7 / §4.2（写真圧縮規格） / docs/00（検証チケットのやり方）
- 依存: 21（録音の再生確認に閲覧Webを使う）

## 目的

PWA 化の前提となる3つの未知（録音形式・写真の選択と圧縮・OAuth リダイレクト）を
ブラウザの実挙動で確定させ、25・26 の設計判断に落とす。本実装はしない（00 と同じ検証チケット）。

## Todo

- [x] 録音：`MediaRecorder`（`audio/mp4`）で録音 → worker の署名URLへ PUT → 閲覧Web `/w/[slug]` で再生、を **PC Chrome と iPhone Safari の両方**で通す。worker の `.m4a`/`audio/mp4` 固定を変えずに済むかを確定する
- [x] 録音の3分上限（`forDuration` 相当の自動停止）と、3分録ったときのサイズ感を確認
- [x] 写真：`expo-image-picker` / `expo-image-manipulator` が Web でどこまで動くか確認。不足なら `<input type="file">`＋Canvas（長辺1600px / JPEG品質80）の方式を確定
- [x] ログイン：`signInWithOAuth` を Web のリダイレクト（`http://localhost:8081` → 本番 `https://`）で通す（Supabase の Redirect URLs 追加はユーザー作業。該当箇所に来たら依頼する）
- [x] 主要画面（ホーム・お題一覧・回答・ギャラリー・じぶん史・共有・せってい）の RN Web 描画をざっと確認し、崩れ・操作不能の箇所を洗い出してメモに列挙する

## 完了条件

録音が「iPhone Safari で録れて、worker 経由で保存でき、閲覧Webで再生できる」ところまで実証されて
形式が確定している。写真・ログインの実装方式が決まり、画面の課題一覧がメモに残っている。

## 検証のやりかた

検証用 URL：**https://watashiater-app.vercel.app**（Vercel プロジェクト `watashiater-app`。
閲覧Web の `watashiater` とは別プロジェクト）。検証画面は **`/web-check`**。

**PC Chrome → iPhone Safari の順**で同じことを2回やる（形式はブラウザごとに違うため）。
「ログ」は画面いちばん下のカードのこと（ブラウザの開発者ツールではない）。

### 手順

0. **開く**：`https://watashiater-app.vercel.app/web-check`
   - ログイン画面になったら「Google でログイン」→ 戻ったらもう一度 `/web-check` を開く
   - マイクの許可を聞かれたら「許可」。**どの時点で聞かれたかを控える**
1. **録音A**：`A で録音をはじめる` → 3〜5秒しゃべる → `A をとめる（→ 計測＋PUT）`
   - 止めたあと数秒待つ（アップロード中）。ログに `A:` の行が3〜4本増えたら次へ
2. **録音B**：`B で録音をはじめる` → 3〜5秒しゃべる → `B をとめる（→ 計測＋PUT）`
3. **再生**：`閲覧URLをとる` → `聞いてみる`（直前に上げた B が鳴る）
4. **回答に紐づけ**：「6.」のカードで回答のボタンをどれか1つ押す
5. **写真**：`写真をえらんで 圧縮＋PUT` → 1枚選ぶ → 下に写真が出るか
6. **ログ**：いちばん下までスクロール → `ログをコピー` → 貼り戻す
   （コピーできなければスクリーンショットでよい）

途中でエラーが出ても止めずに最後まで進める（ログに残るほうが有益）。

### 手順のあとに別途やること

- **3分の自動停止**：`B で録音をはじめる` を押して3分放置し、勝手に止まるか・サイズはいくつか
- **閲覧Web**：`https://watashiater.vercel.app/w/<slug>` を開いて、4で紐づけた声が鳴るか
- **Android アプリ**：同じ回答を開いて声が鳴るか（形式互換の裏取り）＋
  CORS 追加後もアプリが壊れていないか（写真をのせる／じぶん史をつくる）
- **画面のチェック**：主要画面（ホーム・お題一覧・回答・ギャラリー・じぶん史・共有・せってい）を
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

（2026-08-13。PC ブラウザから順に実施）

#### ログイン（OAuth リダイレクト）

**成立**。ただし Supabase 側の設定が2か所必要だった：

- **Redirect URLs** に `https://watashiater-app.vercel.app`（**末尾スラッシュ無し**）を登録する。
  アプリは `window.location.origin` を戻り先に渡すので、`/**` 付きだけでは足りない
- **Site URL** が既定の `http://localhost:3000` のままだと、許可されない `redirect_to` が
  黙って握りつぶされて Site URL に飛ぶ。症状は「このサイトにアクセスできません」で、
  原因が読み取れない。書き手Web の URL に変えておくこと

→ ページごとリダイレクトする方式（`auth-context.tsx` の web 分岐）で問題なし。
`openAuthSessionAsync` のポップアップ方式は不要だった。

#### マイク許可：**回答画面を開いただけでダイアログが出る**（要対処）

PC ブラウザで「お題 → 回答画面（保存ずみの声を聞こうとしたところ）」でダイアログが出た。
`components/recording-box.tsx` のマウント時 `refreshPermission()` →
`AudioModule.getRecordingPermissionsAsync()` が犯人。Web 実装は

```
query('microphone') が granted/denied で確定しなければ → requestRecordingPermissionsAsync()
                                                        → getUserMedia()（＝ダイアログ）
```

という作りなので、「まだ許可も拒否もしていない人」＝初めて開いた全員にダイアログが出る。
Safari は Permissions API の microphone 自体に未対応なので、そちらでは常にこうなる。

ネイティブでは意図どおり静かに状態だけ見られていた（docs/00・チケット10）ので、
**この関数を Web で状態確認に使ってはいけない**。チケット26 の対処案：

- Web では起動時の許可確認をしない（`phase` を `idle` 決め打ちにする）
- 許可を求めるのは「録音をはじめる」を押したときだけ＝ `getUserMedia` の成否で判定する
- `blocked` 画面の `Linking.openSettings()` は Web で機能しないので、
  ブラウザのアドレスバーの鍵アイコンから直す案内に差し替える

#### 本番の回答画面：録音はできるが「この声を のこす」で必ず失敗する

PC ブラウザで確認。表示される文言は
「つうしんに しっぱいしました。でんぱの よいところで もういちど ためしてください。」

原因は電波ではなく、`lib/worker-api.ts` の `putObject()` が使っている
`FileSystem.uploadAsync`（expo-file-system legacy）が **Web には存在しない**こと
（`ExponentFileSystemShim` が全メソッドで throw する）。その例外を `putObject` の
`catch` が `WorkerApiError('network', …)` に丸めるため、実装の穴が通信障害に化けて見える。

- 逆に言うと、**expo-audio の Web recorder で録音そのものは成立している**
  （回答画面は `RECORDING_OPTIONS` に `mimeType` を持たないので、この時点の形式は
  ブラウザ既定＝Chrome なら webm のはず。形式の確定は `/web-check` の A/B で行う）
- チケット26 では `putObject` を Web で `fetch(uploadUrl, { method:'PUT', body: blob })` に
  差し替える。Blob を body にすれば Content-Length は自動で付く（worker の 411 を満たす）
- 併せて、Web に無い API を呼んだときのエラーを「電波のせい」と読ませない扱いを検討する
  （native 側の文言は変えない）

#### 録音の形式：**`audio/mp4;codecs=mp4a.40.2` を明示すれば AAC で録れる**

PC Chrome 151（Windows）で計測。**worker の `.m4a`/`audio/mp4` 固定は変えなくてよい**。

| ブラウザ | `audio/mp4` | `audio/mp4;codecs=mp4a.40.2` | `audio/aac` | `audio/webm` | `audio/webm;codecs=opus` | `audio/ogg;codecs=opus` |
|---|---|---|---|---|---|---|
| Chrome 151 / Windows | true | **true** | false | true | true | false |
| Safari 26.6 / iOS 18.7（iPhone） | true | **true** | false | true | true | false |

**iPhone Safari でも同じ指定がそのまま通る**（対応表は Chrome と完全に一致した）。
webm まで true なのは意外だが、こちらは使わない。

**指定は必ずコーデックまで書く。** ここが今回いちばん重要な発見：

- `audio/mp4` とだけ指定すると Chrome は **`audio/mp4;codecs=opus`** を選ぶ（実測）。
  コンテナは合っているのに中身が Opus なので、REQUIREMENTS §4.2 の「AAC」を満たさないし
  Safari で鳴らない可能性が高い。**コンテナだけの指定は危険**
- `audio/mp4;codecs=mp4a.40.2` は docs/24 の事前調査時点の Chromium では false だったが、
  **Chrome 151 では true**。ブラウザ側が対応した（事前調査のメモはこの行で上書きされる）

**経路A（expo-audio の Web recorder）で足りる**＝Web 専用の録音実装は要らない。ただし指定場所に罠がある：

- `useAudioRecorder` は `createRecordingOptions()`（`utils/options.js`）を通してから
  recorder を作り、その関数が **`options.web` をトップレベルへ展開する**。
  よって `createMediaRecorder` が読む `options.mimeType` の実体は **`options.web.mimeType`**。
  型どおり `web: { mimeType }` に置くのが正しく、トップレベルに置くと**黙って捨てられて
  既定の `audio/webm` になる**（1回目の計測で webm が出たのはこれが原因）
- `bitRate` はトップレベルのままでよい（web では `audioBitsPerSecond` になる）

計測値（`numberOfChannels:1` / `bitRate:64000` 指定）：

| ブラウザ | 経路 | 実際の形式 | 長さ | サイズ | 実測ビットレート | 3分ぶんの見つもり |
|---|---|---|---|---|---|---|
| Chrome 151 | A（expo-audio） | `audio/mp4` | 5.03 秒 | 63,423 バイト | 約 101 kbps | 約 2.27 MB |
| Chrome 151 | B（素の MediaRecorder） | `audio/mp4;codecs=mp4a.40.2` | 4.5 秒 | 54,981 バイト | 約 98 kbps | 約 2.20 MB |
| iOS Safari 26.6 | A（expo-audio） | `audio/mp4` | 4.52 秒 | 37,221 バイト | 約 66 kbps | 約 1.48 MB |
| iOS Safari 26.6 | B（素の MediaRecorder） | `audio/mp4; codecs=mp4a.40.2` | 4.7 秒 | 39,297 バイト | 約 67 kbps | 約 1.50 MB |

- **`bitRate` の扱いがブラウザで違う**。Safari は 64kbps 指定を守る（3分≈1.5MB＝Android 実測
  1.4MB とほぼ同じ）が、Chrome はヒント扱いで約 100kbps になる（3分≈2.3MB）。
  どちらも worker の録音上限 10MB には余裕がある
- **Safari は mimeType を `audio/mp4; codecs=mp4a.40.2`（セミコロンのあとに空白）で返す**。
  文字列の完全一致で判定すると外れる。チケット26 で形式を判定するなら
  `startsWith('audio/mp4')` のような前方一致にするか、パラメータを落として比べること
- A の blob.type はコーデック無しの `audio/mp4` に見えるが、要求は mp4a.40.2 で通っている
  （blob: URL を fetch し直すとパラメータが落ちるため。B は生の blob なので付いたまま）

#### 再生：R2 往復・閲覧Web ともに鳴った

PC Chrome で録った AAC について確認ずみ：

- `/web-check` の「R2 から再生」（署名URL → `useAudioPlayer`）で鳴った
- **閲覧Web `https://watashiater.vercel.app/w/<slug>` でも鳴った**
  ＝ブラウザで録った声が、家族の見る側でそのまま再生できる
- **Android アプリ（Expo Go）でも鳴った**＝ブラウザ録音とネイティブ録音は相互に互換

→ **ブラウザ録音のために worker・DB・R2・閲覧Web・Android を変える必要はない**
（形式さえ `audio/mp4;codecs=mp4a.40.2` で揃っていればよい）。
これで REQUIREMENTS §3.7 の「録音は audio/mp4 に統一し、Worker の `.m4a`/`audio/mp4` 固定・
DB・R2 を変えない」は**成立すると確認できた**（残るは iPhone Safari での確認）。

#### 写真：無改造で規格を満たす

`lib/photo-attach.ts` の `pickPhotos` / `compressPhoto` は Web 実装のまま動く（**変更不要**）。

| ブラウザ | 段階 | 寸法 | 形式 | サイズ |
|---|---|---|---|---|
| Chrome 151 | 元 | 4080x3072 | image/jpeg | 3,237,741 バイト（3.09 MB） |
| Chrome 151 | 圧縮後 | （長辺1600px へ縮小） | image/jpeg | 242,933 バイト（0.23 MB） |
| iOS Safari 26.6 | 元 | 5712x4284 | image/jpeg | 5,201,351 バイト（4.96 MB） |
| iOS Safari 26.6 | 圧縮後 | **1600x1200** | image/jpeg | 623,674 バイト（0.59 MB） |

- **iPhone の写真も `image/jpeg` で入ってくる**（HEIC のままにならない）。
  `<input type="file">` 経由で Safari が変換するため、HEIC のデコード対策は要らない
- 長辺が正確に 1600px になっており、REQUIREMENTS §4.2 の規格を満たしている

#### アップロード：`fetch` の PUT で通る

`fetch(uploadUrl, { method:'PUT', body: blob })` で 200。Blob を body にすると
Content-Length が自動で付くので worker の 411 は出ない。CORS も通った
（worker の allowlist に `https://watashiater-app.vercel.app` を登録ずみ）。

#### 3分の自動停止・画面の描画

- **3分の自動停止は効く**（iPhone Safari で確認）。Web の `forDuration` は setTimeout 実装で、
  ネイティブの `record({ forDuration })` と同じ書き方のまま動く
- 3分ぶんのサイズは短時間サンプルからの外挿：**iOS Safari 約 1.5MB / Chrome 約 2.3MB**。
  docs/00 で「短時間サンプルの外挿は3分実測と 0.5% 以内で一致する」ことを確認しているので、
  この見積もりで足りる（worker の上限 10MB に対して十分な余裕）
- **主要画面の RN Web 描画に崩れ・操作不能は見つからなかった**（PC Chrome・iPhone Safari）。
  ホーム／お題一覧／回答／ギャラリー（ならべかえ含む）／じぶん史／みんなに見せる／せってい。
  reanimated・gesture-handler・react-native-svg も込みで動いている

#### iPhone のマイク許可ダイアログのタイミング（未計測。ただし結論は変わらない）

iPhone では出たタイミングを控えられなかったが、**追加の計測は不要**と判断した：

- PC で「回答画面を開いた瞬間に出る」ことは確認ずみ
- Safari は Permissions API の `microphone` に未対応なので、`getRecordingPermissionsAsync()` は
  **必ず** `requestRecordingPermissionsAsync()`＝`getUserMedia` に落ちる（コード上、例外がない）
- どちらの経路でも 26 の対処は同じ（起動時に許可を確認しない）

## 結論（25・26 への申し送り）

| 決めたこと | 内容 |
|---|---|
| 録音形式 | **`audio/mp4;codecs=mp4a.40.2`（コーデックまで明示）**。Chrome 151・iOS Safari 26.6 の両方で true。コンテナだけの指定は Chrome が Opus を選ぶので**禁止** |
| 録音の実装 | **expo-audio の Web recorder をそのまま使う**（Web 専用の録音実装は作らない）。指定は `web: { mimeType }` に置く |
| 写真 | **`lib/photo-attach.ts` は変更不要**。iPhone も JPEG で入り、長辺1600px になる |
| アップロード | `putObject` を Web で `fetch(uploadUrl, { method:'PUT', body: blob })` に差し替える（`FileSystem.uploadAsync` は Web に無い） |
| ログイン | ページごとリダイレクト。24 で実装ずみ（`auth-context.tsx`） |
| マイク許可 | 起動時に確認しない形へ作り直す（26） |
| 波形 | Web に `metering` が無い。代替を 26 で判断する |
| worker / DB / R2 / 閲覧Web / Android | **すべて変更不要**（CORS だけは 24 で追加ずみ） |

REQUIREMENTS §3.7 の前提「録音は audio/mp4 に統一し、Worker の `.m4a`/`audio/mp4` 固定・
DB・R2 を変えない」は**成立する**ことが実機で確認できた。
