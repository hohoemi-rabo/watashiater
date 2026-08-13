# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このリポジトリは「ワタシアター」（60〜80代シニアが自分の博物館を作るアプリ）のモノレポ。
仕様は **REQUIREMENTS.md**、見た目は **DESIGN.md** に従うこと。両方を必ず先に読むこと。

---

## 構成（セットアップ済み）

3つの**独立した npm プロジェクト**。ルートに package.json はない（workspaces 不使用）。コマンドは必ず各ディレクトリ内で実行する。

| ディレクトリ | 役割 | 技術 |
|---|---|---|
| `app/` | 書き手用アプリ（Android 先行。iPhone 向けには**同一コードを Expo Web で PWA 出力**＝チケット24〜27・REQUIREMENTS §3.7） | Expo SDK 54 / expo-router / TypeScript。コードはプロジェクト直下（`app/`・`components/`・`constants/`）、エイリアス `@/*` → `./*` |
| `web/` | 閲覧専用 Web（`/w/[slug]`。家族が URL で見るだけ） | Next.js 15.5.22 App Router / Tailwind CSS 3.4.17 |
| `worker/` | AI 生成プロキシ＋R2 署名 URL 発行 | Cloudflare Workers / wrangler 4 / vitest |

実装の着手順は **app → worker → web**（app のローカル動作を先に作り、写真アップロード・AI 生成が必要になった段階で worker、最後に web）。

- DB スキーマはルートの **`supabase/migrations/`**（番号順 SQL）が正。MCP の `apply_migration` で適用したものと同内容を必ず残す
- Supabase プロジェクト: `watashiater`（ref: `shqkwdxpjnfnctatukqn` / ap-northeast-1 / 組織 create-hohoemi）。TypeScript 型は `app/types/database.types.ts`（スキーマ変更のたびに MCP で再生成）

## 開発コマンド

```bash
# app/
npm start                     # Expo 開発サーバー（npm run android で Android 起動）
npm run lint                  # expo lint
npx tsc --noEmit              # 型チェック
npx expo export --platform android --output-dir <一時dir> --clear
                              # バンドル検証＋typed routes 再生成。
                              # 新ルート追加後は tsc の前にこれを実行（.expo/types が古いと型エラーになる）

# web/
npm run dev                   # 開発サーバー
npm run build                 # 本番ビルド（動作検証にも使う）
npm run lint                  # eslint

# worker/
npm run dev                   # wrangler dev（.dev.vars を読む）
npm test -- --run             # vitest を1回実行（watch にしない）
npx vitest run test/index.spec.ts   # 単一テスト
npm run cf-typegen            # wrangler.jsonc 変更後に型を再生成
npm run deploy                # wrangler deploy
```

- app の型チェックには `expo-env.d.ts`（CSS モジュール等の型宣言。gitignore 対象）が必要。無ければ `expo start` を一度起動すると自動生成される
- **動作検証は常に実機の Expo Go**（この開発機＝WSL2 に Android SDK・adb・エミュレータは無い）。ネイティブモジュール追加後は `npx expo start --clear`、QR がつながらないときは `--tunnel`。実機確認が要る変更はユーザーに依頼して結果を待つ

---

## チケット運用（docs/）

実装は `docs/` の連番チケットに沿って進める。**番号順＝実装順**（一覧は docs/README.md）。

