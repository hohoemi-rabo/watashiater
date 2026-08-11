import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signMediaToken } from "../src/sign";
import {
	makeJwt,
	mockOwnedSubject,
	OWNER_ID,
	setupFetchMock,
	SIGNING_SECRET,
	STRANGER_ID,
	SUBJECT_ID,
} from "./helpers";

const ORIGIN = "https://watashiater-worker.test";
const signEnv = { SIGNING_SECRET };

beforeAll(async () => {
	await setupFetchMock();
});
afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

function postUploadUrls(jwt: string | null, body: unknown): Promise<Response> {
	return SELF.fetch(`${ORIGIN}/media/upload-urls`, {
		method: "POST",
		headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
		body: JSON.stringify(body),
	});
}

/** 発行エンドポイントを通さずに、テスト側で署名済みアップロードURLを組み立てる */
async function makePutUrl(r2Key: string, options?: { exp?: number; method?: "GET" | "PUT"; sig?: string }): Promise<string> {
	const exp = options?.exp ?? Math.floor(Date.now() / 1000) + 60;
	const sig = options?.sig ?? (await signMediaToken(signEnv, options?.method ?? "PUT", r2Key, exp));
	return `${ORIGIN}/media/objects/${r2Key}?exp=${exp}&sig=${sig}`;
}

function photoKey(): string {
	return `subjects/${SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`;
}

describe("POST /media/upload-urls", () => {
	it("正常系：本人が写真2枚分を発行し、PUT すると R2 に入る", async () => {
		mockOwnedSubject(OWNER_ID, [{ id: SUBJECT_ID }]);
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID }), { kind: "photo", count: 2 });
		expect(response.status).toBe(200);
		const { items } = (await response.json()) as { items: { uploadUrl: string; r2Key: string }[] };
		expect(items).toHaveLength(2);
		expect(items[0].r2Key).toMatch(new RegExp(`^subjects/${SUBJECT_ID}/photos/[0-9a-f-]{36}\\.jpg$`));

		const bytes = new Uint8Array([1, 2, 3, 4]);
		const put = await SELF.fetch(items[0].uploadUrl, { method: "PUT", body: bytes });
		expect(put.status).toBe(200);

		const stored = await env.MEDIA.get(items[0].r2Key);
		expect(stored).not.toBeNull();
		expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes);
		expect(stored!.httpMetadata?.contentType).toBe("image/jpeg");
	});

	it("正常系：録音は1件・.m4a・audio/mp4 で保存される", async () => {
		mockOwnedSubject(OWNER_ID, [{ id: SUBJECT_ID }]);
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID }), { kind: "recording" });
		expect(response.status).toBe(200);
		const { items } = (await response.json()) as { items: { uploadUrl: string; r2Key: string }[] };
		expect(items).toHaveLength(1);
		expect(items[0].r2Key).toMatch(/\.m4a$/);

		const put = await SELF.fetch(items[0].uploadUrl, { method: "PUT", body: new Uint8Array([9]) });
		expect(put.status).toBe(200);
		// head() で確認する（get() だと未消費のボディストリームが isolated storage の後始末を妨げる）
		const stored = await env.MEDIA.head(items[0].r2Key);
		expect(stored!.httpMetadata?.contentType).toBe("audio/mp4");
	});

	it("Authorization なしは 401", async () => {
		const response = await postUploadUrls(null, { kind: "photo" });
		expect(response.status).toBe(401);
	});

	it("でたらめなトークンは 401", async () => {
		const response = await postUploadUrls("not-a-jwt", { kind: "photo" });
		expect(response.status).toBe(401);
	});

	it("別の鍵で署名された JWT は 401", async () => {
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID, wrongKey: true }), { kind: "photo" });
		expect(response.status).toBe(401);
	});

	it("期限切れ JWT は 401", async () => {
		const expired = await makeJwt({ sub: OWNER_ID, expiresAtEpoch: Math.floor(Date.now() / 1000) - 3600 });
		const response = await postUploadUrls(expired, { kind: "photo" });
		expect(response.status).toBe(401);
	});

	it("subject を持たないユーザーは 403", async () => {
		mockOwnedSubject(STRANGER_ID, []);
		const response = await postUploadUrls(await makeJwt({ sub: STRANGER_ID }), { kind: "photo" });
		expect(response.status).toBe(403);
	});

	it("不正な kind は 400", async () => {
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID }), { kind: "video" });
		expect(response.status).toBe(400);
	});

	it("写真の count 上限（5）超えは 400", async () => {
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID }), { kind: "photo", count: 6 });
		expect(response.status).toBe(400);
	});

	it("録音の count は 1 のみ", async () => {
		const response = await postUploadUrls(await makeJwt({ sub: OWNER_ID }), { kind: "recording", count: 2 });
		expect(response.status).toBe(400);
	});
});

describe("PUT /media/objects/<r2Key>", () => {
	it("HMAC トークンが期限切れなら 403", async () => {
		const url = await makePutUrl(photoKey(), { exp: Math.floor(Date.now() / 1000) - 10 });
		const response = await SELF.fetch(url, { method: "PUT", body: new Uint8Array([1]) });
		expect(response.status).toBe(403);
	});

	it("署名が改ざんされていたら 403", async () => {
		const url = await makePutUrl(photoKey(), { sig: "dGFtcGVyZWQ" });
		const response = await SELF.fetch(url, { method: "PUT", body: new Uint8Array([1]) });
		expect(response.status).toBe(403);
	});

	it("閲覧用（GET）トークンではアップロードできない", async () => {
		const url = await makePutUrl(photoKey(), { method: "GET" });
		const response = await SELF.fetch(url, { method: "PUT", body: new Uint8Array([1]) });
		expect(response.status).toBe(403);
	});

	it("キー形式が不正（prefix-escape）なら 403", async () => {
		const exp = Math.floor(Date.now() / 1000) + 60;
		const evilKey = "evil.txt";
		const sig = await signMediaToken(signEnv, "PUT", evilKey, exp);
		const response = await SELF.fetch(`${ORIGIN}/media/objects/${evilKey}?exp=${exp}&sig=${sig}`, {
			method: "PUT",
			body: new Uint8Array([1]),
		});
		expect(response.status).toBe(403);
	});

	it("ボディなし（Content-Length なし）は 411", async () => {
		const response = await SELF.fetch(await makePutUrl(photoKey()), { method: "PUT" });
		expect(response.status).toBe(411);
	});

	it("写真の上限（5MB）超えは 413", async () => {
		const response = await SELF.fetch(await makePutUrl(photoKey()), {
			method: "PUT",
			body: new Uint8Array(5 * 1024 * 1024 + 1),
		});
		expect(response.status).toBe(413);
	});
});
