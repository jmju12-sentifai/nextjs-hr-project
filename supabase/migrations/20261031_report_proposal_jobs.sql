-- 화면을 떠난 뒤에도 생성 결과를 관리자·앱·조건별로 복원한다.
create table if not exists public.report_proposal_jobs (
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  id uuid not null unique,
  status text not null check (status in ('running', 'completed', 'failed', 'cancelled')),
  calculation text not null,
  saved_doc text not null,
  source_doc jsonb,
  result jsonb,
  error text,
  started_at timestamptz not null default now(),
  primary key (app_id, user_id, path_id)
);
alter table public.report_proposal_jobs enable row level security;
revoke all on public.report_proposal_jobs from anon, authenticated;
grant all on public.report_proposal_jobs to service_role;