- **セッション開始時**：docs/README.md と各チケット冒頭のステータス行で現在地を確認し、番号が最小の未完了チケットから着手する（**README に実装順の例外が書かれていればそちらを優先**。現在は 24〜27（書き手Web/PWA）を 22・23 より先に実装する）
- 着手前に、チケットの「参照」が指す REQUIREMENTS.md / DESIGN.md の該当節を必ず読む
- 各チケットの Todo は `- [ ]` で管理し、**完了したら `- [x]` に書き換える**。ファイル冒頭のステータス行（未着手／進行中／完了）も随時更新する
- 仕様をチケットに書き写さない。REQUIREMENTS.md / DESIGN.md が唯一の情報源（チケットは参照＋Todo＋完了条件のみ）
- 手作業を含むチケット（01・07）：01 の Supabase プロジェクト作成は supabase MCP で Claude が実行する。Google OAuth 設定（01）と Cloudflare/Gemini 準備（07）はユーザーのコンソール操作が必要なので、該当番号に来たら作業を依頼して完了を待つ
- 実装中に生じた検証結果・設計判断は該当チケットの「メモ」「検証結果」節に追記する
- **1チケット＝1つ以上の原子的コミット**。チケット完了時にステータスを「完了」へ更新してコミットに含める（チケットをまたぐ巨大コミットにしない）

---

## Git・外部ツール

- リモート: `origin` = github.com/hohoemi-rabo/watashiater。個人開発のため main へ直接コミットする（ブランチ不要）
- push はユーザーの指示時、またはチケット完了の区切りで行う
- Supabase の操作（プロジェクト作成を含む）は supabase MCP ツールで行う（ルートの `.mcp.json` で設定済み。**ローカル専用・コミット禁止**）。ただしスキーマ変更は必ずマイグレーション SQL としてリポジトリにも残す（MCP で直接変更して終わりにしない）
- `.mcp.json` はトークン直書きのまま運用する（ユーザーはプロジェクトごとに Supabase アカウントを使い分けているため、環境変数化・共通化を提案しない）

---

## バージョン固定（変更禁止）

| パッケージ | バージョン | 備考 |
|---|---|---|
| next | **15.5.22** | 16 系にアップグレードしない |
| tailwindcss | **3.4.17** | **v4 を使わない（重要・下記参照）** |
| react (web) | next 15.5.22 の peerDependencies に従う | |
| Expo SDK | **54** | 上げない（下記「既知の注意点」参照） |

### Tailwind v3 の注意（最重要）

- 設定は v3 方式（`tailwind.config.js` + `content` 配列 + `globals.css` に `@tailwind base/components/utilities`）
- `@import "tailwindcss";`（v4 方式）を書かない
- DESIGN.md §3 のカラートークンは `tailwind.config.js` の `theme.extend.colors` に定義済み

---

## アーキテクチャ

### データフロー（全体像）

- **認証・DB**: Supabase（Google OAuth / Postgres / RLS）。Supabase Storage は使わない
- **メディア（写真・音声）**: Cloudflare R2。クライアントから直接触らせない。アップロードも閲覧も必ず worker が発行する**署名付き URL** 経由
- **AI（Gemini）**: worker 経由のみ。レート制限は 1日3回/ユーザー・JST 0時リセット
- **worker の役割はこの2つだけ**（AI 生成プロキシ／R2 署名 URL 発行）。それ以外を持たせない
- **認可の2経路**: app は Supabase JWT を worker に渡して検証させる。web の閲覧 URL（`/w/[slug]`）は Next.js サーバー側で slug を検証して service role キーで読む（anon キーでの直接読み取り禁止）。閲覧 Web は全ページ noindex
- データモデルの意図は REQUIREMENTS.md §6 に固定済み（subjects / prompts / answers / recordings / photos / life_story / family_members / invite_codes / view_links / reactions）

### デザイントークン（二重管理・値の一致必須）

- app: `app/constants/tokens.ts`
- web: `web/tailwind.config.js` の `theme.extend`

DESIGN.md の色8・影3・フォント3・サイズ表を定数化してある。生値のハードコード禁止。片方を変えたら必ずもう片方も合わせる（フォントサイズのスケールだけは DESIGN.md §4 の指定でアプリと Web が意図的に別）。

---

## Next.js 15 App Router ベストプラクティス（web/）

Next.js **15.5** 向け（context7 の v15 公式ドキュメント準拠、2026-08-08 取得）。Next 16 の機能（`use cache` 等）は使わない。

