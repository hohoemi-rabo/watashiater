# 25. 書き手Web（PWA）：基盤（フォント・PWA・デプロイ）

- ステータス: 進行中
- 参照: REQUIREMENTS.md §3.7 / DESIGN.md §3（テーマ色）・§12（トークン） / CLAUDE.md「アーキテクチャ」
- 依存: 24

## 目的

書き手 Web を配れる土台を作る。iPhone で「ホーム画面に追加」すればアプリのように起動する状態まで。

## Todo

- [x] フォント読み込みの Web 分岐：Web ではサブセット woff2 を使う（TTF 23MB を配らない）。app のネイティブ経路（useFonts＋サブパス import）は変えない → **サブセット自作ではなく Google Fonts の unicode-range 分割を流用**（メモ参照）
- [x] PWA マニフェスト（名前「ワタシアター」・アイコン・`display: standalone`・テーマ色は tokens から）
- [x] Service Worker（最小構成。**署名URLはキャッシュしない**原則を守る）
- [x] `<title>` を「ワタシアター」にする（いまは Expo 既定の `app`）
- [x] アイコンを作る（Expo 既定の青いAマークのままだった。仮アイコン。本番は23）
- [x] Vercel に**新規プロジェクト**としてデプロイ（閲覧Web `watashiater` とは別。Expo の静的出力）→ チケット24 で先行。`watashiater-app`（https://watashiater-app.vercel.app）。`app/vercel.json` に build/output と SPA rewrite
- [x] `EXPO_PUBLIC_*` 環境変数のビルド時埋め込みを本番用に設定 → 24 で Production に4本登録ずみ。**Preview 環境は未登録**（CLI が対話を要求して入らなかった。GitHub 連携するときに入れる）
- [x] Supabase の Redirect URLs に本番 URL を追加（ユーザー作業）→ 24 で実施ずみ（ログインが通ることを実機で確認）
- [ ] Vercel プロジェクトを GitHub 連携にする（24 は CLI からの直接デプロイ。main への push で自動デプロイにしたい）

## 完了条件

本番 URL をブラウザで開いて Google ログインができ、iPhone で「ホーム画面に追加」すると
standalone（アドレスバーなし）で起動する。

## メモ

### フォント：サブセットを自作せず Google の分割をそのまま使う

**やったこと**：`app/scripts/gen-web-fonts.mjs` が Google Fonts の CSS を1回取得し、
書体名だけ `constants/tokens.ts` と同じ名前に書き換えて `public/fonts/fonts.css` として保存する。
woff2 の実体は fonts.gstatic.com のまま。生成物はコミットする（ビルド時に外部通信しない）。

**なぜ自前サブセットにしなかったか**：Google の CSS は 492 スライスに分かれていて、
ブラウザは `unicode-range` を見て**画面に出る文字を含むスライスだけ**を取りに行く。
自分で「よく使う漢字」に絞ったファイルを作ると、この賢さを捨てて全部を落とすことになる
（見積もり 約1.5MB）。また稀な漢字（人名の 𠮷 など）が代替フォントに落ちる。

| | 変更前 | 変更後 |
|---|---|---|
| Web 出力の合計 | 28MB | **5.2MB** |
| 出力に含まれる TTF | 4本 23MB | **0本** |
| フォント CSS（本番・brotli 後） | — | **35KB** |

**プラットフォーム差し替えは `.web.ts`**（`lib/app-fonts.ts` / `lib/app-fonts.web.ts`）。
`Platform.OS` の分岐では **import 文が残って Metro が TTF を Web バンドルに同梱してしまう**ため、
ファイルごと分ける必要がある。Android 出力に TTF 4本が残っていることは export で確認ずみ。

書体名を CSS 側で合わせたので、`constants/tokens.ts` も各画面も無変更。
`@font-face` は実際に使われた書体しか取りに行かないので、Shippori Mincho は
じぶん史を開くまで読み込まれない（`useFonts` の一括ロードより軽い）。

### `public/index.html` の落とし穴

Expo は `public/index.html` があればそれをテンプレートとして使い、
html の lang と title のプレースホルダーを `app.json` の `web.lang` / `web.name` で置換する。
置換は**素の `String.replace`＝最初の1件だけ**なので、
**コメントにプレースホルダーの綴りを書くとそちらが置換されて本体が未置換のまま出る**。
実際に一度これで `<title>%WEB_TITLE%</title>` のまま出力された。ファイル冒頭に注意書きを入れてある。

`viewport-fit=cover` は**付けない**。付けないほうが iOS は standalone でもコンテンツを
セーフエリア内に収めてくれる。付けると全画面になり `SkyBackground` の `SafeAreaView` と
二重に効く。代わりに `html` に空グラデ（sky-top → sky-bottom）を敷いて、
セーフエリア外に出る上下の帯がアプリの背景とつながって見えるようにした。

### Service Worker：別オリジンには一切手を出さない

「**署名URLはキャッシュしない**」（CLAUDE.md アーキテクチャ）を、URL の除外リストではなく
`url.origin !== self.location.origin` の1判定で担保している。worker（署名URL）も Supabase も
gstatic もすべて別オリジンなので、この1行でまとめて対象外になる。
個別に除外する作りだと、呼び先が増えたときに漏れる。

- 画面の読み込みは **network-first**（cache-first にすると新しいデプロイが反映されない）
- `/_expo/static/`（内容ハッシュ付き）・`/fonts/`・`/icons/` は cache-first
- ユーザーデータのオフライン閲覧は既存の `lib/offline-cache.ts` が持つ。SW は殻だけ
- `vercel.json` で `/sw.js` に `must-revalidate` を付けている。**これが無いと SW を更新できなくなる**

### 色トークンの対応（DESIGN §3）

| 使った場所 | 値 | トークン |
|---|---|---|
| `app.json` の `web.themeColor`・manifest の `theme_color`・`html` の背景上端 | `#A8DCF0` | sky-top |
| manifest の `background_color`・`html` の背景下端 | `#FDF6E8` | sky-bottom |
| アイコンの幕 | `#E0472F` | curtain-red |
| アイコンのスポット光 | spot-yellow(`#F5B93C`) を明るく起こした `#FFECC2` | spot-yellow 由来 |

### アイコン

`app/scripts/gen-icons.mjs`（`gen-wood-tile.mjs` と同じ依存なし・決定的生成）。
DESIGN §1「マチネ（昼公演）」＋§6.1 の緞帳。**仮アイコンでチケット23 で差し替える**。
`assets/images/icon.png`（Android アプリのアイコン）は触っていない＝23 の範囲。
23 で 1024 が要るときはスクリプトの `SIZES` に足せばよい。

最初は垂れ幕の内側の端を弧にしたが、開口部が卵型になって「劇場」に見えなかったので
台形（上から裾へゆるく細くなる）に変えた。
