/**
 * 招待コードの引き換え（チケット16。家族側）。プロジェクト初の supabase.rpc() 呼び出し。
 * RPC（public.redeem_invite_code）は業務エラーを RAISE せず discriminated jsonb で返すので、
 * ここでは Json をランタイムパースして判別 union に写すだけ（例外文字列のパースをしない）。
 */
import { supabase } from '@/lib/supabase';

export type RedeemResult =
  | { status: 'ok' | 'already_member'; subjectId: string; subjectNickname: string }
  | { status: 'not_found' | 'already_used' | 'expired' | 'own_code' | 'invalid_name' }
  | { status: 'network_error' };

export async function redeemInviteCode(code: string, displayName: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code,
    p_display_name: displayName,
  });
  if (error || data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'network_error' };
  }
  const status = data.status;
  if (status === 'ok' || status === 'already_member') {
    const subjectId = data.subject_id;
    const subjectNickname = data.subject_nickname;
    if (typeof subjectId !== 'string' || typeof subjectNickname !== 'string') {
      return { status: 'network_error' };
    }
    return { status, subjectId, subjectNickname };
  }
  if (
    status === 'not_found' ||
    status === 'already_used' ||
    status === 'expired' ||
    status === 'own_code' ||
    status === 'invalid_name'
  ) {
    return { status };
  }
  return { status: 'network_error' };
}
