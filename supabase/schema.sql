-- apps 테이블
create table if not exists apps (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  app_schema      jsonb not null default '{}',
  status          text not null default 'draft',
  version         integer not null default 1,
  created_by      uuid references auth.users(id),
  published_at    timestamp,
  created_at      timestamp default now()
);

-- app_runs 테이블
create table if not exists app_runs (
  id               uuid primary key default gen_random_uuid(),
  app_id           uuid references apps(id),
  app_version      integer,
  input_data       jsonb not null default '{}',
  result           jsonb not null default '{}',
  status           text not null default 'pending',
  error_message    text,
  user_identifier  text,
  created_at       timestamp default now()
);

-- RLS: 데모용 익명 접근 허용
-- 1) RLS 끄기 (가장 간단)
alter table apps      disable row level security;
alter table app_runs  disable row level security;

-- 또는 2) RLS는 켜두고 익명 전체 접근 정책 부여 (위 disable 대신 사용)
-- alter table apps     enable row level security;
-- alter table app_runs enable row level security;
-- drop policy if exists "anon all apps" on apps;
-- create policy "anon all apps" on apps      for all to anon using (true) with check (true);
-- drop policy if exists "anon all runs" on app_runs;
-- create policy "anon all runs" on app_runs  for all to anon using (true) with check (true);