- **Server Components がデフォルト**。`'use client'` は操作が必要な末端（音声再生・開幕演出・拡大表示など）にだけ付ける。`'use client'` を付けたファイルが import するものはすべてクライアントバンドルに入るため、境界はできるだけ葉に近く・小さく保つ
- **データ取得はサーバー側で完結**させ、Client Components へは表示用の値だけを props で渡す。`SUPABASE_SERVICE_ROLE_KEY` を扱うモジュールは `server-only` パッケージを import してクライアント混入をビルドエラーで防ぐ
- **Next 15 は `fetch` がデフォルト非キャッシュ**（`no-store`）。キャッシュしたい場合のみ `cache: 'force-cache'` を明示。worker から取得する**署名付きURLは有効期限があるためキャッシュしない**こと
- **動的 API は Promise**：`params` / `searchParams` / `cookies()` / `headers()` は `await` が必要（例：`const { slug } = await params`）。`generateMetadata` の `params` も同様
- 無効・失効 slug は `next/navigation` の **`notFound()`** で404にする
- **noindex は metadata で宣言**：ルートレイアウトの `metadata` に `robots: { index: false, follow: false }`（全ページ必須。REQUIREMENTS §3.6）
- 同一リクエスト内で同じデータを `generateMetadata` とページ本体の両方で使う場合は、`cache: 'force-cache'` か React の `cache()` でメモ化して二重取得を避ける

### 閲覧Webが使う既存の口（チケット17・08で実装済み）

- **slug の実体**：`view_links`（`slug` unique・`is_active`・**有効リンクは subject に1本**の partial unique）。無効化は `is_active=false` にするだけ。RLS は本人のみなので、web は service role で読む
- **メディアの署名URL**：`POST ${WORKER_URL}/media/view-urls` に `{ r2Keys, slug }` を投げる（**Authorization ヘッダーを付けないこと**。worker は「ヘッダーがあれば JWT 経路・無ければ slug 経路」で分岐し、フォールバックしない）。無効・存在しない slug は 403「リンクが無効になっています」。キーは1リクエスト1 subject・最大200件・有効期限1時間なのでキャッシュしない
- 机の上の再現はアプリと同じ座標契約（`app/lib/board-layout.ts` のルール）に従う＝チケット21

---

## 環境変数の命名

| 場所 | 変数 |
|---|---|
| app (.env) | `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_WORKER_URL` / `EXPO_PUBLIC_WEB_URL`（閲覧Webのベース＝`https://watashiater.vercel.app`） |
| web (.env.local) | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（サーバー側のみ） / `WORKER_URL` |
| worker | シークレットは `GEMINI_API_KEY` / `SUPABASE_SECRET_KEY` / `SIGNING_SECRET`（ローカルは `.dev.vars`＝`.dev.vars.example` をコピー、本番は `wrangler secret put`）。`SUPABASE_URL` は秘密ではないので `wrangler.jsonc` の `vars`。JWT シークレットは無い（公開 JWKS・ES256 で検証。docs/07） |

- API キー類をクライアントコードに直書きしない。各ディレクトリの `.env.example` / `.dev.vars.example` だけをコミットする
- ルートの `.mcp.json` は Supabase アクセストークンを含むため gitignore 済み。コミットしないこと

---

## 実装ルール（要点の再掲）

1. **MVP スコープ厳守**：REQUIREMENTS.md §2.2 の項目（ペット・課金・通知・コメント・iOS・会話型 AI）を実装しない。先回りの抽象化もしない（`subject_type` カラムのみ例外）
2. **デザイントークン**：上記の定数ファイルから参照する。生値ハードコード禁止
3. **文字サイズ変更機能を作らない**（DESIGN.md §11-3）
4. **UI 文言は日本語・やさしい言葉**。REQUIREMENTS.md の文言（「みたよ」「ならべかえ」「じぶん史をつくる」）をそのまま使う。**ひらがなの分かち書きにしすぎず、日常的な漢字をスペースなしで使う**（例：「自分でかく」「声で話す」。チケット06でのユーザー指示）
5. AI 呼び出し・R2 アクセスは必ず worker 経由。レート制限は 1日3回/ユーザー・JST 0時リセット
6. 迷ったら判断基準は「シニアの書き手が一人で迷わず使えるか」。判断内容はコードコメントに残す

