# HR Coach MicroSaaS 앱 빌더 — Claude Code 실행 프롬프트

당신은 Next.js 풀스택 개발자입니다.
아래 설계 문서를 기반으로 HR Coach MicroSaaS 앱 빌더를 구현해주세요.

---

## 프로젝트 개요

인사 분석 앱을 양산할 수 있는 앱 빌더(반제품)를 구축합니다.
- 관리자: 빌더에서 5개 탭을 채워 인사 분석 앱을 생산
- 사용자: 생산된 앱에 문서를 업로드하여 분석 리포트를 수령

---

## 기술 스택

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: Supabase (PostgreSQL)
- AI: Google Gemini API
- 수식 계산: mathjs
- PDF 출력: @react-pdf/renderer
- DOCX 출력: docx
- 패키지 관리: npm workspace (monorepo)

---

## 디렉토리 구조

```
/
├── app/
│   ├── admin/
│   │   └── builder/
│   │       ├── page.tsx
│   │       └── components/
│   │           ├── Tab0Overview.tsx
│   │           ├── Tab1RegulationVars.tsx
│   │           ├── Tab2PersonalVars.tsx
│   │           ├── Tab3LogicEngine.tsx
│   │           ├── Tab4ReportBuilder.tsx
│   │           └── Tab5Preview.tsx
│   ├── apps/
│   │   └── [appId]/
│   │       └── page.tsx
│   └── api/
│       ├── parse-spec/route.ts
│       ├── parse-document/route.ts
│       ├── run-logic/route.ts
│       └── export/
│           ├── pdf/route.ts
│           └── docx/route.ts
├── packages/
│   └── app-renderer/
│       ├── index.ts
│       ├── LogicEngine.ts
│       ├── ReportRenderer.tsx
│       ├── blocks/
│       │   ├── BranchBlock.ts
│       │   ├── ClassificationBlock.ts
│       │   ├── RangeTableBlock.ts
│       │   ├── FormulaBlock.ts
│       │   ├── AdjustmentBlock.ts
│       │   └── DateBlock.ts
│       └── palettes/
│           ├── BasicInfo.tsx
│           ├── SummaryCard.tsx
│           ├── ComparisonTable.tsx
│           ├── IncludeExcludeTag.tsx
│           ├── RangeBarChart.tsx
│           ├── StepLineChart.tsx
│           ├── IncludeExcludeDonut.tsx
│           └── GuidanceText.tsx
└── lib/
    ├── supabase.ts
    └── ai-parser.ts
```

---

## Supabase 테이블 설계

아래 SQL을 Supabase에서 실행해서 테이블을 생성해주세요.

```sql
-- apps 테이블
create table apps (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  app_schema      jsonb not null default '{}',
  status          text not null default 'draft',  -- draft | published
  version         integer not null default 1,
  created_by      uuid references auth.users(id),
  published_at    timestamp,
  created_at      timestamp default now()
);

-- app_runs 테이블
create table app_runs (
  id               uuid primary key default gen_random_uuid(),
  app_id           uuid references apps(id),
  app_version      integer,
  input_data       jsonb not null default '{}',
  result           jsonb not null default '{}',
  status           text not null default 'pending',  -- pending | success | failed
  error_message    text,
  user_identifier  text,
  created_at       timestamp default now()
);
```

---

## app_schema JSONB 구조

apps.app_schema 컬럼에 저장되는 JSON 구조입니다.

```json
{
  "tab0": {
    "appName": "",
    "description": "",
    "purpose": "",
    "problem": "",
    "target": "",
    "security": "",
    "effects": [],
    "features": []
  },
  "tab1": {
    "variables": [
      { "name": "", "type": "text|number|date|ratio", "unit": "" }
    ]
  },
  "tab2": {
    "variables": [
      { "name": "", "type": "text|number|date|ratio", "unit": "", "required": true }
    ]
  },
  "tab3": {
    "conditions": [
      { "variable": "", "operator": ">=|<=|==|>|<", "value": 0 }
    ],
    "truePath": {
      "label": "적용대상",
      "blocks": []
    },
    "falsePath": {
      "label": "제외대상",
      "blocks": []
    }
  },
  "tab4": {
    "palette": [
      {
        "id": "",
        "order": 1,
        "type": "basic-info|summary-card|comparison|include-tag|bar-chart|step-line|donut|guidance",
        "config": {}
      }
    ]
  }
}
```

---

## 블록 6종 JSON 구조

