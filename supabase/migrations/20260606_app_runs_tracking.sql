-- app_runs 사용 추적 활성화 — 옵션 A (메타데이터만)
--
-- 변경 의도:
-- 1. user_id 컬럼 추가 (auth.users FK) — 본인 행 식별 가능
-- 2. RLS 활성화 + 본인 행만 SELECT/INSERT 정책
-- 3. 개인정보(input_data) 는 비워두고 메타데이터만 기록
--    → /apps/[id] 의 f4(산출 및 안내) 탭 첫 진입 시 1행 INSERT
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

-- ① user_id 컬럼 추가 (옵셔널 — auth.users 삭제 시 자동 정리)
alter table public.app_runs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists app_runs_user_id_idx on public.app_runs (user_id);
create index if not exists app_runs_app_id_idx on public.app_runs (app_id);
create index if not exists app_runs_created_at_idx on public.app_runs (created_at desc);

-- ② RLS 활성화 + 정책
alter table public.app_runs enable row level security;

-- 기존 정책이 있으면 정리
drop policy if exists "anon all runs" on public.app_runs;
drop policy if exists "users insert own runs" on public.app_runs;
drop policy if exists "users read own runs" on public.app_runs;

-- 본인 행만 INSERT
create policy "users insert own runs"
  on public.app_runs for insert
  with check (auth.uid() = user_id);

-- 본인 행만 SELECT
create policy "users read own runs"
  on public.app_runs for select
  using (auth.uid() = user_id);

-- ③ 누적 방지용 옵션 인덱스 — 같은 사용자 × 같은 앱 × 5분 이내 중복 차단을 SQL로 보완하려면 별도 트리거 필요.
-- (지금은 클라이언트에서 세션 플래그로 중복 방지)