## 実装で確立したパターン（チケット00〜21。詳細は各チケットのメモ）

- **認証**：`lib/auth-context.tsx` の `useAuth()`（session / subject / memberships / restoredFromCache / signInWithGoogle / signOut / refreshSubject）。ルートガードは `app/_layout.tsx` の AuthGate。ログインは Expo Go 制約により**ブラウザ経由の `signInWithOAuth`**（Supabase の Redirect URLs に `exp://**` 登録済み。Android 用 OAuth クライアントはリリースビルドまで不要）
- **データ取得**：`lib/use-prompts.ts`（画面フォーカス毎に refetch。保存して戻ると一覧・進捗が自動追随）。「回答済み」＝answers に行が存在する
- **共通UI**：`components/` の sky-background / app-text / app-card / prompt-card（演目札）/ primary・secondary-button / back-button / progress-dots。tokens.ts の spacing・radii は app 専用の実装規約（web と値一致必須の対象外）
- **非同期処理直後の分岐は処理の戻り値で行う**。setState 直後に state を読まない（チケット04で実際に起きたバグの教訓）
- **入力を伴う画面**：保存ボタンはスクロール外の固定フッター（キーボードの真上に浮く）。TextInput に lineHeight を指定しない（Android はカーソルが行の高さいっぱいに描かれる）。書きかけ保護は `usePreventRemove`
- **メディア（チケット09）**：worker 呼び出しは `lib/worker-api.ts`（署名URL発行・PUT・閲覧URL一括。エラーは日本語 message の `WorkerApiError`）。アップロードは legacy `FileSystem.uploadAsync`（worker が Content-Length 必須のため）。画像表示は expo-image で `source={{ uri, cacheKey: r2_key }}`（署名URLのクエリは毎回変わる）。DB 行削除時も R2 オブジェクトは消さない（回収はチケット18。docs/09 メモ）
- **worker（チケット08）**：本番 URL は `https://watashiater-worker.rabo-hohoemi.workers.dev`（app の `EXPO_PUBLIC_WORKER_URL`・web の `WORKER_URL` はこれ）。構成は素の fetch ルーター（`src/index.ts`）＋JWT検証 `verifyAccessToken`（`src/auth.ts`・公開 JWKS）＋PostgREST 照会（`src/supabase.ts`・sb_secret は apikey ヘッダーのみ）＋エラー形式 `jsonError`（`src/http.ts`。`{error:{code,message}}`・日本語 message。チケット11の生成 API も同形で返す）。テストは `test/helpers.ts` の fetchMock ヘルパーを再利用（JWKS モックは persist＋事前1回読みが必須・PostgREST モックは1回消費）
- **AI生成（チケット11）**：`POST /ai/life-story`（`src/ai.ts`）。`{answers:[{title,body}]}` → `{bodyText, remaining}`。モデルは `gemini-3.6-flash` 固定（2.5-flash は新規キーで404。thinking は 3.x の `thinkingLevel:"minimal"`）。レート制限は KV バインディング `RATE_LIMIT`（`gen:<userId>:<JST日付>`・成功後のみカウント・非アトミック許容）。エラーコードと申し送りは docs/11 メモ参照
- **じぶん史画面（チケット12）**：`app/story.tsx`＋`components/curtain-overlay.tsx`。幕演出はアプリ内でここだけ（DESIGN §7）。CSS アニメは完了コールバックが無いので setTimeout でフェーズ進行し、**開幕は閉幕完了の Promise を await**（429 は幕が閉じ切る前に返る）。生成成功・保存失敗時は本文を捨てず保存だけリトライ。残り回数は「もういちどつくる（あと N 回）」とボタンに表示（詳細は docs/12 メモ）
- **机の上ボード（チケット13）**：`app/gallery.tsx`＋`lib/board-layout.ts`（座標契約：ボード幅=1 正規化・中心座標・度・z 整数。**14/17/21 はこの契約に従う**）＋`lib/use-board-photos.ts`＋`components/board-polaroid.tsx`/`desk-board.tsx`。配置は `fnv1a(photo.id)^board_seed` で決定的（枚数増減で他の写真が動かない）。木目はテクスチャ画像（`app/scripts/gen-wood-tile.mjs` で生成）・**机の縁は作らない**（ユーザー判断で削除・DESIGN §5 更新済み）。重なりは z 昇順の描画順で表現（詳細は docs/13 メモ）
- **ならべかえ（チケット14）**：`components/draggable-polaroid.tsx`＋`lib/board-save.ts`。見た目＝基準位置＋offset 共有値で、ドロップはワークレット内で畳み込む（跳ね戻りゼロ）。長押し220msでつまむ（スクロールとの取り合いは activateAfterLongPress で解決）・最前面 zIndex はドラッグ中のみ・保存はドロップ毎4項目セット・失敗は revertSignal で元へ。`GestureHandlerRootView` は `_layout.tsx` に追加済み。共有値は `.get()/.set()`・コールバックに `'worklet'` 明示（詳細は docs/14 メモ）
- **録音の検証済み事実**（チケット00）：AAC は `RecordingPresets.HIGH_QUALITY` のみ／`record({ forDuration })` は実機で有効／3分＝約2.78MB／`File.type` はアップロードの Content-Type に使わない（詳細は docs/00 検証結果）
- **録音（チケット10）**：本番プリセットは HIGH_QUALITY ベースの 1ch/64kbps（3分≈1.4MB・耳確認済み）。1回答1録音＝`recordings` は upsert(`onConflict:'answer_id'`)。保存順序は「PUT → answers 行の用意 → upsert」（空行の失敗経路を作らない）。録音まわりの機微は `components/recording-box.tsx` 冒頭コメントと docs/10 メモ
- **写真が語る（チケット15）**：`components/photo-lightbox.tsx`（画面内 absoluteFill オーバーレイ。Modal は使わない）。閉じる＝即アンマウント＝`useAudioPlayer` の解放で音が確実に止まる。背景は `DIMMED_SKY`（skyTop+stageNavy の混色。黒背景禁止）。音声読み込み失敗は10秒タイムアウトで検知（SDK 54 の AudioStatus に error が無い）
- **家族・共有（チケット16）**：`public.redeem_invite_code` RPC が `family_members` への唯一の登録経路（INSERT ポリシーは意図的に無し）。**業務エラーは RAISE せず discriminated jsonb で返す**（`lib/family-join.ts` がパース）。家族の閲覧は専用 `/family/*` ルート（既存画面に readOnly フラグを差し込まない）。みたよは楽観更新＋23505 は成功扱い（`lib/use-my-reactions.ts`）。招待コードは7日・使い捨て・32文字アルファベット（`lib/invite.ts`）
- **閲覧リンク（チケット17）**：`lib/view-link.ts`。有効リンクは subject に1本（partial unique）なので**再発行は「止める→作り直す」の2段階**。worker の slug 経路（`/media/view-urls` の `{slug}`）は実装・本番検証済み。**`EXPO_PUBLIC_WEB_URL` は `https://watashiater.vercel.app`**（チケット21のデプロイで確定済み）
- **アカウント削除（チケット18）**：順序は worker `POST /media/wipe`（R2 の `subjects/<id>/` を prefix 一括削除。孤児も回収）→ RPC `delete_own_account`（auth.users の DELETE で全カスケード）→ signOut。**逆順にすると prefix を導出できず孤児が残る**。`lib/account.ts` に集約。SecondaryButton の `destructive` prop は削除系専用（errorRed）
- **オフライン（チケット19）**：`lib/offline-cache.ts`（AsyncStorage・`wt:v1:` 接頭辞）＋`lib/use-online.ts`（`useIsOnline()`。`isConnected === false` のときだけオフライン扱い）＋`components/offline-note.tsx`。**フックの契約＝error を立てるのは見せるものが何一つ無いときだけ**（キャッシュがあれば error は null のまま＝画面の `!error` ゲートを書き換えない）。キャッシュ水和は通信より先（postgrest の GET リトライ待ちを隠す）。**自分の博物館だけ**キャッシュ（家族分は残さない）。写真の閲覧URLは「署名URLをキャッシュしない」原則の唯一の例外（expo-image が `cacheKey` でディスクを引くため。声はオンライン前提）。書き込みは `useIsOnline()` で無効化＋案内。ログアウト・アカウント削除で全消し
- **閲覧Web基盤（チケット20）**：`web/lib/supabase-server.ts`（`server-only`＋素の PostgREST fetch。`@supabase/supabase-js` は使わない・secret キーは apikey ヘッダーのみ）＋`web/lib/museum.ts`（`getMuseumBySlug()`。**認可は `view_links?slug=…&is_active=is.true` の1行に集約**し、得た subject_id 以外は読まない。slug 形式は `/^[a-z2-7]{16}$/` で DB 照会前に検証。React `cache()` でメモ化するが**署名URLは含めない**）＋`web/lib/worker-api.ts`（Authorization なし・失敗しても `{}` を返して本文は読ませる）。写真は `next/image` を使わず素の `<img>`（署名URLは毎回変わる）。`/` はページを置かない＝404。404/エラーの受け皿は `app/not-found.tsx`・`app/error.tsx` で自前。next/font の `subsets` は**プリロード対象の選択にしか効かず**日本語グリフは自前ホストされる（`['latin']` でよい。docs/20 メモ）
- **閲覧WebのUI（チケット21）**：`web/lib/board-layout.ts` は `app/lib/board-layout.ts` の**逐語コピー**（`diff` がヘッダーだけになる状態を保つ。片方を直したら必ず両方）。**座標契約は CSS だけで満たす**（JS で測らない）＝ボード `aspect-ratio: 1/H`・ポラロイド `width: 42%`・`left: x*100%` / `top: (y/H)*100%` ＋ `translate(-50%,-50%) rotate(Ndeg)`。配置計算はサーバー側で確定させてクライアントに数値だけ渡す。開幕（`components/curtain.tsx`）の非表示2経路（既読・reduced-motion）は**CSS だけ**で閉じ、既読判定は描画前のインラインスクリプトが `<html data-curtain>` を立てる（JS で後から消すと赤画面が1フレーム出る／`<html>` に `suppressHydrationWarning` が要る）。演目札の切り欠きは CSS マスク（影は外側の要素に持たせる）。**自動再生は拒否されうる**ので `play()` の reject を「声を聞く」ボタンに落とす。署名URL失効からの復帰は `router.refresh()`。本番は Vercel プロジェクト `watashiater`（Root Directory = `web/`。環境変数3つを Production/Preview に登録済み）
- **書き手Web/PWA（チケット24 完了。実装は25〜27・仕様は REQUIREMENTS §3.7）**：方針＝**worker・DB・閲覧Web・Android の挙動は変えない**（Web で動くときだけ通る道を横に足す）。分岐の形は「共通部分が支配的なファイルは `Platform.OS === 'web'`、Web 専用の実装に置き換わるものは `.web.ts`」（`auth-context.tsx` は前者。判断はコードコメントに残す）
  - **本番URL**：書き手Web = `https://watashiater-app.vercel.app`（Vercel プロジェクト `watashiater-app`。閲覧Web の `watashiater` とは**別プロジェクト**。Root Directory = `app/`・設定は `app/vercel.json`）。`web.output: "single"` なので **SPA rewrite（全パス→`/index.html`）が必須**。`app.json` の `"static"` には戻さない（Supabase 認証が Node 上で `window` を触って落ちる）
  - **録音形式は `audio/mp4;codecs=mp4a.40.2`（コーデックまで明示）**。Chrome 151・iOS Safari 26.6 の両方で `isTypeSupported` = true。**コンテナだけの `audio/mp4` を指定してはいけない**（Chrome が MP4 に Opus を入れる＝AAC 要件違反）。expo-audio の Web recorder をそのまま使えるが、指定場所は **`web: { mimeType }`**（`useAudioRecorder` は `createRecordingOptions()` で `options.web` をトップレベルへ展開するので、トップレベルに置くと黙って捨てられ既定の `audio/webm` になる）。Safari は type を `audio/mp4; codecs=…`（**空白入り**）で返すので完全一致で比べない
  - Web で動かないもの：`FileSystem.uploadAsync`（legacy は全 throw → `fetch` の PUT に差し替え。Blob body なら Content-Length は自動）／`AudioModule.getRecordingPermissionsAsync()`（**その場で `getUserMedia` を呼ぶ**＝画面を開いただけで許可ダイアログ。起動時の状態確認に使わない）／`RecorderState.metering`（波形が動かない）／`Linking.openSettings()`
  - Web でそのまま動くもの：`lib/photo-attach.ts`（`pickPhotos`・`compressPhoto`。iPhone の写真も JPEG で入り長辺1600pxになる）／`forDuration` の3分自動停止
  - **worker には CORS がある**（`worker/src/cors.ts`。チケット24 で追加）。許可オリジンは `wrangler.jsonc` の `vars.ALLOWED_ORIGINS` にカンマ区切り**完全一致**で列挙する。ブラウザから叩くオリジンを増やしたらここに足すこと（ワイルドカード非対応）
  - **Supabase の URL Configuration**：Redirect URLs に書き手Web の URL を**末尾スラッシュ無し**で登録する（アプリは `window.location.origin` を渡す）。Site URL を既定の `http://localhost:3000` のままにしない（許可外の `redirect_to` は黙ってここへ飛び、原因の読めない「アクセスできません」になる）
  - フォントは**必ずウェイトのサブパスから import**（`@expo-google-fonts/noto-sans-jp/400Regular` 等。ルート import は全19ウェイト106MBがバンドルに入る）。Web は TTF 4ウェイト23MB のままなので**チケット25で woff2 分岐が必須**

