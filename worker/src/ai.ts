import { verifyAccessToken } from "./auth";
import { json, jsonError } from "./http";

// ── レート制限の保存先の判断（チケット11で「実装時に判断しコメントに残す」とされた項目）──
// Workers KV を採用する（キー gen:<userId>:<JST日付>、値は当日の生成回数）。
// 理由：
//  1. 必要なのは「ユーザー×日付の単純カウンタ」だけで、TTL（2日）で勝手に消える
//  2. worker の Supabase アクセスを読み取り専用のまま保てる（スキーマ変更も不要）
//  3. vitest-pool-workers が KV をローカルでシミュレートするので、境界（3回目OK・4回目NG・
//     日付跨ぎ）を実際に実行するテストが書ける
// KV は非アトミックなので、同時リクエストが重なると 1 日 3 回を 1 回だけ超え得るが、
// 個人アプリ×3回/日の規模では許容する（app 側も生成中はボタンを無効化する。チケット12）。
// Durable Objects なら厳密にできるが、この規模ではやり過ぎと判断した。
//
// カウントは Gemini 成功後にだけ増やす（失敗・タイムアウトで回数を消費させない）。
// 成功後の put が失敗した場合は、回数記録より生成済みの本文を返すことを優先する（下記）。
// ────────────────────────────────────────────────────────────────────────

// ── モデルの判断 ──
// gemini-3.6-flash（実装時点の最新安定 flash）に固定する。"-latest" エイリアスは
// リリースごとに中身が変わり、挙動・コストが黙って変わるので使わない。
// gemini-2.5-flash は 2026-08 時点で新規キーに対し 404（no longer available to new users）を
// 返すため使えない（このプロジェクトのキーは 2026-08 発行。docs/07）。
// thinking はデフォルト有効で、thinking トークンが maxOutputTokens を食い潰して
// candidates が空になり得るため、thinkingLevel: "minimal" で最小化する（散文生成に思考は不要）。
// 注意：2.5 系の thinkingConfig は thinkingBudget（数値）で、3.x 系とは形が違う。
// ────────────────────────────────────────────────────────────────────────
const MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// 1日3回/ユーザー・JST 0時リセット（REQUIREMENTS §3.3）
const DAILY_LIMIT = 3;
// 当日と翌日分だけ残れば十分（日付跨ぎの読み違い防止の余裕込みで2日）
const KV_TTL_SECONDS = 172_800;
// 2,000字の随筆生成は10〜30秒程度。低速時の余裕を見て60秒で打ち切る
const TIMEOUT_MS = 60_000;
// 固定10問＋自由お題1枠（REQUIREMENTS §3.2）
const MAX_ANSWERS = 11;
// 以下は不正入力対策の上限。通常運用のお題タイトル・回答では到達しない
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 8000;

// 生成プロンプトの方針は REQUIREMENTS §3.3 で固定（一人称は本人／創作しない／
// 未回答のお題に触れない／終末を連想させる表現の禁止）
const SYSTEM_INSTRUCTION = [
	"あなたは、本人が「お題」に答えて書いた文章をもとに、本人の一人称による「じぶん史」を仕立てる編集者です。",
	"次の決まりを必ず守ってください。",
	"- 一人称は本人。本人が自分で綴った随筆として書く",
	"- 回答に書かれていない事実・人名・年代・出来事を創作しない",
	"- 回答にないお題や話題には一切触れない",
	"- 温かいが感傷的すぎない、静かな筆致にする",
	"- 「人生の終わり」「余生」「最期」「遺す」など、終末を連想させる表現を使わない",
	"- 全体で2,000字程度の日本語の随筆にする（回答が少ないときは、事実を足してまで長くしない）",
	"- 見出しや箇条書きを使わず、段落だけで構成する",
	"- 出力は随筆の本文のみ。前置き・後書き・タイトルを付けない",
].join("\n");

type AnswerItem = { title: string; body: string };

