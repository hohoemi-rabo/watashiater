-- チケット16：招待コードの引き換え（家族登録）と、その周辺のスキーマ拡張。
--
-- 設計判断：
-- - family_members.display_name は「〇〇さんが みたよ しました」の表示名。
--   参加時に家族本人が入力する（Google 名を初期値にするのはアプリ側。2026-08-12 ユーザー決定）
-- - invite_codes.expires_at のデフォルトは 7日間（サーバー時刻基準。端末時計ズレの影響を受けない。
--   TTL の変更はこの1行だけ。2026-08-12 ユーザー決定）
-- - redeem_invite_code は public スキーマ唯一の関数（PostgREST の rpc で呼ぶため意図的。
--   anon からは revoke）。family_members への INSERT ポリシーは引き続き作らない＝この関数が唯一の登録経路
-- - 業務エラー（コード誤り・期限切れ等）は RAISE せず discriminated jsonb で返す。
--   supabase.rpc() の例外はエラーメッセージ文字列のパースが必要になるため
-- - 6桁英数（32文字アルファベット）＝約10億通り＋使い捨て＋7日期限。authenticated からの
--   総当たりは理論上可能だがレートに見合わないためMVPでは受容する（docs/16 メモ）

-- 家族の表示名（テーブルは空だが defensive に default 付きで追加してから外す）
alter table public.family_members add column display_name text not null default '';
alter table public.family_members alter column display_name drop default;

-- 招待コード有効期限のデフォルト
alter table public.invite_codes alter column expires_at set default (now() + interval '7 days');

-- 招待コードの引き換え：検証 → family_members INSERT → used_by 更新 を1関数で行う
create or replace function public.redeem_invite_code(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(btrim(p_code));
  v_name text := btrim(p_display_name);
  v_invite public.invite_codes%rowtype;
  v_owner uuid;
  v_nickname text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 20 then
    return jsonb_build_object('status', 'invalid_name');
  end if;

  -- 同時引き換えを直列化（2人が同じコードを同時に使ったら後の1人は used_by で弾かれる）
  select ic.* into v_invite
    from public.invite_codes ic
    where ic.code = v_code
    for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_invite.used_by is not null then
    return jsonb_build_object('status', 'already_used');
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select s.owner_user_id, s.nickname into v_owner, v_nickname
    from public.subjects s
    where s.id = v_invite.subject_id;
  if v_owner = v_uid then
    return jsonb_build_object('status', 'own_code');
  end if;

  if exists (
    select 1 from public.family_members fm
    where fm.subject_id = v_invite.subject_id and fm.member_user_id = v_uid
  ) then
    -- 既に家族：コードは消費しない（別の家族がまだ使える）
    return jsonb_build_object(
      'status', 'already_member',
      'subject_id', v_invite.subject_id,
      'subject_nickname', v_nickname
    );
  end if;

  begin
    insert into public.family_members (subject_id, member_user_id, display_name)
      values (v_invite.subject_id, v_uid, v_name);
  exception when unique_violation then
    -- 併走ダブルジョインの保険（事前チェックとの隙間）
    return jsonb_build_object(
      'status', 'already_member',
      'subject_id', v_invite.subject_id,
      'subject_nickname', v_nickname
    );
  end;

  update public.invite_codes set used_by = v_uid where id = v_invite.id;

  return jsonb_build_object(
    'status', 'ok',
    'subject_id', v_invite.subject_id,
    'subject_nickname', v_nickname
  );
end;
$$;

revoke execute on function public.redeem_invite_code(text, text) from public, anon;
grant execute on function public.redeem_invite_code(text, text) to authenticated, service_role;
