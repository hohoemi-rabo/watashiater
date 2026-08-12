/**
 * 招待コードの発行・取得（チケット16。書き手側）。REQUIREMENTS §3.5(a)。
 * - 6桁英数。紛らわしい 0/O/1/I を除いた32文字（256 % 32 === 0 なので剰余の偏りなし。
 *   大文字の L は 1 と紛れないため残す。チケット17で31文字だった誤りを修正）
 * - 有効期限は DB のカラムデフォルト（7日間・サーバー時刻）に任せ、insert 後に読み戻す
 * - RLS（invite_codes_owner_all）により本人しか発行・参照できない
 */
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

export type InviteCode = Tables<'invite_codes'>;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CREATE_ERROR_MESSAGE =
  '招待コードをつくれませんでした。電波のよいところで、もういちどためしてください。';

function generateCode(): string {
  const bytes = Crypto.getRandomBytes(CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export type CreateInviteResult = { ok: true; invite: InviteCode } | { ok: false; message: string };

/** 新しい招待コードを発行する。コード衝突（unique 違反）は作り直して最大3回試す */
export async function createInviteCode(subjectId: string): Promise<CreateInviteResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({ subject_id: subjectId, code: generateCode() })
      .select()
      .single();
    if (!error) {
      return { ok: true, invite: data };
    }
    if (error.code !== '23505') {
      break;
    }
  }
  return { ok: false, message: CREATE_ERROR_MESSAGE };
}

/**
 * いま使える（未使用・未失効の）最新コードを返す。画面を開き直しても同じコードを見せる。
 * 失効判定に端末時計を使うが、真の判定は引き換え時にサーバー側（RPC）で行われる
 */
export async function fetchActiveInviteCode(
  subjectId: string,
): Promise<{ ok: boolean; invite: InviteCode | null }> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('subject_id', subjectId)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { ok: false, invite: null };
  }
  return { ok: true, invite: data };
}