function parseAnswers(data: unknown): AnswerItem[] | null {
	if (typeof data !== "object" || data === null) return null;
	const { answers } = data as { answers?: unknown };
	if (!Array.isArray(answers) || answers.length === 0 || answers.length > MAX_ANSWERS) return null;
	const items: AnswerItem[] = [];
	for (const entry of answers) {
		if (typeof entry !== "object" || entry === null) return null;
		const { title, body } = entry as { title?: unknown; body?: unknown };
		if (typeof title !== "string" || typeof body !== "string") return null;
		if (title.trim() === "" || body.trim() === "") return null;
		if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH) return null;
		items.push({ title: title.trim(), body: body.trim() });
	}
	return items;
}

/** JST の日付キー（YYYY-MM-DD）。JST 0時 = UTC 15:00 が境界。テストから直接検証する */
export function jstDayKey(nowMs: number): string {
	return new Date(nowMs + 9 * 3_600_000).toISOString().slice(0, 10);
}

type GeminiResponse = {
	candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
};

/** Gemini を呼んで随筆本文を返す。失敗はエラー Response を返す（呼び出し側でそのまま返却） */
async function generateEssay(env: Env, answers: AnswerItem[]): Promise<string | Response> {
	const userText = [
		"以下は本人が書いた回答です。これをもとに、じぶん史を書いてください。",
		...answers.map((a) => `\n【お題】${a.title}\n${a.body}`),
	].join("\n");

	let response: Response;
	try {
		response = await fetch(GEMINI_ENDPOINT, {
			method: "POST",
			headers: {
				"x-goog-api-key": env.GEMINI_API_KEY,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
				contents: [{ role: "user", parts: [{ text: userText }] }],
				generationConfig: {
					thinkingConfig: { thinkingLevel: "minimal" },
					// 2,000字の随筆 ≈ 1,200トークン。thinking の消費分も見込んだ余裕（超過時は 502 で回数未消費）
					maxOutputTokens: 8192,
				},
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (error) {
		if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
			return jsonError(504, "upstream_timeout", "時間がかかりすぎたため、中断しました。もういちどためしてください");
		}
		throw error;
	}

	// 失敗の詳細（安全フィルタの理由等）はログにのみ残し、ユーザーには一般的な文言を返す
	if (!response.ok) {
		console.error(`Gemini API ${response.status}: ${await response.text()}`);
		return jsonError(502, "upstream_error", "じぶん史をつくれませんでした。少し時間をおいて、もういちどためしてください");
	}
	const result = (await response.json()) as GeminiResponse;
	const candidate = result.candidates?.[0];
	const bodyText = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
	if (result.promptFeedback?.blockReason || candidate?.finishReason !== "STOP" || bodyText === "") {
		console.error(`Gemini unusable response: ${JSON.stringify(result).slice(0, 2000)}`);
		return jsonError(502, "upstream_error", "じぶん史をつくれませんでした。少し時間をおいて、もういちどためしてください");
	}
	return bodyText;
}

/** POST /ai/life-story：回答済みお題テキスト → 随筆調のじぶん史（REQUIREMENTS §3.3） */
export async function handleGenerateLifeStory(request: Request, env: Env): Promise<Response> {
	const auth = await verifyAccessToken(request, env);
	if (!auth) return jsonError(401, "unauthorized", "ログインが必要です");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_body", "JSON ボディが必要です");
	}
	const answers = parseAnswers(body);
	if (!answers) {
		return jsonError(400, "invalid_answers", "answers は 1〜11 件の { title, body } の配列で送ってください");
	}

	const key = `gen:${auth.userId}:${jstDayKey(Date.now())}`;
	const count = Number(await env.RATE_LIMIT.get(key)) || 0;
	if (count >= DAILY_LIMIT) {
		return jsonError(429, "rate_limited", "今日つくれる回数（3回）を使い切りました。また明日ためしてください");
	}

	const essay = await generateEssay(env, answers);
	if (essay instanceof Response) return essay;

	// 生成は成功している。回数記録の失敗で 500 にして本文を捨てるより、1回分の記録漏れを許容する
	try {
		await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: KV_TTL_SECONDS });
	} catch (error) {
		console.error("RATE_LIMIT put failed:", error);
	}

	return json({ bodyText: essay, remaining: DAILY_LIMIT - count - 1 });
}
