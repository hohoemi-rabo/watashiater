// ブラウザからこの worker を直接呼ぶ経路のための CORS（チケット24）。
//
// 追加した理由：書き手 Web（PWA・REQUIREMENTS §3.7）は app と同一コードを Expo Web で
// 出力したものなので、写真・音声のアップロードと閲覧URL取得を「ブラウザの JS から」
// この worker に投げる。ネイティブアプリ（CORS の制約を受けない）と閲覧 Web
// （Next.js のサーバー側から呼ぶ）しか無かった間は不要だった。
//
// 許可オリジンは wrangler.jsonc の vars.ALLOWED_ORIGINS（カンマ区切り）で持つ。
// ワイルドカードは実装しない＝完全一致のみ：
//  - 書き手 Web は本番ドメイン1つで配るので、これで足りる
//  - Vercel のプレビューデプロイを使う場合は、そのオリジンを明示的に足すこと
//
// なお `*` にしない理由は「秘密が漏れるから」ではない（Authorization は Bearer で、
// 攻撃者のサイトから他人のトークンは取れない）。攻撃対象面をこちらで把握できる
// 状態に保つための運用上の選択。

const ALLOWED_METHODS = "GET, HEAD, PUT, POST, OPTIONS";
// app から実際に送るヘッダーだけ（worker-api.ts の authorization / content-type）
const ALLOWED_HEADERS = "authorization, content-type";
const PREFLIGHT_MAX_AGE_SECONDS = 86400;

/** リクエストの Origin が許可リストにあればそれを返す。無ければ null */
function allowedOrigin(request: Request, env: Env): string | null {
	const origin = request.headers.get("origin");
	if (!origin) return null;
	const allowed = (env.ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	return allowed.includes(origin) ? origin : null;
}

/**
 * OPTIONS（プリフライト）への応答。
 * 未許可オリジンには CORS ヘッダーを付けずに 204 を返す＝ブラウザ側が弾く
 * （403 にしても結果は同じで、こちらの許可リストを推測させないぶん静かに落とす）
 */
export function preflight(request: Request, env: Env): Response {
	const headers = new Headers({ vary: "origin" });
	const origin = allowedOrigin(request, env);
	if (origin) {
		headers.set("access-control-allow-origin", origin);
		headers.set("access-control-allow-methods", ALLOWED_METHODS);
		headers.set("access-control-allow-headers", ALLOWED_HEADERS);
		headers.set("access-control-max-age", String(PREFLIGHT_MAX_AGE_SECONDS));
	}
	return new Response(null, { status: 204, headers });
}

/**
 * 実リクエストの応答に CORS ヘッダーを足す。
 * vary: origin は許可・不許可にかかわらず必ず付ける（オリジンごとに応答が変わるため、
 * 署名URLの GET に付けた cache-control: private のキャッシュが混ざらないようにする）
 */
export function withCors(response: Response, request: Request, env: Env): Response {
	const headers = new Headers(response.headers);
	headers.append("vary", "origin");
	const origin = allowedOrigin(request, env);
	if (origin) {
		headers.set("access-control-allow-origin", origin);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
