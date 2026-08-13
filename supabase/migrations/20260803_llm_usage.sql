-- LLM 토큰 사용 원장 (llm_usage)
--
-- 목적: 관리자가 사용자별·앱별·모델별 토큰 사용량을 한 곳에서 보고 요금제 기준을 잡는다.
--
-- 왜 app_runs 에 컬럼을 붙이지 않고 별도 테이블인가:
--   ① 기획서 생성(관리자 작업)은 앱 실행이 아니라 app_id 가 아예 없다.
--   ② 개인정보 파싱은 앱 실행 전에 여러 번 일어나 실행과 1:1 이 아니다.
--   ③ app_runs 는 앱 삭제 시 cascade 로 지워지는데, 과금 근거는 남아야 한다.
--
-- 쓰기 주체: 서버 라우트가 service_role 로만 INSERT (lib/llm-usage.ts).
--            사용자가 자기 토큰 수를 조작할 수 없어야 요금 산정이 성립한다.
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 통째로 실행.

create table if not exists public.llm_usage (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 누가 — 사용자가 탈퇴해도 과거 청구 근거가 남도록 이메일은 스냅샷으로 함께 보관
  user_id       uuid references auth.users(id) on delete set null,
  user_email    text,
  is_admin      boolean not null default false,   -- 호출 시점 기준 (서버에서 판정)

  -- 어디서 / 무엇을
  surface       text not null default 'app',      -- 'app'(사용자 앱) | 'builder'(관리자 빌더)
  operation     text not null,                    -- llm_summary | parse_document | generate_spec | spec_stage | spec_preview | parse_spec

  -- 어느 앱 — 앱이 삭제돼도 원장은 남아야 하므로 SET NULL + 이름 스냅샷
  app_id        uuid references public.apps(id) on delete set null,
  app_name      text,

  -- 얼마나
  model         text not null,                    -- 실제 사용된 모델 문자열
  prompt_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  total_tokens  integer not null default 0,

  duration_ms   integer,
  status        text not null default 'ok',       -- 'ok' | 'error'
  error_message text
);

-- 집계 축별 인덱스
create index if not exists llm_usage_created_at_idx on public.llm_usage (created_at desc);
create index if not exists llm_usage_user_idx       on public.llm_usage (user_id, created_at desc);
create index if not exists llm_usage_app_idx        on public.llm_usage (app_id, created_at desc);
create index if not exists llm_usage_model_idx      on public.llm_usage (model);
create index if not exists llm_usage_surface_idx    on public.llm_usage (surface, created_at desc);

-- RLS: 켜두고 정책을 하나도 두지 않는다.
--   → anon·authenticated 는 읽기·쓰기 모두 차단. service_role 만 RLS 를 우회해 접근한다.
--   → 관리자 화면도 클라이언트에서 직접 읽지 않고 서버 라우트(service_role)를 통해 집계한다.
alter table public.llm_usage enable row level security;

comment on table public.llm_usage is
  'LLM 호출 단위 토큰 원장. 서버(service_role)만 기록하며 요금제 산정 근거로 사용.';