## 技術検証を最初にやること

音声入力（テキスト化）と録音（expo-audio）の同時動作は端末依存の恐れがある。
**まず「録音＋手動テキスト」の2本立てで実装し、同時動作は実機検証後に統合する**（REQUIREMENTS.md §3.2）。

---

## 既知の注意点

- Expo SDK は **54 に固定**（2026-08-08 時点）。ユーザー端末の Expo Go が新しい SDK のプロジェクトを開けず「This project requires a newer version of Expo Go」になるため、動作実績のある SDK 54 環境（expo ~54.0.35 / react-native 0.81.5 / react 19.1.0）に合わせて再スキャフォールドした。上げる場合は実機の Expo Go が対応する SDK を先に確認し、`npx expo install --fix` で揃えること
- `worker/wrangler.jsonc` の `compatibility_date` はローカル workerd の対応上限（2026-03-10）に合わせてある。無闇に上げない（テストで警告が出て本番と挙動が乖離する）
- `npm audit` が next 15.5.22 同梱の postcss / sharp の脆弱性を報告するが、修正には next 16 が必要なため対応不可（意図的な妥協。README 参照）
- `app/AGENTS.md`（Expo SDK 57 ドキュメント参照）と `worker/AGENTS.md`（Cloudflare 向け）はスキャフォールド生成物で有効。web 側の AGENTS.md は Next 16 向けの内容だったため削除済み — 復活させない
