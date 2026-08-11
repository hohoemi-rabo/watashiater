import { jsonError } from "./http";
import { handleCreateUploadUrls, handleCreateViewUrls, handleGetObject, handlePutObject } from "./media";

// メディアの門番（REQUIREMENTS §5 役割2）。R2 への読み書きは必ずこの worker を通る。
// CORS ヘッダーは意図的に付けていない：
//  - アプリ（React Native の fetch）は CORS の制約を受けない
//  - 閲覧 Web は Next.js のサーバー側から WORKER_URL を呼ぶ（ブラウザから直接叩かない）
//  - <img>/<audio> タグによるメディア読み込みに CORS は不要
// ブラウザから直接呼ぶ経路が増えたときに初めて追加する。
export default {
	async fetch(request, env): Promise<Response> {
		try {
			const { pathname } = new URL(request.url);
			if (request.method === "POST" && pathname === "/media/upload-urls") {
				return await handleCreateUploadUrls(request, env);
			}
			if (request.method === "POST" && pathname === "/media/view-urls") {
				return await handleCreateViewUrls(request, env);
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
	},
} satisfies ExportedHandler<Env>;
