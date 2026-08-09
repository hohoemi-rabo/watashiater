-- ============================================================
-- ワタシアター 初期スキーマ（チケット02）
-- REQUIREMENTS.md §6 の10テーブル＋RLS。
-- 方針：
--   * subject_type カラムの存在だけが Phase 2（ペット）への備え。それ以外の先回りをしない
--   * RLS は「本人＝全操作可／登録家族＝対象 subject の SELECT＋reactions INSERT のみ」
--   * view_links は anon からもログインユーザーからも読ませない（閲覧 Web は
--     Next.js サーバーが service role で読む。REQUIREMENTS §6 末尾）
--   * 家族登録（family_members への INSERT）は招待コードの検証つき
--     SECURITY DEFINER 関数としてチケット16で実装する。ここでは INSERT ポリシーを
--     置かない＝デフォルト拒否のまま
-- ============================================================

-- ------------------------------------------------------------
-- テーブル
-- ------------------------------------------------------------

-- 博物館の主役。MVP は本人('self')のみ・1ユーザー1館（owner_user_id UNIQUE）
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  subject_type text not null default 'self' check (subject_type = 'self'),
  nickname text not null,
  -- cover_photo_id の FK は photos 作成後に追加（循環参照のため）
  cover_photo_id uuid,
  -- 机の上ボードの自動整列シード（毎回同じばら撒き配置を再現する。REQUIREMENTS §3.4）
  board_seed integer not null default floor(random() * 2147483647)::integer,
  created_at timestamptz not null default now()
);

-- お題マスタ（固定10問。文言を DB 管理し将来変更可能に。REQUIREMENTS §3.2）
create table public.prompts (
  id integer primary key,
  sort_order integer not null unique,
  title text not null,
  is_photo_prompt boolean not null default false
);

-- 回答カード。prompt_id が null の行が自由お題（custom_title 必須）
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  prompt_id integer references public.prompts (id),
  custom_title text,
  body_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 固定お題は custom_title なし／自由お題は custom_title 必須
  check (
    (prompt_id is not null and custom_title is null)
    or (prompt_id is null and custom_title is not null)
  ),
  -- 固定お題は subject ごとに1回答
  unique (subject_id, prompt_id)
);

-- 自由お題は MVP では1枠のみ（REQUIREMENTS §3.2）。unique 制約は null を重複可と
-- 数えるため、部分 unique インデックスで枠数を固定する
create unique index answers_one_free_prompt_per_subject
  on public.answers (subject_id)
  where prompt_id is null;

-- 録音（回答ごとに1本。「写真が語る」の音源になる）
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null unique references public.answers (id) on delete cascade,
  r2_key text not null unique,
  -- 最長3分（REQUIREMENTS §4.2）。チケット00の実測で自動停止は180秒手前だが、
  -- JS 側の予備停止が最大181秒まで許すため上限は181
  duration_sec integer not null check (duration_sec >= 0 and duration_sec <= 181),
  created_at timestamptz not null default now()
);

-- 写真。board_* が null なら自動整列（REQUIREMENTS §6）。
-- 1お題あたり5枚の上限（§3.2）はアプリ側で制御する
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers (id) on delete cascade,
  r2_key text not null unique,
  board_x real,
  board_y real,
  board_rotation real,
  board_z integer,
  created_at timestamptz not null default now()
);

alter table public.subjects
  add constraint subjects_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos (id) on delete set null;

-- AI 自分史（subject ごとに1本。REQUIREMENTS §6）
create table public.life_story (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null unique references public.subjects (id) on delete cascade,
  body_text text not null,
  generated_at timestamptz not null default now(),
  edited_by_user boolean not null default false
);

-- 登録家族
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (subject_id, member_user_id)
);

