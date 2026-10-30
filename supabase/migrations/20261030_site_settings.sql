-- Supabase SQL Editor에서 실행한다. 공개 가이드만 보관하고 비밀 설정은 넣지 않는다.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select (key, value) on public.site_settings to anon, authenticated;
grant all on public.site_settings to service_role;
drop policy if exists "public_report_guide" on public.site_settings;
create policy "public_report_guide" on public.site_settings for select
  to anon, authenticated using (key = 'report_guide');
