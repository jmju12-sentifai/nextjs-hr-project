# 참고 문서 분석 (Spec Analysis) 로직 구조

빌더의 **"참고 문서 분석"** — 사용자가 올린 규정·신청서·인사정보 등 참고 문서를 읽어
빌더 5탭(앱 개요 / 규정 변수 / 개인 변수 / 분석 로직 / 리포트 구성)을 채우는 프리뷰를 생성한다.

## 설계 목표

1. **타임아웃 없음** — Vercel Hobby 60초 캡(요청당)에 안 걸려야 함.
2. **품질 유지** — 변수 추출·경로 커버리지·매칭 정확.
3. **컨텍스트 일관성** — 탭 간 변수명·참조가 어긋나지 않아야 함.

핵심 아이디어: **한 요청에 다 넣지 않고, 작업을 여러 HTTP 요청으로 쪼갠다.**
Vercel 60초 캡은 *요청 1건당* 적용되므로, 각 단계가 60초 안이면 총합이 길어도(예: 68초) 타임아웃이 없다.

## 전체 흐름

```
[빌더: 참고 문서 분석 모달] "분석" 클릭 → generateSpec()
        │  파일 준비(prepFile) + 4MB 용량 가드
        ▼
  클라이언트가 /api/spec-stage 를 6번 "순차" 호출
  (각 요청 = 별도 서버리스 함수 = 각자 60초 캡)
        │
   0. digest   POST {stage:"digest", files}                     → {digest}
        │  digest(문서 정리본)를 이후 모든 단계에 전달 = 공유 컨텍스트
   1. meta     POST {stage:"meta",   digest}                     → {meta}
   2. varsReg  POST {stage:"varsReg",digest, meta}               → {vars: 규정[]}
   3. varsPer  POST {stage:"varsPer",digest, meta}               → {vars: 개인[]}
        │  vars = [...규정, ...개인]  (잠금 — 이후 단계는 이 name 만 참조)
   4. paths    POST {stage:"paths",  digest, meta, vars}         → {paths, fallback}
   5. report   POST {stage:"report", digest, meta, vars, paths}  → {report, rationale}
        │
        ▼
  단계마다 setSpecPreview 로 누적 → 탭 프리뷰가 채워지고 진행칩이 ✓ 됨
```

## 단계별 상세

| # | stage | 입력(컨텍스트) | 하는 일 | 출력 | 실측(로컬) |
|---|---|---|---|---|---|
| 0 | `digest` | **파일(PDF 등)** | Gemini **비전**으로 문서를 정확히 읽어 깔끔한 텍스트 정리본 생성 | `digest`(텍스트) | ~12초 |
| 1 | `meta` | digest | 앱 개요(이름·목적·대상·처리흐름 4단계) | `meta` | ~6초 |
| 2 | `varsReg` | digest + meta | **규정 변수**만 (정책값·기준액·비율·연령·한도·기한) | `vars[grp=규정]` | ~7초 |
| 3 | `varsPer` | digest + meta | **개인 변수**만 (성명·사번·생년월일·금액·분류 등) | `vars[grp=개인]` | ~12초 |
| 4 | `paths` | digest + **확정 vars** | 분기축 분류값마다 경로 + 진입조건 + 산출 step | `paths`, `fallback` | ~18초 |
| 5 | `report` | digest + vars + **확정 paths** | 경로별 리포트 요소 + 설계 근거 | `report`, `rationale` | ~13초 |

> 가장 느린 단계 **18초** → 60초 캡 대비 40초 이상 마진. 총합 ~68초지만 6개 요청으로 분산.

## 핵심 설계 포인트

### 1) 타임아웃 회피 — 요청 분할
- [`app/api/spec-stage/route.ts`](../app/api/spec-stage/route.ts) : `maxDuration = 60`, `stage` 파라미터로 디스패치.
- 한 작업을 6개 요청으로 분리 → 어느 요청도 60초를 넘지 않음.

