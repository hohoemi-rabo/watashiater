import { fetchMock } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// vitest.config.mts の miniflare.bindings と一致させる固定値
export const SUPABASE_ORIGIN = "https://supabase.test";
export const SIGNING_SECRET = "test-signing-secret";

export const OWNER_ID = "11111111-1111-4111-8111-111111111111";
export const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
export const STRANGER_ID = "33333333-3333-4333-8333-333333333333";
export const SUBJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_SUBJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const TEST_KID = "test-key";

// jose の createRemoteJWKSet は取得した鍵をモジュール内にキャッシュするため、
// 鍵ペアはテストファイルごとに1組へ固定する。
// 「署名不正」の JWT は別鍵・同じ kid で作る（kid を変えると JWKS の再取得が絡んで非決定的になる）
let keysPromise: Promise<{ privateKey: CryptoKey; wrongPrivateKey: CryptoKey; jwk: Record<string, unknown> }> | null =
	null;

function keys() {
	keysPromise ??= (async () => {
		const pair = await generateKeyPair("ES256");
		const wrongPair = await generateKeyPair("ES256");
		const jwk = { ...(await exportJWK(pair.publicKey)), kid: TEST_KID, alg: "ES256" };
		return { privateKey: pair.privateKey as CryptoKey, wrongPrivateKey: wrongPair.privateKey as CryptoKey, jwk };
	})();
	return keysPromise;
}

/**
 * 各スペックの beforeAll で呼ぶ。fetchMock を有効化し、JWKS モックを常設して1回読んでおく
 * （persist したモックは一度も呼ばれないと assertNoPendingInterceptors に引っかかるため）
 */
export async function setupFetchMock(): Promise<void> {
	fetchMock.activate();
	fetchMock.disableNetConnect();
	const { jwk } = await keys();
	fetchMock
		.get(SUPABASE_ORIGIN)
		.intercept({ method: "GET", path: "/auth/v1/.well-known/jwks.json" })
		.reply(200, { keys: [jwk] })
		.persist();
	await fetch(`${SUPABASE_ORIGIN}/auth/v1/.well-known/jwks.json`);
}

/** Supabase 発行相当のアクセストークンを作る。expiresAtEpoch を過去にすれば期限切れ JWT */
export async function makeJwt(options: {
	sub: string;
	expiresAtEpoch?: number;
	wrongKey?: boolean;
}): Promise<string> {
	const { privateKey, wrongPrivateKey } = await keys();
	return new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: TEST_KID })
		.setIssuer(`${SUPABASE_ORIGIN}/auth/v1`)
		.setAudience("authenticated")
		.setSubject(options.sub)
		.setIssuedAt()
		.setExpirationTime(options.expiresAtEpoch ?? Math.floor(Date.now() / 1000) + 300)
		.sign(options.wrongKey ? wrongPrivateKey : privateKey);
}

/** PostgREST への1クエリぶんのモック（1回で消費される。叩き忘れは assertNoPendingInterceptors が検知） */
export function mockPostgrest(table: string, query: Record<string, string>, rows: unknown[]): void {
	fetchMock
		.get(SUPABASE_ORIGIN)
		.intercept({ method: "GET", path: `/rest/v1/${table}`, query })
		.reply(200, rows);
}

export function mockOwnedSubject(userId: string, rows: { id: string }[]): void {
	mockPostgrest("subjects", { owner_user_id: `eq.${userId}`, select: "id" }, rows);
}

export function mockSubjectOwnerCheck(subjectId: string, userId: string, rows: { id: string }[]): void {
	mockPostgrest("subjects", { id: `eq.${subjectId}`, owner_user_id: `eq.${userId}`, select: "id" }, rows);
}

export function mockFamilyCheck(subjectId: string, userId: string, rows: { id: string }[]): void {
	mockPostgrest("family_members", { subject_id: `eq.${subjectId}`, member_user_id: `eq.${userId}`, select: "id" }, rows);
}

export function mockSlug(slug: string, rows: { subject_id: string }[]): void {
	mockPostgrest("view_links", { slug: `eq.${slug}`, is_active: "is.true", select: "subject_id" }, rows);
}
