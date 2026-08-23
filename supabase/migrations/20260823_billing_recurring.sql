-- 정기결제(빌링) 전환 마이그레이션
--
-- 배경: MID `bill_HRcoawdkw` 는 빌링 가맹점인데 결제 구현은 단건 승인이었다.
-- 단건 승인은 카드 정보를 보관하지 않으므로 다음 달 청구를 할 수단이 없다.
-- 빌링은 카드 등록 시 받은 billingKey 를 보관해두고 그 키로 매달 청구한다.
-- 따라서 구독 행이 (a) 어떤 키로 (b) 언제 다시 청구할지를 들고 있어야 한다.
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

-- ① 빌링 관련 컬럼 ------------------------------------------------------
alter table public.subscriptions
  add column if not exists billing_key         text,
  -- 토스 빌링키는 customerKey 와 쌍으로만 유효하다. 발급 때 쓴 값을 그대로 보관한다.
  add column if not exists customer_key        text,
  add column if not exists card_company        text,
  add column if not exists card_number_masked  text,
  -- 다음 청구 예정 시각. 갱신 크론이 이 컬럼만 보고 대상을 고른다.
  add column if not exists next_billing_at     timestamptz,
  -- 해지하면 false. 행은 남기되 만료일까지는 계속 active 로 쓴다.
  add column if not exists auto_renew          boolean not null default true,
  add column if not exists canceled_at         timestamptz,
  -- 갱신 실패 누적. 연속 실패가 쌓이면 크론이 더 시도하지 않는다.
  add column if not exists renew_fail_count    integer not null default 0,
  add column if not exists last_renew_error    text;

-- ② 갱신 크론용 인덱스 --------------------------------------------------
-- 크론은 "active + auto_renew + next_billing_at 지남" 을 훑는다. 부분 인덱스로 좁힌다.
create index if not exists subscriptions_due_for_renewal_idx
  on public.subscriptions (next_billing_at)
  where status = 'active' and auto_renew;

-- ③ 빌링키는 사용자당 하나만 살아 있으면 된다 --------------------------
-- 카드를 새로 등록하면 이전 구독을 해지하고 새 행을 만드는 흐름이라
-- 유니크 제약 대신 조회용 인덱스만 둔다.
create index if not exists subscriptions_billing_key_idx
  on public.subscriptions (billing_key)
  where billing_key is not null;

-- ④ billing_key 는 사용자에게 노출되면 안 된다 -------------------------
-- 기존 SELECT 정책은 행 전체를 읽게 해주므로, 정책을 컬럼 제한이 가능한
-- 뷰로 갈음한다. 앱 코드는 이 뷰만 읽는다.
create or replace view public.my_subscriptions
with (security_invoker = true) as
  select
    id, user_id, plan, amount, status,
    started_at, expires_at, next_billing_at,
    auto_renew, canceled_at,
    card_company, card_number_masked
  from public.subscriptions;

grant select on public.my_subscriptions to authenticated;

-- ⑤ 기존 단건 결제 행 정리 --------------------------------------------
-- 빌링키가 없는 과거 행은 갱신 대상이 되면 안 된다. (테스트 결제분)
update public.subscriptions
   set auto_renew = false
 where billing_key is null;
