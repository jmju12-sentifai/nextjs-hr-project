-- 갱신 실패로 이용 기간이 지난 활성 구독도 무료 제공 중 재청구하면 안 된다.
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
  if s.id is not null then
   if v_end is null then
    update subscriptions set auto_renew=false,canceled_at=now(),next_billing_at=null,billing_key=null where id=s.id;
   else
    v_delta:=v_end-v_start;
    update subscriptions set expires_at=v_end,next_billing_at=case when auto_renew then greatest(now(),coalesce(next_billing_at,v_start))+v_delta else null end where id=s.id;
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

