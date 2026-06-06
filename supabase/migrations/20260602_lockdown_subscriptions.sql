-- Subscription 보안 강화 마이그레이션
--
-- 변경 의도:
-- 1. 사용자가 직접 자기 구독을 INSERT 할 수 없게 함 (결제 우회 차단)
-- 2. payment_key 중복 처리 방지 (idempotency)
-- 3. SELECT 정책은 유지 — 사용자는 자기 구독 현황을 읽을 수 있어야 함
--
-- 결제 승인 후 구독 행 생성은 서버 측 service-role 클라이언트만 가능.
-- (app/api/payment/confirm/route.ts 에서 createAdminClient() 사용)
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

-- ① INSERT 정책 제거 — 사용자가 직접 구독을 만들 수 없게 차단
drop policy if exists "users can insert own subscriptions" on public.subscriptions;

-- ② SELECT 정책은 보존 (혹시 누락된 경우 다시 만들기)
drop policy if exists "users can read own subscriptions" on public.subscriptions;
create policy "users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ③ payment_key 유니크 제약 — 같은 결제로 구독이 두 번 만들어지지 않도록
create unique index if not exists subscriptions_payment_key_uniq
  on public.subscriptions (payment_key)
  where payment_key is not null;

-- ④ RLS는 이미 켜져 있음을 확인 (idempotent)
alter table public.subscriptions enable row level security;
