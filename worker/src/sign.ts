// worker 自身が発行する短命の署名トークン。R2 バケットは非公開のまま、
// 「/media/objects/<key>?exp=...&sig=...」だけをメディアへの唯一の入口にする（REQUIREMENTS §4.3）

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
		"verify",
	]);
}

// method を署名に含めるので、閲覧用（GET）トークンを流用したアップロード（PUT）はできない
function payload(method: string, r2Key: string, exp: number): Uint8Array {
	return encoder.encode(`${method}|${r2Key}|${exp}`);
}

export async function signMediaToken(
	env: Pick<Env, "SIGNING_SECRET">,
	method: "GET" | "PUT",
	r2Key: string,
	exp: number,
): Promise<string> {
	const key = await hmacKey(env.SIGNING_SECRET);
	const sig = await crypto.subtle.sign("HMAC", key, payload(method, r2Key, exp));
	return base64UrlEncode(new Uint8Array(sig));
}

export async function verifyMediaToken(
	env: Pick<Env, "SIGNING_SECRET">,
	method: "GET" | "PUT",
	r2Key: string,
	exp: number,
	sig: string,
): Promise<boolean> {
	if (!Number.isSafeInteger(exp) || exp * 1000 < Date.now()) return false;
	const rawSig = base64UrlDecode(sig);
	if (!rawSig) return false;
	const key = await hmacKey(env.SIGNING_SECRET);
	// 比較は crypto.subtle.verify に任せる（自前の文字列比較でタイミング差を作らない）
	return crypto.subtle.verify("HMAC", key, rawSig, payload(method, r2Key, exp));
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Uint8Array | null {
	try {
		const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}