tab3.truePath.blocks 배열에 들어가는 블록들입니다.
변수명은 관리자가 tab1·tab2에서 정의한 변수명을 그대로 사용합니다.
관리자가 불록을 설계할 때 만들어지고, 사용자가 분석을 실행할 때 소비됩니다.

```json
// Branch
{ "type": "Branch", "condition": "변수A >= 값", "trueBlocks": [], "falseBlocks": [] }

// Classification
{ "type": "Classification", "variable": "변수A", "groups": [{ "label": "그룹명", "condition": "..." }] }

// RangeTable
{ "type": "RangeTable", "variable": "변수A", "resultVar": "결과변수",
  "ranges": [{ "from": 0, "to": 10, "value": 0.1 }] }

// Formula
{ "type": "Formula", "expression": "변수A * (1 - 변수B)", "resultVar": "결과변수" }

// Adjustment
{ "type": "Adjustment", "target": "결과변수", "round": "원|없음", "max": null, "min": null }

// Date
{ "type": "Date", "operation": "age|add|diff", "input": "변수A", "resultVar": "결과변수" }
```

---

## 구현 요구사항

### 1. 렌더러 패키지 (packages/app-renderer)

**LogicEngine.ts**
tab3 JSON을 받아서 블록을 순서대로 실행하는 핵심 엔진
- tab3 JSON과 변수 객체를 받아서 블록을 순서대로 실행
- conditions 평가 후 truePath / falsePath 분기
- 각 블록 실행 결과를 vars에 누적
- 반환값: { isApplicable, label, vars }

**블록 6종 (blocks/)**
LogicEngine이 블록 타입보고 해당 블록의 excute() 호출
- 각 블록은 execute(block, vars) 함수 하나만 구현
- FormulaBlock은 mathjs의 evaluate() 사용
- DateBlock은 만 나이, 날짜 가감, 기간 계산 지원
- RangeTableBlock은 범위 내 값 조회 후 resultVar에 저장

**ReportRenderer.tsx**
tab4 팔레트 배열 + 로직 결과를 받아서 화면으로 조립하는 컴포넌트 
- tab4.palette 배열을 order 순으로 정렬 후 렌더링
- PALETTE_MAP으로 type → 컴포넌트 매핑
- 각 컴포넌트에 config와 data(로직 결과) 전달

**팔레트 8종 (palettes/)**
ReportRenderer가 조립하는 개별 UI 컴포넌트
- BasicInfo: 선택된 변수들을 그리드로 표시
- SummaryCard: 핵심 산출값 1개 강조 카드
- ComparisonTable: 기준값 vs 개인값 비교 테이블
- IncludeExcludeTag: 적용/제외 뱃지
- RangeBarChart: 구간별 막대 차트 (recharts)
- StepLineChart: 구간 계단선 차트 (recharts)
- IncludeExcludeDonut: 비율 도넛 차트 (recharts)
- GuidanceText: {{변수명}} 치환 텍스트

**index.ts**
- runLogicEngine, ReportRenderer export

---

### 2. 빌더 (app/admin/builder)

**page.tsx**
- 0~5탭 네비게이션
- 상단: AI 기획서 업로드 버튼
- 하단: 임시저장 / 저장(publish) 버튼
- 탭 전환 시 작성 데이터 유지
- Supabase apps 테이블에 저장

**Tab0Overview.tsx**
- 앱명, 설명, 목적, 문제, 대상사용자, 보안안내 입력 필드
- 기대효과, 핵심특징 태그 입력 (추가/삭제)

**Tab1RegulationVars.tsx / Tab2PersonalVars.tsx**
- 변수 목록 테이블
- 변수명 / 타입(드롭다운) / 단위(드롭다운) / 삭제 버튼
- 하단 인라인 행 추가
- Tab2는 필수여부 체크박스 추가

**Tab3LogicEngine.tsx**
- 판정부: 조건 행 추가 (변수명 / 연산자 / 값)
- 산출부: 블록 추가 버튼 (6종 선택 드롭다운)
- 블록 카드 목록 표시 (각 블록 타입별 입력 UI)
- 블록 순서 변경, 삭제

**Tab4ReportBuilder.tsx**
- 왼쪽: 팔레트 8종 목록
- 오른쪽: 캔버스 (추가된 팔레트 카드 목록)
- 팔레트 클릭 시 캔버스에 추가
- 각 카드 클릭 시 속성 편집 패널 표시
- 순서 변경, 삭제

**Tab5Preview.tsx**
- 테스트 변수 입력 폼
- runLogicEngine 실행
- ReportRenderer로 미리보기 표시

---

### 3. 완제품 앱 (app/apps/[appId])

