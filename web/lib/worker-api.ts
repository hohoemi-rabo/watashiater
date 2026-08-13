// Cloudflare Worker（メディアの門番）クライアント・閲覧Web版（チケット20）。
// R2 の写真・音声は必ず worker の署名URLを通す（CLAUDE.md アーキテクチャ）。
import 'server-only'

const workerUrl = process.env.WORKER_URL

if (!workerUrl) {
  // .env.local の作り忘れを起動時に明確に知らせる（lib/supabase-server.ts と同じ）
  throw new Error(
    'WORKER_URL が設定されていません。web/.env.local を用意してください（.env.example 参照）',
  )
}

/** worker の MAX_VIEW_KEYS（worker/src/media.ts）。これを超えると 400 になる */
const MAX_VIEW_KEYS = 200

/**
 * 閲覧用署名URLの一括取得（r2_key → 署名URL）。
 *
 * - **Authorization ヘッダーを付けないこと**。worker は「ヘッダーがあれば JWT 経路・
 *   無ければ slug 経路」で分岐し、フォールバックしない（worker/src/media.ts）
 * - キーは1リクエスト1 subject・最大200件。有効期限1時間なのでキャッシュしない
 *   （POST は既定で非キャッシュ。署名URLをキャッシュに載せない原則＝CLAUDE.md）
 * - **失敗しても throw しない**：署名URLが取れなくても回答本文とじぶん史は読める。
 *   「見せるものがあるなら全滅させない」（チケット19で確立した契約）の閲覧Web版。
 *   呼び出し側は URL が欠けた写真を個別に「よみこめませんでした」と出す
 */
export async function getViewUrls(
  r2Keys: readonly string[],
  slug: string,
): Promise<Record<string, string>> {
  if (r2Keys.length === 0) {
    return {}
  }
  const keys = r2Keys.slice(0, MAX_VIEW_KEYS)
  if (keys.length < r2Keys.length) {
    // 上限に達するのは写真5枚×11お題＋録音11＝66件の想定を大きく超えたとき。
    // 黙って切り捨てると「一部の写真だけ出ない」原因が追えなくなるので必ず残す
    console.warn(`[view-urls] keys truncated: ${r2Keys.length} -> ${keys.length}`)
  }

  try {
    const response = await fetch(`${workerUrl}/media/view-urls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ r2Keys: keys, slug }),
    })
    if (!response.ok) {
      // 403「リンクが無効になっています」等。本文は日本語 message を持つが、
      // ここでは画面に出さずログにだけ残す（写真が出ない以外は読めるため）
      console.error(`[view-urls] worker responded ${response.status}: ${await response.text()}`)
      return {}
    }
    const { urls } = (await response.json()) as { urls: Record<string, string> }
    return urls
  } catch (error) {
    console.error('[view-urls] worker request failed', error)
    return {}
  }
}
