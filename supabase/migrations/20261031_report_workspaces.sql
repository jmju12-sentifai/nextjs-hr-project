-- 작업 기록은 이용자에게 보여 주는 확정 양식과 분리한다.
create table if not exists public.report_editor_workspaces (
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  workspace jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (app_id, user_id, path_id)
);
alter table public.report_editor_workspaces enable row level security;
revoke all on public.report_editor_workspaces from anon, authenticated;
grant all on public.report_editor_workspaces to service_role;
