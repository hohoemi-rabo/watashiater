// PostgREST への読み取り専用アクセス。sb_secret キーは RLS をバイパスするため、
// 認可判定はこのモジュールの呼び出し側（media.ts）で明示的に行う。
// DB の private スキーマにある判定関数は auth.uid() 前提のため REST からは再利用できない。
// 新形式の secret キーは apikey ヘッダーだけで送る（Authorization: Bearer に入れない）— Supabase docs の指定

async function sbSelect<T>(env: Env, pathWithQuery: string): Promise<T[]> {
	const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathWithQuery}`, {
		headers: { apikey: env.SUPABASE_SECRET_KEY, accept: "application/json" },
	});
	if (!response.ok) {
		// 認可の判定材料が取れないときは握りつぶさず 500 にする（index.ts の try/catch が拾う）
		throw new Error(`PostgREST ${pathWithQuery.split("?")[0]} failed: ${response.status}`);
	}
	return response.json();
}

/** アップロードは本人のみ：呼び出しユーザーが所有する subject の id を返す（未作成なら null） */
export async function getOwnedSubjectId(env: Env, userId: string): Promise<string | null> {
	const rows = await sbSelect<{ id: string }>(env, `subjects?owner_user_id=eq.${userId}&select=id`);
	return rows[0]?.id ?? null;
}

/** 閲覧は本人または登録家族（DB の SELECT ポリシーと同じ判定。REQUIREMENTS §6） */
export async function canViewSubject(env: Env, subjectId: string, userId: string): Promise<boolean> {
	const owned = await sbSelect<{ id: string }>(
		env,
		`subjects?id=eq.${subjectId}&owner_user_id=eq.${userId}&select=id`,
	);
	if (owned.length > 0) return true;
	const membership = await sbSelect<{ id: string }>(
		env,
		`family_members?subject_id=eq.${subjectId}&member_user_id=eq.${userId}&select=id`,
	);
	return membership.length > 0;
}

/** 閲覧専用URL：有効な slug が指す subject の id を返す（無効化済み・存在しない slug は null） */
export async function getSubjectIdForSlug(env: Env, slug: string): Promise<string | null> {
	const rows = await sbSelect<{ subject_id: string }>(
		env,
		`view_links?slug=eq.${encodeURIComponent(slug)}&is_active=is.true&select=subject_id`,
	);
	return rows[0]?.subject_id ?? null;
}
