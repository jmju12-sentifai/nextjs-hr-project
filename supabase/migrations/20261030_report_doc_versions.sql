-- Supabase SQL Editor에서 실행. 확정본 교체와 버전 기록을 한 트랜잭션에서 처리한다.
create table if not exists public.report_doc_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  path_id text not null,
  version integer not null,
  doc jsonb not null,
  note text not null default '',
  status text not null check (status in ('draft','confirmed')),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (app_id, path_id, version)
);
alter table public.report_doc_versions enable row level security;
revoke all on public.report_doc_versions from anon, authenticated;
grant all on public.report_doc_versions to service_role;
create index if not exists report_doc_versions_lookup on public.report_doc_versions (app_id, path_id, version desc);

create or replace function public.save_report_doc_draft(
  p_app_id uuid, p_path_id text, p_doc jsonb, p_note text, p_actor text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_schema jsonb; v_number integer; v_result public.report_doc_versions;
begin
  select app_schema into v_schema from public.apps where id = p_app_id for update;
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(v_schema->'paths','[]'::jsonb)) p where p->>'id'=p_path_id)
    and coalesce(v_schema->'fallback'->>'id','') <> p_path_id then raise exception 'PATH_NOT_FOUND'; end if;
  select coalesce(max(version),0)+1 into v_number from public.report_doc_versions where app_id=p_app_id and path_id=p_path_id;
  insert into public.report_doc_versions(app_id,path_id,version,doc,note,status,created_by)
    values(p_app_id,p_path_id,v_number,p_doc,p_note,'draft',p_actor) returning * into v_result;
  return to_jsonb(v_result);
end; $$;

create or replace function public.confirm_report_doc(
  p_app_id uuid, p_path_id text, p_doc jsonb, p_expected_schema jsonb, p_actor text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_schema jsonb; v_number integer; v_index integer; v_result public.report_doc_versions;
begin
  select app_schema into v_schema from public.apps where id = p_app_id for update;
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  if v_schema is distinct from p_expected_schema then raise exception 'SCHEMA_CONFLICT'; end if;
  select (ordinality-1)::integer into v_index from jsonb_array_elements(coalesce(v_schema->'paths','[]'::jsonb)) with ordinality p
    where p.value->>'id'=p_path_id;
  if v_index is not null then
    v_schema := jsonb_set(v_schema, array['paths',v_index::text,'doc'],p_doc);
  elsif v_schema->'fallback'->>'id'=p_path_id then
    v_schema := jsonb_set(v_schema,array['fallback','doc'],p_doc);
  else raise exception 'PATH_NOT_FOUND'; end if;
  update public.apps set app_schema=v_schema, version=coalesce(version,1)+1 where id=p_app_id;
  select coalesce(max(version),0)+1 into v_number from public.report_doc_versions where app_id=p_app_id and path_id=p_path_id;
  insert into public.report_doc_versions(app_id,path_id,version,doc,note,status,created_by)
    values(p_app_id,p_path_id,v_number,p_doc,'양식 확정','confirmed',p_actor) returning * into v_result;
  return jsonb_build_object('version',to_jsonb(v_result),'schema',v_schema);
end; $$;
revoke all on function public.save_report_doc_draft(uuid,text,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.confirm_report_doc(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_report_doc_draft(uuid,text,jsonb,text,text) to service_role;
grant execute on function public.confirm_report_doc(uuid,text,jsonb,jsonb,text) to service_role;