### 2) 컨텍스트·일관성 — digest + 확정 결과 잠금 주입
- **digest**(문서 정리본)를 모든 단계가 공유 → 같은 원천 참조.
- 각 단계가 이전 단계의 **확정 결과를 프롬프트에 잠가서** 받음:
  - `paths`/`report` 는 `varListText()`로 전달된 **확정 vars의 name만 참조**, 새 변수 발명 금지
    (단, step 의 산출 결과 이름(step.name)은 신규 허용).
- 결과: 탭 간 변수명 어긋남 0 (검증 시 `undefinedRefs: []`).

### 3) 빌더 탭과 1:1 매핑
- 진행칩 라벨 = 빌더 탭과 동일: **⓪ 앱 개요 / ① 규정 변수 / ② 개인 변수 / ③ 분석 로직 / ④ 리포트 구성**
  + 사전 단계 **문서 읽기(digest)**.
- 변수를 규정/개인 두 단계로 나눈 이유: (a) 탭과 1:1, (b) 단계가 작아져 타임아웃 여유↑.

### 4) 진행 표시 (UI)
```
✓ 문서 읽기 완료  ✓ ⓪ 앱 개요 완료  ✓ ① 규정 변수 완료  ⏳ ② 개인 변수 진행중…
○ ③ 분석 로직  ○ ④ 리포트 구성        ⏱ 총 68.2초
```
- 완료 = 초록 ✓, 진행중 = 보라 ⏳(깜빡임), 대기 = 회색 ○.
- 실패 시 어느 단계에서 막혔는지 표시 (예: `[① 규정 변수 단계] ...`).

## 코드 위치

| 역할 | 위치 |
|---|---|
| 단계 엔드포인트 | [`app/api/spec-stage/route.ts`](../app/api/spec-stage/route.ts) |
| 단계 디스패처 `runSpecStage` | [`lib/ai-parser.ts`](../lib/ai-parser.ts) |
| 단계 함수 `generateDigest` / `generateSpecMeta` / `generateSpecVars(grp)` / `generateSpecPaths` / `generateSpecReport` | [`lib/ai-parser.ts`](../lib/ai-parser.ts) |
| 공유 규칙 프롬프트 `SPEC_PREVIEW_PROMPT` / 문서정리 `DIGEST_PROMPT` | [`lib/ai-parser.ts`](../lib/ai-parser.ts) |
| 클라이언트 오케스트레이션 + 진행칩 `generateSpec` / `SPEC_STAGES` | [`app/admin/builder/page.tsx`](../app/admin/builder/page.tsx) |

## 분석 이후 (별개 단계)
- 6단계가 끝나면 `specPreview` 에 완성 구조(meta·vars·paths·fallback·report·rationale)가 모임.
- **"이 구성으로 빌더 자동 채우기"** → `/api/preview-to-schema`(LLM 호출 없이 즉시 변환) → 빌더 5탭 반영.

## 모델·설정

- 모델: `gemini-3.5-flash` (`.env.local` 의 `GEMINI_MODEL`), thinking off (`thinkingBudget: 0`).
- `digest` 는 마크다운 텍스트 출력, 나머지 단계는 `responseMimeType: "application/json"` 강제.
- 입력 용량: 파일을 보내는 `digest` 요청만 4MB 가드 대상. 이후 단계는 digest 텍스트만 전송(가벼움).

## 참고 — 구버전(레거시) 경로
- 단일 호출 `/api/spec-preview` + `generateAppSpecPreview`(단계형 플래그 `SPEC_PREVIEW_STAGED`)는 **그대로 남아있음**.
  현재 빌더 UI 는 위의 단계별(`/api/spec-stage`) 흐름을 사용한다.

## 성능·품질 측정 요약 (3장, gemini-3.5-flash)

| 항목 | 값 |
|---|---|
| 단계별 최대 시간 | 18.1초 (< 60초) |
| 총 소요 | ~68초 (6개 요청 분산) |
| 변수 | 32개 (규정 11 + 개인 21) |
| 경로 커버리지 | 4/4 (사망·결혼·출산·입학) |
| 일관성 | `undefinedRefs: []` (0 오류) |
