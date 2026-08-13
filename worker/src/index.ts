import { handleGenerateLifeStory } from "./ai";
import { preflight, withCors } from "./cors";
import { jsonError } from "./http";
import {
	handleCreateUploadUrls,
	handleCreateViewUrls,
	handleGetObject,
	handlePutObject,
	handleWipeMedia,
} from "./media";

// AI生成プロキシ（REQUIREMENTS §5 役割1）とメディアの門番（同 役割2）。
// Gemini の API キーはこの worker の外に出さず、R2 への読み書きも必ずこの worker を通る。
//
// CORS は許可オリジンの完全一致リストで付ける（チケット24。理由と設計は src/cors.ts）。
// 呼び出し元は3種類あり、CORS が要るのは1つ目だけ：
//  - 書き手 Web（PWA）：ブラウザの JS から直接叩く → CORS 必須
//  - アプリ（React Native の fetch）：CORS の制約を受けない
//  - 閲覧 Web：Next.js のサーバー側から呼ぶ（ブラウザから直接叩かない）
// <img>/<audio> タグによるメディア読み込みにも CORS は不要（許可しても害は無いので分岐しない）。
export default {
	async fetch(request, env): Promise<Response> {
		// プリフライトは認可より前に返す。ブラウザは Authorization を付けずに投げてくるので、
		// ルーティングに流すと 401 になってしまう
		if (request.method === "OPTIONS") {
			return preflight(request, env);
		}
		return withCors(await route(request, env), request, env);
	},
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
	try {
		const { pathname } = new URL(request.url);
		if (request.method === "POST" && pathname === "/ai/life-story") {
			return await handleGenerateLifeStory(request, env);
		}
		if (request.method === "POST" && pathname === "/media/upload-urls") {
			return await handleCreateUploadUrls(request, env);
		}
		if (request.method === "POST" && pathname === "/media/view-urls") {
			return await handleCreateViewUrls(request, env);
		}
		if (request.method === "POST" && pathname === "/media/wipe") {
			return await handleWipeMedia(request, env);
		}
		if (pathname.startsWith("/media/objects/")) {
			const r2Key = pathname.slice("/media/objects/".length);
			if (request.method === "PUT") return await handlePutObject(request, env, r2Key);
			if (request.method === "GET" || request.method === "HEAD") {
				return await handleGetObject(request, env, r2Key);
			}
		}
		return jsonError(404, "not_found", "エンドポイントが見つかりません");
	} catch (error) {
		// 認可判定に必要な外部照会（JWKS / PostgREST）の失敗など。詳細はログにのみ残す
		console.error(error);
		return jsonError(500, "internal_error", "サーバー内部でエラーが発生しました");
	}
}
