-- チケット18：アカウント削除（REQUIREMENTS §4.3。本人データの完全削除）。
--
-- 設計判断：
-- - auth.users の DELETE 1文で public 側は FK CASCADE が全回収する
--   （subjects → answers → photos/recordings、life_story、family_members → reactions、
--     invite_codes、view_links。家族としての登録も family_members.member_user_id の
--     CASCADE で消え、その reactions も member_id の CASCADE で消える）
-- - invite_codes.used_by は on delete set null のため、削除者が引き換え済みの「他人の」
--   コードが未使用に戻り、7日期限内なら再引き換え可能になってしまう。
--   先に expires_at = now() で失効させてから削除する
-- - R2 のオブジェクト削除は worker の POST /media/wipe（アプリがこの RPC の**前**に呼ぶ。
--   順序が逆だと subject_id が消えて prefix を導出できず、孤児が永久に残る）。
--   DB からは R2 に触れない（worker の supabase.ts が読み取り専用なのと対になる分担）
-- - redeem_invite_code と同じく public スキーマの definer 関数（PostgREST rpc で呼ぶため。
--   anon からは revoke）。postgres 所有なので auth.users を削除できる（Supabase の標準パターン）
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.invite_codes set expires_at = now() where used_by = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated, service_role;
