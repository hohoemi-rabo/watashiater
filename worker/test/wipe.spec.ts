import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	makeJwt,
	mockOwnedSubject,
	OTHER_SUBJECT_ID,
	OWNER_ID,
	setupFetchMock,
	STRANGER_ID,
	SUBJECT_ID,
} from "./helpers";

const ORIGIN = "https://watashiater-worker.test";

beforeAll(async () => {
	await setupFetchMock();
});
afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

function postWipe(jwt: string | null): Promise<Response> {
	return SELF.fetch(`${ORIGIN}/media/wipe`, {
		method: "POST",
		headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
	});
}

async function seed(key: string): Promise<void> {
	await env.MEDIA.put(key, new Uint8Array([1]));
}

describe("POST /media/wipe", () => {
	it("正常系：自分の prefix だけ全削除（孤児含む）。他 subject は残り、2回目は 0 件", async () => {
		// 写真2＋録音1＋DB行を失った孤児1（キー形式は同じ）＋他 subject の1件
		const ownKeys = [
			`subjects/${SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`,
			`subjects/${SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`,
			`subjects/${SUBJECT_ID}/recordings/${crypto.randomUUID()}.m4a`,
			`subjects/${SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`,
		];
		const otherKey = `subjects/${OTHER_SUBJECT_ID}/photos/${crypto.randomUUID()}.jpg`;
		for (const key of [...ownKeys, otherKey]) {
			await seed(key);
		}

		mockOwnedSubject(OWNER_ID, [{ id: SUBJECT_ID }]);
		const response = await postWipe(await makeJwt({ sub: OWNER_ID }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: 4 });

		const remaining = await env.MEDIA.list({ prefix: `subjects/${SUBJECT_ID}/` });
		expect(remaining.objects).toHaveLength(0);
		// 他人の博物館のオブジェクトには触れない
		expect(await env.MEDIA.head(otherKey)).not.toBeNull();

		// 冪等：空 prefix への再実行は 0 件（PostgREST モックは1回消費なので張り直す）
		mockOwnedSubject(OWNER_ID, [{ id: SUBJECT_ID }]);
		const again = await postWipe(await makeJwt({ sub: OWNER_ID }));
		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({ deleted: 0 });
	});

	it("Authorization なしは 401", async () => {
		const response = await postWipe(null);
		expect(response.status).toBe(401);
	});

	it("署名不正の JWT は 401", async () => {
		const response = await postWipe(await makeJwt({ sub: OWNER_ID, wrongKey: true }));
		expect(response.status).toBe(401);
	});

	it("subject を持たないユーザーは 403", async () => {
		mockOwnedSubject(STRANGER_ID, []);
		const response = await postWipe(await makeJwt({ sub: STRANGER_ID }));
		expect(response.status).toBe(403);
		const body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("forbidden");
	});
});
