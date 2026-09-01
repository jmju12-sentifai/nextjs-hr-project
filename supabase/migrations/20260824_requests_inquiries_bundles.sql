-- 앱개발요청 게시판 / 문의 접수 / 마이 앱 번들
--
-- 출처: HRcoach_Menu_Structure_20260810.xlsx
--   6. 앱개발요청게시판 — 신규 개발 요청 폼(PSST) · 진행 상태 트래킹 · 유저 투표소
--   7. Contact Us      — 고객 지원 센터 · VOC 및 에러 리포트 · B2B 제휴 제안
--   4. 내 작업실        — 마이 앱 번들
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

-- ① 앱 개발 요청 -------------------------------------------------------
create table if not exists public.app_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  category    text,
  -- 엑셀의 "PSST 논리 구조". 네 항목을 각각 컬럼으로 둔다.
  problem     text not null,          -- 어떤 업무가 문제인가
  solution    text not null,          -- 어떤 산출물이 나오면 해결되나
  current_way text,                   -- 지금은 어떻게 처리하나 / 소요 시간
  usage_note  text,                   -- 누가 얼마나 자주 쓰나
  -- 접수 → 검토 → 개발 중 → 완료 / 보류
  status      text not null default 'received'
              check (status in ('received','reviewing','building','done','hold')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists app_requests_status_idx on public.app_requests (status);
create index if not exists app_requests_created_idx on public.app_requests (created_at desc);

alter table public.app_requests enable row level security;

drop policy if exists "anyone reads requests" on public.app_requests;
drop policy if exists "users insert own request" on public.app_requests;
drop policy if exists "users update own request" on public.app_requests;

-- 게시판이므로 목록은 누구나 읽는다. 작성자 식별 정보는 컬럼에 두지 않는다.
create policy "anyone reads requests"
  on public.app_requests for select
  using (true);

create policy "users insert own request"
  on public.app_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 상태와 관리자 메모는 사용자가 못 바꾼다 (서비스 롤로만 변경).
create policy "users update own request"
  on public.app_requests for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ② 유저 투표소 -------------------------------------------------------
create table if not exists public.app_request_votes (
  request_id uuid not null references public.app_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)   -- 1인 1표
);

create index if not exists app_request_votes_request_idx
  on public.app_request_votes (request_id);

alter table public.app_request_votes enable row level security;

drop policy if exists "anyone reads votes" on public.app_request_votes;
drop policy if exists "users vote once" on public.app_request_votes;
drop policy if exists "users cancel own vote" on public.app_request_votes;

create policy "anyone reads votes"
  on public.app_request_votes for select
  using (true);

create policy "users vote once"
  on public.app_request_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users cancel own vote"
  on public.app_request_votes for delete
  to authenticated
  using (auth.uid() = user_id);

-- 목록에서 요청마다 카운트 쿼리를 또 돌리지 않도록 집계 뷰를 둔다.
create or replace view public.app_requests_with_votes
with (security_invoker = true) as
  select r.*, coalesce(v.cnt, 0)::int as vote_count
    from public.app_requests r
    left join (
      select request_id, count(*) as cnt
        from public.app_request_votes
       group by request_id
    ) v on v.request_id = r.id;

grant select on public.app_requests_with_votes to anon, authenticated;

-- ③ 문의 접수 (VOC · B2B 제휴 · 일반) ---------------------------------
create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  -- voc: UI 버그·모델 환각 등 / partnership: B2B 제휴 / support: 일반 문의
  kind       text not null check (kind in ('voc','partnership','support')),
  user_id    uuid references auth.users(id) on delete set null,
  name       text,
  email      text not null,
  company    text,
  subject    text not null,
  body       text not null,
  status     text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now()
);

create index if not exists inquiries_kind_idx on public.inquiries (kind, created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "anyone submits inquiry" on public.inquiries;
drop policy if exists "users read own inquiry" on public.inquiries;

-- 비로그인도 문의는 넣을 수 있어야 한다. 읽기는 본인 것만.
create policy "anyone submits inquiry"
  on public.inquiries for insert
  to anon, authenticated
  with check (true);

create policy "users read own inquiry"
  on public.inquiries for select
  to authenticated
  using (auth.uid() = user_id);

-- ④ 마이 앱 번들 -------------------------------------------------------
create table if not exists public.app_bundles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_bundle_items (
  bundle_id uuid not null references public.app_bundles(id) on delete cascade,
  -- 도구(TOOL)도 담을 수 있어야 해서 apps.id 외래키를 걸지 않고 문자열 키로 둔다.
  item_key  text not null,
  added_at  timestamptz not null default now(),
  primary key (bundle_id, item_key)
);

create index if not exists app_bundles_user_idx on public.app_bundles (user_id);

alter table public.app_bundles enable row level security;
alter table public.app_bundle_items enable row level security;

drop policy if exists "users own bundles" on public.app_bundles;
drop policy if exists "users own bundle items" on public.app_bundle_items;

create policy "users own bundles"
  on public.app_bundles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 아이템은 소유한 번들에 속한 것만.
create policy "users own bundle items"
  on public.app_bundle_items for all
  to authenticated
  using (
    exists (select 1 from public.app_bundles b
             where b.id = bundle_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.app_bundles b
             where b.id = bundle_id and b.user_id = auth.uid())
  );
