-- 회원 권한·결제 이력·운영 처리는 서버에서만 변경한다.
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subscription_id uuid references public.subscriptions(id) on delete set null,
 kind text not null check(kind in ('first','renew','legacy')), amount integer not null check(amount>=0),
 status text not null check(status in ('done','failed')), order_id text not null unique,
 payment_key text, receipt_url text, error text, created_at timestamptz not null default now()
);
create index if not exists payments_user_date_idx on public.payments(user_id,created_at desc);
create table if not exists public.subscription_grants (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 starts_at timestamptz not null default now(), ends_at timestamptz, reason text not null,
 granted_by text not null, revoked_at timestamptz, revoked_by text, created_at timestamptz not null default now(),
 subscription_id uuid references public.subscriptions(id) on delete set null, billing_adjustment interval,
 check(ends_at is null or ends_at>starts_at)
);
create index if not exists grants_user_idx on public.subscription_grants(user_id) where revoked_at is null;
create table if not exists public.admin_actions (
 id uuid primary key default gen_random_uuid(), target_user_id uuid not null references auth.users(id) on delete cascade,
 actor_email text not null, action text not null, detail jsonb not null default '{}', created_at timestamptz not null default now(), request_id uuid unique
);
create index if not exists admin_actions_user_date_idx on public.admin_actions(target_user_id,created_at desc);
create table if not exists public.member_notes (
 user_id uuid primary key references auth.users(id) on delete cascade, note text not null default '', updated_at timestamptz not null default now(), updated_by text not null
);
-- 청구 중 탭 이동·서버 종료에도 같은 주문을 재사용한다. 카드 키는 이 비공개 테이블에만 보관한다.
create table if not exists public.billing_attempts (
 id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 subscription_id uuid references public.subscriptions(id), kind text not null check(kind in ('first','renew')),
 plan text not null, amount integer not null, months integer not null, order_id text not null unique,
 state text not null default 'pending' check(state in ('pending','processing','done','failed')),
 lease_until timestamptz, lease_token uuid, billing_data jsonb, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists billing_one_open_user_idx on public.billing_attempts(user_id) where state in ('pending','processing');
alter table public.payments enable row level security;
alter table public.subscription_grants enable row level security;
alter table public.admin_actions enable row level security;
alter table public.member_notes enable row level security;
alter table public.billing_attempts enable row level security;
revoke all on public.payments,public.subscription_grants,public.admin_actions,public.member_notes,public.billing_attempts from anon,authenticated;
grant all on public.payments,public.subscription_grants,public.admin_actions,public.member_notes,public.billing_attempts to service_role;
grant select(id,user_id,subscription_id,kind,amount,status,order_id,receipt_url,error,created_at) on public.payments to authenticated;
grant select(id,user_id,starts_at,ends_at,revoked_at,created_at) on public.subscription_grants to authenticated;
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments for select to authenticated using(auth.uid()=user_id);
drop policy if exists "own grants" on public.subscription_grants;
create policy "own grants" on public.subscription_grants for select to authenticated using(auth.uid()=user_id);
-- 뷰만 추가해서는 원본 테이블의 빌링키를 숨길 수 없으므로 컬럼 권한도 제한한다.
revoke select on public.subscriptions from anon,authenticated;
grant select(id,user_id,plan,amount,status,started_at,expires_at,next_billing_at,auto_renew,canceled_at,card_company,card_number_masked) on public.subscriptions to authenticated;

-- 기존 데이터는 마지막으로 남아 있는 결제만 이관한다. 잃어버린 과거 회차를 추정하지 않는다.
insert into public.payments(user_id,subscription_id,kind,amount,status,order_id,payment_key,created_at)
 select user_id,id,'legacy',amount,'done',order_id,payment_key,started_at from public.subscriptions
 where payment_key is not null and order_id is not null on conflict(order_id) do nothing;

create or replace view public.admin_member_overview as
select u.id,u.email,u.created_at,u.last_sign_in_at,
 case when g.id is not null and g.starts_at<=now() then 'free'
      when s.renew_fail_count>0 and s.status in ('active','expired') then 'failed'
      when s.status='active' and (s.expires_at is null or s.expires_at>now()) then case when s.auto_renew then 'paid' else 'canceling' end
      else 'none' end as state,
 (g.id is not null and g.starts_at<=now()) or coalesce(s.status='active' and (s.expires_at is null or s.expires_at>now()),false) as active,
 s.id as subscription_id,s.plan,s.amount,s.status as subscription_status,s.started_at,s.expires_at,s.next_billing_at,s.auto_renew,s.canceled_at,s.card_company,s.card_number_masked,s.renew_fail_count,s.last_renew_error,
 g.id as grant_id,g.starts_at as grant_starts_at,g.ends_at as grant_ends_at,g.reason as grant_reason,
 (select max(r.created_at) from public.app_runs r where r.user_id=u.id) as last_run_at
from auth.users u
left join lateral (select * from public.subscriptions where user_id=u.id order by (status='active') desc,started_at desc,id limit 1) s on true
left join lateral (select * from public.subscription_grants where user_id=u.id and revoked_at is null and (ends_at is null or ends_at>now()) order by starts_at,id limit 1) g on true;
revoke all on public.admin_member_overview from public,anon,authenticated;
grant select on public.admin_member_overview to service_role;

-- 사유·변경 전후와 권한 변경을 한 트랜잭션으로 남긴다. 재전송도 중복 부여하지 않는다.
create or replace function public.manage_member(p_user uuid,p_actor text,p_action text,p_data jsonb,p_request uuid)
returns jsonb language plpgsql security invoker set search_path=public set timezone='Asia/Seoul' as $$
declare s public.subscriptions; g public.subscription_grants; v_start timestamptz; v_end timestamptz; v_delta interval; v_before jsonb; v_after jsonb; v_reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,71031));
 if not exists(select 1 from admin_member_overview where id=p_user) then raise exception 'MEMBER_NOT_FOUND'; end if;
 if exists(select 1 from admin_actions where request_id=p_request and target_user_id=p_user and actor_email=p_actor) then return jsonb_build_object('ok',true,'replayed',true); end if;
 if p_action<>'note' and exists(select 1 from billing_attempts where user_id=p_user and state in ('pending','processing')) then raise exception 'BILLING_BUSY'; end if;
 v_reason:=trim(coalesce(p_data->>'reason',''));
 if p_action<>'note' and (length(v_reason)<1 or length(v_reason)>500) then raise exception 'REASON_REQUIRED'; end if;
 select to_jsonb(o) into v_before from admin_member_overview o where id=p_user;
 if p_action<>'note' and p_data ? 'expected' and (
 (p_data->'expected'->>'subscription_id') is distinct from (v_before->>'subscription_id') or
 (p_data->'expected'->>'expires_at')::timestamptz is distinct from (v_before->>'expires_at')::timestamptz or
 (p_data->'expected'->>'grant_id') is distinct from (v_before->>'grant_id') or
 (p_data->'expected'->>'auto_renew')::boolean is distinct from (v_before->>'auto_renew')::boolean
 ) then raise exception 'STATE_CHANGED'; end if;
 select * into s from subscriptions where user_id=p_user and status='active' order by started_at desc limit 1 for update;
 if p_action='note' then
  if length(coalesce(p_data->>'note',''))>5000 then raise exception 'INVALID_INPUT'; end if;
  insert into member_notes(user_id,note,updated_by) values(p_user,coalesce(p_data->>'note',''),p_actor)
    on conflict(user_id) do update set note=excluded.note,updated_at=now(),updated_by=p_actor;
 elsif p_action='cancel' then
  if s.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  update subscriptions set auto_renew=false,canceled_at=coalesce(canceled_at,now()),billing_key=null,next_billing_at=null where id=s.id;
 elsif p_action='terminate' then
  update subscriptions set status='canceled',expires_at=now(),auto_renew=false,canceled_at=now(),billing_key=null,next_billing_at=null where user_id=p_user and status='active';
  update subscription_grants set revoked_at=now(),revoked_by=p_actor where user_id=p_user and revoked_at is null;
 elsif p_action='expiry' then
  if s.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  v_end:=(p_data->>'endsAt')::timestamptz;
  if v_end is null or v_end<=now() then raise exception 'INVALID_END'; end if;
  if exists(select 1 from subscription_grants where user_id=p_user and revoked_at is null and (ends_at is null or ends_at>now())) then raise exception 'GRANT_EXISTS'; end if;
  update subscriptions set expires_at=v_end,next_billing_at=case when auto_renew then v_end else null end where id=s.id;
 elsif p_action='grant' then
  if exists(select 1 from subscription_grants where user_id=p_user and revoked_at is null and (ends_at is null or ends_at>now())) then raise exception 'GRANT_EXISTS'; end if;
  v_start:=case when s.id is not null and s.expires_at>now() and p_data->>'duration'<>'unlimited' then s.expires_at else now() end;
  if p_data->>'duration'='unlimited' then v_end:=null;
  elsif p_data->>'duration' in ('1','3') then v_end:=v_start+make_interval(months=>(p_data->>'duration')::integer);
  elsif p_data->>'duration'='custom' then v_end:=(p_data->>'endsAt')::timestamptz;
  else raise exception 'INVALID_INPUT'; end if;
  if v_end is not null and v_end<=v_start then raise exception 'INVALID_END'; end if;
  if s.id is not null and s.expires_at>now() then
   if v_end is null then
    update subscriptions set auto_renew=false,canceled_at=now(),next_billing_at=null,billing_key=null where id=s.id;
   else
    v_delta:=v_end-v_start;
    update subscriptions set expires_at=v_end,next_billing_at=case when auto_renew then coalesce(next_billing_at,v_start)+v_delta else null end where id=s.id;
   end if;
  end if;
  insert into subscription_grants(user_id,starts_at,ends_at,reason,granted_by,subscription_id,billing_adjustment)
   values(p_user,v_start,v_end,v_reason,p_actor,s.id,v_delta);
 elsif p_action='revoke' then
  select * into g from subscription_grants where id=(p_data->>'grantId')::uuid and user_id=p_user and revoked_at is null for update;
  if g.id is null then raise exception 'GRANT_NOT_FOUND'; end if;
  if g.billing_adjustment is not null and g.ends_at>now() then
   update subscriptions set expires_at=greatest(now(),expires_at-g.billing_adjustment),next_billing_at=case when auto_renew then greatest(now(),next_billing_at-g.billing_adjustment) else null end where id=g.subscription_id and status='active';
  end if;
  update subscription_grants set revoked_at=now(),revoked_by=p_actor where id=g.id;
 else raise exception 'INVALID_ACTION'; end if;
 select to_jsonb(o) into v_after from admin_member_overview o where id=p_user;
 insert into admin_actions(target_user_id,actor_email,action,detail,request_id)
 values(p_user,p_actor,p_action,jsonb_build_object('reason',v_reason,'before',v_before,'after',v_after),p_request);
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.manage_member(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.manage_member(uuid,text,text,jsonb,uuid) to service_role;

create or replace function public.member_usage(p_user uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('runs',count(*),'apps',count(distinct app_id),'last',max(created_at)) from app_runs
 where user_id=p_user and created_at >= (date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;
revoke all on function public.member_usage(uuid) from public,anon,authenticated;
grant execute on function public.member_usage(uuid) to service_role;
