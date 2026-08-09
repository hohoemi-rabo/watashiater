-- ============================================================
-- セキュリティ・パフォーマンス強化（チケット02、advisor 対応）
--
-- 1) RLS ヘルパー関数（SECURITY DEFINER）とトリガー関数を private スキーマへ移動。
--    public スキーマの関数は PostgREST の RPC（/rest/v1/rpc/...）として anon からも
--    呼べてしまうため（advisor 0028/0029）、API 非公開スキーマに隔離する。
--    ポリシー・トリガーは関数を OID で参照しているため、スキーマ移動で壊れない。
-- 2) 同一テーブル・同一アクションに permissive ポリシーが複数あると全数評価される
--    （advisor 0006）ため、SELECT を「本人 or 家族」の1本に統合し、書き込み系は
--    本人のみのポリシーに分割する。
-- ============================================================

-- ------------------------------------------------------------
-- 1) 関数を private スキーマへ
-- ------------------------------------------------------------

create schema if not exists private;

-- RLS ポリシーは実行ユーザー権限で関数を評価するため、authenticated に
-- USAGE / EXECUTE が必要。anon には与えない（anon が評価するポリシーは無い）
grant usage on schema private to authenticated, service_role;

alter function public.set_updated_at() set schema private;
alter function public.validate_reaction_target() set schema private;
alter function public.is_subject_owner(uuid) set schema private;
alter function public.is_subject_family(uuid) set schema private;
alter function public.is_answer_owner(uuid) set schema private;
alter function public.is_answer_family(uuid) set schema private;
alter function public.is_own_membership(uuid) set schema private;
alter function public.is_membership_of_owned_subject(uuid) set schema private;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- ------------------------------------------------------------
-- 2) ポリシー統合：SELECT は「本人 or 家族」1本、書き込みは本人のみ
-- ------------------------------------------------------------

-- subjects
drop policy subjects_owner_all on public.subjects;
drop policy subjects_family_select on public.subjects;

create policy subjects_select on public.subjects
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or private.is_subject_family(id));

create policy subjects_owner_insert on public.subjects
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy subjects_owner_update on public.subjects
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy subjects_owner_delete on public.subjects
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- answers
drop policy answers_owner_all on public.answers;
drop policy answers_family_select on public.answers;

create policy answers_select on public.answers
  for select to authenticated
  using (private.is_subject_owner(subject_id) or private.is_subject_family(subject_id));

create policy answers_owner_insert on public.answers
  for insert to authenticated
  with check (private.is_subject_owner(subject_id));

create policy answers_owner_update on public.answers
  for update to authenticated
  using (private.is_subject_owner(subject_id))
  with check (private.is_subject_owner(subject_id));

create policy answers_owner_delete on public.answers
  for delete to authenticated
  using (private.is_subject_owner(subject_id));

-- recordings
drop policy recordings_owner_all on public.recordings;
drop policy recordings_family_select on public.recordings;

create policy recordings_select on public.recordings
  for select to authenticated
  using (private.is_answer_owner(answer_id) or private.is_answer_family(answer_id));

create policy recordings_owner_insert on public.recordings
  for insert to authenticated
  with check (private.is_answer_owner(answer_id));

create policy recordings_owner_update on public.recordings
  for update to authenticated
  using (private.is_answer_owner(answer_id))
  with check (private.is_answer_owner(answer_id));

create policy recordings_owner_delete on public.recordings
  for delete to authenticated
  using (private.is_answer_owner(answer_id));

-- photos
drop policy photos_owner_all on public.photos;
drop policy photos_family_select on public.photos;

create policy photos_select on public.photos
  for select to authenticated
  using (private.is_answer_owner(answer_id) or private.is_answer_family(answer_id));

create policy photos_owner_insert on public.photos
  for insert to authenticated
  with check (private.is_answer_owner(answer_id));

create policy photos_owner_update on public.photos
  for update to authenticated
  using (private.is_answer_owner(answer_id))
  with check (private.is_answer_owner(answer_id));

create policy photos_owner_delete on public.photos
  for delete to authenticated
  using (private.is_answer_owner(answer_id));

-- life_story
drop policy life_story_owner_all on public.life_story;
drop policy life_story_family_select on public.life_story;

create policy life_story_select on public.life_story
  for select to authenticated
  using (private.is_subject_owner(subject_id) or private.is_subject_family(subject_id));

create policy life_story_owner_insert on public.life_story
  for insert to authenticated
  with check (private.is_subject_owner(subject_id));

create policy life_story_owner_update on public.life_story
  for update to authenticated
  using (private.is_subject_owner(subject_id))
  with check (private.is_subject_owner(subject_id));

create policy life_story_owner_delete on public.life_story
  for delete to authenticated
  using (private.is_subject_owner(subject_id));

-- family_members（owner_delete は据え置き。SELECT の2本だけ統合）
drop policy family_members_owner_select on public.family_members;
drop policy family_members_member_select on public.family_members;

create policy family_members_select on public.family_members
  for select to authenticated
  using (private.is_subject_owner(subject_id) or member_user_id = (select auth.uid()));

-- reactions（family_insert は据え置き。SELECT の2本だけ統合）
drop policy reactions_member_select on public.reactions;
drop policy reactions_owner_select on public.reactions;

create policy reactions_select on public.reactions
  for select to authenticated
  using (
    private.is_own_membership(member_id)
    or private.is_membership_of_owned_subject(member_id)
  );
