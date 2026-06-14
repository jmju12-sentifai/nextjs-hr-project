-- app_runs.app_id FK 에 ON DELETE CASCADE 추가
--
-- 문제:
-- 1) apps 를 삭제하면 app_runs 가 FK 로 묶여 있어 실패
-- 2) 클라이언트가 app_runs 를 먼저 지우려 해도 RLS DELETE 정책이 없어 차단됨 (silently 0행 삭제)
-- 3) 결과: "violates foreign key constraint app_runs_app_id_fkey"
--
-- 해결: apps 삭제 시 app_runs 가 자동 삭제되도록 FK 를 CASCADE 로 변경.
-- (RLS 정책과 무관하게 DB 레벨에서 자동 처리됨)
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

-- ① 기존 FK 제거
alter table public.app_runs
  drop constraint if exists app_runs_app_id_fkey;

-- ② CASCADE 옵션 포함하여 다시 추가
alter table public.app_runs
  add constraint app_runs_app_id_fkey
  foreign key (app_id)
  references public.apps(id)
  on delete cascade;
