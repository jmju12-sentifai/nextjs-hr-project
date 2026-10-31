create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,service_role;
create table public.app_runs(id uuid primary key default gen_random_uuid(),user_id uuid,app_id uuid,created_at timestamptz default now());
grant all on public.app_runs to service_role;
