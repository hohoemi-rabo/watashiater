import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signMediaToken } from "../src/sign";
import {
	FAMILY_ID,
	makeJwt,
	mockFamilyCheck,
	mockSlug,
	mockSubjectOwnerCheck,
	OTHER_SUBJECT_ID,
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

const PHOTO_BYTES = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));

async function seedPhoto(subjectId = SUBJECT_ID): Promise<string> {
	const key = `subjects/${subjectId}/photos/${crypto.randomUUID()}.jpg`;
	await env.MEDIA.put(key, PHOTO_BYTES, { httpMetadata: { contentType: "image/jpeg" } });
	return key;
}

function postViewUrls(options: { jwt?: string; slug?: string; r2Keys: unknown }): Promise<Response> {
	return SELF.fetch(`${ORIGIN}/media/view-urls`, {
		method: "POST",
		headers: options.jwt ? { authorization: `Bearer ${options.jwt}` } : {},
		body: JSON.stringify({ r2Keys: options.r2Keys, ...(options.slug ? { slug: options.slug } : {}) }),
	});
}

async function makeGetUrl(r2Key: string, options?: { exp?: number }): Promise<string> {
	const exp = options?.exp ?? Math.floor(Date.now() / 1000) + 60;
	const sig = await signMediaToken(signEnv, "GET", r2Key, exp);
	return `${ORIGIN}/media/objects/${r2Key}?exp=${exp}&sig=${sig}`;
}

describe("POST /media/view-urls", () => {
	it("正常系：本人 JWT で発行し、GET で中身が返る", async () => {
		const key = await seedPhoto();
		mockSubjectOwnerCheck(SUBJECT_ID, OWNER_ID, [{ id: SUBJECT_ID }]);
		const response = await postViewUrls({ jwt: await makeJwt({ sub: OWNER_ID }), r2Keys: [key] });
		expect(response.status).toBe(200);
		const { urls } = (await response.json()) as { urls: Record<string, string> };
		expect(urls[key]).toContain(`/media/objects/${key}?exp=`);

		const media = await SELF.fetch(urls[key]);
		expect(media.status).toBe(200);
		expect(media.headers.get("content-type")).toBe("image/jpeg");
		expect(media.headers.get("accept-ranges")).toBe("bytes");
		expect(new Uint8Array(await media.arrayBuffer())).toEqual(PHOTO_BYTES);
	});

	it("正常系：登録家族の JWT でも発行できる", async () => {
		const key = await seedPhoto();
		mockSubjectOwnerCheck(SUBJECT_ID, FAMILY_ID, []);
		mockFamilyCheck(SUBJECT_ID, FAMILY_ID, [{ id: "membership-1" }]);
		const response = await postViewUrls({ jwt: await makeJwt({ sub: FAMILY_ID }), r2Keys: [key] });
		expect(response.status).toBe(200);
	});

	it("本人でも家族でもないユーザーは 403", async () => {
		const key = await seedPhoto();
		mockSubjectOwnerCheck(SUBJECT_ID, STRANGER_ID, []);
		mockFamilyCheck(SUBJECT_ID, STRANGER_ID, []);
		const response = await postViewUrls({ jwt: await makeJwt({ sub: STRANGER_ID }), r2Keys: [key] });
		expect(response.status).toBe(403);
	});

	it("不正な JWT は 401（slug へのフォールバックはしない）", async () => {
		const key = await seedPhoto();
		const response = await postViewUrls({ jwt: "broken", slug: "goodslug", r2Keys: [key] });
		expect(response.status).toBe(401);
	});

	it("正常系：有効な閲覧スラッグで発行し、GET で中身が返る", async () => {
		const key = await seedPhoto();
		mockSlug("goodslug", [{ subject_id: SUBJECT_ID }]);
		const response = await postViewUrls({ slug: "goodslug", r2Keys: [key] });
		expect(response.status).toBe(200);
		const { urls } = (await response.json()) as { urls: Record<string, string> };
		const media = await SELF.fetch(urls[key]);
		expect(media.status).toBe(200);
		// R2 由来のボディは必ず消費する（isolated storage の後始末のため）
		await media.arrayBuffer();
	});

	it("無効化された・存在しないスラッグは 403", async () => {
		const key = await seedPhoto();
		mockSlug("deadslug", []);
		const response = await postViewUrls({ slug: "deadslug", r2Keys: [key] });
		expect(response.status).toBe(403);
	});

	it("スラッグの subject と違う subject のキーは 403", async () => {
		const key = await seedPhoto();
		mockSlug("otherslug", [{ subject_id: OTHER_SUBJECT_ID }]);
		const response = await postViewUrls({ slug: "otherslug", r2Keys: [key] });
		expect(response.status).toBe(403);
	});

	it("複数 subject のキーが混ざっていたら 403", async () => {
		const keyA = await seedPhoto();
		const keyB = await seedPhoto(OTHER_SUBJECT_ID);
		const response = await postViewUrls({ slug: "goodslug", r2Keys: [keyA, keyB] });
		expect(response.status).toBe(403);
	});

	it("キー形式が不正なら 400", async () => {
		const response = await postViewUrls({ slug: "goodslug", r2Keys: ["../../secrets"] });
		expect(response.status).toBe(400);
	});

	it("空の r2Keys は 400", async () => {
		const response = await postViewUrls({ slug: "goodslug", r2Keys: [] });
		expect(response.status).toBe(400);
	});

	it("JWT もスラッグもなければ 401", async () => {
		const key = await seedPhoto();
		const response = await postViewUrls({ r2Keys: [key] });
		expect(response.status).toBe(401);
	});
});

describe("GET /media/objects/<r2Key>", () => {
	it("期限切れの署名URLは 403", async () => {
		const key = await seedPhoto();
		const url = await makeGetUrl(key, { exp: Math.floor(Date.now() / 1000) - 10 });
		const response = await SELF.fetch(url);
		expect(response.status).toBe(403);
	});

	it("存在しないオブジェクトは 404", async () => {
		const missingKey = `subjects/${SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`;
		const response = await SELF.fetch(await makeGetUrl(missingKey));
		expect(response.status).toBe(404);
	});

	it("Range リクエストに 206 + Content-Range で応える（音声のシーク用）", async () => {
		const key = await seedPhoto();
		const response = await SELF.fetch(await makeGetUrl(key), { headers: { range: "bytes=0-9" } });
		expect(response.status).toBe(206);
		expect(response.headers.get("content-range")).toBe("bytes 0-9/100");
		expect((await response.arrayBuffer()).byteLength).toBe(10);
	});

	it("If-None-Match が一致したら 304", async () => {
		const key = await seedPhoto();
		const first = await SELF.fetch(await makeGetUrl(key));
		const etag = first.headers.get("etag");
		await first.arrayBuffer();
		expect(etag).toBeTruthy();
		const second = await SELF.fetch(await makeGetUrl(key), { headers: { "if-none-match": etag! } });
		expect(second.status).toBe(304);
	});

	it("HEAD はヘッダーだけ返す", async () => {
		const key = await seedPhoto();
		const response = await SELF.fetch(await makeGetUrl(key), { method: "HEAD" });
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/jpeg");
		expect((await response.arrayBuffer()).byteLength).toBe(0);
	});
});
