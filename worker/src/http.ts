// JSON 応答の共通形。エラーは { error: { code, message } } に統一し、
// チケット11（AI生成プロキシ）のエンドポイントでも同じ形を使う
export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

export function jsonError(status: number, code: string, message: string): Response {
	return json({ error: { code, message } }, status);
}
