# HR Coach MicroSaaS 앱 빌더

인사 분석 앱을 양산할 수 있는 앱 빌더 (Next.js 14 + Supabase + Gemini).

## 설치 / 실행

```bash
npm install
cp .env.local.example .env.local   # 키 채우기
npm run dev
```

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

## Supabase 테이블

[supabase/schema.sql](supabase/schema.sql) 의 SQL을 Supabase SQL Editor에서 실행.

## 주요 경로

- `/` — 진입
- `/admin/builder` — 0~5탭 빌더
- `/apps/[appId]` — 발행된 앱 (Step 1~5)

## 구조

```
app/                  Next.js App Router
  admin/builder/      6탭 빌더 UI
  apps/[appId]/       완제품 사용자 앱
  api/                parse-spec | parse-document | run-logic | export/pdf | export/docx
packages/app-renderer/  LogicEngine + 블록 6종 + 팔레트 8종 + ReportRenderer
lib/                  supabase, ai-parser (Gemini)
```

## 빌더 → 완제품 흐름

1. 빌더에서 6탭 채우기 (또는 AI 기획서 업로드)
2. "발행 (Publish)" 클릭 → Supabase apps 테이블 저장
3. `/apps/[appId]` 에 사용자 접속
4. 규정/개인 문서 업로드 → Gemini 추출 → 로직 실행 → 리포트
