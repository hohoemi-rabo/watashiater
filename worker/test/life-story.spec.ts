import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { jstDayKey } from "../src/ai";
import { makeJwt, mockGemini, mockGeminiRaw, OWNER_ID, setupFetchMock } from "./helpers";

const ORIGIN = "https://watashiater-worker.test";
const ESSAY = "私の子どもの頃の思い出は、夏の縁側で過ごした時間だ。";
const VALID_BODY = { answers: [{ title: "子どもの頃、好きだった場所", body: "夏の縁側。祖母とスイカを食べた。" }] };

// fetchMock は disableNetConnect 済みなので、Gemini のモックを張らないテストで
// 生成が走れば必ず失敗する＝「拒否経路で Gemini を呼ばない」ことも同時に検証される
beforeAll(async () => {
	await setupFetchMock();
});
afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

function todayKey(): string {
	return `gen:${OWNER_ID}:${jstDayKey(Date.now())}`;
}

function post(jwt: string | null, body: unknown): Promise<Response> {
	return SELF.fetch(`${ORIGIN}/ai/life-story`, {
		method: "POST",
		headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

async function errorCode(response: Response): Promise<string> {
	const { error } = (await response.json()) as { error: { code: string; message: string } };
	return error.code;
}

describe("jstDayKey", () => {
	it("JST 0時（UTC 15:00）を境に日付が変わる", () => {
		expect(jstDayKey(Date.UTC(2026, 7, 11, 14, 59, 59))).toBe("2026-08-11");
		expect(jstDayKey(Date.UTC(2026, 7, 11, 15, 0, 0))).toBe("2026-08-12");
	});
});

describe("POST /ai/life-story", () => {
	it("正常系：随筆を返し、当日カウントが 1 になる", async () => {
		mockGemini(ESSAY);
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ bodyText: ESSAY, remaining: 2 });
		expect(await env.RATE_LIMIT.get(todayKey())).toBe("1");
	});

	it("認証なし → 401", async () => {
		const response = await post(null, VALID_BODY);
		expect(response.status).toBe(401);
		expect(await errorCode(response)).toBe("unauthorized");
	});

	it("別鍵で署名された JWT → 401", async () => {
		const response = await post(await makeJwt({ sub: OWNER_ID, wrongKey: true }), VALID_BODY);
		expect(response.status).toBe(401);
	});

	it("JSON でないボディ → 400 invalid_body", async () => {
		const response = await post(await makeJwt({ sub: OWNER_ID }), "not json");
		expect(response.status).toBe(400);
		expect(await errorCode(response)).toBe("invalid_body");
	});

	it("answers の形が不正 → 400 invalid_answers", async () => {
		const jwt = await makeJwt({ sub: OWNER_ID });
		const cases: unknown[] = [
			{},
			{ answers: [] },
			{ answers: Array.from({ length: 12 }, () => ({ title: "お題", body: "回答" })) },
			{ answers: [{ title: "お題", body: "   " }] },
			{ answers: [{ title: "お題" }] },
			{ answers: [{ title: "お題", body: "あ".repeat(8001) }] },
		];
		for (const body of cases) {
			const response = await post(jwt, body);
			expect(response.status).toBe(400);
			expect(await errorCode(response)).toBe("invalid_answers");
		}
	});

	it("3回目は生成でき（remaining: 0）、カウントが 3 になる", async () => {
		await env.RATE_LIMIT.put(todayKey(), "2");
		mockGemini(ESSAY);
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ bodyText: ESSAY, remaining: 0 });
		expect(await env.RATE_LIMIT.get(todayKey())).toBe("3");
	});

	it("4回目 → 429 rate_limited（Gemini は呼ばれない）", async () => {
		await env.RATE_LIMIT.put(todayKey(), "3");
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(429);
		expect(await errorCode(response)).toBe("rate_limited");
	});

	it("JST 日付跨ぎ：昨日 3 回使い切っていても今日は生成できる", async () => {
		await env.RATE_LIMIT.put(`gen:${OWNER_ID}:${jstDayKey(Date.now() - 86_400_000)}`, "3");
		mockGemini(ESSAY);
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(200);
		expect(await env.RATE_LIMIT.get(todayKey())).toBe("1");
	});

	it("Gemini が 500 → 502 upstream_error、カウントは消費されない", async () => {
		mockGeminiRaw(500, { error: { message: "internal" } });
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(502);
		expect(await errorCode(response)).toBe("upstream_error");
		expect(await env.RATE_LIMIT.get(todayKey())).toBeNull();
	});

	it("Gemini が candidates なし（ブロック等）→ 502 upstream_error", async () => {
		mockGeminiRaw(200, { promptFeedback: { blockReason: "SAFETY" } });
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(502);
	});

	it("Gemini が MAX_TOKENS で途切れた応答 → 502 upstream_error", async () => {
		mockGeminiRaw(200, {
			candidates: [{ content: { parts: [{ text: "途中まで" }], role: "model" }, finishReason: "MAX_TOKENS" }],
		});
		const response = await post(await makeJwt({ sub: OWNER_ID }), VALID_BODY);
		expect(response.status).toBe(502);
	});
});
