/**
 * せってい（チケット18）：ニックネーム変更とアカウント削除。
 *
 * アカウント削除の順序（逆にしない）：
 *   1. worker /media/wipe（R2 全削除。subject 行と JWT が生きているうちに）
 *   2. RPC delete_own_account（auth.users の DELETE → 全テーブルへ CASCADE）
 *   3. 呼び出し側で signOut（AsyncStorage のセッションはサーバー側削除では消えない）
 * 1 と 2 の間で失敗しても、行が残っているので再実行でつづきから消せる
 * （空 prefix への wipe は冪等）。
 */
import { clearOfflineCache } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { WorkerApiError, wipeMedia } from '@/lib/worker-api';

const NICKNAME_ERROR_MESSAGE =
  'ほぞんできませんでした。インターネットに つながっているか たしかめて、もういちど ためしてください。';
const DELETE_RETRY_MESSAGE =
  '削除が途中で止まりました。もういちど「アカウントを削除する」を押すと、つづきから削除できます。';
const DELETE_ERROR_MESSAGE =
  '削除できませんでした。電波のよいところで、もういちどためしてください。';

export type AccountResult = { ok: true } | { ok: false; message: string };

/** ニックネーム変更（プロジェクト初の subjects UPDATE。RLS subjects_owner_update） */
export async function updateNickname(subjectId: string, nickname: string): Promise<AccountResult> {
  const { error } = await supabase.from('subjects').update({ nickname }).eq('id', subjectId);
  if (error) {
    return { ok: false, message: NICKNAME_ERROR_MESSAGE };
  }
  return { ok: true };
}

/**
 * アカウント削除。hasSubject=false（家族専用アカウント）は R2 を持ち得ないので wipe を省く。
 * 成功後の signOut と画面遷移は呼び出し側で行う
 */
export async function deleteAccount(hasSubject: boolean): Promise<AccountResult> {
  if (hasSubject) {
    try {
      await wipeMedia();
    } catch (error) {
      // まだ何も消えていない。worker の日本語 message をそのまま出してリトライしてもらう
      const message = error instanceof WorkerApiError ? error.message : DELETE_ERROR_MESSAGE;
      return { ok: false, message };
    }
  }
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    // R2 は消えたが行は残っている状態。再実行で wipe（0件）→ RPC のつづきから消せる
    return { ok: false, message: hasSubject ? DELETE_RETRY_MESSAGE : DELETE_ERROR_MESSAGE };
  }
  // 端末に残した写し（オフライン閲覧用）も消す（チケット19）
  await clearOfflineCache();
  return { ok: true };
}