**page.tsx**
- Supabase에서 appId로 app_schema 조회
- Step 1~5 상태 관리 (useState)
- sessionState: { step, regulationVars, personalVars, result }

**Step 1 — 앱 설명**
- tab0 메타 정보 표시
- 업로드할 문서 안내
- 시작하기 버튼

**Step 2 — 규정 문서 업로드**
- 파일 업로드 UI
- /api/parse-document 호출
- 파싱 결과 테이블 표시 (변수명 / 추출값 / 상태)
- 미파싱 항목 수기 입력 폼
- 다음 단계 버튼 (필수 항목 완료 시 활성화)

**Step 3 — 개인 문서 업로드**
- Step 2와 동일 구조
- tab2 슬롯 기준으로 파싱
- required: true 항목 누락 시 다음 버튼 비활성화

**Step 4 — 분석 실행**
- regulationVars + personalVars 합산
- /api/run-logic 호출
- 로딩 UI 표시
- 완료 시 app_runs INSERT

**Step 5 — 리포트 출력**
- ReportRenderer 렌더링
- PDF / DOCX / JSON 다운로드 버튼

---

### 4. API 라우트 (app/api)

**POST /api/parse-spec**
관리자가 빌더 상단에서 기획서 파일 업로드할 때 호출
```
요청: { fileBase64: string, mimeType: string }
처리: Gemini API로 기획서 파싱 → 5탭 JSON 추출
응답: { tab0, tab1, tab2, tab3, tab4 }
프롬프트: "아래 기획서를 읽고 반드시 JSON만 반환해. 다른 텍스트 없이.
구조: { tab0: {...}, tab1: { variables: [...] }, tab2: { variables: [...] },
tab3: { conditions: [...], truePath: {...}, falsePath: {...} },
tab4: { palette: [...] } }
기획서: [텍스트]"
```

**POST /api/parse-document**
사용자가 완제품앱 Step2, Step3에서 파일을 업로드할 때 호출 
```
요청: { fileBase64: string, mimeType: string, slots: Variable[] }
처리: Gemini API로 문서에서 슬롯 변수 추출
응답: { [변수명]: 추출값 | null }
프롬프트: "아래 문서에서 변수 목록의 값을 찾아 JSON으로만 반환해.
못 찾으면 null. 변수목록: [slots]
문서: [텍스트]"
```

**POST /api/run-logic**
```
요청: { tab3: Tab3Schema, vars: Variables }
처리: runLogicEngine 실행
응답: { isApplicable, label, vars }
```

**POST /api/export/pdf**
사용자가 Step 5 리포트 화면에서 PDF 다운로드 버튼 클릭 시 호출
```
요청: { tab4: Tab4Schema, result: LogicResult, tab0: Tab0Schema }
처리: @react-pdf/renderer로 PDF 생성
응답: PDF 파일 (application/pdf)
```

**POST /api/export/docx**
사용자가 Step 5 리포트 화면에서 DOCX 다운로드 버튼 클릭 시 호출
```
요청: { tab4: Tab4Schema, result: LogicResult, tab0: Tab0Schema }
처리: docx 라이브러리로 DOCX 생성
응답: DOCX 파일
```

---

### 5. lib/supabase.ts
- createClient로 Supabase 클라이언트 생성
- 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

### 6. lib/ai-parser.ts
- Gemini API 클라이언트 설정
- 환경변수: GEMINI_API_KEY
- parseAppSpec(fileText): 기획서 파싱
- parseDocument(fileText, slots): 문서 변수 추출
- 응답에서 JSON만 파싱 (마크다운 코드블록 제거 후 JSON.parse)

---

## 구현 순서

1. Supabase 테이블 생성 SQL 실행
2. packages/app-renderer 패키지 구현
   - LogicEngine.ts
   - 블록 6종
   - 팔레트 8종
   - ReportRenderer.tsx
3. lib/supabase.ts, lib/ai-parser.ts 구현
4. API 라우트 4개 구현
5. 빌더 탭 0~5 구현
6. 완제품 앱 Step 1~5 구현

---

## 주의사항

- 모든 파일 TypeScript로 작성
- 환경변수는 .env.local에서 읽기
- Supabase 클라이언트는 싱글톤으로 관리
- AI API 응답은 반드시 try-catch로 감싸고 JSON 파싱 실패 시 빈 구조 반환
- 렌더러 패키지는 순수 함수 위주로 작성 (사이드이펙트 최소화)
- tab3 블록 실행 시 변수 누락이면 에러 throw 대신 null 처리 후 계속 진행
