# 11. worker：Gemini生成＋レート制限

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.3（生成仕様・プロンプト方針） / §5（worker の役割1） / CLAUDE.md 実装ルール5
- 依存: 07

## 目的

じぶん史生成の AI プロキシを作る（API キーをクライアントに置かない）。

## Todo

- [x] 生成エンドポイント：JWT 検証 → 回答済みお題テキストを受領 → Gemini 呼び出し → 随筆調2,000字程度を返す
- [x] プロンプト実装（§3.3 の方針：一人称は本人／回答にない事実を創作しない／未回答のお題に触れない／「人生の終わり」を連想させる表現の禁止）
- [x] レート制限：1日3回/ユーザー・JST 0時リセット（保存先は KV 等から実装時に判断し、判断をコメントに残す）
- [x] Gemini エラー・タイムアウト時の整ったエラー応答（app 側でやさしく表示できる形）
- [x] vitest：レート制限の境界（3回目OK・4回目NG・JST日付跨ぎ）／JWT不正

## 完了条件

認証済みユーザーが1日3回まで生成でき、テストが通る。

## メモ

### 着手前の申し送り（チケット07〜10より）

- Gemini API キーは取得済みで `worker/.dev.vars` の `GEMINI_API_KEY` に記入済み（ローカル開発はそのまま動く）。
  **本番の `wrangler secret put GEMINI_API_KEY` は未実施**＝このチケットのデプロイ時に行う
  （SIGNING_SECRET / SUPABASE_SECRET_KEY は08で設定済み）
- キーは新形式（`AQ.` プレフィックス）。`GET /v1beta/models` での疎通確認は07で済み（HTTP 200）
- JWT 検証・エラー形式・テストヘルパーは08のものを再利用する（CLAUDE.md「実装で確立したパターン」参照）
- レート制限の保存先候補を検討する際、wrangler.jsonc の compatibility_date（2026-03-10）は変更しないこと

### 設計判断（実装時。詳細は `worker/src/ai.ts` 冒頭コメント）

- **エンドポイント**: `POST /ai/life-story`。リクエスト `{ answers: [{ title, body }] }`（1〜11件・trim後非空・title≦200字/body≦8,000字）→ レスポンス `{ bodyText, remaining }`。worker は Supabase を照会しないステートレス構成（レート制限キーは JWT の userId）。life_story への保存は app 側（チケット12）
- **レート制限の保存先は Workers KV**（バインディング `RATE_LIMIT`、namespace id は wrangler.jsonc 参照）。キー `gen:<userId>:<JST日付>`・TTL 2日で自然消滅。KV は非アトミックなので同時リクエストで1回だけ超過し得るが個人アプリ規模では許容（app 側の生成中ボタン無効化で実質防止）。カウントは **Gemini 成功後のみ**インクリメント＝失敗・タイムアウトで回数を消費しない
- **モデルは `gemini-3.6-flash` に固定**。当初計画の `gemini-2.5-flash` は 2026-08 発行の新規キーに対して 404（"no longer available to new users"）を返したため変更した。`-latest` エイリアスは中身が黙って変わるので不使用。thinking は `thinkingLevel: "minimal"` で最小化（2.5系の `thinkingBudget` とは形が違う点に注意）
- **タイムアウト**: `AbortSignal.timeout(60秒)` → 504 `upstream_timeout`。Gemini の非2xx・candidates 空・`finishReason !== "STOP"`・安全ブロック → 502 `upstream_error`（詳細はログのみ、ユーザーには一般文言）

### 検証結果

- vitest 48件（うち本チケット12件）通過・`tsc --noEmit` クリーン
- 実キーでの生成品質確認（3問のサンプル回答・2026-08-12）: 一人称・創作なし・禁止表現なし・随筆調・約1,200字（回答3問ぶんとして自然な長さ。プロンプトに「事実を足してまで長くしない」を明記済み）
- 本番デプロイ済み（`wrangler secret put GEMINI_API_KEY` 実施・KV バインディング認識確認）。スモーク: 未知パス 404 / 認証なし `/ai/life-story` 401

### チケット12への申し送り

- app からは `lib/worker-api.ts` の `postJson` で `POST /ai/life-story` に `{ answers: [{ title, body }] }` を送る（回答済み＝body_text が非空の行のみ。表示順どおりに並べる。自由お題は custom_title を title に）
- 成功レスポンス `{ bodyText: string, remaining: number }`。remaining は「今日あと何回つくれるか」で、生成後の案内表示に使える
- エラーコード: `unauthorized`(401) / `invalid_body`(400) / `invalid_answers`(400) / `rate_limited`(429) / `upstream_error`(502) / `upstream_timeout`(504)。message はそのままシニア向けに表示できる日本語（`WorkerApiError` が拾う）
- 生成は10〜30秒かかる。生成中はボタンを無効化すること（レート制限の同時リクエスト超過の実質防止も兼ねる）