-- 招待コード（6桁英数・使い捨て。REQUIREMENTS §3.5a）
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 閲覧専用 URL（推測不能スラッグ。REQUIREMENTS §3.5b）
create table public.view_links (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 有効なリンクは subject ごとに1本（無効化＋再発行の運用。§3.5b）
create unique index view_links_one_active_per_subject
  on public.view_links (subject_id)
  where is_active;

-- みたよ（1タップリアクション。対象は写真か自分史）
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members (id) on delete cascade,
  target_type text not null check (target_type in ('photo', 'life_story')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  -- 同じ対象への「みたよ」は1人1回
  unique (member_id, target_type, target_id)
);

-- ------------------------------------------------------------
-- FK インデックス（unique 制約で足りないもの。RLS の join もこれを使う）
-- ------------------------------------------------------------

create index subjects_cover_photo_id_idx on public.subjects (cover_photo_id);
create index answers_prompt_id_idx on public.answers (prompt_id);
create index photos_answer_id_idx on public.photos (answer_id);
create index family_members_member_user_id_idx on public.family_members (member_user_id);
create index invite_codes_subject_id_idx on public.invite_codes (subject_id);
create index invite_codes_used_by_idx on public.invite_codes (used_by);
create index view_links_subject_id_idx on public.view_links (subject_id);
create index reactions_target_idx on public.reactions (target_type, target_id);

-- ------------------------------------------------------------
-- トリガー
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger answers_set_updated_at
  before update on public.answers
  for each row execute function public.set_updated_at();

-- reactions の対象整合性チェック。target_id は多態（photo / life_story）で FK を張れない
-- ため、「その家族が属する subject のコンテンツか」をトリガーで検証する
create or replace function public.validate_reaction_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_subject uuid;
  target_ok boolean;
begin
  select subject_id into member_subject
    from public.family_members where id = new.member_id;
  if member_subject is null then
    raise exception 'family member not found';
  end if;

  if new.target_type = 'photo' then
    select exists (
      select 1 from public.photos p
      join public.answers a on a.id = p.answer_id
      where p.id = new.target_id and a.subject_id = member_subject
    ) into target_ok;
  else
    select exists (
      select 1 from public.life_story ls
      where ls.id = new.target_id and ls.subject_id = member_subject
    ) into target_ok;
  end if;

  if not target_ok then
    raise exception 'reaction target does not belong to the member''s subject';
  end if;
  return new;
end;
$$;

create trigger reactions_validate_target
  before insert on public.reactions
  for each row execute function public.validate_reaction_target();

-- ------------------------------------------------------------
-- RLS ヘルパー（SECURITY DEFINER：RLS を介さず所有・家族関係だけを判定する。
-- ポリシー内で相互参照による再帰を避け、インデックスの効く形に寄せる）
-- ------------------------------------------------------------

create or replace function public.is_subject_owner(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subjects s
    where s.id = sid and s.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_subject_family(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.subject_id = sid and fm.member_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_answer_owner(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.answers a
    join public.subjects s on s.id = a.subject_id
    where a.id = aid and s.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_answer_family(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.answers a
    join public.family_members fm on fm.subject_id = a.subject_id
    where a.id = aid and fm.member_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_own_membership(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.id = mid and fm.member_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_membership_of_owned_subject(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    join public.subjects s on s.id = fm.subject_id
    where fm.id = mid and s.owner_user_id = (select auth.uid())
  );
$$;

-- ------------------------------------------------------------
-- RLS ポリシー
-- ------------------------------------------------------------

alter table public.subjects enable row level security;
alter table public.prompts enable row level security;
alter table public.answers enable row level security;
alter table public.recordings enable row level security;
alter table public.photos enable row level security;
alter table public.life_story enable row level security;
alter table public.family_members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.view_links enable row level security;
alter table public.reactions enable row level security;

-- subjects：本人＝全操作／家族＝SELECT
create policy subjects_owner_all on public.subjects
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy subjects_family_select on public.subjects
  for select to authenticated
  using (public.is_subject_family(id));

-- prompts：お題マスタはログインユーザー全員が読める。書き込みは service role のみ
create policy prompts_select on public.prompts
  for select to authenticated
  using (true);

-- answers
create policy answers_owner_all on public.answers
  for all to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

create policy answers_family_select on public.answers
  for select to authenticated
  using (public.is_subject_family(subject_id));

-- recordings
create policy recordings_owner_all on public.recordings
  for all to authenticated
  using (public.is_answer_owner(answer_id))
  with check (public.is_answer_owner(answer_id));

create policy recordings_family_select on public.recordings
  for select to authenticated
  using (public.is_answer_family(answer_id));

-- photos
create policy photos_owner_all on public.photos
  for all to authenticated
  using (public.is_answer_owner(answer_id))
  with check (public.is_answer_owner(answer_id));

create policy photos_family_select on public.photos
  for select to authenticated
  using (public.is_answer_family(answer_id));

-- life_story
create policy life_story_owner_all on public.life_story
  for all to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

create policy life_story_family_select on public.life_story
  for select to authenticated
  using (public.is_subject_family(subject_id));

-- family_members：本人＝一覧・解除／家族＝自分の行のみ閲覧。
-- INSERT ポリシーは意図的に無し（招待コード検証つきの definer 関数をチケット16で用意する）
create policy family_members_owner_select on public.family_members
  for select to authenticated
  using (public.is_subject_owner(subject_id));

create policy family_members_owner_delete on public.family_members
  for delete to authenticated
  using (public.is_subject_owner(subject_id));

create policy family_members_member_select on public.family_members
  for select to authenticated
  using (member_user_id = (select auth.uid()));

-- invite_codes：本人のみ（家族側の照合はチケット16の definer 関数経由）
create policy invite_codes_owner_all on public.invite_codes
  for all to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

-- view_links：本人のみ。anon・家族からは読めない（閲覧 Web は service role で読む）
create policy view_links_owner_all on public.view_links
  for all to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

-- reactions：家族＝自分のメンバーシップでの INSERT と自分の行の SELECT／本人＝SELECT
create policy reactions_family_insert on public.reactions
  for insert to authenticated
  with check (public.is_own_membership(member_id));

create policy reactions_member_select on public.reactions
  for select to authenticated
  using (public.is_own_membership(member_id));

create policy reactions_owner_select on public.reactions
  for select to authenticated
  using (public.is_membership_of_owned_subject(member_id));
