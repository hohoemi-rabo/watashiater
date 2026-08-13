# 24. 書き手Web（PWA）：技術検証（録音・写真・ログイン）

- ステータス: 未着手
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
