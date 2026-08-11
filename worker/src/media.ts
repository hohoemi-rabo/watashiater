import { verifyAccessToken } from "./auth";
import { json, jsonError } from "./http";
import { signMediaToken, verifyMediaToken } from "./sign";
import { canViewSubject, getOwnedSubjectId, getSubjectIdForSlug } from "./supabase";

// ── 署名URLの実現方式の判断（チケット08で「実装時に判断しコメントに残す」とされた項目）──
// 「S3互換 presign」ではなく「worker 経由ストリーム＋自前HMACトークン」を採用する。
// 理由：
//  1. R2 バインディングだけで完結し、S3互換キーの発行・保管が一切不要（docs/07 の方針どおり）
//  2. vitest-pool-workers が R2 をローカルでシミュレートするため、認可・期限切れ・
//     アップロード→閲覧の一連の流れを「実際に実行する」テストが書ける
//  3. MEDIA.get(key, { range, onlyIf }) が Range／条件付きリクエストを解釈してくれるので、
//     Safari の <audio> 再生に必須の 206 Partial Content 対応がほぼ無料で手に入る
// 引き換えにメディアのバイト列は worker を通るが、写真≦5MB・音声≦10MB・家族数人の
// 閲覧という規模では Workers 無料枠（10万リクエスト/日）に余裕で収まる。
// ────────────────────────────────────────────────────────────────────────

type Kind = "photo" | "recording";

// アップロードURLの有効期限。低速回線でも3分音声（約2.78MB。docs/00 実測）を送り切れる余裕
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
// 閲覧URLの有効期限。閲覧セッション1回分。署名URLはキャッシュしない前提（CLAUDE.md Next.js 節）
const VIEW_URL_TTL_SECONDS = 60 * 60;
// 写真は長辺1600px/JPEG品質80に圧縮してから上げる（REQUIREMENTS §4.2）ので実測1MB未満。余裕を見た上限
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
// 音声は3分AAC≈2.78MB（docs/00 実測）。余裕を見た上限
const RECORDING_MAX_BYTES = 10 * 1024 * 1024;
// 閲覧バッチの上限。ボードは写真最大55枚＋録音程度なのでその余裕
const MAX_VIEW_KEYS = 200;
// 1お題あたり写真5枚まで（REQUIREMENTS §3.2）。1回の発行数もこれを上限にする
const PHOTO_MAX_COUNT = 5;

// ── R2キー設計の判断（チケット08で「実装時に判断しコメントに残す」とされた項目）──
// キーは answer 単位ではなく subject 単位のプレフィックスにする：
//   subjects/<subject_id>/photos/<uuid>.jpg
//   subjects/<subject_id>/recordings/<uuid>.m4a
// 理由：
//  1. 認可の単位が subject（家族・閲覧スラッグは subject 全体を見る）なので、閲覧可否は
//     「認可済み subject のプレフィックスで始まるキーか」だけで判定でき、キーごとの DB 照会が要らない
//  2. answer との紐付けは DB 行（photos.answer_id / recordings.answer_id）が持つ
//  3. アカウント削除（REQUIREMENTS §4.3）が subjects/<id>/ のプレフィックス一括削除で完結する
// uuid 固定の正規表現で全体を検証することで、パストラバーサルや他 subject へのキー偽装も同時に防ぐ
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_PATTERN = new RegExp(`^subjects/(${UUID})/(photos|recordings)/${UUID}\\.(jpg|m4a)$`);

// Content-Type はサーバー側で固定する。クライアントの File.type は .m4a に audio/mpeg を
// 返すなど信用できない（docs/00 検証結果の申し送り）
const CONTENT_TYPE: Record<Kind, string> = { photo: "image/jpeg", recording: "audio/mp4" };

function subjectIdOfKey(r2Key: string): string | null {
	return KEY_PATTERN.exec(r2Key)?.[1] ?? null;
}

function kindOfKey(r2Key: string): Kind {
	return r2Key.includes("/photos/") ? "photo" : "recording";
}

