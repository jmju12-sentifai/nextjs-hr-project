-- 외부 승인과 DB 저장 사이에 끊겨도 같은 주문을 조회·재사용하도록 먼저 작업을 확정한다.
create or replace function public.claim_billing_attempt(p_id text,p_user uuid,p_kind text,p_subscription uuid,p_plan text,p_amount integer,p_months integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.billing_attempts; s public.subscriptions; token uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,71031));
 select * into a from billing_attempts where id=p_id and user_id=p_user for update;
 if a.id is not null then
  if a.state in ('done','failed') then return to_jsonb(a); end if;
  if a.lease_until>now() then raise exception 'BILLING_BUSY'; end if;
 else
  if exists(select 1 from billing_attempts where user_id=p_user and state in ('pending','processing')) then raise exception 'BILLING_BUSY'; end if;
  if p_kind='first' then
   if exists(select 1 from subscriptions where user_id=p_user and status='active' and (expires_at is null or expires_at>now()))
    and not exists(select 1 from subscription_grants where user_id=p_user and revoked_at is null and (ends_at is null or ends_at>now()) and starts_at<=now()) then raise exception 'ALREADY_SUBSCRIBED'; end if;
  elsif p_kind='renew' then
   select * into s from subscriptions where id=p_subscription and user_id=p_user for update;
   if s.id is null or s.status<>'active' or not s.auto_renew or s.billing_key is null or s.next_billing_at is null or s.next_billing_at>now() then return null; end if;
  else raise exception 'INVALID_INPUT'; end if;
  insert into billing_attempts(id,user_id,subscription_id,kind,plan,amount,months,order_id,billing_data)
   values(p_id,p_user,p_subscription,p_kind,p_plan,p_amount,p_months,'hr_'||p_id,
    case when p_kind='renew' then jsonb_build_object('billingKey',s.billing_key,'customerKey',s.customer_key,'cardCompany',s.card_company,'cardNumber',s.card_number_masked) else null end)
   returning * into a;
 end if;
 update billing_attempts set state='processing',lease_until=now()+interval '2 minutes',lease_token=token,updated_at=now() where id=a.id returning * into a;
 return to_jsonb(a);
end; $$;

create or replace function public.finish_billing_attempt(p_id text,p_token uuid,p_payment jsonb,p_error text default null,p_definite boolean default false)
returns jsonb language plpgsql security invoker set search_path=public set timezone='Asia/Seoul' as $$
declare a public.billing_attempts; v_sub uuid; v_next timestamptz; v_approved timestamptz; v_fails integer;
begin
 select * into a from billing_attempts where id=p_id;
 if a.id is null then raise exception 'ATTEMPT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.user_id::text,71031));
 select * into a from billing_attempts where id=p_id for update;
 if a.state='done' then return jsonb_build_object('ok',true,'subscriptionId',a.subscription_id); end if;
 if a.state='failed' then return jsonb_build_object('ok',false,'pending',false); end if;
 if a.lease_token is distinct from p_token then raise exception 'BILLING_BUSY'; end if;
 if p_payment is null then
  update billing_attempts set state=case when p_definite then 'failed' else 'pending' end,error=left(p_error,500),billing_data=case when p_definite then null else billing_data end,lease_until=null,lease_token=null,updated_at=now() where id=a.id;
  if p_definite then
   insert into payments(user_id,subscription_id,kind,amount,status,order_id,error) values(a.user_id,a.subscription_id,a.kind,a.amount,'failed',a.order_id,left(p_error,500)) on conflict(order_id) do nothing;
   if a.kind='renew' then
    select renew_fail_count+1 into v_fails from subscriptions where id=a.subscription_id for update;
    update subscriptions set renew_fail_count=v_fails,last_renew_error=left(p_error,500),
     status=case when v_fails>=3 then 'expired' else status end,auto_renew=case when v_fails>=3 then false else auto_renew end,
     next_billing_at=case when v_fails>=3 then null else now()+interval '1 day' end where id=a.subscription_id;
   end if;
  end if;
  return jsonb_build_object('ok',false,'pending',not p_definite);
 end if;
 if (p_payment->>'status') is distinct from 'DONE' or (p_payment->>'totalAmount')::integer is distinct from a.amount or (p_payment->>'orderId') is distinct from a.order_id or coalesce(p_payment->>'paymentKey','')='' then raise exception 'PAYMENT_MISMATCH'; end if;
 v_approved:=coalesce((p_payment->>'approvedAt')::timestamptz,now());
 v_next:=v_approved+make_interval(months=>a.months);
 if a.kind='first' then
  update subscriptions set status='canceled',auto_renew=false,expires_at=now(),next_billing_at=null,billing_key=null where user_id=a.user_id and status='active';
  insert into subscriptions(user_id,plan,payment_key,order_id,amount,status,started_at,expires_at,next_billing_at,billing_key,customer_key,card_company,card_number_masked,auto_renew)
   values(a.user_id,a.plan,p_payment->>'paymentKey',a.order_id,a.amount,'active',v_approved,v_next,v_next,a.billing_data->>'billingKey',a.billing_data->>'customerKey',a.billing_data->>'cardCompany',a.billing_data->>'cardNumber',true) returning id into v_sub;
  -- 무료 기간은 성공한 첫 결제와 동시에 종료한다. 승인 실패 시 무료 권한은 보존한다.
  update subscription_grants set revoked_at=now(),revoked_by='결제 즉시 유료 전환' where user_id=a.user_id and revoked_at is null;
 else
  v_sub:=a.subscription_id;
  update subscriptions set payment_key=p_payment->>'paymentKey',order_id=a.order_id,amount=a.amount,expires_at=v_next,next_billing_at=v_next,renew_fail_count=0,last_renew_error=null where id=v_sub;
 end if;
 insert into payments(user_id,subscription_id,kind,amount,status,order_id,payment_key,receipt_url,created_at)
  values(a.user_id,v_sub,a.kind,a.amount,'done',a.order_id,p_payment->>'paymentKey',p_payment->'receipt'->>'url',v_approved)
  on conflict(order_id) do update set status='done',payment_key=excluded.payment_key,receipt_url=excluded.receipt_url,error=null;
 update billing_attempts set state='done',subscription_id=v_sub,billing_data=null,lease_until=null,lease_token=null,error=null,updated_at=now() where id=a.id;
 insert into admin_actions(target_user_id,actor_email,action,detail) values(a.user_id,'자동 결제',a.kind||'_payment',jsonb_build_object('orderId',a.order_id,'amount',a.amount,'expiresAt',v_next));
 return jsonb_build_object('ok',true,'subscriptionId',v_sub,'nextBillingAt',v_next);
end; $$;
revoke all on function public.claim_billing_attempt(text,uuid,text,uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.finish_billing_attempt(text,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_billing_attempt(text,uuid,text,uuid,text,integer,integer) to service_role;
grant execute on function public.finish_billing_attempt(text,uuid,jsonb,text,boolean) to service_role;
