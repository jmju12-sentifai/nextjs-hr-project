-- 관리자 계정에 활성 구독 부여
-- 적용: Supabase Dashboard → SQL Editor 에 통째로 붙여넣고 실행.
-- 전제: 해당 이메일로 이미 회원가입(auth.users 에 존재)되어 있어야 함.
-- 동작: 이메일로 유저를 찾아 active 구독 1건 생성. 이미 active 구독이 있으면 건너뜀(중복 방지).
--       expires_at = null → 만료 없음(영구 활성). amount 0 = 무상 부여.

insert into public.subscriptions (user_id, plan, amount, status, started_at, expires_at)
select u.id, 'coach', 0, 'active', now(), null
from auth.users u
where u.email = 'admin@sentif.ai'
  and not exists (
    select 1 from public.subscriptions s
    where s.user_id = u.id and s.status = 'active'
  );

-- 확인용 — 부여 결과 조회
select s.status, s.plan, s.started_at, s.expires_at, u.email
from public.subscriptions s
join auth.users u on u.id = s.user_id
where u.email = 'admin@sentif.ai';
