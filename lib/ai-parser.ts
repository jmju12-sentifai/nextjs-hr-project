import { GoogleGenerativeAI } from "@google/generative-ai";
interface Slot {
  name: string;
  type: string;
  unit?: string;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 누락");
  return new GoogleGenerativeAI(key);
}

function extractJson(text: string): any {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 첫 JSON 블록 추출 시도
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generate(prompt: string, fileBase64?: string, mimeType?: string) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });
  const parts: any[] = [{ text: prompt }];
  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { data: fileBase64, mimeType } });
  }
  const res = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  return res.response.text();
}

const EMPTY_V5 = {
  meta: {
    appName: "",
    tagline: "",
    purpose: "",
    problem: "",
    users: "",
    security: "",
    effects: [],
    features: [],
  },
  vars: [],
  shared: { steps: [] },
  paths: [],
  fallback: {
    id: "fallback",
    label: "미적용",
    conditions: [],
    steps: [],
    report: [],
  },
};

const APP_SPEC_PROMPT = `당신은 인사 분석 앱 빌더의 자동 설정 도우미입니다.
사용자가 업로드한 "앱 기획서"를 읽고, 다음 v5 다중 경로 스키마를 가능한 최대한 채워서
**오직 JSON만** 반환하세요. 마크다운/설명/코드블록 없이 순수 JSON.

# 출력 스키마

{
  "meta": {
    "appName": "앱 상단 타이틀 (예: '임금피크제 자동화 마이크로 SaaS 앱')",
    "tagline": "한 줄 요약 (1문장)",
    "purpose": "구축 목적 (2~3문장)",
    "problem": "해결하려는 문제 (1~2문장)",
    "users": "대상 사용자 (예: 'HR 운영팀 · 보상 담당자')",
    "security": "보안 안내 (예: '개인정보 보호 · 보안 암호화 · 클라우드 기반')",
    "effects": ["기대 효과 3~5개"],
    "features": ["핵심 특징 3~5개"]
  },
  "vars": [
    // grp='규정' : 규정 문서에서 뽑을 기준값/정책 상수
    // grp='개인' : 개인 1명 문서에서 뽑을 항목
    // type ∈ number|text|date
    // unit ∈ '' | 원 | 일 | 명 | % | 배 | 점 | 개 | 년 | 월 | 시간 | 건 | 회
    // req: 개인 변수에서 필수면 true
    { "id": "auto", "grp": "규정", "name": "변수명_공백없이", "type": "number", "unit": "년", "req": false, "test": "" }
  ],
  "shared": {
    // 모든 경로 진입 전 실행되는 공통 사전 계산
    // 예: 만나이, 출생월처럼 여러 경로가 공통으로 쓰는 산출
    "steps": [
      // step 형식은 아래 paths[].steps 와 동일
    ]
  },
  "paths": [
    // 적용 가능한 경로 후보. 위→아래 순서로 first-match.
    // 각 경로는 자기만의 conditions/steps/report 를 갖는다.
    {
      "id": "auto",
      "label": "예: 가산형 적용 (만 56~58)",
      "conditions": [
        // a/b 는 변수명(aMode/bMode 미지정 또는 'var') 또는 리터럴('val' 명시)
        // 변수 vs 변수: { "a": "만나이", "op": ">=", "b": "최초적용연령" }
        // 변수 vs 숫자: { "a": "만나이", "op": ">=", "b": "55", "bMode": "val" }
        // 변수 vs 문자: { "a": "직군",   "op": "==", "b": "사무직", "bMode": "val" }
        { "id": "auto", "a": "변수A", "op": "<=|>=|>|<|==|!=", "b": "변수B 또는 리터럴", "bMode": "var|val" }
      ],
      "steps": [
        // 6종 산출 블록 (아래 정의)
      ],
      "report": [
        // 8종 리포트 요소 (아래 정의)
      ]
    }
  ],
  "fallback": {
    // 어느 경로도 매칭 안 됐을 때 사용 (예: '미적용', '대상 외')
    "id": "fallback",
    "label": "미적용",
    "conditions": [],
    "steps": [],
    "report": []
  },
  "_step_blocks": [
    // 산출 블록. 단계는 위→아래 순서로 실행. step.name 은 이후 단계에서 변수처럼 참조 가능.
    // 6종 타입:
    // 1) date    — 두 날짜 차이(diff) 또는 연·월·일 추출(part)
    //    { "type": "date", "name": "만나이", "unit": "년", "mode": "diff", "a": "생년월일", "b": "오늘", "out": "year" }
    //    out ∈ year|month|day
    // 2) classify — 항목 집계 (sum/count/avg/max/min)
    //    { "type": "classify", "name": "통상임금", "unit": "원", "agg": "sum",
    //      "items": [{ "ref": "기본급", "inc": true }, { "ref": "수당", "inc": true }] }
    // 3) table   — 구간표: 입력 변수가 어느 구간에 속하는지 → v 반환
    //    { "type": "table", "name": "감액률", "unit": "%", "ref": "만나이",
    //      "bands": [{ "from": 56, "to": 57, "v": 0 }, { "from": 58, "to": 58, "v": 0.2 }] }
    //    (단위가 % 면 0.2 ↔ 20% 로 표시됨)
    // 4) formula — 토큰 기반 수식. 변수/숫자/연산자/괄호로 구성
    //    { "type": "formula", "name": "피크임금", "unit": "원",
    //      "tokens": [ {"t":"var","name":"통상임금"}, {"t":"op","op":"*"},
    //                  {"t":"lp"}, {"t":"num","v":1}, {"t":"op","op":"-"},
    //                  {"t":"var","name":"감액률"}, {"t":"rp"} ] }
    //    토큰 t ∈ var|num|op|lp|rp,  op ∈ +|-|*|/
    // 5) clamp   — 상·하한 보정
    //    { "type": "clamp", "name": "최종금액", "unit": "원", "ref": "피크임금",
    //      "min": "최저임금", "max": "" }   // 변수명 또는 '' (없음)
    // 6) branch  — 조건 분기 (참/거짓 → 텍스트 또는 계산식)
    //    { "type": "branch", "name": "적용시점", "unit": "",
    //      "ref": "출생월", "op": "<=", "rhs": 6,
    //      "then": "당해 7월 1일", "thenT": "text", "thenTok": [],
    //      "els":  "익년 1월 1일", "elsT":  "text", "elsTok":  [] }
    //    thenT/elsT ∈ text|calc.  calc 면 thenTok/elsTok 에 formula 와 같은 tokens.
  ],
  "_report_elements": [
    // 참고용 — 실제 출력에선 paths[].report 또는 fallback.report 안에 배치
    // 8 종 리포트 요소. 폭 w ∈ full|half|third, 높이 h ∈ 1|2|3
    // kind:
    //  - field   : 단순 텍스트 1행. bind=변수명
    //  - card    : 큰 숫자 카드. bind=변수명
    //  - compare : 판정부 비교표 (자동, bind 불필요)
    //  - calc    : 계산식 한 줄 + 결과. bind=formula step name
    //  - incexc  : 분류 단계 포함/제외 태그. bind=classify step name
    //  - chart   : ctype ∈ bar|step|donut.
    //              bar/step → table step name, donut → classify step name
    //  - note    : 안내문, tpl 에 '{변수명}' 치환 패턴
    { "id": "auto", "kind": "card", "label": "적용 여부", "bind": "적용여부", "w": "third", "h": 1 }
  ]
}

# 작성 지침

- **반드시 meta · vars · shared · paths · fallback 전부**를 가능한 최대한 채워라.
- 기획서가 단일 판정(예: 적용/제외)만 다루면 paths 1개 + fallback 으로 표현.
  복수 그룹(예: 가산형/표준형/제외)이 있으면 paths 를 여러 개 만들어라.
- 변수명은 공백/특수문자 없이 한글 또는 영문. (예: "만나이", "통상임금기준액")
- 공통적으로 쓰이는 산출(예: 만나이 계산)은 shared.steps 에 한 번만.
- 각 경로의 conditions 는 AND. 위 경로부터 first-match — 가장 좁은 조건을 먼저.
- 경로마다 자기만의 report 를 가져라 (안내 메시지는 경로마다 달라야 의미가 있음).
- **기획서에 체크박스(✓·☑·■·●·검은/파란 채워진 사각형 등)로 표시된 모든 팔레트 항목은
  누락 없이 각 경로의 report 에 포함하라.** 동일 데이터를 시각화하는 chart(bar/step/donut)나
  유사 요소가 함께 체크돼 있어도 자체 판단으로 합치지 말고 모두 별도 요소로 추가하라.
  예: '구간 계단선'과 '포함/제외 도넛'이 둘 다 체크돼 있으면 chart.step 1개 + chart.donut 1개
  두 요소를 만들어라.
- 기획서가 임금피크제·정년·퇴직금·승진 자격 등 인사 판정 주제면 그 도메인 변수/로직을 구성.
- 정보 부족 시 합리적 기본값으로 채우되, 추측 불가능한 부분은 빈 문자열/빈 배열.

# 다중 경로 예시 (참고)

paths = [
  { label: "가산형 적용 (만 56~58)", conditions: [만나이>=56, 만나이<=58], steps:[...], report:[...] },
  { label: "표준형 적용 (만 59~정년)", conditions: [만나이>=59, 만나이<=정년], steps:[...], report:[...] }
]
fallback = { label: "임금피크제 미적용", conditions: [], steps: [], report: [...] }

# 출력
순수 JSON 1개. 다른 텍스트 금지.`;

