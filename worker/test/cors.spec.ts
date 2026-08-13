import { fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeJwt, mockOwnedSubject, OWNER_ID, setupFetchMock, SUBJECT_ID } from "./helpers";

// vitest.config.mts の miniflare.bindings で ALLOWED_ORIGINS に入れてある値
const ALLOWED = "https://writer.test";
const ALLOWED_SECOND = "https://writer-2.test";
const DENIED = "https://evil.test";

const ORIGIN = "https://watashiater-worker.test";

beforeAll(async () => {
	await setupFetchMock();
});
afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

describe("プリフライト（OPTIONS）", () => {
	it("許可オリジンには CORS ヘッダー付きの 204 を返す", async () => {
		const response = await SELF.fetch(`${ORIGIN}/media/upload-urls`, {
			method: "OPTIONS",
			headers: { origin: ALLOWED, "access-control-request-method": "POST" },
		});
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
		expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
		// app が実際に送るヘッダー（worker-api.ts）が両方通ること
		const allowHeaders = response.headers.get("access-control-allow-headers") ?? "";
		expect(allowHeaders).toContain("authorization");
		expect(allowHeaders).toContain("content-type");
		expect(response.headers.get("vary")).toContain("origin");
	});

	it("カンマ区切りの2つ目のオリジンも許可される（前後の空白を無視する）", async () => {
		const response = await SELF.fetch(`${ORIGIN}/media/upload-urls`, {
			method: "OPTIONS",
			headers: { origin: ALLOWED_SECOND, "access-control-request-method": "POST" },
		});
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_SECOND);
	});

	it("未許可オリジンには CORS ヘッダーを付けない（ブラウザ側が弾く）", async () => {
		const response = await SELF.fetch(`${ORIGIN}/media/upload-urls`, {
			method: "OPTIONS",
			headers: { origin: DENIED, "access-control-request-method": "POST" },
		});
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
		// 許可・不許可でヘッダーが変わるので、キャッシュを混ぜないための vary は常に付ける
		expect(response.headers.get("vary")).toContain("origin");
	});

	it("認可を通さずに返る（Authorization なしでも 401 にしない）", async () => {
		// ブラウザはプリフライトに Authorization を付けないので、
		// ルーティングに流してしまうと本リクエストの前に 401 で落ちる
		const response = await SELF.fetch(`${ORIGIN}/media/wipe`, {
			method: "OPTIONS",
			headers: { origin: ALLOWED, "access-control-request-method": "POST" },
		});
		expect(response.status).toBe(204);
	});
});

describe("実リクエストへの CORS ヘッダー", () => {
	it("成功応答（200）に許可オリジンが付く", async () => {
		mockOwnedSubject(OWNER_ID, [{ id: SUBJECT_ID }]);
		const response = await SELF.fetch(`${ORIGIN}/media/upload-urls`, {
			method: "POST",
			headers: { authorization: `Bearer ${await makeJwt({ sub: OWNER_ID })}`, origin: ALLOWED },
			body: JSON.stringify({ kind: "recording" }),
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
		// 本文が壊れていない（withCors がボディを差し替えていない）
		const { items } = (await response.json()) as { items: { r2Key: string }[] };
		expect(items[0].r2Key).toMatch(/\.m4a$/);
	});

	it("エラー応答（401）にも許可オリジンが付く（付けないとブラウザが理由を読めない）", async () => {
		const response = await SELF.fetch(`${ORIGIN}/media/upload-urls`, {
			method: "POST",
			headers: { origin: ALLOWED },
			body: JSON.stringify({ kind: "recording" }),
		});
		expect(response.status).toBe(401);
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
		const body = (await response.json()) as { error: { message: string } };
		expect(body.error.message).toBe("ログインが必要です");
	});

	it("ルーティングの 404 にも付く", async () => {
		const response = await SELF.fetch(`${ORIGIN}/nothing-here`, { headers: { origin: ALLOWED } });
		expect(response.status).toBe(404);
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
	});

	it("未許可オリジンには付かない", async () => {
		const response = await SELF.fetch(`${ORIGIN}/nothing-here`, { headers: { origin: DENIED } });
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
	});

	it("Origin ヘッダーが無いリクエスト（アプリ・閲覧Webのサーバー側）はこれまで通り", async () => {
		const response = await SELF.fetch(`${ORIGIN}/nothing-here`);
		expect(response.status).toBe(404);
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
	});
});