async function signedObjectUrl(env: Env, origin: string, method: "GET" | "PUT", r2Key: string): Promise<string> {
	const ttl = method === "PUT" ? UPLOAD_URL_TTL_SECONDS : VIEW_URL_TTL_SECONDS;
	const exp = Math.floor(Date.now() / 1000) + ttl;
	const sig = await signMediaToken(env, method, r2Key, exp);
	return `${origin}/media/objects/${r2Key}?exp=${exp}&sig=${sig}`;
}

/** POST /media/upload-urls：アップロード用署名URLの発行（本人のみ） */
export async function handleCreateUploadUrls(request: Request, env: Env): Promise<Response> {
	const auth = await verifyAccessToken(request, env);
	if (!auth) return jsonError(401, "unauthorized", "ログインが必要です");

	let body: { kind?: unknown; count?: unknown };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_body", "JSON ボディが必要です");
	}
	const kind = body.kind;
	if (kind !== "photo" && kind !== "recording") {
		return jsonError(400, "invalid_kind", "kind は photo または recording です");
	}
	const count = body.count ?? 1;
	const maxCount = kind === "photo" ? PHOTO_MAX_COUNT : 1;
	if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > maxCount) {
		return jsonError(400, "invalid_count", `count は 1〜${maxCount} です`);
	}

	// アップロードできるのは自分の博物館だけ（家族は閲覧のみ。REQUIREMENTS §3.5）
	const subjectId = await getOwnedSubjectId(env, auth.userId);
	if (!subjectId) return jsonError(403, "forbidden", "アップロードできる博物館がありません");

	const origin = new URL(request.url).origin;
	const ext = kind === "photo" ? "jpg" : "m4a";
	const items = await Promise.all(
		Array.from({ length: count }, async () => {
			const r2Key = `subjects/${subjectId}/${kind}s/${crypto.randomUUID()}.${ext}`;
			return { r2Key, uploadUrl: await signedObjectUrl(env, origin, "PUT", r2Key) };
		}),
	);
	return json({ items });
}

/** PUT /media/objects/<r2Key>?exp&sig：署名URLへの実アップロード */
export async function handlePutObject(request: Request, env: Env, r2Key: string): Promise<Response> {
	if (!KEY_PATTERN.test(r2Key)) return jsonError(403, "forbidden", "キーの形式が不正です");

	const params = new URL(request.url).searchParams;
	const exp = Number(params.get("exp"));
	const sig = params.get("sig") ?? "";
	if (!(await verifyMediaToken(env, "PUT", r2Key, exp, sig))) {
		return jsonError(403, "forbidden", "アップロードURLが無効か期限切れです");
	}

	// R2 の put は既知長ストリームが必要なので Content-Length を必須にし、サイズ上限もここで守る。
	// workerd はプロトコル層で実際のボディ長と Content-Length の一致を強制する
	const contentLength = Number(request.headers.get("content-length"));
	if (!request.body || !Number.isFinite(contentLength) || contentLength <= 0) {
		return jsonError(411, "length_required", "Content-Length が必要です");
	}
	const kind = kindOfKey(r2Key);
	const maxBytes = kind === "photo" ? PHOTO_MAX_BYTES : RECORDING_MAX_BYTES;
	if (contentLength > maxBytes) {
		return jsonError(413, "too_large", `ファイルが大きすぎます（上限 ${maxBytes} バイト）`);
	}

	await env.MEDIA.put(r2Key, request.body, { httpMetadata: { contentType: CONTENT_TYPE[kind] } });
	return json({ r2Key });
}

