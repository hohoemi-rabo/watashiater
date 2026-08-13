// 閲覧Webの PostgREST 読み取り（チケット20）。
//
// 閲覧URL（/w/[slug]）はログインしない相手が開くため RLS を当てる主体がいない。
// そこで REQUIREMENTS §6 末尾の規約どおり「Next.js サーバー側で slug を検証し、
// service role キーで読む」（anon キーでの直接読み取りは禁止）。
// キーが RLS をバイパスする以上、**どの subject を読んでよいかの判定は呼び出し側
// （lib/museum.ts の slug 照会）が持つ**。このモジュールは読み取り手段だけを提供する。
//
// worker/src/supabase.ts と同型の素の fetch を採る（@supabase/supabase-js を足さない）。
// 必要なのは数本の SELECT だけで、依存を1つ増やす理由にならないため。
import 'server-only'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !secretKey) {
  // .env.local の作り忘れ（新規クローン時）を起動時に明確に知らせる
  // （app/lib/worker-api.ts と同じ流儀）
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。web/.env.local を用意してください（.env.example 参照）',
  )
}

/**
 * PostgREST への読み取り専用アクセス。
 * - 新形式の secret キー（sb_secret_...）は apikey ヘッダーだけで送る（Authorization: Bearer に
 *   入れない）— Supabase docs の指定。worker/src/supabase.ts と同じ
 * - Next 15 の fetch は既定で no-store。閲覧内容は常に最新を出したいのでそのまま使う
 * - 失敗は握りつぶさず throw する。PostgREST が落ちているのを「データが無い」と
 *   表示すると、書き手には博物館が消えたように見えるため
 */
export async function sbSelect<T>(pathWithQuery: string): Promise<T[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: secretKey!, accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`PostgREST ${pathWithQuery.split('?')[0]} failed: ${response.status}`)
  }
  return response.json()
}

/** in.(...) のリスト。UUID しか渡さない前提だが、念のため各要素をエンコードする */
export function inList(values: readonly string[]): string {
  return `(${values.map((value) => encodeURIComponent(value)).join(',')})`
}
