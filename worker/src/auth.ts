import { createRemoteJWKSet, jwtVerify } from "jose";

// Supabase のアクセストークンは ES256 署名（docs/07 で確定）。
// 共有シークレットではなく公開 JWKS で検証するため、worker は認証用の秘密を持たない。
// createRemoteJWKSet は鍵をキャッシュし、未知の kid のときだけ再取得する
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
	let jwks = jwksCache.get(supabaseUrl);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
		jwksCache.set(supabaseUrl, jwks);
	}
	return jwks;
}

/** Authorization: Bearer の Supabase JWT を検証し、ユーザー ID を返す。失敗はすべて null（→ 401） */
export async function verifyAccessToken(request: Request, env: Env): Promise<{ userId: string } | null> {
	const authorization = request.headers.get("authorization");
	if (!authorization?.startsWith("Bearer ")) return null;
	try {
		const { payload } = await jwtVerify(authorization.slice("Bearer ".length), jwksFor(env.SUPABASE_URL), {
			issuer: `${env.SUPABASE_URL}/auth/v1`,
			audience: "authenticated",
		});
		return payload.sub ? { userId: payload.sub } : null;
	} catch {
		return null;
	}
}
