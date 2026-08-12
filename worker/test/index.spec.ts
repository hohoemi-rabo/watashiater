import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// ルーティングの外形テスト。各エンドポイントの中身は upload.spec.ts / view.spec.ts
describe("ルーティング", () => {
	it("未知のパスは 404 の JSON エラー", async () => {
		const response = await SELF.fetch("https://example.com/nothing-here");
		expect(response.status).toBe(404);
		const body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("not_found");
	});

	it("ルートも 404", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(404);
	});

	it("/media/objects/ への未対応メソッド（POST）は 404", async () => {
		const response = await SELF.fetch("https://example.com/media/objects/whatever.jpg", { method: "POST" });
		expect(response.status).toBe(404);
	});

	it("/media/upload-urls への GET は 404", async () => {
		const response = await SELF.fetch("https://example.com/media/upload-urls");
		expect(response.status).toBe(404);
	});

	it("/media/wipe への GET は 404", async () => {
		const response = await SELF.fetch("https://example.com/media/wipe");
		expect(response.status).toBe(404);
	});
});