/** POST /media/view-urls：閲覧用署名URLの一括発行（本人・家族の JWT、または有効な閲覧スラッグ） */
export async function handleCreateViewUrls(request: Request, env: Env): Promise<Response> {
	let body: { r2Keys?: unknown; slug?: unknown };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_body", "JSON ボディが必要です");
	}
	const r2Keys = body.r2Keys;
	if (!Array.isArray(r2Keys) || r2Keys.length === 0 || r2Keys.length > MAX_VIEW_KEYS) {
		return jsonError(400, "invalid_keys", `r2Keys は 1〜${MAX_VIEW_KEYS} 件の配列です`);
	}

	// 全キーが正しい形式で、同一 subject に属することを先に確認する（認可は subject 単位）
	const subjectIds = new Set<string>();
	for (const key of r2Keys) {
		const subjectId = typeof key === "string" ? subjectIdOfKey(key) : null;
		if (!subjectId) return jsonError(400, "invalid_keys", "キーの形式が不正です");
		subjectIds.add(subjectId);
	}
	if (subjectIds.size !== 1) {
		return jsonError(403, "forbidden", "複数の博物館のキーは同時に扱えません");
	}
	const [subjectId] = subjectIds;

	// 認可の2経路（REQUIREMENTS §5）：アプリは JWT（本人 or 家族）、閲覧 Web は有効な slug
	if (request.headers.get("authorization")) {
		const auth = await verifyAccessToken(request, env);
		if (!auth) return jsonError(401, "unauthorized", "ログインが必要です");
		if (!(await canViewSubject(env, subjectId!, auth.userId))) {
			return jsonError(403, "forbidden", "この博物館を見る権限がありません");
		}
	} else if (typeof body.slug === "string" && body.slug !== "") {
		const slugSubjectId = await getSubjectIdForSlug(env, body.slug);
		if (!slugSubjectId || slugSubjectId !== subjectId) {
			return jsonError(403, "forbidden", "リンクが無効になっています");
		}
	} else {
		return jsonError(401, "unauthorized", "ログインか閲覧リンクが必要です");
	}

	const origin = new URL(request.url).origin;
	const urls: Record<string, string> = {};
	for (const key of r2Keys as string[]) {
		urls[key] = await signedObjectUrl(env, origin, "GET", key);
	}
	return json({ urls });
}

/** GET|HEAD /media/objects/<r2Key>?exp&sig：署名URLからのメディア配信 */
export async function handleGetObject(request: Request, env: Env, r2Key: string): Promise<Response> {
	if (!KEY_PATTERN.test(r2Key)) return jsonError(403, "forbidden", "キーの形式が不正です");

	const params = new URL(request.url).searchParams;
	const exp = Number(params.get("exp"));
	const sig = params.get("sig") ?? "";
	if (!(await verifyMediaToken(env, "GET", r2Key, exp, sig))) {
		return jsonError(403, "forbidden", "URLが無効か期限切れです");
	}

	// Range／条件付きリクエストの解釈は R2 に任せる（Cloudflare 公式パターン）
	const object = await env.MEDIA.get(r2Key, { onlyIf: request.headers, range: request.headers });
	if (object === null) return jsonError(404, "not_found", "ファイルが見つかりません");

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	// Safari の <audio> はシーク時に Range を要求する
	headers.set("accept-ranges", "bytes");
	// 署名URLの有効期限と同じだけブラウザ内キャッシュを許可（共有キャッシュには載せない）
	headers.set("cache-control", `private, max-age=${VIEW_URL_TTL_SECONDS}`);

	// onlyIf（If-None-Match 等）が成立しなかった場合は本体なしの R2Object が返る
	if (!("body" in object) || !object.body) {
		return new Response(null, { status: 304, headers });
	}

	// 206 にするのはクライアントが実際に Range を要求したときだけ。
	// range オプションに Headers を渡すと、実装によっては Range ヘッダーが無くても
	// object.range が全域で埋まることがある（miniflare で確認）
	let status = 200;
	if (request.headers.has("range") && object.range) {
		let offset = 0;
		let length = object.size;
		if ("suffix" in object.range && object.range.suffix !== undefined) {
			offset = object.size - object.range.suffix;
			length = object.range.suffix;
		} else {
			const range = object.range as { offset?: number; length?: number };
			offset = range.offset ?? 0;
			length = range.length ?? object.size - offset;
		}
		headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
		status = 206;
	}
	if (request.method === "HEAD") {
		await object.body.cancel();
		return new Response(null, { status, headers });
	}
	return new Response(object.body, { status, headers });
}