function withIds(schema: any) {
  const uid = () =>
    Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
  const stamp = (arr: any[]): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((x) =>
      x && typeof x === "object" && (!x.id || x.id === "auto")
        ? { ...x, id: uid() }
        : x
    );
  };
  const stampPath = (p: any) =>
    p && typeof p === "object"
      ? {
          ...p,
          id: !p.id || p.id === "auto" ? uid() : p.id,
          conditions: stamp(p.conditions || []),
          steps: stamp(p.steps || []),
          report: stamp(p.report || []),
        }
      : p;
  return {
    ...EMPTY_V5,
    ...schema,
    meta: { ...EMPTY_V5.meta, ...(schema.meta || {}) },
    vars: stamp(schema.vars),
    shared: {
      steps: stamp(schema.shared?.steps || []),
    },
    paths: (schema.paths || []).map(stampPath),
    fallback: schema.fallback
      ? stampPath(schema.fallback)
      : EMPTY_V5.fallback,
  };
}

export async function parseAppSpec(fileBase64: string, mimeType: string) {
  try {
    const text = await generate(APP_SPEC_PROMPT, fileBase64, mimeType);
    const parsed = extractJson(text);
    if (!parsed) return EMPTY_V5;
    return withIds(parsed);
  } catch (e) {
    console.error("parseAppSpec error:", e);
    return EMPTY_V5;
  }
}

export async function parseDocument(
  fileBase64: string,
  mimeType: string,
  slots: Slot[]
): Promise<Record<string, any>> {
  if (!slots || slots.length === 0) return {};
  const slotsDesc = slots
    .map((s) => `- ${s.name} (${s.type}${s.unit ? ", " + s.unit : ""})`)
    .join("\n");
  const prompt = `아래 문서에서 다음 변수 목록의 값을 찾아 JSON으로만 반환해.
값을 못 찾으면 null. 마크다운/코드블록 없이 JSON만.

변수목록:
${slotsDesc}

응답 형식 예시:
{ "변수명1": 값, "변수명2": null }`;
  try {
    const text = await generate(prompt, fileBase64, mimeType);
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== "object") {
      return Object.fromEntries(slots.map((s) => [s.name, null]));
    }
    // 누락된 슬롯은 null로 채움
    const out: Record<string, any> = {};
    for (const s of slots) {
      out[s.name] = parsed[s.name] ?? null;
    }
    return out;
  } catch (e) {
    console.error("parseDocument error:", e);
    return Object.fromEntries(slots.map((s) => [s.name, null]));
  }
}
