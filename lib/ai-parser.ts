import { GoogleGenerativeAI } from "@google/generative-ai";
import { APP_SPEC_TEMPLATE_MD } from "@/lib/spec-template";
interface Slot {
  name: string;
  type: string;
  unit?: string;
  desc?: string; // 변수 설명 — 파싱 정확도를 높이기 위한 맥락
  options?: string[]; // type="select" — 허용값 목록. 파싱 결과는 반드시 이 안에서만.
}

// 기본 모델 — 환경변수(GEMINI_MODEL) 없으면 gemini-3.5-flash 사용 (빠르고 파싱 정확).
//   다른 모델로 바꾸려면 GEMINI_MODEL 환경변수로 오버라이드.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// thinking(추론)을 끄면 생성 시간이 크게 줄어 서버리스 타임아웃을 피한다. 필요하면 env 로 예산(토큰) 재설정 가능.
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
const THINKING_CFG = { thinkingConfig: { thinkingBudget: THINKING_BUDGET } };

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 누락");
  return new GoogleGenerativeAI(key);
}

// 잘린 JSON 을 가능한 만큼 복구해서 파싱 시도
// Gemini 가 maxOutputTokens 에 걸려 닫는 괄호 없이 끊긴 응답을 받았을 때 사용.
function repairTruncatedJson(s: string): string {
  // 마지막 의미있는 위치까지 잘라낸 후 부족한 닫는 괄호 보충
  let str = s;
  // 1) 마지막 쉼표/콜론/여는괄호 뒤에 매달려 있는 부분 정리
  //    - 따옴표가 짝이 안 맞는 경우: 가장 마지막 따옴표 위치 이전까지만 사용
  // 따옴표 개수가 홀수면 마지막 따옴표 자르기
  let qCount = 0;
  let lastQuoteIdx = -1;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { qCount++; lastQuoteIdx = i; }
  }
  if (qCount % 2 === 1 && lastQuoteIdx >= 0) {
    // 닫히지 않은 마지막 문자열 — 그 따옴표 직전까지만
    str = str.slice(0, lastQuoteIdx);
  }
  // 2) 끝에 매달린 쉼표/콜론/공백 제거
  str = str.replace(/[\s,:]+$/g, "");
  // 끝이 객체 키만 있고 값이 없는 경우 제거 (예: ..., "key": )
  str = str.replace(/,\s*"[^"]*"\s*$/g, "");
  // 3) { 와 [ 의 미닫힘 개수를 세서 끝에 닫는 괄호 추가
  let braces = 0, brackets = 0;
  let inStr = false;
  escaped = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === "[") brackets++;
    else if (c === "]") brackets--;
  }
  while (brackets-- > 0) str += "]";
  while (braces-- > 0) str += "}";
  return str;
}

function extractJson(text: string): any {
  if (!text) return null;
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .replace(/```/g, "")
    .trim();
  // 1차: 그대로 시도
  try {
    return JSON.parse(cleaned);
  } catch {
    // pass
  }
  // 2차: 첫 JSON 블록 추출
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // pass
    }
  }
  // 3차: truncate 복구 시도 (출력 토큰 한도에 걸린 케이스)
  const start = cleaned.indexOf("{");
  if (start >= 0) {
    try {
      return JSON.parse(repairTruncatedJson(cleaned.slice(start)));
    } catch {
      // pass
    }
  }
  return null;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

// DOCX 는 Gemini inlineData 가 지원하지 않으므로 서버에서 텍스트로 미리 추출
async function extractDocxText(fileBase64: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(fileBase64, "base64");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

// XLSX/XLS — 시트별 표 데이터를 텍스트로 직렬화 (TSV-like + 시트명 헤더 포함)
async function extractXlsxText(fileBase64: string): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(fileBase64, "base64");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!rows.length) continue;
    const tsv = rows
      .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")).join("\t") : String(r)))
      .join("\n");
    parts.push(`=== 시트: ${name} ===\n${tsv}`);
  }
  return parts.join("\n\n");
}

async function generate(
  prompt: string,
  fileBase64?: string,
  mimeType?: string,
  opts?: { jsonOnly?: boolean }
): Promise<{ text: string; finishReason?: string }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      // JSON 출력 강제 — 파싱 실패 방지
      ...(opts?.jsonOnly ? { responseMimeType: "application/json" } : {}),
      // 큰 스키마도 잘리지 않도록 토큰 한도 최대치 (Gemini 2.5 Flash 65,536)
      maxOutputTokens: 65536,
      temperature: 0.2,
      ...THINKING_CFG, // thinking off — 서버리스 타임아웃 방지
    } as any,
  });
  const parts: any[] = [{ text: prompt }];

  if (fileBase64 && mimeType) {
    if (mimeType === DOCX_MIME) {
      // DOCX: 서버에서 텍스트 추출 후 프롬프트에 포함 (inlineData 사용 안 함)
      const text = await extractDocxText(fileBase64);
      if (!text.trim()) {
        throw new Error("DOCX 파일에서 텍스트를 추출하지 못했습니다");
      }
      parts.push({ text: `\n\n[첨부 문서 내용 (DOCX)]\n${text}` });
    } else if (mimeType === XLSX_MIME || mimeType === XLS_MIME) {
      // XLSX/XLS: 시트별 표 데이터를 TSV 텍스트로 직렬화 (Gemini inlineData 미지원)
      const text = await extractXlsxText(fileBase64);
      if (!text.trim()) {
        throw new Error("Excel 파일에서 데이터를 추출하지 못했습니다");
      }
      parts.push({ text: `\n\n[첨부 문서 내용 (Excel — 시트별 표)]\n${text}` });
    } else {
      parts.push({ inlineData: { data: fileBase64, mimeType } });
    }
  }

  const res = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const candidate = res.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  return { text: res.response.text() || "", finishReason };
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
    flow: ["", "", "", ""],
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
    "features": ["핵심 특징 3~5개"],
    "flow": [
      // 처리 흐름 4단계 — **정확히 4개 문자열**의 배열. 모든 인사 자동화 앱은 다음 표준 4단계 패턴을 따른다:
      //   1) 기준 지식화        — 규정·기준 파일을 읽고 정책 상수를 정의
      //   2) 개인 정보 파싱     — 임직원 1인의 데이터를 추출
      //   3) 적용 여부 판단·분석 — 조건에 따라 분기하여 산출
      //   4) 산출 및 안내       — 최종 결과·안내자료 생성
      //
      // 도메인에 맞게 위 4단계의 표현을 살짝 도메인화하라 (순서·개수는 절대 바꾸지 말 것).
      // 예시 (임금피크제):
      //   ["임금피크제 운영 세칙·기준 파일 지식화",
      //    "임직원 인사·급여 데이터 파싱 및 정합성 확인",
      //    "적용 여부·운영모델(가산/표준)·감액률 판단",
      //    "최종 월기준액 산출 및 개인별 안내자료 생성"]
      // 예시 (복리후생 경조사):
      //   ["경조 지원 기준파일 지식화",
      //    "신청서·증빙자료 파싱",
      //    "지원 자격·관계·금액 적정성 판단",
      //    "지원금액 산출 및 개인별 안내자료 생성"]
      // 예시 (성과급 지급):
      //   ["성과급 산정 기준·등급별 배율 지식화",
      //    "임직원 평가 결과·인사 데이터 파싱",
      //    "등급·조건별 산정 방식 판단",
      //    "성과급 산출 및 개인별 명세서 생성"]
      // 예시 (휴가 자격 판정):
      //   ["휴가 규정·근속 기준 지식화",
      //    "임직원 근태·근속 데이터 파싱",
      //    "유급 휴가 일수·자격 판단",
      //    "사용 가능 일수 산출 및 안내"]
      // ⚠ 위는 예시 4개 — 실제 도메인은 다양 (교육비/보상/징계/승진/평가/근태 등 모든 인사 도메인 가능).
      //   업로드된 문서의 실제 도메인에 맞게 4단계 작성. 경조 도메인만 떠올리지 말 것.
      //
      // 기획서에 "처리 흐름 4단계", "흐름", "프로세스" 등 명시 항목이 있으면 우선 사용하되,
      // 그것 역시 위 표준 4단계 구조에 맞춰 1~4번 순으로 정렬해서 채워라.
      // 명시 항목이 없으면 표준 4단계를 도메인에 맞춰 변형해 채워라 (절대 빈 배열 금지).
      "[1단계 — 기준 지식화의 도메인 표현]",
      "[2단계 — 개인 정보 파싱의 도메인 표현]",
      "[3단계 — 적용 여부 판단의 도메인 표현]",
      "[4단계 — 산출 및 안내의 도메인 표현]"
    ]
  },
  "vars": [
    // grp='규정' : 회사 규정·취업규칙·정책 기준값·정책 상수 (사용자가 입력하는 게 아니라 회사가 정한 값)
    //              예: 사망조위금기준액, 결혼축의금기준액, 최대지원한도, 신청가능기한, 근속가산기준년수,
    //                  근속가산율, 최초적용연령, 정년, 최저임금월액, 감액률(고정), 기준일, 운영모델 등
    //              💡 규칙: "회사가 정한 모든 정책 값·기준값·한도·률·연령·일수·등급 기준" → 규정
    //              💡 **지원금/지급액/축의금/조위금/위로금/포상금/장려금/감액률** 등 회사가 정한 금액·비율은
    //                 이름 앞에 "본인", "배우자", "자녀", "직계존속" 같은 분류 접두어가 있어도 **모두 규정**.
    //                 예: "본인결혼지원금", "자녀학자금지원금", "배우자장례조위금", "직계존속경조금" → 모두 규정
    //                 (사용자가 입력하는 게 아니라 회사 규정에 정해진 표준 지급액이기 때문)
    // grp='개인' : 임직원 1명의 인사/급여/신청 정보 (사용자가 입력·업로드하는 항목)
    //              예: 성명, 사번, 부서, 직급, 입사일, 생년월일, 기본급, 직책수당, 신청금액,
    //                  경조분류, 대상자관계, 발생일, 신청일 등
    //              💡 규칙: "임직원 한 명마다 다른 값, 입력·업로드로 채워지는 값" → 개인
    //              💡 헷갈리는 케이스 — 결정 기준: 회사 규정 문서에 숫자가 적혀 있나, 임직원이 채워야 하나?
    //                 • "본인결혼지원금" (회사가 정한 금액 100만원 등) → 규정
    //                 • "신청금액"        (임직원이 사용한 실제 금액)   → 개인
    //                 • "대상자관계"      (임직원이 고른 본인/배우자/자녀) → 개인
    // ⚠️ 절대 모든 변수를 한쪽 grp 로 몰지 말 것. 기획서에는 보통 규정·개인 변수가 모두 있다.
    //    규정 변수가 안 보이면 다시 한 번 기획서를 읽어 회사 정책 값을 찾아라.
    // type ∈ number|text|date|select
    //   • select = **기획서가 허용값 목록을 명시한 변수만** ("값: A/B/C" 표기 또는 후보가 열거된 경우).
    //     "options" 배열에 명시된 후보를 그대로 나열하고 test 는 그중 하나로. **후보 발명 금지**.
    //     select 의 desc 끝에 "값: A/B/C" 표기를 포함. 여러 건 입력하는 목록 항목(경력내역·보유자격 등)은 select 금지 — text.
    //     예: { "name": "급여체계유형", "type": "select", "options": ["밴드","호봉","표준액","미운영"], ... }
    // unit ∈ '' | 원 | 일 | 명 | % | 배 | 점 | 개 | 년 | 월 | 시간 | 건 | 회 (select 는 unit 빈값)
    // req: 개인 변수에서 필수면 true
    // desc: 사용자에게 보여줄 한 줄 설명 (기획서의 '설명' 컬럼 내용을 간결히) — 가능한 채워라
    //
    // 🆕 test 필드 (예시 테스트값) — 빌더 미리보기에서 사용. **반드시 채워라**.
    //   • 규정 변수: 기획서에 명시된 정책 값을 그대로 (예: "1000000", "60", "2026-07-01", "혼합형")
    //   • 개인 변수: 도메인에 맞는 사실적인 예시 1건 — 활성 경로가 발동하도록 일관된 케이스로 채워라.
    //     - text (성명) → "홍길동" / 사번 → 8자리 숫자 / 부서·직급 → 그 도메인에 흔한 단어
    //     - number(원) → 회사 평균 수준의 정수 (단위 표시 없이 숫자만, 예: "5500000")
    //     - number(년/일/점) → 도메인 맥락에 맞는 정수
    //     - date → "YYYY-MM-DD" 형식, 조건에 매칭되는 케이스 (예: 임금피크제 적용 연령에 들어가는 생년월일)
    //   • 미리보기에서 path 가 활성화되어 산식 결과가 나오도록 ‘서로 일관된’ 값들로 채울 것.
    //   • 모르겠으면 합리적 기본값 (예: 평가점수 75, 연차 15 등).
    //   • ⚠ **반드시 첫 번째 적용 경로(paths[0]) 의 모든 진입조건을 만족하는 값** 으로 채워라 — fallback(미적용) 으로 빠지지 않도록.
    //     예: paths[0].conditions = ["경조이벤트유형 == \"결혼\"", "대상자관계 == \"본인\""] 이면
    //         "경조이벤트유형" 의 test = "결혼", "대상자관계" 의 test = "본인" 으로 설정.
    //     숫자 조건도 마찬가지 — "만나이 >= 56" 이면 "만나이" 또는 "생년월일" test 가 만 56세 이상이 되도록.
    { "id": "auto", "grp": "규정", "name": "변수명_공백없이", "type": "number", "unit": "년", "req": false, "test": "예시값", "desc": "한 줄 설명" },
    { "id": "auto", "grp": "규정", "name": "급여체계유형", "type": "select", "options": ["밴드", "호봉", "표준액", "미운영"], "unit": "", "req": false, "test": "밴드", "desc": "기본급 산정 방식(분기축)" }
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
    // 4) formula — 토큰 기반 수식. 변수/숫자/연산자/괄호/함수로 구성
    //    { "type": "formula", "name": "피크임금", "unit": "원",
    //      "tokens": [ {"t":"var","name":"통상임금"}, {"t":"op","op":"*"},
    //                  {"t":"lp"}, {"t":"num","v":1}, {"t":"op","op":"-"},
    //                  {"t":"var","name":"감액률"}, {"t":"rp"} ] }
    //    토큰 t ∈ var|num|op|fn|lp|rp,  op ∈ +|-|*|/|%|//  (% 나머지, // 몫=내림나눗셈)
    //    fn ∈ floor|ceil|round (단항 함수, 반드시 lp 가 뒤따름: fn lp ... rp)
    //    예) floor((근속연수-1)/가산연차주기):
    //      [ {"t":"fn","fn":"floor"}, {"t":"lp"}, {"t":"lp"}, {"t":"var","name":"근속연수"},
    //        {"t":"op","op":"-"}, {"t":"num","v":1}, {"t":"rp"}, {"t":"op","op":"/"},
    //        {"t":"var","name":"가산연차주기"}, {"t":"rp"} ]
    //    ⚠ floor/ceil/round 외 함수 금지. 상·하한은 clamp, 합계는 classify, 조건은 branch/switch.
    // 5) clamp   — 상·하한 보정
    //    { "type": "clamp", "name": "최종금액", "unit": "원", "ref": "피크임금",
    //      "min": "최저임금", "max": "" }   // 변수명 또는 '' (없음)
    // 6) branch  — 조건 분기 (참/거짓 → 텍스트 또는 계산식)
    //    { "type": "branch", "name": "적용시점", "unit": "",
    //      "ref": "출생월", "op": "<=", "rhs": 6,
    //      "then": "당해 7월 1일", "thenT": "text", "thenTok": [],
    //      "els":  "익년 1월 1일", "elsT":  "text", "elsTok":  [] }
    //    thenT/elsT ∈ text|calc.  calc 면 thenTok/elsTok 에 formula 와 같은 tokens.
    //    ⚠ then·els 는 **반드시 실제 출력 값**으로 채울 것:
    //      - thenT="text" → then 에 표시할 문자열(예: "당해 7월 1일", "지급", "1.5") — 변수 이름 자체 금지
    //      - thenT="calc" → thenTok 에 토큰 (예: [{t:"var",name:"기본급"},{t:"op",v:"*"},{t:"num",v:0.5}])
    //    ❌ 금지 패턴: then="신청금액", thenT="text" — 이건 리터럴 문자열 "신청금액" 으로 노출됨.
    //       변수 값을 그대로 쓰려면 thenT="calc" + thenTok=[{t:"var",name:"신청금액"}] 형식 필수.
    //    ❌ 양쪽 다 placeholder("참"/"거짓") 만이면 분기 자체를 만들지 말 것. 실제 값이 한 쪽이라도 없으면 차라리 분기 생략.
    //    ⚠ 숫자 출력이 필요한 분기 — thenT/elsT 는 반드시 "calc" + 토큰 사용. text 모드에 "80000" 같은 숫자 문자열 넣지 말 것.
    //      이걸 어기면 후속 formula 가 이 branch 결과를 더하려다 "숫자 아님" 으로 터짐.
    //      ❌ 잘못된 예: { thenT:"text", then:"80000", elsT:"text", els:"0" }
    //      ✅ 올바른 예: { thenT:"calc", thenTok:[{t:"num",v:80000}], elsT:"calc", elsTok:[{t:"num",v:0}] }
    //    💡 직급별 회비 같은 N분기 케이스 — 굳이 분기 step 여러 개로 쪼개지 말고 **table(구간표) 한 개** 또는
    //      **paths 분기 (직급별 path)** 또는 **아래 switch step** 으로 표현하는 게 깔끔.
    // 6.5) switch — N-way 문자열/숫자 분기 (한 변수의 값에 따라 케이스별 출력)
    //    💡 cases 의 outputVar 는 **number 변수든 text 변수든 모두 가능**.
    //       text 변수 (예: "결혼화환제공여부_본인" 값 "예") 도 case 의 outputVar 로 사용 가능 — 그 값이 그대로 출력.
    //       formula 같은 산식이 아니라 "분류값에 해당하는 변수값" 을 그대로 가져오는 용도이므로 type 무관.
    //    {
    //      "type": "switch", "name": "결혼축의금", "unit": "원",
    //      "ref": "결혼분류",
    //      "cases": [
    //        { "match": "본인",     "t": "calc", "tokens": [{t:"var",name:"본인결혼축의금"}] },
    //        { "match": "자녀",     "t": "calc", "tokens": [{t:"var",name:"자녀결혼축의금"}] },
    //        { "match": "형제자매", "t": "calc", "tokens": [{t:"var",name:"형제자매결혼축의금"}] }
    //      ],
    //      "defaultT": "calc", "defaultTokens": [{t:"num",v:0}], "defaultText": ""
    //    }
    //    💡 **분류 변수 + 분류별 정책값** 패턴은 항상 switch 로. 경로 안에서 한 번에 표현됨.
    //    💡 cases 의 match 는 분류 변수의 값(예: "본인" "자녀" "형제자매"). 빠짐없이 나열.
    //    💡 t="calc" 가 기본 — 분류별 다른 금액 산출에 사용. 토큰에 해당 분류의 규정 변수를 var 로 넣음.
    //    ⚠ defaultT/defaultTokens 는 매칭 없을 때 출력 (보통 0 또는 안내문).
    //    ⚠ cases 가 0개면 빌더가 step 자체를 삭제. 케이스 명시적으로 1개 이상.
    // 7) llm     — LLM(Gemini) 호출로 자연어 요약 텍스트 생성. **마지막 단계 1개만, 안내문 용도**.
    //    ⚠ name 은 반드시 "LLM 분석" 으로. "LLM 요약" / "요약" 금지.
    //    { "type": "llm", "name": "LLM 분석", "unit": "",
    //      "items": ["만나이", "감액률", "최종월기준액"],  // 요약에 넣을 변수·산출 결과 이름들
    //      "prompt": "",   // 빈 문자열 권장(기본 프롬프트 사용). 필요 시 커스텀.
    //      "lastResult": "", "lastAt": "" }
    //    LLM 은 산식 계산이 끝난 결과들을 자연어로 풀어주는 안내문 생성에만 사용.
    //    ❌ 절대 금지: 금액 계산·구간 분류·날짜 차이·조건 분기를 LLM 에게 떠넘기지 말 것.
    //       이것들은 모두 결정론적 산식(formula/classify/table/date/branch/clamp)으로 명시.
    //    예시: "사망조위금 = 기준액 × 관계가산율" 같은 식은 formula 로 정의, 결과를 LLM items 에 넣어 안내만 위임.
  ],
  "_report_elements": [
    // 참고용 — 실제 출력에선 paths[].report 또는 fallback.report 안에 배치
    //
    // ── 사이즈 매핑 (매우 중요) ──
    // 리포트 캔버스는 6열 그리드. 각 요소는 wSpan(가로 1~6) · hSpan(세로 1~6) 으로 정의.
    // 호환을 위해 w(full|half|third) · h(1|2|3) 도 함께 채울 것.
    //   wSpan=1     w="third"  (1/6 폭, 좁은 카드)
    //   wSpan=2     w="third"  (1/3 폭, 작은 카드 — 일반적 텍스트 카드)
    //   wSpan=3     w="half"   (1/2 폭, 중간 카드 — 일반적 차트)
    //   wSpan=4     w="half"   (2/3 폭)
    //   wSpan=5     w="full"   (5/6 폭)
    //   wSpan=6     w="full"   (전체 폭)
    // 기획서에 "2x2", "3x2", "6x2" 같은 WxH 표기가 명시된 경우에만 그 값을 wSpan x hSpan 으로 매핑하라.
    //   "2x2" → wSpan=2, hSpan=2, w="third", h=2
    //   "3x2" → wSpan=3, hSpan=2, w="half",  h=2
    //   "6x2" → wSpan=6, hSpan=2, w="full",  h=2
    // ⚠ 기획서에 사이즈가 명시되지 **않은** 요소는 wSpan/hSpan/w/h 필드를 아예 빼고 출력하라.
    //   서버가 kind 에 따라 자동으로 기본값을 채워 넣는다. 추측해서 값 넣지 말 것.
    // ⚠ 다음 kind 들은 사이즈가 항상 기본값으로 강제됨 (기획서에 명시돼도 무시):
    //    - field(단일 기본정보) : wSpan=2, hSpan=2
    //    - fields(기본정보 묶음): wSpan=6, hSpan=1
    //    - pathlabel(경로 라벨) : wSpan=6, hSpan=1
    //   → 위 3종은 사이즈 필드를 항상 빼라.
    // 표기가 없을 때 적용되는 기본값(참고용):
    //   field  (단일 기본정보) : w="third", h=2, wSpan=2, hSpan=2  (작은 카드)
    //   fields (기본정보 묶음) : w="full",  h=1, wSpan=6, hSpan=1  (전체폭 한 줄)
    //   pathlabel              : w="full",  h=1, wSpan=6, hSpan=1
    //   card                   : w="third", h=2, wSpan=2, hSpan=2
    //   chart                  : w="half", h=2, wSpan=3, hSpan=2  (차트는 최소 3 폭 권장)
    //   compare/calc           : w="full", h=2, wSpan=6, hSpan=2
    //   incexc                 : w="half", h=2, wSpan=3, hSpan=2
    //   note                   : w="full", h=2, wSpan=6, hSpan=2
    //
    // ── kind ──
    //  - field     : 단순 텍스트 1행. bind=변수명
    //  - fields    : 여러 변수를 한 카드에 묶음. binds=["성명","사번",...] (배열). label=""
    //                기획서에 "기본정보 묶음", "성명/사번/소속/직급" 같이 변수 여러 개가 슬래시·콤마로
    //                같이 나오면 무조건 fields 한 개로 만들어라. field 여러 개로 쪼개지 말 것.
    //  - pathlabel : 현재 활성 경로 라벨 표시 (자동, bind/binds 불필요). label="경로"
    //  - card      : 큰 숫자 카드. bind=변수명
    //  - compare   : 판정부 비교표 (자동, bind 불필요)
    //  - calc      : 계산식 한 줄 + 결과. bind=formula step name
    //  - incexc    : 분류 단계 포함/제외 태그. bind=classify step name
    //  - chart     : ctype ∈ bar|step|donut|gauge|ratio|bullet|stacked|comparison|delta
    //                bar/step → table step name, donut/stacked → classify step name
    //                gauge → clamp 또는 그냥 변수, ratio/bullet/comparison/delta → bind + bind2(비교 대상)
    //  - note      : 안내문, tpl 에 '{변수명}' 치환 패턴. LLM 요약 결과를 표시하려면 tpl="{LLM분석}" 처럼.
    { "id": "auto", "kind": "card", "label": "적용 여부", "bind": "적용여부", "w": "third", "h": 2, "wSpan": 2, "hSpan": 2 },
    { "id": "auto", "kind": "fields", "label": "", "binds": ["성명","사번","소속","직급"], "w": "full", "h": 1, "wSpan": 6, "hSpan": 1 },
    { "id": "auto", "kind": "chart", "ctype": "gauge", "label": "평가점수", "bind": "평가점수", "w": "half", "h": 2, "wSpan": 3, "hSpan": 2 }
  ]
}

# 작성 지침

- **반드시 meta · vars · shared · paths · fallback 전부**를 가능한 최대한 채워라.
- 기획서가 단일 판정(예: 적용/제외)만 다루면 paths 1개 + fallback 으로 표현.
  복수 그룹(예: 가산형/표준형/제외)이 있으면 paths 를 여러 개 만들어라.
- 변수명은 공백/특수문자 없이 한글 또는 영문. **분류가 있으면 "상위_하위_세부" 순** (예: \`결혼_본인_회사지원금\`).
- **OCR/오타 교정 (매우 중요)** — 기획서가 스캔본·이미지·자동 변환이라 명백한 오타·띄어쓰기 깨짐이 있으면 자연스러운 한국어로 교정해서 사용하라:
  • "상망일" → "사망일" (OCR 오인식)
  • "생 일 기 념" → "생일기념" (글자가 모두 떨어진 OCR)
  • "출산축 하금" → "출산축하금" (어색한 띄어쓰기)
  • "통상 임금 기준액" → "통상임금기준액" (단일 명사 단위로 붙임)
  • 명백히 의미가 통하는 표준 인사 용어로 정규화: '근속년수', '평가점수', '기본급' 등
  교정이 모호하면 원형 유지. 단순히 글자를 빼지는 말 것.
- **변수명 일관성 (매우 중요)** — paths[].conditions·steps·report 의 모든 변수/단계 참조는
  반드시 vars[].name 또는 shared.steps[].name / paths[].steps[].name 에 **정의된 이름과 글자 그대로** 일치해야 한다.
  - ❌ 절대 금지: "규정_최초적용연령", "개인_생년월일", "var_만나이" 같이 prefix·접두사를 붙이지 말 것.
    grp 정보(규정/개인)는 vars 의 grp 필드로만 표시하고, 이름 자체에는 포함하지 않는다.
  - ❌ 금지: "최초적용연령(년)", "기본급 (원)" 같이 단위·괄호를 이름에 붙이지 말 것 — 단위는 unit 필드로만.
  - ✅ 정의: { name: "최초적용연령", grp: "규정", unit: "년" }
  - ✅ 참조: { a: "만나이", op: ">=", b: "최초적용연령" }  (b 는 vars 의 name 과 동일)
  - ✅ 산출 token 참조: { t: "var", name: "통상임금기준액" }  (vars 또는 앞선 step name)
  - 정의되지 않은 변수를 참조하면 빌더에서 "미정의" 에러가 난다. 반드시 vars/shared/paths.steps 에 먼저 정의 후 참조.
- 공통적으로 쓰이는 산출(예: 만나이 계산)은 shared.steps 에 한 번만.
- **산식 우선 원칙 (매우 중요)** — 기획서에 계산 로직이 명시·암시되면 반드시 결정론적 산식(formula/classify/table/date/branch/clamp)으로 구현:
  • 금액·비율 계산이 보이면 → formula 단계 (예: "기준액 × 관계가산율" → tokens 로 표현)
  • 항목 합산이 보이면 → classify(sum)
  • 연령·근속·경과일 차이 → date(diff)
  • 구간별 차등 비율 → table(bands)
  • 조건 분기 (A 면 X / 아니면 Y) → branch
  • 상·하한 보정 → clamp
  LLM 은 **위 산식이 모두 끝난 후 결과들을 자연어로 설명하는 안내문 1개**만 만들 것.
  ❌ "감액률 산출은 LLM 으로" 같이 산식을 LLM 에 떠넘기지 말 것.
  ✅ formula tokens 안의 모든 var 참조는 정의된 변수/단계 이름과 정확히 일치해야 한다.
  ✅ formula 결과는 number — 텍스트 변수와 곱·나누기 금지. 필요하면 branch 로 텍스트 → 숫자 매핑 후 사용.
- **계산식(formula) "숫자 아님" 방지 (필수)** — formula 의 tokens 안 var 참조는 **반드시 type='number' 인 변수만**.
  • ❌ 금지: text/date 타입 변수 (예: 성명, 사번, 부서, 생년월일, 입사일, 사유, 관계, 시기, 품목명, 안내문구)를 곱셈/덧셈/나눗셈에 끌어다 쓰지 말 것.
  • ❌ 금지: 텍스트성 이름(끝이 명/사유/시기/관계/품목/구분/유형 등)을 산식 변수로 쓰지 말 것.
  • ❌ 금지: 이전 LLM 단계 결과(텍스트)를 formula 토큰으로 쓰지 말 것.
  • ❌ 금지: 양쪽 다 text 모드인 branch 결과를 formula 토큰으로 쓰지 말 것.
  • ✅ 날짜 차이가 필요하면 → date(diff) 단계로 먼저 숫자(년/월/일)로 만들고, 그 단계의 name 을 formula 가 참조.
  • ✅ 텍스트→숫자 매핑이 필요하면 → branch(thenT="calc"/elsT="calc")로 숫자 분기 후 그 결과를 formula 가 참조.
  이걸 어기면 빌더가 산식 자체를 자동 삭제하므로, 결과 누락 없이 만들려면 위 원칙을 반드시 지킬 것.
- **리포트 note(안내문) 절대 빈 값 금지** — note 의 tpl 은 반드시 의미 있는 텍스트로 채워라.
  • 경로에 LLM 요약 단계가 있으면: tpl="{LLM분석}" (해당 단계 name 으로 치환)
  • 없으면: 핵심 변수를 조합한 친절한 안내 문장 (예: "{성명} 님의 {경조분류} 지원금은 {최종지원금} 입니다.")
  • **{변수명} 치환은 반드시 vars 또는 steps name 에 정의된 이름만 사용.**
  • ❌ 금지: {appName}, {앱명}, {meta.X} 같이 vars 에 없는 placeholder — 이건 치환 안 되고 그대로 노출됨.
    앱 이름을 넣고 싶으면 tpl 안에 **그대로 텍스트로** 쓸 것 (예: "복리후생 적용 대상이 아닙니다").
- **Fallback (미적용) 경로 — LLM 단계 절대 금지** — fallback.steps 에는 type='llm' 단계를 넣지 말 것.
  fallback 은 산출 없이 안내문만 표시하는 경로. note.tpl 은 변수 치환 없는 정적 안내문으로 작성.
  예: "현재 본 앱의 적용 대상이 아닙니다. 지원 범위와 자격 조건을 확인해 주세요."
- 각 경로의 conditions 는 AND. 위 경로부터 first-match — 가장 좁은 조건을 먼저.
- 경로마다 자기만의 report 를 가져라 (안내 메시지는 경로마다 달라야 의미가 있음).
- **리포트 배치 순서 (필수)** — 각 경로의 report 배열은 다음 순서를 항상 지켜라:
  1) fields (기본정보 묶음 — 성명/사번 등) — 있다면 항상 0번 인덱스
  2) note (안내문 / LLM 요약 카드 등) — fields 다음 인덱스. fields 가 없으면 0번 인덱스.
  3) card, chart, compare, calc, incexc 등 나머지 요소 — 기획서 순서대로
  → 안내문(note)이 윗부분에 있어야 사용자가 결과를 한눈에 받아볼 수 있음. 절대 맨 아래로 보내지 말 것.
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

// OCR 깨짐 복구: "생 일 기 념" → "생일기념"
// 단일 한글 문자가 3개 이상 공백으로 분리된 패턴만 머지 (정상 단어 "임금 피크제" 등은 그대로 둠)
function fixHangulSpacing(s: any): any {
  if (typeof s !== "string") return s;
  let out = s;
  // 단일 한글 + 공백 + 단일 한글 + 공백 + 단일 한글... (3개 이상 연속)
  out = out.replace(/(?:[가-힣]\s+){2,}[가-힣]/g, (m) => m.replace(/\s+/g, ""));
  // 양쪽 공백 정리
  return out.trim();
}

// formula 에서 허용하는 단항 함수 — runtime 엔진(evalRpn)이 지원하는 것과 일치해야 한다.
const FN_NAMES = new Set(["floor", "ceil", "round"]);

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
  // 리포트 배치 순서 정렬 — fields → note → 나머지
  // (AI 프롬프트 지침과 같이 적용. AI가 어겨도 서버에서 강제)
  const reorderReport = (report: any[]) => {
    const fields = report.filter((e) => e?.kind === "fields");
    const notes = report.filter((e) => e?.kind === "note");
    const others = report.filter(
      (e) => e?.kind !== "fields" && e?.kind !== "note"
    );
    return [...fields, ...notes, ...others];
  };
  // kind 별 기본 사이즈 — 기획서에 명시되지 않은 경우 적용
  const KIND_DEFAULT_SIZE: Record<string, { w: string; h: number; wSpan: number; hSpan: number }> = {
    // 단일 기본정보(field): 작은 카드 — 2×2
    field:     { w: "third", h: 2, wSpan: 2, hSpan: 2 },
    // 기본정보 묶음(fields): 여러 변수 한 줄 — 전체폭 1행 6×1
    fields:    { w: "full",  h: 1, wSpan: 6, hSpan: 1 },
    pathlabel: { w: "full",  h: 1, wSpan: 6, hSpan: 1 },
    card:      { w: "third", h: 2, wSpan: 2, hSpan: 2 },
    chart:     { w: "half",  h: 2, wSpan: 3, hSpan: 2 },
    compare:   { w: "full",  h: 2, wSpan: 6, hSpan: 2 },
    calc:      { w: "full",  h: 2, wSpan: 6, hSpan: 2 },
    incexc:    { w: "half",  h: 2, wSpan: 3, hSpan: 2 },
    note:      { w: "full",  h: 2, wSpan: 6, hSpan: 2 },
  };
  const VALID_W = new Set(["full", "half", "third"]);
  const VALID_H = new Set([1, 2, 3, 4, 5, 6]);
  const VALID_SPAN = (n: any) => Number.isFinite(n) && n >= 1 && n <= 6;
  // "기본정보" 묶음(fields)·경로 라벨(pathlabel) 은 무조건 기본 사이즈 강제
  // — 가로 1행 전체폭(wSpan=6, hSpan=1)이 의미상 항상 맞기 때문.
  //   AI 가 잘못된 사이즈를 넣어도 사용자 빌더에서 직접 바꿔야 하는 번거로움을 막음.
  const FORCE_DEFAULT_KINDS = new Set(["field", "fields", "pathlabel"]);
  // 리포트 요소에 사이즈 기본값 적용 — AI 가 명시한 유효 값만 살리고 나머지는 kind 기본값
  const applyReportSizeDefaults = (report: any[]): any[] =>
    report.map((e) => {
      if (!e || typeof e !== "object" || !e.kind) return e;
      const def = KIND_DEFAULT_SIZE[e.kind] || KIND_DEFAULT_SIZE.note;
      const out: any = { ...e };
      // fields / pathlabel — AI 가 무슨 사이즈를 줬건 무조건 기본값으로 덮어쓰기
      if (FORCE_DEFAULT_KINDS.has(e.kind)) {
        out.wSpan = def.wSpan;
        out.hSpan = def.hSpan;
        out.w = def.w;
        out.h = def.h;
        return out;
      }
      // 그 외 — 유효한 명시값이면 그대로, 아니면 기본값으로 대체
      if (!VALID_SPAN(out.wSpan)) out.wSpan = def.wSpan;
      if (!VALID_SPAN(out.hSpan)) out.hSpan = def.hSpan;
      if (!VALID_W.has(out.w)) out.w = def.w;
      if (!VALID_H.has(Number(out.h))) out.h = def.h;
      return out;
    });
  const stampPath = (p: any) =>
    p && typeof p === "object"
      ? {
          ...p,
          id: !p.id || p.id === "auto" ? uid() : p.id,
          conditions: stamp(p.conditions || []),
          steps: stamp(p.steps || []),
          report: reorderReport(applyReportSizeDefaults(stamp(p.report || []))),
        }
      : p;
  // OCR 깨짐 자동 복구 — 모든 string 필드 (변수명, 라벨, 단계 이름 등)
  const fixSchemaSpacing = (obj: any): void => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === "string") obj[i] = fixHangulSpacing(obj[i]);
        else if (typeof obj[i] === "object") fixSchemaSpacing(obj[i]);
      }
      return;
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        obj[k] = fixHangulSpacing(v);
      } else if (typeof v === "object") {
        fixSchemaSpacing(v);
      }
    }
  };
  fixSchemaSpacing(schema);

  // 변수명 prefix 정리 — AI 가 "규정_X", "개인_X", "var_X" 등을 붙여도 X 가 정의돼 있으면 X 로 치환
  // (없는 변수 참조로 빌더에 "미정의" 에러가 뜨는 것 방지)
  const definedNames = new Set<string>();
  for (const v of schema.vars || []) if (v?.name) definedNames.add(v.name);
  for (const s of schema.shared?.steps || []) if (s?.name) definedNames.add(s.name);
  for (const p of schema.paths || [])
    for (const s of p.steps || []) if (s?.name) definedNames.add(s.name);
  const PREFIX_PATTERNS = [/^규정_/, /^개인_/, /^공통_/, /^var_/, /^변수_/];
  const stripPrefix = (name: any): any => {
    if (typeof name !== "string") return name;
    for (const re of PREFIX_PATTERNS) {
      if (re.test(name)) {
        const stripped = name.replace(re, "");
        if (definedNames.has(stripped)) return stripped;
      }
    }
    return name;
  };
  const cleanConditions = (conds: any[] = []) =>
    conds.map((c) => {
      if (!c || typeof c !== "object") return c;
      const out: any = { ...c, a: stripPrefix(c.a), b: stripPrefix(c.b) };
      // bMode/aMode 자동 추정 — 숫자/따옴표 리터럴인데 mode 가 'val' 이 아니면 보정
      const looksLiteral = (v: any): boolean => {
        if (typeof v !== "string") return false;
        const t = v.trim();
        if (/^-?\d+(\.\d+)?$/.test(t)) return true;
        if (t.startsWith('"') || t.startsWith("'")) return true;
        return false;
      };
      if (looksLiteral(out.a) && out.aMode !== "val") out.aMode = "val";
      if (looksLiteral(out.b) && out.bMode !== "val") out.bMode = "val";
      return out;
    });
  const cleanSteps = (steps: any[] = []) =>
    steps.map((s) => {
      if (!s || typeof s !== "object") return s;
      const out: any = { ...s };
      // 단계 타입별 참조 필드 정리
      if (s.a !== undefined) out.a = stripPrefix(s.a);
      if (s.b !== undefined) out.b = stripPrefix(s.b);
      if (s.ref !== undefined) out.ref = stripPrefix(s.ref);
      if (typeof s.min === "string") out.min = stripPrefix(s.min);
      if (typeof s.max === "string") out.max = stripPrefix(s.max);
      // classify items
      if (Array.isArray(s.items) && s.type === "classify") {
        out.items = s.items.map((it: any) =>
          it && typeof it === "object" ? { ...it, ref: stripPrefix(it.ref) } : it
        );
      }
      // llm items (변수명 배열)
      if (Array.isArray(s.items) && s.type === "llm") {
        out.items = s.items.map((nm: any) => stripPrefix(nm));
      }
      // formula tokens
      if (Array.isArray(s.tokens)) {
        out.tokens = s.tokens.map((tok: any) =>
          tok && tok.t === "var" ? { ...tok, name: stripPrefix(tok.name) } : tok
        );
      }
      return out;
    });
  const cleanReport = (report: any[] = []) =>
    report.map((e) => {
      if (!e || typeof e !== "object") return e;
      const out: any = { ...e };
      if (e.bind !== undefined) out.bind = stripPrefix(e.bind);
      if (e.bind2 !== undefined) out.bind2 = stripPrefix(e.bind2);
      if (Array.isArray(e.binds)) out.binds = e.binds.map(stripPrefix);
      return out;
    });

  // ── 빈 bind 자동 보강 + 보강 실패 시 element 제거 ──
  // AI 가 card/calc/incexc/chart/field 의 bind 를 비워둔 경우, label 과 의미적으로 일치하는
  // 변수/step 이름을 찾아 자동 연결. 못 찾으면 빈 카드는 사용자에게 "-" 만 보이므로 통째로 제거.
  const fixEmptyBinds = (report: any[] = []): any[] => {
    if (!Array.isArray(report) || report.length === 0) return report;
    const needsBind = new Set(["card", "calc", "incexc", "chart", "field"]);
    return report.filter((e) => {
      if (!e || typeof e !== "object") return false;
      if (!needsBind.has(e.kind)) return true; // bind 불필요 (fields/note/compare/pathlabel)
      const bind = typeof e.bind === "string" ? e.bind.trim() : "";
      if (bind && definedNames.has(bind)) return true; // 이미 유효한 bind
      // 자동 보강 시도 — label 과 일치하거나 포함하는 step/var 이름 찾기
      const label = typeof e.label === "string" ? e.label.trim() : "";
      if (!label) return false; // label 도 없으면 의미 없는 element — 제거
      const labelNorm = label.replace(/[\s_·\-./]/g, "").toLowerCase();
      const candidate = [...definedNames].find((n) => {
        const nn = n.replace(/[\s_·\-./]/g, "").toLowerCase();
        return nn === labelNorm || nn.includes(labelNorm) || labelNorm.includes(nn);
      });
      if (candidate) {
        e.bind = candidate;
        return true;
      }
      return false; // 보강 실패 — 통째로 제거 (사용자에게 "-" 만 보이는 빈 카드 차단)
    });
  };
  // cleanReport + fixEmptyBinds 묶음으로 적용
  const processReport = (r: any[] = []) => fixEmptyBinds(cleanReport(r));
  if (Array.isArray(schema.shared?.steps)) {
    schema.shared.steps = cleanSteps(schema.shared.steps);
  }
  if (Array.isArray(schema.paths)) {
    schema.paths = schema.paths.map((p: any) => ({
      ...p,
      conditions: cleanConditions(p.conditions),
      steps: cleanSteps(p.steps),
      report: processReport(p.report),
    }));
  }
  if (schema.fallback) {
    schema.fallback = {
      ...schema.fallback,
      conditions: cleanConditions(schema.fallback.conditions),
      steps: cleanSteps(schema.fallback.steps),
      report: processReport(schema.fallback.report),
    };
  }

  // ── 미지원 함수식 제거 — 엔진엔 FORMAT_DATE/CURRENT_DATE/IF 같은 스프레드시트·SQL 함수가 없음 ──
  //   이런 식이 변수 값·분기/스위치 출력에 들어오면 화면에 "FORMAT_DATE(...)" 가 그대로 떠서 무의미 → 빈값으로.
  //   (날짜는 date step(diff/part) 으로만, 고정 표시는 일반 텍스트 라벨로 — 프롬프트에서도 금지)
  const FUNC_EXPR_RE = /\b(FORMAT_?DATE|DATE_?FORMAT|DATEADD|DATEDIFF?|EDATE|DATE|YEAR|MONTH|DAY|TODAY|NOW|CURRENT_?DATE|CURDATE|SYSDATE|CONCAT|TEXTJOIN|TEXT|IFS?|SWITCH|VLOOKUP|XLOOKUP|ROUND)\s*\(/i;
  const DATE_KW_RE = /\b(CURRENT_?DATE|TODAY|NOW|SYSDATE|CURDATE)\b/i;
  const isFuncExpr = (s: any) => typeof s === "string" && (FUNC_EXPR_RE.test(s) || DATE_KW_RE.test(s));
  if (Array.isArray(schema.vars)) {
    for (const v of schema.vars) if (v && isFuncExpr(v.test)) v.test = "";
  }
  const sanitizeStepText = (s: any) => {
    if (!s) return;
    if (s.type === "branch") {
      if (s.thenT !== "calc" && isFuncExpr(s.then)) s.then = "";
      if (s.elsT !== "calc" && isFuncExpr(s.els)) s.els = "";
    } else if (s.type === "switch") {
      for (const c of s.cases || []) if (c && c.t !== "calc" && isFuncExpr(c.text)) c.text = "";
      if (s.defaultT !== "calc" && isFuncExpr(s.defaultText)) s.defaultText = "";
    }
  };
  for (const s of schema.shared?.steps || []) sanitizeStepText(s);
  for (const p of schema.paths || []) for (const s of p.steps || []) sanitizeStepText(s);
  for (const s of schema.fallback?.steps || []) sanitizeStepText(s);

  // ── "미정의 변수" 자동 정의 — 참조됐지만 정의 안 된 이름을 vars 에 자동 추가 ──
  // (prefix 정리 후 단계라서 이 시점에 빠진 이름은 진짜 undefined)
  const RESERVED = new Set(["오늘", "적용여부"]);
  const isNumericLiteral = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());
  const isQuotedLiteral = (s: string) =>
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"));

  // 정의된 이름 집합 재계산 (prefix 정리 후 변경됐을 수 있음)
  const allDefined = new Set<string>();
  for (const v of schema.vars || []) if (v?.name) allDefined.add(v.name);
  for (const s of schema.shared?.steps || []) if (s?.name) allDefined.add(s.name);
  for (const p of schema.paths || [])
    for (const s of p.steps || []) if (s?.name) allDefined.add(s.name);
  for (const s of schema.fallback?.steps || [])
    if (s?.name) allDefined.add(s.name);

  // 새로 정의할 변수: name → { suggestedType, suggestedUnit }
  type TypeHint = { type: "number" | "text" | "date"; unit?: string };
  const undefRefs = new Map<string, TypeHint>();

  const addUndef = (name: any, hint: TypeHint = { type: "number" }) => {
    if (typeof name !== "string") return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (RESERVED.has(trimmed)) return;
    if (isNumericLiteral(trimmed)) return; // 숫자 리터럴
    if (isQuotedLiteral(trimmed)) return; // 텍스트 리터럴
    // 깨진 수식 조각(따옴표·%·연산자·괄호·콤마 포함, 또는 따옴표만)은 변수로 만들지 않음 — "세 구간"·"A,B" 같은 쓰레기 변수 방지
    if (/["'“”‘’%()*/+,]/.test(trimmed)) return;
    if (allDefined.has(trimmed)) return; // 이미 정의됨
    // 이미 발견된 ref면 더 구체적인 타입 힌트가 들어왔을 때만 갱신
    const prev = undefRefs.get(trimmed);
    if (!prev || (prev.type === "number" && hint.type !== "number")) {
      undefRefs.set(trimmed, hint);
    }
  };

  // conditions 스캔 — bMode='val' 또는 aMode='val' 이면 리터럴, 변수 아님
  const scanConditions = (conds: any[] = []) => {
    for (const c of conds) {
      if (!c || typeof c !== "object") continue;
      if (c.aMode !== "val") addUndef(c.a);
      if (c.bMode !== "val") addUndef(c.b);
    }
  };

  // step 스캔
  const scanSteps = (steps: any[] = []) => {
    for (const s of steps) {
      if (!s || typeof s !== "object") continue;
      if (s.type === "date") {
        if (typeof s.a === "string") addUndef(s.a, { type: "date" });
        if (typeof s.b === "string") addUndef(s.b, { type: "date" });
      } else if (s.type === "classify") {
        if (Array.isArray(s.items))
          for (const it of s.items)
            if (it?.ref) addUndef(it.ref, { type: "number" });
      } else if (s.type === "table") {
        if (typeof s.ref === "string") addUndef(s.ref, { type: "number" });
      } else if (s.type === "formula") {
        if (Array.isArray(s.tokens))
          for (const tok of s.tokens)
            if (tok?.t === "var" && tok.name)
              addUndef(tok.name, { type: "number" });
      } else if (s.type === "clamp") {
        if (typeof s.ref === "string") addUndef(s.ref, { type: "number" });
        if (typeof s.min === "string") addUndef(s.min, { type: "number" });
        if (typeof s.max === "string") addUndef(s.max, { type: "number" });
      } else if (s.type === "branch") {
        if (typeof s.ref === "string") addUndef(s.ref);
      } else if (s.type === "llm") {
        if (Array.isArray(s.items))
          for (const nm of s.items) addUndef(nm);
      }
    }
  };

  scanConditions(schema.shared?.conditions);
  scanSteps(schema.shared?.steps);
  for (const p of schema.paths || []) {
    scanConditions(p.conditions);
    scanSteps(p.steps);
  }
  if (schema.fallback) {
    scanConditions(schema.fallback.conditions);
    scanSteps(schema.fallback.steps);
  }

  // 미정의 ref를 vars 에 자동 추가 (기본 grp='개인')
  if (undefRefs.size > 0) {
    if (!Array.isArray(schema.vars)) schema.vars = [];
    for (const [name, hint] of undefRefs) {
      schema.vars.push({
        id: "auto",
        grp: "개인",
        name,
        type: hint.type,
        unit: hint.unit || (hint.type === "number" ? "원" : ""),
        req: false,
        test: "",
      });
    }
  }

  // ── 분석 로직 무결성 검사·복구 ──
  // 산출 블록·진입 조건·공통 사전 계산이 빌더에서 정상 작동하도록 자동 수리.

  const numberPromote = new Set<string>(); // 산식에 쓰인 변수 — 반드시 number 타입이어야 함

  // 텍스트성 변수 — 이름 끝/포함이 명백히 문자열인 것들. 산식·구간표·classify·clamp 의 ref/var 로 들어오면 안 됨.
  const TEXT_HINTS: RegExp[] = [
    /품목$/, /품목명$/, /물품$/, /물품명$/, /상품$/, /상품명$/,
    /사유$/, /내용$/, /비고$/, /메모$/, /설명$/, /안내$/, /안내문$/, /문구$/,
    /명$/, /^이름$/, /^성명$/, /^부서$/, /^직급$/, /^사번$/,
    /관계$/, /구분$/, /유형$/, /종류$/, /상태$/, /등급$/,
    /시기$/, /시점$/, /일정$/, /발주시기$/,
    /주소$/, /연락처$/, /전화/, /이메일/,
    /URL$/i, /링크$/,
    // boolean/yes-no 류 — 문자열로 처리 ("예"/"아니오"/"Y"/"N")
    /여부($|_)/, /유무($|_)/, /가능여부$/, /제공여부($|_)/, /지급여부($|_)/,
    /적용여부($|_)/, /허용여부($|_)/, /확인($|_)/, /동의($|_)/,
  ];
  const looksLikeText = (name: string): boolean => {
    if (!name || typeof name !== "string") return false;
    // 등급은 등급기준/등급률 등은 숫자성 — 이름이 정확히 "등급"이거나 끝나기만 할 때만
    return TEXT_HINTS.some((re) => re.test(name));
  };

  // formula tokens 복구
  // promote=false 이면 var 토큰을 numberPromote 에 추가하지 않음 (switch case 처럼 텍스트도 허용되는 곳에서 사용).
  const repairFormulaTokens = (tokens: any[], promote: boolean = true): any[] => {
    if (!Array.isArray(tokens)) return [];
    // 1) 유효 토큰만 남김
    const valid: any[] = [];
    for (const t of tokens) {
      if (!t || typeof t !== "object") continue;
      if (t.t === "var" && typeof t.name === "string" && t.name.trim()) {
        valid.push({ t: "var", name: t.name.trim() });
        if (promote) numberPromote.add(t.name.trim());
      } else if (t.t === "num" && (typeof t.v === "number" || /^-?\d+(\.\d+)?$/.test(String(t.v)))) {
        valid.push({ t: "num", v: Number(t.v) });
      } else if (t.t === "op" && ["+", "-", "*", "/", "%", "//"].includes(t.op)) {
        valid.push({ t: "op", op: t.op });
      } else if (t.t === "fn" && FN_NAMES.has(t.fn)) {
        valid.push({ t: "fn", fn: t.fn });
      } else if (t.t === "lp" || t.t === "rp") {
        valid.push({ t: t.t });
      }
    }
    // 2) 시작 op 제거 (단항 - 는 num 으로 변환 못 하니 그냥 버림). fn 은 시작 가능(floor(...)) 이라 보존.
    while (valid.length > 0 && valid[0].t === "op") valid.shift();
    // 3) 끝 op 제거
    while (valid.length > 0 && valid[valid.length - 1].t === "op") valid.pop();
    // 4) 연속 op 정리 (앞 우선)
    const dedupOps: any[] = [];
    for (const t of valid) {
      const last = dedupOps[dedupOps.length - 1];
      if (last && last.t === "op" && t.t === "op") continue;
      dedupOps.push(t);
    }
    // 5) 괄호 균형 — 열림 더 많으면 끝에 ) 추가, 닫힘 더 많으면 앞에서 제거
    let depth = 0;
    const balanced: any[] = [];
    for (const t of dedupOps) {
      if (t.t === "rp") {
        if (depth <= 0) continue; // 매칭 안 되는 ) 버림
        depth--;
      } else if (t.t === "lp") {
        depth++;
      }
      balanced.push(t);
    }
    while (depth > 0) {
      balanced.push({ t: "rp" });
      depth--;
    }
    // 6) 빈 결과면 0 토큰 1개로 — 빌더가 "비어 있음" 으로 표시
    if (balanced.length === 0) {
      return [{ t: "num", v: 0 }];
    }
    return balanced;
  };

  // step 복구
  const VALID_STEP_TYPES = new Set([
    "date",
    "classify",
    "table",
    "formula",
    "clamp",
    "branch",
    "switch",
    "llm",
  ]);
  const repairSteps = (steps: any[] = []): any[] =>
    steps
      .filter((s) => {
        // 유효한 type 이 없는 step 은 통째로 제거 — 깨진 정보성 항목 차단
        if (!s || typeof s !== "object") return false;
        if (!VALID_STEP_TYPES.has(s.type)) return false;
        return true;
      })
      .map((s) => {
      const out: any = { ...s };
      // 이름 비어 있으면 타입으로 임시 이름 부여
      if (!out.name || typeof out.name !== "string" || !out.name.trim()) {
        out.name = `${out.type || "step"}_${uid().slice(0, 4)}`;
      }
      // 단위는 문자열로 보장
      if (out.unit == null) out.unit = "";

      if (out.type === "formula") {
        out.tokens = repairFormulaTokens(out.tokens || []);
      } else if (out.type === "classify") {
        // items 가 없거나 비면 빈 분류 (사용자가 채워야 함)
        if (!Array.isArray(out.items)) out.items = [];
        // agg 기본값
        if (!["sum", "count", "avg", "max", "min"].includes(out.agg)) {
          out.agg = "sum";
        }
        // 각 item ref 가 비어 있으면 제거
        out.items = out.items.filter(
          (it: any) => it && typeof it === "object" && typeof it.ref === "string" && it.ref.trim()
        );
        // 분류 결과는 number 처리
        if (out.name) numberPromote.add(out.name);
        // items 의 ref 들도 number 로 처리
        for (const it of out.items) numberPromote.add(it.ref);
      } else if (out.type === "table") {
        // bands 없거나 비면 최소 1구간
        if (!Array.isArray(out.bands) || out.bands.length === 0) {
          out.bands = [{ from: 0, to: 100, v: 0 }];
        } else {
          // 각 band 의 from/to/v 가 숫자가 아니면 정리
          out.bands = out.bands.map((b: any) => ({
            from: Number(b?.from) || 0,
            to: Number(b?.to) || 0,
            v: Number(b?.v) || 0,
          }));
        }
        if (out.ref) numberPromote.add(out.ref);
      } else if (out.type === "clamp") {
        if (typeof out.min !== "string") out.min = "";
        if (typeof out.max !== "string") out.max = "";
        if (out.ref) numberPromote.add(out.ref);
        if (out.min) numberPromote.add(out.min);
        if (out.max) numberPromote.add(out.max);
      } else if (out.type === "branch") {
        if (!["text", "calc"].includes(out.thenT)) out.thenT = "text";
        if (!["text", "calc"].includes(out.elsT)) out.elsT = "text";
        // text 모드인데 값이 변수/step 이름 자체이면 calc 으로 자동 승격
        // text 모드인데 값이 순수 숫자 문자열이면 calc + num 토큰으로 승격
        //   ↳ "80000" 같은 케이스. 이게 없으면 후속 formula 가 이 branch 결과를 더하려다 "숫자 아님" 으로 터짐.
        const NUM_RE = /^-?\d+(\.\d+)?$/;
        const promoteIfVar = (side: "then" | "els") => {
          const valKey = side; // "then" | "els"
          const typKey = side === "then" ? "thenT" : "elsT";
          const tokKey = side === "then" ? "thenTok" : "elsTok";
          if (out[typKey] !== "text") return;
          if (typeof out[valKey] !== "string") return;
          const v = out[valKey].trim();
          if (!v) return;
          // (a) 정의된 이름이면 — '숫자' 변수/step 만 calc(계산식) 로 승격.
          //     텍스트/날짜 변수는 branch calc(숫자 전용)에 못 들어가므로 텍스트 모드 유지 +
          //     이름 대신 그 변수의 '값'을 라벨로 (이름이 그대로 표시되거나 NaN 으로 깨지는 것 방지).
          if (allDefined.has(v)) {
            const vv = (schema.vars || []).find((x: any) => x?.name === v);
            const isNumericName = vv ? (vv.type === "number" && !looksLikeText(v)) : !looksLikeText(v);
            if (isNumericName) {
              out[typKey] = "calc";
              out[tokKey] = [{ t: "var", name: v }];
              out[valKey] = "";
              numberPromote.add(v);
            } else if (vv && typeof vv.test === "string" && vv.test.trim()) {
              out[valKey] = vv.test.trim(); // 텍스트/날짜 변수 → 값 라벨, 텍스트 모드 유지
            }
            return;
          }
          // (b) 순수 숫자 문자열이면 num 토큰으로 (예: "80000", "1.5", "-1000")
          if (NUM_RE.test(v.replace(/,/g, ""))) {
            out[typKey] = "calc";
            out[tokKey] = [{ t: "num", v: Number(v.replace(/,/g, "")) }];
            out[valKey] = "";
            return;
          }
        };
        promoteIfVar("then");
        promoteIfVar("els");
        if (out.thenT === "calc") out.thenTok = repairFormulaTokens(out.thenTok || []);
        else out.thenTok = [];
        if (out.elsT === "calc") out.elsTok = repairFormulaTokens(out.elsTok || []);
        else out.elsTok = [];
        // 기본 placeholder 채움 (한 쪽만 비어 있을 때 대비). 양쪽 다 의미 없으면 isUsableStep 에서 제거.
        if (out.thenT === "text" && (out.then == null || out.then === "")) out.then = "참";
        if (out.elsT === "text" && (out.els == null || out.els === "")) out.els = "거짓";
        if (!["<", "<=", "==", "!=", ">=", ">"].includes(out.op)) out.op = ">=";
        if (out.rhs == null || out.rhs === "") out.rhs = 0;
      } else if (out.type === "switch") {
        // N-way 분기 정리 — cases 정제, 기본값 보강
        if (!Array.isArray(out.cases)) out.cases = [];
        out.cases = out.cases
          .filter((c: any) => c && typeof c === "object")
          .map((c: any) => {
            const cc: any = { ...c };
            if (cc.match == null) cc.match = "";
            cc.match = String(cc.match);
            if (!["text", "calc"].includes(cc.t)) cc.t = "calc";
            if (cc.t === "calc") {
              // switch case 는 텍스트 변수도 출력 가능 — number 승격하지 말 것.
              cc.tokens = repairFormulaTokens(cc.tokens || [], false);
              cc.text = cc.text || "";
            } else {
              cc.tokens = [];
              // text 모드가 순수 숫자면 calc 으로 승격
              if (typeof cc.text === "string" && /^-?\d+(\.\d+)?$/.test(cc.text.replace(/,/g, ""))) {
                cc.t = "calc";
                cc.tokens = [{ t: "num", v: Number(cc.text.replace(/,/g, "")) }];
                cc.text = "";
              }
            }
            return cc;
          });
        // 기본값
        if (!["text", "calc"].includes(out.defaultT)) out.defaultT = "calc";
        if (out.defaultT === "calc") {
          out.defaultTokens = repairFormulaTokens(out.defaultTokens || [], false);
          if (typeof out.defaultText !== "string") out.defaultText = "";
        } else {
          out.defaultTokens = [];
          if (typeof out.defaultText !== "string") out.defaultText = "";
        }
        if (typeof out.ref !== "string") out.ref = "";
      } else if (out.type === "date") {
        if (!["diff", "part"].includes(out.mode)) out.mode = "diff";
        if (!out.out) out.out = out.mode === "part" ? "month" : "year";
        // a/b 정규화: '오늘/현재일/현재/금일/today' 류 → "오늘".
        //   날짜 입력은 '날짜 타입 변수' 또는 "오늘" 만 유효 — 숫자 step/미해석 이름을 날짜로 쓰면
        //   런타임 "날짜 형식 오류" 가 나므로 "오늘" 로 안전 대체.
        const TODAY_RE = /^(오늘|현재일|현재날짜|현재|금일|오늘날짜|today|todaydate|now|currentdate)$/i;
        const dateOperand = (x: any): string => {
          const raw = typeof x === "string" ? x.trim() : "";
          if (!raw) return "오늘";
          if (TODAY_RE.test(raw.replace(/\s/g, ""))) return "오늘";
          const vv = (schema.vars || []).find((v: any) => v?.name === raw);
          if (vv && vv.type === "date") return raw; // 날짜 변수만 유효
          return "오늘";
        };
        out.a = dateOperand(out.a);
        if (out.mode === "diff") out.b = dateOperand(out.b);
      } else if (out.type === "llm") {
        if (!Array.isArray(out.items)) out.items = [];
        if (typeof out.prompt !== "string") out.prompt = "";
        // 산출 블록명 표준화: "LLM 요약" / "요약" → "LLM 분석"
        if (typeof out.name === "string") {
          const n = out.name.trim();
          if (/^LLM\s*요약$/i.test(n) || n === "요약" || n === "LLM요약") {
            out.name = "LLM 분석";
          }
        }
      }
      return out;
    });

  // ── 비숫자 변수 집합 구축 — formula/table/clamp/classify 에서 절대 참조하면 안 되는 이름들 ──
  // (1) schema.vars 중 type 이 'text' 또는 'date' 인 변수
  // (2) 이름이 looksLikeText(품목·사유·관계·시기 등)에 걸리는 변수
  // (3) llm step 결과 (항상 텍스트)
  // (4) branch step 결과 중 양쪽 다 text 모드인 것 (텍스트 출력)
  const nonNumericNames = new Set<string>();
  for (const v of schema.vars || []) {
    if (!v?.name) continue;
    if (v.type === "text" || v.type === "date" || v.type === "select") nonNumericNames.add(v.name);
    else if (looksLikeText(v.name)) nonNumericNames.add(v.name);
  }
  const collectNonNumericFromSteps = (steps: any[] = []) => {
    for (const s of steps) {
      if (!s?.name) continue;
      if (s.type === "llm") nonNumericNames.add(s.name);
      else if (s.type === "branch") {
        // 양쪽 다 text 모드면 결과도 텍스트
        if (s.thenT === "text" && s.elsT === "text") nonNumericNames.add(s.name);
        // 한 쪽이라도 calc 면 숫자 출력 가능 — 일단 숫자 취급
      } else if (s.type === "switch") {
        // switch 의 case 가 모두 text 모드이거나 단일 text 변수 토큰만 반환하면 결과도 텍스트
        const cases = Array.isArray(s.cases) ? s.cases : [];
        const allText = cases.length > 0 && cases.every((c: any) => {
          if (c.t === "text") return true;
          // calc 모드인데 단일 var 토큰 + 그 변수가 비숫자이면 텍스트
          if (c.t === "calc" && Array.isArray(c.tokens) && c.tokens.length === 1 && c.tokens[0]?.t === "var") {
            return nonNumericNames.has(c.tokens[0].name);
          }
          return false;
        });
        if (allText) nonNumericNames.add(s.name);
      }
    }
  };
  collectNonNumericFromSteps(schema.shared?.steps || []);
  for (const p of schema.paths || []) collectNonNumericFromSteps(p.steps || []);
  collectNonNumericFromSteps(schema.fallback?.steps || []);
  // (numberPromote 반영은 repair 가 끝난 후 별도로 처리 — 이 시점에는 아직 빔)

  // 빈 껍데기 step 제거 — 산식·분류·구간표 등이 실제 내용 없으면 차라리 삭제
  // + 비숫자 변수를 숫자로 다루려는 잘못된 step 제거 (runtime "숫자 아님" 에러 방지)
  const isNonNumeric = (name: string) =>
    typeof name === "string" && (nonNumericNames.has(name) || looksLikeText(name));
  const isUsableStep = (s: any): boolean => {
    if (!s || typeof s !== "object") return false;
    if (s.type === "formula") {
      const toks = Array.isArray(s.tokens) ? s.tokens : [];
      if (toks.length === 0) return false;
      if (toks.length === 1 && toks[0]?.t === "num" && toks[0]?.v === 0) return false;
      const hasVar = toks.some((t: any) => t?.t === "var" && t?.name);
      const hasOp = toks.some((t: any) => t?.t === "op");
      if (!hasVar && !hasOp) return false;
      // 비숫자 변수(텍스트/날짜/품목 등)를 산식 토큰으로 쓰면 무효 — runtime "숫자 아님" 방지
      if (toks.some((t: any) => t?.t === "var" && isNonNumeric(t.name))) return false;
      // 산출 결과 자체가 텍스트성 이름이면 (예: 부의발주시기) 무효 — 산식으로 만들 게 아님
      if (s.name && looksLikeText(s.name)) return false;
      return true;
    }
    if (s.type === "classify") {
      if (!Array.isArray(s.items) || s.items.length === 0) return false;
      if (s.name && looksLikeText(s.name)) return false;
      // 비숫자 변수를 inc 항목으로 두면 sum/avg 가 NaN — 그런 항목은 자동 제거
      const cleaned = s.items.filter((it: any) => it?.ref && !isNonNumeric(it.ref));
      if (cleaned.length === 0) return false;
      s.items = cleaned;
      return true;
    }
    if (s.type === "table") {
      if (!s.ref || typeof s.ref !== "string") return false;
      if (isNonNumeric(s.ref)) return false; // 비숫자 변수에 구간표 적용 불가
      if (s.name && looksLikeText(s.name)) return false;
      return Array.isArray(s.bands) && s.bands.length > 0;
    }
    if (s.type === "clamp") {
      if (typeof s.ref !== "string" || s.ref.trim() === "") return false;
      if (isNonNumeric(s.ref)) return false;
      // min/max 도 비숫자면 빈값 처리
      if (s.min && isNonNumeric(s.min)) s.min = "";
      if (s.max && isNonNumeric(s.max)) s.max = "";
      return true;
    }
    if (s.type === "switch") {
      // ref 필수, cases 1개 이상 필요
      if (typeof s.ref !== "string" || s.ref.trim() === "") return false;
      if (!Array.isArray(s.cases) || s.cases.length === 0) return false;
      // ref 가 식별 정보(성명·사번·부서·직급 등) 이면 분기 ref 로 부적합 → step 제거
      const BASIC_ID_REF = /^(성명|이름|성함|사번|직원번호|사원번호|임직원번호|부서|소속|본부|팀|직급|직위|직책|생년월일|출생일|입사일|채용일|연락처|전화|이메일|주소)$/;
      if (BASIC_ID_REF.test(s.ref.trim())) return false;
      // 각 case 의 출력값이 의미 있는지 — 빈 토큰 또는 빈 텍스트만이면 무효 case 제거
      s.cases = s.cases.filter((c: any) => {
        if (c.t === "calc") {
          if (!Array.isArray(c.tokens) || c.tokens.length === 0) return false;
          if (c.tokens.length === 1 && c.tokens[0]?.t === "num" && c.tokens[0]?.v === 0) return false;
          return true;
        }
        return typeof c.text === "string" && c.text.trim() !== "";
      });
      if (s.cases.length === 0) return false;
      // case.match 중복 검사 — 같은 match 가 둘 이상이면 비정상 step → 제거
      const matches = s.cases.map((c: any) => String(c.match ?? ""));
      const uniq = new Set(matches);
      if (uniq.size !== matches.length) return false;
      // case.match 값이 모두 정의된 변수 이름 → 분기 의미 없음 (변수 이름 자체가 match 값일 리 없음)
      const defNames = new Set<string>(schema.vars?.map((v: any) => v.name) ?? []);
      const allMatchAreVarNames = matches.length > 0 && matches.every((m: string) => defNames.has(m));
      if (allMatchAreVarNames) return false;
      return true;
    }
    if (s.type === "branch") {
      if (typeof s.ref !== "string" || s.ref.trim() === "") return false;
      if (looksLikeText(s.ref) && !["==", "!=", "eq", "neq"].includes(s.op)) return false;
      // 양쪽 출력값 검증 — 한 쪽이라도 의미 있는 값이 없으면 분기 자체가 무용지물 → 제거
      const sideHasValue = (typ: string, txt: any, toks: any[]) => {
        if (typ === "calc") {
          if (!Array.isArray(toks) || toks.length === 0) return false;
          if (toks.length === 1 && toks[0]?.t === "num" && toks[0]?.v === 0) return false;
          return true;
        }
        // text 모드 — 불리언/placeholder(참·거짓·true·false 등)만이면 사용자에게 무의미한 값 → 무효
        //   (출생반기 같은 분류는 "상반기"/"하반기" 처럼 이해되는 라벨이어야 함. true/false 노출 차단.)
        if (typeof txt !== "string") return false;
        const t = txt.trim();
        if (!t) return false;
        if (/^(참|거짓|true|false|yes|no|y|n|0|1)$/i.test(t)) return false;
        return true;
      };
      const thenOk = sideHasValue(s.thenT, s.then, s.thenTok);
      const elsOk = sideHasValue(s.elsT, s.els, s.elsTok);
      if (!thenOk || !elsOk) return false;
      return true;
    }
    if (s.type === "date") {
      // a 가 없으면 무효
      if (typeof s.a !== "string" || s.a.trim() === "") return false;
      // 같은 날짜끼리 차이(예: 오늘-오늘) = 항상 0, 무의미한 step → 제거
      if (s.mode === "diff" && s.a === s.b) return false;
      return true;
    }
    if (s.type === "llm") {
      // items 가 비어 있어도 LLM 은 호출 가능 (그냥 메타만 보내도 됨) — OK
      return true;
    }
    return false;
  };

  // 2-pass: (1) 전체 repair → numberPromote 채움  (2) nonNumericNames 재계산  (3) isUsableStep 필터
  if (schema.shared) schema.shared.steps = repairSteps(schema.shared.steps || []);
  if (Array.isArray(schema.paths)) {
    schema.paths = schema.paths.map((p: any) => ({ ...p, steps: repairSteps(p.steps || []) }));
  }
  if (schema.fallback) {
    schema.fallback = { ...schema.fallback, steps: repairSteps(schema.fallback.steps || []) };
  }
  // repair 후 — branch / switch 의 출력 타입 재조정.
  // branch: 한 쪽이라도 calc 면 숫자 출력 가능 → nonNumeric 에서 제거.
  // switch: 모든 case 가 텍스트 변수만 가리키면 결과도 텍스트 → nonNumeric 추가.
  const rescanSwitchBranchNumeric = (steps: any[] = []) => {
    for (const s of steps) {
      if (!s?.name) continue;
      if (s.type === "branch") {
        if (s.thenT === "calc" || s.elsT === "calc") {
          nonNumericNames.delete(s.name);
        } else {
          nonNumericNames.add(s.name);
        }
      } else if (s.type === "switch") {
        const cases = Array.isArray(s.cases) ? s.cases : [];
        const allText = cases.length > 0 && cases.every((c: any) => {
          if (c.t === "text") return true;
          if (c.t === "calc" && Array.isArray(c.tokens) && c.tokens.length === 1 && c.tokens[0]?.t === "var") {
            return nonNumericNames.has(c.tokens[0].name);
          }
          return false;
        });
        if (allText) nonNumericNames.add(s.name);
        else nonNumericNames.delete(s.name);
      }
    }
  };
  rescanSwitchBranchNumeric(schema.shared?.steps || []);
  for (const p of schema.paths || []) rescanSwitchBranchNumeric(p.steps || []);
  rescanSwitchBranchNumeric(schema.fallback?.steps || []);
  // 값이 명백히 비숫자인 변수는 산식에 쓰였어도 숫자로 보지 않는다 (예: 운영모델="표준형").
  //   → 이런 변수를 참조하는 산식 step 은 isUsableStep 에서 제거되어 "텍스트가 계산식에 들어가 0" 을 막는다.
  const hasNonNumericValue = (name: string): boolean => {
    const v = (schema.vars || []).find((x: any) => x?.name === name);
    if (!v) return false; // 변수 아님(step 등) → 숫자 산출로 간주
    const t = typeof v.test === "string" ? v.test.trim().replace(/,/g, "") : "";
    return t !== "" && !/^-?\d+(\.\d+)?$/.test(t);
  };
  // numberPromote 결과를 nonNumericNames 에 반영 (산식에 쓰인 이름은 numeric 으로 간주,
  //   단 명백한 텍스트 이름·비숫자 값 변수는 제외)
  for (const n of numberPromote) {
    if (!looksLikeText(n) && !hasNonNumericValue(n)) nonNumericNames.delete(n);
  }
  // 필터링 (무효 step 제거)
  if (schema.shared) schema.shared.steps = (schema.shared.steps || []).filter(isUsableStep);
  if (Array.isArray(schema.paths)) {
    schema.paths = schema.paths.map((p: any) => ({
      ...p,
      steps: (p.steps || []).filter(isUsableStep),
    }));
  }
  if (schema.fallback) {
    schema.fallback = {
      ...schema.fallback,
      steps: (schema.fallback.steps || []).filter(isUsableStep),
    };
  }

  // ── 스코프 무결성 안전망 — 참조는 "vars + shared + 자기 경로 step" 안에서만 유효 ──
  // ⚠ 전역(모든 경로 합집합) 검사는 금물: 런타임은 매칭된 경로의 step 만 실행하므로,
  //   다른 경로에만 정의된 이름을 참조하면 그 경로에서 "미정의" 에러 → NaN 연쇄가 난다.
  //   (실제 사례: 경로마다 같은 이름의 산출(기본급제안액)이 있는데 한 경로 것만 isUsableStep 에서
  //    drop 되자, 전역 검사가 "정의됨" 으로 통과시켜 그 경로만 런타임에서 깨졌음.)
  // 수리 규칙 — "부족해도 편집 가능" 은 허용, "에러로 깨짐" 은 차단:
  //   (1) 진입 조건이 자기 경로 step 을 참조 → 그 step(+경로 내 의존 step)을 shared 로 승격
  //       (조건은 step 실행 전에 평가되므로 경로 안에 두면 항상 미계산).
  //   (2) 경로 step 참조가 스코프 밖인데 다른 경로에 같은 이름의 step 존재 → 이 경로에
  //       스텁 산출(계산식 0) 삽입. 관리자가 빌더에서 산식만 채우면 됨 (에러 없음).
  //   (3) 어디에도 없는 이름 → 개인 변수 자동 정의 (기존 동작).
  //   (4) 리포트 bind 가 그 경로 스코프 밖 → 요소 제거 (항상 빈 값인 카드 차단).
  {
    const varNames = new Set<string>();
    for (const v of schema.vars || []) if (v?.name) varNames.add(v.name);
    const sharedNames = new Set<string>();
    for (const s of schema.shared?.steps || []) if (s?.name) sharedNames.add(s.name);

    // 참조로 취급 가능한 이름인지 (리터럴·예약어·깨진 수식 조각 제외)
    const asRefName = (nm: any): string | null => {
      if (typeof nm !== "string") return null;
      const n = nm.trim();
      if (!n || RESERVED.has(n) || isNumericLiteral(n) || isQuotedLiteral(n)) return null;
      if (/["'“”‘’%()*/+]/.test(n)) return null;
      return n;
    };
    // step 이 참조하는 이름들 (llm items 는 런타임이 안전 처리하므로 제외)
    const refsOfStep = (s: any): string[] => {
      const out: string[] = [];
      const add = (nm: any) => { const n = asRefName(nm); if (n) out.push(n); };
      if (!s || typeof s !== "object") return out;
      if (s.type === "date") { add(s.a); if (s.mode === "diff") add(s.b); }
      else if (s.type === "classify") for (const it of s.items || []) add(it?.ref);
      else if (s.type === "table") add(s.ref);
      else if (s.type === "clamp") { add(s.ref); add(s.min); add(s.max); }
      else if (s.type === "formula") for (const t of s.tokens || []) { if (t?.t === "var") add(t.name); }
      else if (s.type === "branch") {
        add(s.ref);
        if (typeof s.rhs === "string") add(s.rhs);
        if (s.thenT === "calc") for (const t of s.thenTok || []) { if (t?.t === "var") add(t.name); }
        if (s.elsT === "calc") for (const t of s.elsTok || []) { if (t?.t === "var") add(t.name); }
      } else if (s.type === "switch") {
        add(s.ref);
        for (const c of s.cases || []) if (c?.t === "calc") for (const t of c.tokens || []) { if (t?.t === "var") add(t.name); }
        for (const t of s.defaultTokens || []) { if (t?.t === "var") add(t.name); }
      }
      return out;
    };

    // (1) 조건 → 자기 경로 step 참조 시 shared 승격 (경로 내 의존 step 전이 포함)
    for (const p of schema.paths || []) {
      const ownStepByName = new Map<string, any>();
      for (const s of p.steps || []) if (s?.name) ownStepByName.set(s.name, s);
      const need = new Set<string>();
      const visit = (n: string) => {
        if (need.has(n) || !ownStepByName.has(n)) return;
        need.add(n);
        for (const r of refsOfStep(ownStepByName.get(n))) visit(r);
      };
      for (const c of p.conditions || []) {
        if (!c || typeof c !== "object") continue;
        for (const raw of [c.aMode !== "val" ? c.a : null, c.bMode !== "val" ? c.b : null]) {
          const n = asRefName(raw);
          if (n && !varNames.has(n) && !sharedNames.has(n) && ownStepByName.has(n)) visit(n);
        }
      }
      if (need.size > 0) {
        const moved: any[] = [];
        p.steps = (p.steps || []).filter((s: any) => {
          if (s?.name && need.has(s.name)) { moved.push(s); return false; }
          return true;
        });
        if (!schema.shared) schema.shared = { steps: [] };
        if (!Array.isArray(schema.shared.steps)) schema.shared.steps = [];
        for (const s of moved) {
          if (!sharedNames.has(s.name)) { schema.shared.steps.push(s); sharedNames.add(s.name); }
        }
      }
    }

    // 승격 반영 후 — 경로별 step 이름 인벤토리 (스텁 생성 시 단위 참고용)
    const stepAnywhere = new Map<string, any>();
    for (const p of schema.paths || [])
      for (const s of p.steps || []) if (s?.name && !stepAnywhere.has(s.name)) stepAnywhere.set(s.name, s);
    for (const s of schema.fallback?.steps || []) if (s?.name && !stepAnywhere.has(s.name)) stepAnywhere.set(s.name, s);

    // (3) 어디에도 없는 이름 수집 → 마지막에 개인 변수로 일괄 추가
    const autoVarHints = new Map<string, TypeHint>();
    const noteAutoVar = (n: string, hint: TypeHint) => {
      if (varNames.has(n)) return;
      const prev = autoVarHints.get(n);
      if (!prev || (prev.type === "number" && hint.type !== "number")) autoVarHints.set(n, hint);
    };
    const hintFor = (s: any, refName: string): TypeHint => {
      if (s?.type === "date") return { type: "date" };
      if (s?.type === "switch" && s.ref === refName) return { type: "text" };
      return { type: "number" };
    };

    // (2)+(3) step 참조 스코프 검사 — shared / 각 경로 / fallback
    for (const s of schema.shared?.steps || []) {
      for (const n of refsOfStep(s)) {
        // shared 는 경로 step 을 참조할 수 없음 (경로 실행 전) — 변수로만 보강 가능
        if (!varNames.has(n) && !sharedNames.has(n)) noteAutoVar(n, hintFor(s, n));
      }
    }
    const repairScopedSteps = (steps: any[], scope: Set<string>): any[] => {
      const out: any[] = [];
      for (const s of steps) {
        for (const n of refsOfStep(s)) {
          if (scope.has(n) || autoVarHints.has(n)) continue;
          const other = stepAnywhere.get(n);
          if (other) {
            // 다른 경로에 같은 이름의 산출 존재 → 이 경로용 스텁 삽입 (관리자가 산식을 채움)
            out.push({ id: "auto", name: n, unit: other.unit || "", type: "formula", tokens: [{ t: "num", v: 0 }] });
            scope.add(n);
          } else {
            noteAutoVar(n, hintFor(s, n));
          }
        }
        out.push(s);
      }
      return out;
    };
    const scopeOf = (steps: any[] = []): Set<string> => {
      const scope = new Set<string>([...varNames, ...sharedNames]);
      for (const s of steps) if (s?.name) scope.add(s.name);
      return scope;
    };
    const NEEDS_BIND = new Set(["card", "calc", "incexc", "chart", "field"]);
    const cleanScopedReport = (report: any[] = [], scope: Set<string>): any[] =>
      report.filter((e: any) => {
        if (!e || typeof e !== "object") return false;
        if (!NEEDS_BIND.has(e.kind)) return true;
        const inScope = (nm: any) => {
          const n = typeof nm === "string" ? nm.trim() : "";
          return !n || scope.has(n) || autoVarHints.has(n);
        };
        return inScope(e.bind) && inScope(e.bind2);
      });
    for (const p of schema.paths || []) {
      const scope = scopeOf(p.steps);
      p.steps = repairScopedSteps(p.steps || [], scope);
      // 조건 참조 — 자기 경로 step 은 위에서 이미 shared 승격됨. 남은 미해석 이름은 변수로.
      for (const c of p.conditions || []) {
        if (!c || typeof c !== "object") continue;
        for (const raw of [c.aMode !== "val" ? c.a : null, c.bMode !== "val" ? c.b : null]) {
          const n = asRefName(raw);
          if (n && !varNames.has(n) && !sharedNames.has(n)) noteAutoVar(n, { type: "number" });
        }
      }
      p.report = cleanScopedReport(p.report, scope);
    }
    if (schema.fallback) {
      const scope = scopeOf(schema.fallback.steps);
      schema.fallback.steps = repairScopedSteps(schema.fallback.steps || [], scope);
      schema.fallback.report = cleanScopedReport(schema.fallback.report, scope);
    }
    if (autoVarHints.size > 0) {
      if (!Array.isArray(schema.vars)) schema.vars = [];
      for (const [name, hint] of autoVarHints) {
        schema.vars.push({
          id: "auto",
          grp: "개인",
          name,
          type: hint.type,
          unit: hint.unit || (hint.type === "number" ? "원" : ""),
          req: false,
          test: "",
        });
      }
    }
  }

  // 산식에 쓰인 변수는 type='number' 로 승격 (text/date 면 number 로 강제)
  // 단, 명백히 텍스트성 이름(품목·사유·관계·시기 등)과 선택형(select — 분류 변수)은 절대 승격하지 않음.
  if (Array.isArray(schema.vars) && numberPromote.size > 0) {
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object") return v;
      if (
        numberPromote.has(v.name) &&
        v.type !== "number" &&
        v.type !== "select" &&
        !looksLikeText(v.name) &&
        !hasNonNumericValue(v.name)
      ) {
        return { ...v, type: "number", unit: v.unit || "원" };
      }
      return v;
    });
  }

  // ── 분류 변수 자동 select 승격 — 진입 조건·switch 가 사실상 옵션 목록을 정의하는 경우 ──
  // text 변수가 (1) 경로 진입 조건에서 == 리터럴 비교되거나 (2) switch ref 로 쓰이면,
  // 그 리터럴/case.match 들이 곧 허용값이다. 2개 이상 모이면 select 로 승격해
  // 사용자 입력을 콤보박스로, 파싱을 목록 내로 제한한다. (AI 가 select 로 안 뽑은 경우의 안전망)
  if (Array.isArray(schema.vars)) {
    const optionPool = new Map<string, Set<string>>(); // 변수명 → 발견된 허용값들
    const noteOption = (varName: any, val: any) => {
      if (typeof varName !== "string" || !varName.trim()) return;
      let s = typeof val === "string" ? val.trim() : String(val ?? "").trim();
      s = s.replace(/^["'“”‘’]|["'“”‘’]$/g, "").trim();
      if (!s || /^-?\d+(\.\d+)?$/.test(s)) return; // 숫자 비교는 분류 아님
      const key = varName.trim();
      if (!optionPool.has(key)) optionPool.set(key, new Set());
      optionPool.get(key)!.add(s);
    };
    const scanCondsForOptions = (conds: any[] = []) => {
      for (const c of conds) {
        if (!c || typeof c !== "object") continue;
        if (c.op !== "==" && c.op !== "!=") continue;
        if (c.aMode !== "val" && c.bMode === "val") noteOption(c.a, c.b);
        if (c.bMode !== "val" && c.aMode === "val") noteOption(c.b, c.a);
      }
    };
    const scanSwitchForOptions = (steps: any[] = []) => {
      for (const s of steps) {
        if (s?.type !== "switch" || typeof s.ref !== "string") continue;
        for (const cse of s.cases || []) noteOption(s.ref, cse?.match);
      }
    };
    for (const p of schema.paths || []) {
      scanCondsForOptions(p.conditions);
      scanSwitchForOptions(p.steps);
    }
    scanSwitchForOptions(schema.shared?.steps);
    if (schema.fallback) {
      scanCondsForOptions(schema.fallback.conditions);
      scanSwitchForOptions(schema.fallback.steps);
    }
    // select 유지 근거 — 옵션이 "문서/로직에 실재" 해야 함:
    //   (a) 조건·switch 리터럴에서 그 변수의 값이 실제 사용되거나 (분기축 증거)
    //   (b) desc 에 「값: A/B/C」 표기가 있거나 (기획서가 후보를 명시 — 프롬프트가 select 의 desc 에 강제)
    // 둘 다 없으면 AI 가 후보를 지어낸 것(예: 보유자격에 정보보안기사/PMP/CISA 발명) → text 강등.
    // 목록형 입력(경력내역·보유자격 등 "목록/여러 건") 도 이름·설명 신호로 강등.
    const VALUE_LIST_RE = /값\s*[:：]/;
    const MULTI_LIST_RE = /(목록|내역|리스트|여러\s*건)/;
    const looksMultiList = (v: any) =>
      MULTI_LIST_RE.test(String(v.name || "")) || MULTI_LIST_RE.test(String(v.desc || ""));
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object" || typeof v.name !== "string") return v;
      const found = optionPool.get(v.name);
      if (v.type === "select") {
        const corroborated =
          (found && found.size > 0) || VALUE_LIST_RE.test(String(v.desc || ""));
        if (!corroborated || looksMultiList(v)) {
          // 근거 없는 옵션 목록 — 발명으로 간주하고 자유 입력으로 되돌림
          const { options: _drop, ...rest } = v;
          return { ...rest, type: "text" };
        }
        // 기존 select — 조건/switch 에서 발견된 값이 options 에 빠져 있으면 보충
        const opts: string[] = Array.isArray(v.options) ? [...v.options] : [];
        for (const o of found || []) if (!opts.includes(o)) opts.push(o);
        if (typeof v.test === "string" && v.test.trim() && !opts.includes(v.test.trim()))
          opts.push(v.test.trim());
        return { ...v, options: opts, unit: "" };
      }
      if (v.type === "text" && found && found.size >= 2 && !looksMultiList(v)) {
        const opts = [...found];
        if (typeof v.test === "string" && v.test.trim() && !opts.includes(v.test.trim()))
          opts.push(v.test.trim());
        return { ...v, type: "select", options: opts, unit: "" };
      }
      return v;
    });
  }

  // ── 타입↔테스트값 일관성 보정 ──
  // 변수 type 이 number 인데 test 값이 숫자로 파싱 안 되면 (예: "예", "본인", "예/아니오") → text 로 다운그레이드.
  // 변수 이름이 looksLikeText 면 무조건 text 로 강제 (예: "결혼화환제공여부_본인" type=number → text).
  if (Array.isArray(schema.vars)) {
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object") return v;
      // (a) 이름이 명백히 텍스트성이면 number → text 강제
      if (v.type === "number" && looksLikeText(v.name)) {
        return { ...v, type: "text", unit: "" };
      }
      // (b) test 값이 있는데 숫자 파싱 실패면 다운그레이드 (단, 빈 값이면 통과)
      if (v.type === "number" && typeof v.test === "string" && v.test.trim() !== "") {
        const cleaned = v.test.replace(/[,\s원]/g, "");
        if (cleaned !== "" && !/^-?\d+(\.\d+)?$/.test(cleaned)) {
          // "예"·"아니오"·"본인"·"있음" 같은 비숫자 값 → text 다운그레이드
          return { ...v, type: "text", unit: "" };
        }
      }
      return v;
    });
  }

  // ── grp 자동 보정 — 이름에서 규정/개인 추정 ──
  // AI 가 모든 변수를 개인으로 몰아넣는 흔한 실수 보정.
  // 정책 키워드(기준액·한도·률·연령·정년·최저·최고·기간·등급 등)로 끝나거나 포함하면 '규정' 으로 분류.
  if (Array.isArray(schema.vars)) {
    const REG_HINTS = [
      // 정책 기준값
      /기준액$/, /기준$/, /한도$/, /최대$/, /최소$/, /최저$/, /최고$/,
      /률$/, /율$/, /비율$/, /정년/, /기준일$/, /기준년수$/,
      // ⚠ 연령·나이는 한정어(적용/기준/제한/최초 등)가 붙은 '정책 임계값' 만 규정.
      //    본인 '만나이/나이/연령' (생년월일에서 도출되는 개인 값) 은 규정 아님 → PER_HINTS 로.
      /적용연령/, /기준연령$/, /제한연령$/, /최초적용연령$/, /적용나이$/, /기준나이$/, /정년연령$/,
      /기간$/, /일수$/, /운영모델/, /정책/, /등급기준/,
      // 정책값은 접미사가 붙어도(예: 감액률_58세) 잡히도록 포함/시작 매칭 보강
      /^기준/, /최저임금/, /감액률/, /가산율/, /가산률/, /지급률/, /지원율/, /적용률/,
      // 회사가 정한 지원·지급 금액 — 본인/배우자/자녀 같은 접두어와 무관하게 모두 규정
      /지원금$/, /지원액$/, /지원한도$/, /지급액$/, /지급금$/, /지급한도$/,
      /축의금$/, /축하금$/, /조의금$/, /조위금$/, /부의금$/, /부조금$/,
      /위로금$/, /장려금$/, /격려금$/, /포상금$/, /보상금$/, /보조금$/,
      /수당금$/, /성과금$/, /상여금$/, /퇴직금$/, /연금$/, /수수료$/,
      /가산금$/, /가산율$/, /가산액$/, /감액률$/, /감액액$/, /차감액$/,
      /보전금$/, /휴가비$/, /경조금$/, /생일축하금$/, /명절상여$/,
    ];
    const PER_HINTS = [
      /^성명$/, /^이름$/, /^사번$/, /^부서$/, /^직급$/, /입사일$/, /생년월일$/,
      /^기본급$/, /수당$/, /상여$/, /식대$/, /신청금액$/, /신청일$/, /발생일$/,
      // 개인에게서 도출/입력되는 값 — 본인 나이·근속 등 (정책 임계값과 구분)
      //   근속은 시작매칭만 (기준근속년수 같은 정책값은 제외)
      /만나이$/, /^나이$/, /^연령$/, /^현재나이$/, /^근속/,
      // ⚠ /본인/ 같은 광폭 패턴은 "본인결혼지원금" 같은 규정 금액까지 잡아버리므로 사용 금지.
      //    경조 분류에 등장하는 "본인"은 vars 의 type=text(분류값)이지 grp=개인 의미가 아님.
      /^대상자_/, /^대상자$/, /^본인_/, /증빙/, /^평가점수$/, /^연차/, /^전년/,
      /신청자/, /^나의/, /^본인여부$/, /^본인관계$/,
    ];
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object" || typeof v.name !== "string") return v;
      // 분석이 이미 grp(규정/개인)를 명시했으면 그대로 신뢰한다.
      //   다중 단계 분석이 규정/개인을 전용 단계로 분류하므로 grp 가 신뢰 가능하고,
      //   이름 휴리스틱으로 덮어쓰면 개인 입력값(예: 직전3개월'일수')이 /일수$/ 에 걸려
      //   규정으로 잘못 뒤집히는 문제가 생긴다. → 휴리스틱은 grp 가 비었을 때만 사용.
      if (v.grp === "규정" || v.grp === "개인") return v;
      const name = v.name;
      const looksReg = REG_HINTS.some((re) => re.test(name));
      const looksPer = PER_HINTS.some((re) => re.test(name));
      if (looksReg && !looksPer) return { ...v, grp: "규정" };
      return { ...v, grp: "개인" }; // 비었거나 모호하면 개인 기본값
    });
  }

  // ── group/subGroup 자동 보정 — 보편 식별 변수는 무조건 "기본정보" 묶음으로 ──
  // 성명·사번·부서·직급·생년월일·입사일·연락처 등은 도메인 무관하게 group="기본정보" 로.
  // 하위 묶음(subGroup)은 만들지 않고 평탄하게 둠 — 기본정보는 항목이 적어 1단계로 충분.
  if (Array.isArray(schema.vars)) {
    const BASIC_INFO_PATTERNS: RegExp[] = [
      /^(성명|이름|성함)$/,
      /^(사번|직원번호|사원번호|임직원번호)$/,
      /(부서|소속|본부|팀|사업부|회사명?)$/,
      /(직급|직위|직책)$/,
      /^(생년월일|출생일|생일)$/,
      /^(입사일|채용일|입사년월일)$/,
      /(연락처|전화|휴대폰|이메일|메일|주소|우편번호)$/,
    ];
    const isBasicInfoName = (name: string): boolean =>
      BASIC_INFO_PATTERNS.some((re) => re.test(name));
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object" || typeof v.name !== "string") return v;
      if (isBasicInfoName(v.name)) {
        // 기본정보 묶음 — subGroup 비워서 평탄 표시
        return { ...v, group: "기본정보", subGroup: "" };
      }
      return v;
    });
  }

  // ── Fallback (미적용) 정리 — LLM 단계 제거 ──
  // Fallback 은 산출 없이 안내문만. LLM 단계가 있으면 통째로 제거.
  if (schema.fallback && Array.isArray(schema.fallback.steps)) {
    schema.fallback.steps = schema.fallback.steps.filter(
      (s: any) => s?.type !== "llm"
    );
  }

  // ── note tpl 내 정의되지 않은 placeholder 정리 ──
  // {appName}, {앱명}, {meta.X} 같이 vars 에도 step name 에도 없는 placeholder 를 실제 값으로 치환 또는 제거
  {
    const definedForTpl = new Set<string>();
    for (const v of schema.vars || []) if (v?.name) definedForTpl.add(v.name);
    for (const s of schema.shared?.steps || []) if (s?.name) definedForTpl.add(s.name);
    for (const p of schema.paths || [])
      for (const s of p.steps || []) if (s?.name) definedForTpl.add(s.name);
    for (const s of schema.fallback?.steps || []) if (s?.name) definedForTpl.add(s.name);

    const appName = (schema.meta?.appName && String(schema.meta.appName).trim()) || "본 앱";

    const cleanTpl = (tpl: any): any => {
      if (typeof tpl !== "string") return tpl;
      return tpl.replace(/\{([^}]+)\}/g, (full, key) => {
        const k = key.trim();
        if (definedForTpl.has(k)) return full; // 유효한 변수 — 그대로 둠
        // 앱명·메타 placeholder → 실제 텍스트로 치환
        if (/^(appName|앱명|app_name|meta\.appName|meta\.app_name)$/i.test(k)) {
          return appName;
        }
        // 그 외 정의 안 된 placeholder → 제거
        return "";
      }).replace(/\s+/g, " ").trim();
    };

    const cleanReportTpl = (report: any[] = []) =>
      (report || []).map((e: any) => {
        if (!e || e.kind !== "note") return e;
        return { ...e, tpl: cleanTpl(e.tpl) };
      });

    if (Array.isArray(schema.paths)) {
      schema.paths = schema.paths.map((p: any) => ({
        ...p,
        report: cleanReportTpl(p.report),
      }));
    }
    if (schema.fallback) {
      schema.fallback = {
        ...schema.fallback,
        report: cleanReportTpl(schema.fallback.report),
      };
    }
  }

  // ── 리포트 note 자동 채우기 — 빈 tpl 금지 ──
  // 우선순위: 경로 안에 LLM 단계가 있으면 {LLM이름} / 없으면 핵심 변수 조합 안내문
  const fillNotes = (steps: any[] = [], report: any[] = [], pathLabel: string) => {
    // 경로 안 LLM 단계 이름 찾기
    const llmStep = (steps || []).find((s) => s?.type === "llm" && s?.name);
    const llmName = llmStep?.name;
    // 리포트의 마지막 산출 결과 (final formula/clamp)를 안내문 변수로 사용
    const numericSteps = (steps || []).filter(
      (s) => s?.name && (s.type === "formula" || s.type === "clamp")
    );
    const finalName = numericSteps[numericSteps.length - 1]?.name;
    const appName = schema.meta?.appName || "본 앱";

    return (report || []).map((e) => {
      if (!e || e.kind !== "note") return e;
      const out: any = { ...e };
      const tpl = typeof out.tpl === "string" ? out.tpl.trim() : "";
      if (tpl) return out; // 이미 의미 있는 값
      // 빈 tpl — 자동 채우기
      if (llmName) {
        out.tpl = `{${llmName}}`;
      } else if (finalName) {
        out.tpl = `{성명} 님의 ${pathLabel} 결과는 {${finalName}} 입니다.`;
      } else {
        out.tpl = `${appName} — ${pathLabel} 안내. (자세한 결과는 위 카드들을 참고하세요.)`;
      }
      if (!out.label || !String(out.label).trim()) out.label = "안내문";
      return out;
    });
  };
  if (Array.isArray(schema.paths)) {
    schema.paths = schema.paths.map((p: any) => ({
      ...p,
      report: fillNotes(p.steps || [], p.report || [], p.label || "이 경로"),
    }));
  }
  if (schema.fallback) {
    schema.fallback = {
      ...schema.fallback,
      report: fillNotes(
        schema.fallback.steps || [],
        schema.fallback.report || [],
        schema.fallback.label || "미적용"
      ),
    };
    // Fallback note 가 하나도 없으면 자동 추가 — 미해당 안내는 반드시 있어야 함
    const fbReport = schema.fallback.report || [];
    const hasNote = fbReport.some((e: any) => e?.kind === "note");
    if (!hasNote) {
      fbReport.push({
        id: "auto",
        kind: "note",
        label: "미해당 안내",
        bind: "",
        w: "full",
        h: 2,
        wSpan: 6,
        hSpan: 2,
        tpl: `현재 ${schema.meta?.appName || "본 앱"} 적용 대상이 아닙니다. 사유는 위 판단 결과를 확인하세요.`,
      });
      schema.fallback.report = fbReport;
    }
  }

  // ── test 값 자동 채우기 — AI 가 빈 값으로 보낸 변수에 합리적 기본값 ──
  // 미리보기에서 모든 경로가 죽지 않도록 일관된 케이스로 채움.
  if (Array.isArray(schema.vars)) {
    // 이름 키워드 → 기본 test 값 매핑 (대표 인사 도메인 케이스)
    const defaultByKeyword = (name: string, type: string): string => {
      const n = name.toLowerCase();
      // text 계열
      if (type === "text") {
        if (/성명|이름/.test(name)) return "홍길동";
        if (/사번/.test(name)) return "20180123";
        if (/부서|본부|팀/.test(name)) return "경영지원본부";
        if (/직급|직위/.test(name)) return "과장";
        if (/소속|회사/.test(name)) return "본사";
        if (/관계|대상자관계/.test(name)) return "본인";
        if (/경조분류|경조사/.test(name)) return "결혼";
        if (/운영모델/.test(name)) return "혼합형";
        if (/분류|구분|종류|유형/.test(name)) return "일반";
        return "예시";
      }
      // date 계열
      if (type === "date") {
        if (/생년월일|출생/.test(name)) return "1980-05-15";
        if (/입사일/.test(name)) return "2018-03-02";
        if (/퇴직일|퇴사일/.test(name)) return "2026-12-31";
        if (/기준일/.test(name)) return "2026-07-01";
        if (/발생일|사고일|사망일/.test(name)) return "2026-05-10";
        if (/신청일/.test(name)) return "2026-05-20";
        return "2026-06-01";
      }
      // number 계열 (단위로 추가 추정)
      if (type === "number") {
        if (/기본급|월급|연봉/.test(name)) return "5500000";
        if (/수당|보너스|상여/.test(name)) return "200000";
        if (/식대/.test(name)) return "100000";
        if (/기준액/.test(name)) return "1000000";
        if (/한도/.test(name)) return "2000000";
        if (/최저|최소/.test(name)) return "2060000";
        if (/연령|나이/.test(name)) return "56";
        if (/정년/.test(name)) return "60";
        if (/년수|근속/.test(name)) return "8";
        if (/일수|기한/.test(name)) return "60";
        if (/율|률/.test(name)) return "0.2"; // 비율 (0~1)
        if (/평가점수|점수/.test(name)) return "82";
        if (/연차/.test(name)) return "15";
        if (/회수|회/.test(name)) return "1";
        if (/금액/.test(name)) return "500000";
        return "0";
      }
      return "";
    };
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object" || typeof v.name !== "string") return v;
      // AI 가 채워준 값이 있으면 유지 (단, 공백 문자열만 있으면 비어있는 걸로 간주)
      const existing = typeof v.test === "string" ? v.test.trim() : "";
      // select — test 는 반드시 options 안에서 (빈 값·목록 밖이면 첫 옵션)
      if (v.type === "select") {
        const opts: string[] = Array.isArray(v.options) ? v.options : [];
        if (!existing || !opts.includes(existing)) {
          return { ...v, test: opts[0] || "" };
        }
        return v;
      }
      if (existing) return v;
      return { ...v, test: defaultByKeyword(v.name, v.type) };
    });

    // ── test 값을 첫 번째 경로의 진입 조건에 맞춰 자동 보정 (미적용/fallback 방지) ──
    // 첫 경로가 활성화되도록 conditions 의 "var op val" 패턴을 보고 변수 test 값을 그 리터럴로 맞춤.
    const firstPath = (schema.paths || [])[0];
    if (firstPath && Array.isArray(firstPath.conditions)) {
      const varByName = new Map<string, any>();
      for (const v of schema.vars) if (v?.name) varByName.set(v.name, v);
      for (const c of firstPath.conditions) {
        if (!c) continue;
        const aMode = c.aMode || "var";
        const bMode = c.bMode || "var";
        // a 가 변수, b 가 리터럴이면 a 의 test 값을 b 에 맞춤
        if (aMode === "var" && bMode === "val" && typeof c.a === "string") {
          const v = varByName.get(c.a);
          if (!v) continue;
          const lit = String(c.b ?? "");
          if (!lit) continue;
          if (c.op === "==") {
            // 등가 — 그대로
            v.test = lit;
          } else if (c.op === "!=") {
            // 부등 — 현재 값이 같으면 다른 값으로 (select 는 다른 옵션, 텍스트면 "_other", 숫자면 +1)
            if (String(v.test) === lit) {
              if (v.type === "select" && Array.isArray(v.options)) {
                const alt = v.options.find((o: string) => o !== lit);
                if (alt) v.test = alt;
              } else {
                v.test = /^-?\d+(\.\d+)?$/.test(lit) ? String(Number(lit) + 1) : `${lit}_other`;
              }
            }
          } else if (/^-?\d+(\.\d+)?$/.test(lit)) {
            const n = Number(lit);
            const cur = Number(v.test);
            if (c.op === ">=" && !(cur >= n)) v.test = String(n);
            else if (c.op === ">" && !(cur > n)) v.test = String(n + 1);
            else if (c.op === "<=" && !(cur <= n)) v.test = String(n);
            else if (c.op === "<" && !(cur < n)) v.test = String(n - 1);
          }
        }
        // b 가 변수, a 가 리터럴 (드물지만 대칭으로 처리)
        if (bMode === "var" && aMode === "val" && typeof c.b === "string") {
          const v = varByName.get(c.b);
          if (!v) continue;
          const lit = String(c.a ?? "");
          if (lit && c.op === "==") v.test = lit;
        }
      }
    }
  }

  // ── 변수 필수(req) 자동 판정 — "어디서 쓰이느냐" 기반 경로별 조건부 판정 ──
  // 개인·규정 grp 무관하게 동일 규칙. 이름 패턴 매칭은 사용 안 함.
  //   • 진입 조건(어느 경로든)·공통 사전 계산에서 참조 → 필수 (모든 실행에서 라우팅·계산에 필요)
  //   • 모든 경로의 steps/report 가 공통으로 참조 → 필수
  //   • 일부 경로에서만 참조 → 선택 (그 경로로 안 가는 회사/케이스엔 불필요 —
  //     예: 정책배수는 표준액형 경로 전용인데 밴드형 회사에 "필수 누락" 으로 뜨면 안 됨)
  if (Array.isArray(schema.vars)) {
    const collectFromConds = (conds: any[] = [], into: Set<string>) => {
      for (const c of conds) {
        if (!c) continue;
        if (typeof c.a === "string" && c.aMode !== "val") into.add(c.a);
        if (typeof c.b === "string" && c.bMode !== "val") into.add(c.b);
      }
    };
    const collectFromTokens = (tokens: any[] = [], into: Set<string>) => {
      if (!Array.isArray(tokens)) return;
      for (const tok of tokens) {
        if (tok?.t === "var" && tok.name) into.add(tok.name);
      }
    };
    const collectFromSteps = (steps: any[] = [], into: Set<string>) => {
      for (const s of steps) {
        if (!s) continue;
        if (typeof s.a === "string") into.add(s.a);
        if (typeof s.b === "string") into.add(s.b);
        if (typeof s.ref === "string") into.add(s.ref);
        if (typeof s.min === "string") into.add(s.min);
        if (typeof s.max === "string") into.add(s.max);
        if (Array.isArray(s.items)) {
          for (const it of s.items) {
            if (typeof it === "string") into.add(it);
            else if (it?.ref) into.add(it.ref);
          }
        }
        // formula tokens
        collectFromTokens(s.tokens, into);
        // branch thenTok / elsTok
        collectFromTokens(s.thenTok, into);
        collectFromTokens(s.elsTok, into);
        // switch cases[].tokens 와 defaultTokens
        if (Array.isArray(s.cases)) {
          for (const c of s.cases) {
            collectFromTokens(c?.tokens, into);
          }
        }
        collectFromTokens(s.defaultTokens, into);
      }
    };
    const collectFromReport = (report: any[] = [], into: Set<string>) => {
      for (const e of report) {
        if (!e) continue;
        if (typeof e.bind === "string") into.add(e.bind);
        if (typeof e.bind2 === "string") into.add(e.bind2);
        if (Array.isArray(e.binds)) for (const b of e.binds) if (b) into.add(b);
        // note tpl 안의 {변수명} 도 사용된 변수로 카운트
        if (typeof e.tpl === "string") {
          const matches = e.tpl.matchAll(/\{([^}]+)\}/g);
          for (const m of matches) into.add(m[1]);
        }
      }
    };
    // 항상 필요한 참조 — 경로 매칭 시 모든 경로의 conditions 가 평가되고, shared 는 항상 실행됨
    const alwaysNeeded = new Set<string>();
    collectFromSteps(schema.shared?.steps, alwaysNeeded);
    for (const p of schema.paths || []) collectFromConds(p.conditions, alwaysNeeded);
    if (schema.fallback) collectFromConds(schema.fallback.conditions, alwaysNeeded);
    // 경로별 참조 (steps + report) — fallback 은 "매칭 실패 시" 전용이라 교집합 계산에서 제외
    const perPathRefs: Set<string>[] = (schema.paths || []).map((p: any) => {
      const s = new Set<string>();
      collectFromSteps(p.steps, s);
      collectFromReport(p.report, s);
      return s;
    });
    if (schema.fallback) {
      const s = new Set<string>();
      collectFromSteps(schema.fallback.steps, s);
      collectFromReport(schema.fallback.report, s);
      perPathRefs.push(s); // 참조 여부 집계에는 포함하되 "모든 경로 공통" 판정은 아래에서 일반 경로만 사용
    }
    const normalPathCount = (schema.paths || []).length;
    const referencedRequired = (name: string): boolean => {
      if (alwaysNeeded.has(name)) return true;
      if (normalPathCount === 0) {
        // 경로가 없는 특수 스키마 — 기존 동작(어디서든 참조되면 필수) 유지
        return perPathRefs.some((s) => s.has(name));
      }
      // 모든 일반 경로가 공통으로 참조할 때만 필수. 일부 경로 전용이면 선택.
      let hit = 0;
      for (let i = 0; i < normalPathCount; i++) if (perPathRefs[i].has(name)) hit++;
      return hit === normalPathCount;
    };

    // ── 앱 의도(meta) 기반 필수 판정 ──
    // 앱 개요·목적·해결문제·대상 사용자·기능·효과 텍스트에 변수 이름이 등장하면 필수로 간주.
    // → "이 앱이 무엇을 하는지" 설명에 등장하는 변수는 사용자 입력에 꼭 필요한 것.
    const metaText = [
      schema.meta?.appName,
      schema.meta?.tagline,
      schema.meta?.purpose,
      schema.meta?.problem,
      schema.meta?.users,
      ...(Array.isArray(schema.meta?.effects) ? schema.meta.effects : []),
      ...(Array.isArray(schema.meta?.features) ? schema.meta.features : []),
    ]
      .filter((s) => typeof s === "string")
      .join(" ");
    const mentionedInMeta = new Set<string>();
    for (const v of schema.vars) {
      if (!v?.name || typeof v.name !== "string") continue;
      if (metaText.includes(v.name)) mentionedInMeta.add(v.name);
    }

    // 보편 식별 변수 (성명·사번·부서·직급·생년월일·입사일) 는 도메인 무관 필수.
    const UNIVERSAL_REQUIRED = [
      /^(성명|이름|성함)$/,
      /^(사번|직원번호|사원번호|임직원번호)$/,
      /(부서|소속|본부|팀)$/,
      /(직급|직위|직책)$/,
      /^(생년월일|출생일)$/,
      /^(입사일|채용일)$/,
    ];
    const isUniversal = (name: string) =>
      UNIVERSAL_REQUIRED.some((re) => re.test(name));

    // 최종 req 판정 — 세 조건 중 하나라도 참이면 필수:
    //   (a) 분석 로직 / 리포트에서 실제 참조됨
    //   (b) 앱 meta 텍스트에 변수명이 등장 (앱 의도와 직접 관련)
    //   (c) 보편 식별 항목 (성명/사번/부서/직급/생년월일/입사일)
    schema.vars = schema.vars.map((v: any) => {
      if (!v || typeof v !== "object" || typeof v.name !== "string") return v;
      const referencedHit = referencedRequired(v.name);
      const metaHit = mentionedInMeta.has(v.name);
      const universalHit = v.grp === "개인" && isUniversal(v.name);
      return { ...v, req: referencedHit || metaHit || universalHit };
    });
  }

  // 처리 흐름 4단계 — 기본 베이스 보장
  // AI 가 빈 값/3개 이하/4개 초과로 잘못 채워도 표준 4단계로 정규화
  const FLOW_BASE = [
    "기준 지식화",
    "개인 정보 파싱",
    "적용 여부 판단·분석",
    "산출 및 안내",
  ];
  const normalizeFlow = (raw: any): string[] => {
    const arr = Array.isArray(raw) ? raw : [];
    const cleaned = arr
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
    // 4개 정확히 채워서 반환 — 비어 있거나 모자란 자리는 표준 베이스로 보강
    return [0, 1, 2, 3].map((i) => cleaned[i] || FLOW_BASE[i]);
  };

  const mergedMeta = { ...EMPTY_V5.meta, ...(schema.meta || {}) };
  mergedMeta.flow = normalizeFlow(mergedMeta.flow);

  return {
    ...EMPTY_V5,
    ...schema,
    meta: mergedMeta,
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
  const { text, finishReason } = await generate(APP_SPEC_PROMPT, fileBase64, mimeType, {
    jsonOnly: true,
  });
  let parsed = extractJson(text);
  // 1차 실패 — 안전망: 한 번 더 시도 (잘림 복구 포함). 그래도 안 되면 EMPTY 로 폴백해서
  // 빌더가 죽지 않도록 한다. 사용자는 빈 스키마에서 수동으로 채울 수 있음.
  if (!parsed) {
    console.error("parseAppSpec: invalid JSON. finishReason=", finishReason, "rawLen=", (text || "").length);
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "기획서가 너무 커서 AI 응답이 잘렸습니다. 기획서 분량을 줄이거나 핵심 부분만 업로드해 주세요."
      );
    }
    if (finishReason === "SAFETY") {
      throw new Error(
        "기획서 내용이 안전 필터에 걸렸습니다. 민감 정보를 제거한 후 다시 시도해 주세요."
      );
    }
    if (finishReason === "RECITATION") {
      throw new Error(
        "기획서 내용이 외부 출처와 유사해 차단되었습니다. 내용을 풀어서 작성한 후 다시 시도해 주세요."
      );
    }
    const preview = (text || "").slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(
      preview
        ? `AI 응답을 JSON으로 해석하지 못했습니다 (finishReason=${finishReason || "?"}). 응답 시작: "${preview}..."`
        : "AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요."
    );
  }
  // 잘림 복구로 일부만 살렸을 수 있으니 필수 키 보강
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI 응답이 객체 형태가 아닙니다.");
  }
  // 누락된 최상위 키를 EMPTY 로 보충 — withIds 후처리에서 죽지 않게
  parsed = {
    meta: parsed.meta || { ...EMPTY_V5.meta },
    vars: Array.isArray(parsed.vars) ? parsed.vars : [],
    shared: parsed.shared || { steps: [] },
    paths: Array.isArray(parsed.paths) ? parsed.paths : [],
    fallback: parsed.fallback || { ...EMPTY_V5.fallback },
  };
  return withIds(parsed);
}

// 키 정규화 — 매칭 비교용. 공백·괄호·단위표시·구두점 모두 제거 후 소문자화.
function normKey(s: any): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\([^)]*\)/g, "") // 괄호 내용 제거: "기본급(원)" → "기본급"
    .replace(/\[[^\]]*\]/g, "") // 대괄호 내용 제거
    .replace(/[\s_·\-./,:;'"`]+/g, "") // 공백·언더스코어·구두점 제거
    .toLowerCase()
    .trim();
}

// 한국어 인사 도메인 흔한 동의어 — slot 이름과 AI 가 흔히 쓰는 다른 표현 매핑
const SYNONYM_MAP: Record<string, string[]> = {
  성명: ["이름", "성함", "name", "fullname", "employeename"],
  이름: ["성명", "성함", "name"],
  사번: ["직원번호", "사원번호", "임직원번호", "employeeid", "empno", "employeeno"],
  부서: ["소속", "소속부서", "department", "dept", "team"],
  직급: ["직위", "직책", "position", "rank", "title", "jobtitle"],
  생년월일: ["birthdate", "birthday", "dob", "생일", "출생일"],
  입사일: ["hiredate", "joindate", "입사년월일", "채용일"],
  기본급: ["base", "basesalary", "basepay", "월기본급"],
  근속년수: ["근속연수", "근속기간", "근속", "tenure", "yearsofservice"],
  연차: ["연차일수", "연차잔여", "연가", "annualleave"],
  평가점수: ["평가", "고과", "score", "rating", "performance"],
  신청금액: ["신청액", "청구금액", "amount", "requestedamount"],
  신청일: ["신청날짜", "applieddate", "requestdate"],
  발생일: ["발생날짜", "이벤트일", "eventdate", "occurreddate"],
  대상자관계: ["관계", "대상자", "relation", "relationship"],
};

// AI 응답의 키를 slot 이름과 매칭 — exact → 정규화 → 동의어 순.
function findMatchingValue(parsed: Record<string, any>, slotName: string): any {
  if (slotName in parsed) return parsed[slotName];
  const target = normKey(slotName);
  if (!target) return undefined;
  // 정규화 매칭
  for (const key of Object.keys(parsed)) {
    if (normKey(key) === target) return parsed[key];
  }
  // 동의어 매칭 (양방향 — slot 이름의 동의어 또는 응답 키의 동의어)
  const slotSyns = SYNONYM_MAP[slotName] || [];
  const slotSynsNorm = new Set(slotSyns.map(normKey));
  for (const key of Object.keys(parsed)) {
    const kn = normKey(key);
    if (slotSynsNorm.has(kn)) return parsed[key];
    // 응답 키 쪽 동의어 — 응답 키가 동의어 표에 있으면 그 대표 이름과 비교
    for (const [canonical, syns] of Object.entries(SYNONYM_MAP)) {
      if (kn === normKey(canonical) || syns.map(normKey).includes(kn)) {
        if (normKey(canonical) === target) return parsed[key];
        if ((SYNONYM_MAP[canonical] || []).map(normKey).includes(target)) return parsed[key];
      }
    }
  }
  return undefined;
}

export async function parseDocument(
  fileBase64: string,
  mimeType: string,
  slots: Slot[]
): Promise<Record<string, any>> {
  if (!slots || slots.length === 0) return {};
  const slotsDesc = slots
    .map((s) => {
      const opts =
        Array.isArray(s.options) && s.options.length > 0
          ? ` — 반드시 [${s.options.map((o) => `"${o}"`).join(" | ")}] 중 하나`
          : "";
      const d = s.desc && String(s.desc).trim() ? ` :: ${String(s.desc).trim()}` : "";
      return `- "${s.name}" (${s.type}${s.unit ? ", " + s.unit : ""})${opts}${d}`;
    })
    .join("\n");
  const prompt = `아래 문서에서 다음 변수 목록의 값을 찾아 JSON으로만 반환해.
- JSON 키는 **반드시 아래 변수목록의 따옴표 안 이름과 글자 그대로 일치**해야 한다.
  ❌ 금지: "기본급(원)", "근속 년수", "성명(한글)" 같이 단위·공백·괄호 추가.
  ✅ 정확히: 목록의 이름 그대로.
- 문서에 다른 표현(예: "이름", "직원번호", "Department")이 있어도 목록의 한국어 이름으로 변환해 매칭.
- **허용값 목록이 있는 변수(select)는 값이 문서에 그 단어로 명시돼 있지 않아도, 문서가 설명하는
  운영 방식·구조를 읽고 판단(분류)해서 목록 중 하나로 채워라.**
  예: 문서가 "직급별 연봉 범위(초임~상한)를 운영한다" 고 설명하면 급여체계유형 = "밴드",
      "경력 인정 비율 100%/80%/50%" 를 설명하면 경력인정방식 = "환산율",
      "6개월 이상이면 1년으로 반올림" 이면 단수처리방식 = "반올림".
  판단 근거가 전혀 없을 때만 null. 목록에 없는 값은 절대 만들지 말 것.
- 그 외 변수는 문서에 있는 값만. 값을 못 찾으면 null. 마크다운/코드블록 없이 JSON 만.

변수목록:
${slotsDesc}

응답 형식 예시:
{ "변수명1": 값, "변수명2": null }`;
  const { text, finishReason } = await generate(prompt, fileBase64, mimeType, { jsonOnly: true });
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") {
    const preview = (text || "").slice(0, 200).replace(/\s+/g, " ").trim();
    console.error("parseDocument: invalid JSON. finishReason=", finishReason, "raw=", text);
    throw new Error(
      preview
        ? `AI 응답을 JSON으로 해석하지 못했습니다 (finishReason=${finishReason || "?"}). 응답 시작: "${preview}..."`
        : "AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요."
    );
  }
  // 유사 매칭 — exact → 정규화(공백·괄호·단위·구두점 제거) → 동의어 순으로 찾음.
  // AI 가 키를 약간 다르게 (공백·괄호·단위 추가, 동의어 사용) 내놓아도 매핑되도록.
  const out: Record<string, any> = {};
  for (const s of slots) {
    let v = findMatchingValue(parsed as Record<string, any>, s.name);
    // select — 허용값 목록 밖의 값은 차단 (프롬프트가 어겨도 코드에서 강제).
    // 공백 차이 정도는 관대하게 매칭해 목록의 표준 표기로 정규화.
    if (v != null && Array.isArray(s.options) && s.options.length > 0) {
      const norm = (x: any) => String(x ?? "").replace(/\s+/g, "").toLowerCase();
      const hit = s.options.find((o) => norm(o) === norm(v));
      v = hit ?? null;
    }
    out[s.name] = v ?? null;
  }
  return out;
}

// ───────────────────────── 앱 기획서 생성 ─────────────────────────
// 참고 문서 여러 개(규정·취업규칙·인사정보·신청서 등, 다양한 확장자)를 받아
// public/samples/spec-wagepeak-sample.pdf 를 형식 예시로, 표준 템플릿을 구조로 삼아
// "앱 기획서" 마크다운 문서를 생성한다. 결과는 빌더 "📄 기획서 업로드" 에 그대로 올려
// 5탭을 자동으로 채울 수 있다.

export interface SpecRefFile {
  fileBase64: string;
  mimeType: string;
  name: string;
}

const SAMPLE_SPEC_PATH = "public/samples/spec-wagepeak-sample.pdf";

// 다양한 첨부를 Gemini parts 로 변환 — DOCX 는 텍스트 추출, 그 외는 inlineData.
// Gemini inlineData 가 못 다루는 형식(예: 일반 텍스트가 아닌 바이너리)은 건너뛰지 않고
// 가능한 형태로 넣되, 실패는 호출부에서 처리.
async function fileToParts(f: SpecRefFile, label: string): Promise<any[]> {
  const parts: any[] = [{ text: `\n\n----- ${label}: ${f.name} -----` }];
  if (f.mimeType === DOCX_MIME) {
    const text = await extractDocxText(f.fileBase64);
    parts.push({ text: text.trim() || "(텍스트를 추출하지 못함)" });
  } else if (f.mimeType === XLSX_MIME || f.mimeType === XLS_MIME) {
    const text = await extractXlsxText(f.fileBase64);
    parts.push({ text: text.trim() || "(시트 데이터를 추출하지 못함)" });
  } else if (f.mimeType.startsWith("text/")) {
    // 일반 텍스트/마크다운 — 디코드해서 그대로 삽입
    const text = Buffer.from(f.fileBase64, "base64").toString("utf-8");
    parts.push({ text: text.trim() || "(빈 문서)" });
  } else {
    parts.push({ inlineData: { data: f.fileBase64, mimeType: f.mimeType } });
  }
  return parts;
}

async function loadSampleSpecPart(): Promise<any | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const abs = path.join(process.cwd(), SAMPLE_SPEC_PATH);
    const buf = await fs.readFile(abs);
    return {
      inlineData: {
        data: buf.toString("base64"),
        mimeType: "application/pdf",
      },
    };
  } catch (e) {
    // 샘플이 없어도 템플릿(텍스트)만으로 생성 가능 — 치명적 아님
    console.warn("loadSampleSpecPart: 샘플 PDF 로드 실패 —", (e as any)?.message);
    return null;
  }
}

const SPEC_GEN_PROMPT = `당신은 인사 자동화 마이크로 SaaS 앱의 "앱 기획서"를 작성하는 전문 기획자입니다.

아래 [참고 문서]들(회사 규정·취업규칙·운영세칙·인사정보·신청서 등)을 근거로,
이 앱이 무엇을 자동화해야 하는지 파악하여 **완결된 앱 기획서**를 작성하세요.

# 형식 — 반드시 지킬 것
- 출력은 **순수 마크다운 한국어 문서**입니다. 코드블록(\`\`\`)·설명·머리말 없이 기획서 본문만 출력하세요.
- 아래 [표준 템플릿]의 **섹션 구성·제목·표 컬럼을 그대로** 따르세요
  (1. 앱 개요 / 2. 규정 변수 / 3. 개인 변수 / 4. 분석 로직 / 5. 경로별 리포트 구성).
- 첨부된 [형식 예시 — 임금피크제 기획서 PDF]의 작성 톤·상세도를 참고하되, 내용은 반드시 [참고 문서]에서 가져오세요.

# 내용 — 반드시 지킬 것
- [대괄호] 자리표시자는 모두 실제 도메인 값으로 치환하세요. 빈 자리표시자를 남기지 마세요.
- "규정 변수"는 참고 문서에 명시된 회사 정책 값(기준액·률·연령·한도·기준일 등),
  "개인 변수"는 임직원이 입력/업로드하는 값(성명·사번·생년월일·금액·분류 등)으로 분리하세요.
- "분석 로직"은 공통 사전 계산 → 경로 1·2…(first-match) → Fallback 구조로,
  각 경로의 **조건**과 산출 단계(타입·결과변수·단위·내용)를 구체적으로 채우세요.
  각 적용 경로에는 마지막에 LLM 요약(llm) 단계를 두세요.
- "처리 흐름 4단계"는 반드시 4단계로, 1) 기준 지식화 2) 개인 정보 파싱 3) 적용 판단 4) 산출·안내 구조를 도메인화하세요.
- 참고 문서에 없는 값은 도메인 상식에 맞게 합리적으로 보완하되, 사실과 모순되지 않게 하세요.

# [표준 템플릿]
${APP_SPEC_TEMPLATE_MD}

이제 [참고 문서]를 읽고, 위 템플릿 구조를 그대로 따른 앱 기획서 마크다운을 출력하세요.`;

export async function generateAppSpecDoc(
  files: SpecRefFile[]
): Promise<{ markdown: string }> {
  if (!files || files.length === 0) {
    throw new Error("참고 문서를 1개 이상 첨부해 주세요");
  }
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 65536, temperature: 0.3, ...THINKING_CFG } as any,
  });

  const parts: any[] = [{ text: SPEC_GEN_PROMPT }];

  // 형식 예시 — 임금피크제 샘플 PDF
  const samplePart = await loadSampleSpecPart();
  if (samplePart) {
    parts.push({ text: "\n\n===== [형식 예시 — 임금피크제 기획서 PDF] =====" });
    parts.push(samplePart);
  }

  // 참고 문서들
  parts.push({ text: "\n\n===== [참고 문서] =====" });
  for (let i = 0; i < files.length; i++) {
    const sub = await fileToParts(files[i], `참고 문서 ${i + 1}`);
    parts.push(...sub);
  }

  const res = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const candidate = res.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  let markdown = (res.response.text() || "").trim();

  // 혹시 코드펜스로 감쌌으면 제거
  markdown = markdown
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!markdown) {
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "참고 문서가 너무 많아 응답이 잘렸습니다. 문서 수나 분량을 줄여 주세요."
      );
    }
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      throw new Error(
        "문서 내용이 안전·인용 필터에 걸렸습니다. 민감 정보를 제거한 후 다시 시도해 주세요."
      );
    }
    throw new Error("AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.");
  }
  return { markdown };
}

// ─────────────────────────────────────────────────────────────────
// 앱 기획서 프리뷰 — 탭별로 어떤 값이 들어갈지 + 왜 그런지 보여주는 구조화된 응답
// 마크다운 문서가 아니라 빌더 5탭(0~4)에 매핑되는 JSON.
// ─────────────────────────────────────────────────────────────────

export interface SpecPreviewVar {
  name: string;
  grp: "규정" | "개인";
  type: "number" | "text" | "date" | "select";
  unit?: string;
  value?: string; // 참고 문서에서 발견한 값(있다면)
  category: "핵심" | "기타"; // 도메인 핵심인지, 부수적인지
  source: string; // 어느 문서에서 가져온 것 (예: "참고 문서 1: 취업규칙.docx" 또는 "도메인 상식")
  reason: string; // 왜 이 변수를 선언했는지 / 왜 기타로 분류했는지
  desc?: string; // 사용자에게 보여줄 한 줄 설명
  options?: string[]; // type="select" 전용 — 허용값 목록
  group?: string; // 상위 분류 (예: "경조사", "급여", "휴가")
  subGroup?: string; // 하위 분류 (예: 경조사 > "결혼", "사망", "회갑")
}

export interface SpecPreviewStep {
  name: string;
  type: string;
  expression: string;
  reason?: string; // 이 step 이 비즈니스적으로 왜 필요한지 (1~2 문장)
  // switch 의 경우: cases 에 매칭값 + 출력 변수명
  // ref 도 명시 가능 — AI 가 의도한 분류 변수명
  ref?: string;
  cases?: { match: string; outputVar?: string; outputNum?: number; outputText?: string }[];
  // formula 의 경우: 사용할 변수명들 (산식 표현은 "A * B + C" 형태로 expression 에)
  vars?: string[];
  // date 의 경우: 두 날짜와 출력 단위
  a?: string;
  b?: string;
  out?: "year" | "month" | "day";
  // llm 의 경우: 요약 대상 변수/산출 이름들
  items?: string[];
}
export interface SpecPreviewPath {
  label: string;
  conditions: string[]; // 사람이 읽을 수 있는 자연어 조건 (예: "만나이 56 이상")
  steps: SpecPreviewStep[];
  reason: string;
  source: string;
}

export interface SpecPreviewReportItem {
  kind: string;
  label: string;
  bind?: string;
  bind2?: string; // 비교형 차트(comparison/delta/bullet/ratio)의 두 번째 값
  ctype?: string; // chart 세부종류 (gauge/bar/step/donut/ratio/bullet/stacked/comparison/delta)
  reason: string;
}

export interface AppSpecPreview {
  meta: {
    appName: string;
    tagline: string;
    purpose: string;
    problem: string;
    users: string;
    security: string;
    effects: string[];
    features: string[];
    flow: string[];
    rationale: string; // 왜 이 메타 구성인지
    sources: string[]; // 참조 문서들
  };
  vars: SpecPreviewVar[]; // 규정/개인 + 핵심/기타 분류 모두 포함
  shared?: { steps: SpecPreviewStep[] }; // 공통 사전 계산 (모든 경로가 공유)
  paths: SpecPreviewPath[];
  fallback: { label: string; reason: string };
  report: {
    pathLabel: string;
    elements: SpecPreviewReportItem[];
    reason: string;
  }[];
  rationale: {
    overall: string; // 전체 설계 핵심 요약 — 왜 이렇게 구성했는지
    perDocument: { name: string; contribution: string }[]; // 각 문서가 어디에 기여 — 누락 없이 모든 문서가 등장해야 함
    others: { name: string; reason: string }[]; // 기타로 분류된 항목과 그 이유
  };
}

const SPEC_PREVIEW_PROMPT = `당신은 인사 자동화 마이크로 SaaS 앱 빌더의 "기획 분석가" 입니다.

여러 [참고 문서] (회사 규정·취업규칙·운영세칙·인사정보·신청서·임금테이블 등) 를 읽고,
**범용적으로 쓸 수 있는** 인사 자동화 앱을 어떻게 구성할지 — 빌더의 **탭별로** 어떤 값이 들어갈지를 분석해
**오직 JSON** 으로 반환하세요 (마크다운/코드블록 금지).

# ⚠ 도메인 중립 — 가장 중요
- 인사 도메인은 **경조사 외에도** 임금피크제·성과급·승진·평가·휴가·근태·교육·보상·징계·복리후생·퇴직 등 **수십 가지** 가 있다.
- 아래 예시에 경조사가 자주 등장한다고 해서 **모든 분석을 경조사에 끼워 맞추지 말 것**. 업로드된 문서의 실제 도메인을 그대로 분석하라.
- 문서의 실제 도메인이 무엇인지 (예: 임금피크제·승진심사·휴가신청 등) 를 먼저 파악한 뒤 그 도메인 용어·구조로 결과를 채워라.
- "경조이벤트유형", "대상자관계" 같은 용어는 경조 도메인에만 의미가 있음 — 다른 도메인에는 그 도메인의 자연스러운 용어 사용.

# 핵심 원칙

1. **문서 간 공통성 우선** — 핵심 분류의 1차 기준은 **참고 문서 여러 개에 (의미적으로) 공통 등장** 하는지.
   - **2개 이상 문서에 등장** → 핵심
   - **1개 문서에만 등장하는 부수 항목** → 기타 (의미상 진짜 도메인 핵심이라도 보수적으로 기타)
   - **인사 도메인 보편 필수 항목** (성명·사번·기본정보 등) → 단 1개 문서에만 있어도 핵심 (도메인 상식 보강 가능)
   기준이 흔들릴 때는 **"여러 문서에 동시에 등장한 패턴인가?"** 를 먼저 묻고, 아니면 기타로 보내라.
   사용자는 너무 광범위한 핵심보다 **핵심은 적고 정확하게, 기타로 자유롭게 빼는 것** 을 선호한다.

1.5. **모든 문서를 빠짐없이 읽어 공통 패턴 추출 — 가장 중요한 목표**
   - 첨부된 **모든 문서를 처음부터 끝까지** 깊이 읽어라. 첫 번째 문서에만 의존하지 말 것.
   - 짧은 문서·표 형식(엑셀)·이미지 문서도 동등하게 분석. 길이나 형식으로 우선순위 두지 말 것.
   - 목표는 **편향 회피가 아니라 "공통/범용 패턴 최대 추출"** — 한 문서에 많이 의존해도 그 문서가 핵심을 잘 담고 있으면 OK.
   - 단, 다른 문서에 있는 유용한 패턴을 놓치면 안 됨. 모든 문서에서 한 번씩은 변수·로직을 끌어와라.
   - **여러 문서에 의미적으로 공통 등장하는 항목** 을 가장 우선 채택 → 핵심으로 분류.
   - 한 문서에만 강력하게 등장하지만 다른 문서엔 없는 항목 → 기타로 (단, 보편 필수 항목은 예외).
   - rationale.perDocument 에 각 문서의 기여를 명시 — 모든 문서가 빠짐없이 등장해야 함 (기여 없으면 "해당 도메인 무관" 이라도 명시).
2. **출처(source) 명시** — 모든 변수·경로·리포트 요소에 어느 참고 문서에서 가져왔는지 기재.
   "참고 문서 1: 임금테이블.xlsx" 형태. 도메인 상식으로 보완했다면 "도메인 상식".
3. **이유(reason) 명시** — 왜 이 값을 이렇게 선언했는지 1~2 문장으로 설명.
   기타로 분류한 경우는 "왜 핵심이 아닌지" 명시.
4. **핵심 요약(rationale)** — 전체 설계 의도, 각 문서의 역할, 기타 분류 사유를 종합.

# 공통 구조 추출 원칙 (매우 중요) — 의미론적 매칭으로 분해·통합

## 분석 절차 — 모든 문서를 보고 공통 패턴 식별
1) **각 문서를 처음부터 끝까지** 한 번씩 읽고 등장하는 변수·정책·계산을 도출하라.
2) 모든 문서에서 도출된 항목들을 모아서 **공통점/차이점** 분석:
   - 두 문서 이상에 의미적으로 같은 항목 → 공통 패턴, 핵심으로
   - 한 문서에만 있는 항목 → 그 도메인 특수성이거나 부수적, 기타로
   - 보편 인사 항목(성명·사번 등) → 공통 여부 무관하게 핵심
3) **공통 패턴이 풍부할수록 좋은 결과** — 적극적으로 의미론적 매칭으로 통합해 공통성 찾기.

## 총 금액 우선 — 범용성 우선 (매우 중요)

여러 출처(회사지급·상조회지급·공제회 등) 별로 분해 가능한 금액이 문서에 있어도,
**기본은 "총 지급액" 하나로** 변수를 만들어라. 출처별 분해는 도메인이 명시적으로 요구할 때만.

이유: 회사마다 운영 구조가 다름.
- A 회사: 회사 단독 지급
- B 회사: 회사 + 상조회 합산
- C 회사: 회사 + 공제회 + 상조회 합산

→ 같은 도메인 앱이라도 회사 구조 따라 "출처" 가 달라짐. 출처별 변수로 쪼개면 다른 회사에서 못 씀.
→ **출처에 관계없이 "결혼 시 본인이 받는 총액"** 이 진짜 의미 있는 변수.

### 예시 — 결혼 지원금
문서 A:
| 분류 | 회사 지급 | 상조회 지급 |
|---|---|---|
| 본인 | 1,000,000 | 200,000 |

❌ 분해 변수 (출처별):
- \`결혼_본인_회사지원금\` = 1,000,000
- \`결혼_본인_상조회지원금\` = 200,000

✅ 총액 변수 (범용):
- \`결혼_본인\` = 1,200,000 (총액)
- reason: "본인 결혼 시 총 지급액 (회사 1,000,000 + 상조회 200,000)"
- 도메인 상식: 다른 회사는 출처가 달라도 "본인 결혼 시 받는 총액" 은 똑같이 쓸 수 있음

### 출처 분해를 해야 하는 경우 (예외)
다음 모두에 해당할 때만 출처별로 분해:
1. **문서가 출처 분해를 명시적으로 강조** ("회사 지원과 상조회 지원을 별도 명시한다" 같은 문구)
2. **출처별로 지급 시점·신청 절차·세무 처리가 다름** (단순 합산이 아닌 별도 산출 필요)
3. **사용자에게 출처별 내역을 보여주는 게 본 앱의 핵심 가치** (단순 안내가 아닌 회계 추적 용도)

이 셋 다 만족 안 하면 → **총액 변수 1개** 로.

## 열린 목록 — 회사마다 나열이 달라지는 항목은 분류값 변수로 펼치지 말 것 (매우 중요)

"분류별 값" 패턴은 **분류값이 보편적일 때만** (결혼/사망/출산, 본인/배우자/자녀 — 어느 회사나 같은 축) 쓴다.
**자격증·품목·정책코드처럼 회사마다 목록 자체가 달라지는 "열린 목록"** 은 개별 항목을 변수로 만들면
그 회사의 예시가 변수 정의에 박제되어 다른 회사에서 못 쓴다.

❌ 나쁜 예 (문서의 수당표: 정보보안기사=월10만, PMP=월15만):
- \`수당_정보보안기사_지급액\`, \`수당_PMP_지급액\` — 특정 자격명이 변수명에 박힘. 다른 회사는 자격 목록이 다름.

✅ 좋은 예:
- 개인 변수 \`보유자격\` (text — 자격 목록 입력) + 결과 총액 \`자격수당가산액\` (number, 연간) 하나.
- 항목별 대조·내역은 LLM 안내 단계가 설명 (산출은 총액으로).

판별법: "이 분류값 목록이 다른 회사에도 그대로 있을까?" — 아니오(회사별 상이) → 열린 목록 → 총액 변수 1개.

## 의미론적 매칭 — 글자가 달라도 의미가 같으면 같은 것으로 취급
참고 문서 여러 개가 **글자는 다르지만 의미가 같은 항목**을 다룰 때, 단순히 두 변수로 따로 만들지 말고
**의미상 통일된 하나의 구조**로 합쳐라.

매칭 기준:
- 표현이 달라도 **같은 개념** 이면 같은 것: "축의금" = "결혼지원금" = "결혼축하금", "조위금" = "조의금" = "부의금"
- **같은 분류 축** 이면 같은 분류 변수로: 문서 A 의 "본인/배우자/자녀" 와 문서 B 의 "본인/배우자/자녀/형제자매" 는
  같은 "대상자관계" 축. 더 큰 범위로 통합 (본인·배우자·자녀·형제자매·직계존속·배우자직계존속 등).
- **단위·수치만 다른 같은 항목** 이면 같은 변수: 문서 A 의 "사망조위금 500,000원" 과 문서 B 의 "사망부의금 300,000원" 은
  같은 "사망조위금기준액". 두 변수로 쪼개지 말 것.

## 구조 분해 — "분류별 다른 값" 패턴은 "분류 변수 + 분류별 값 변수들" 로

문서에 **분류 × 값** 표가 있으면 (예: 본인결혼 / 자녀결혼 / 형제자매결혼 각각 다른 금액),
다음 두 종류의 변수로 분해해라 — 절대 한 덩어리로 두지 말 것.

### (1) 개인 변수 1개 — **분류 축** (구분용)
- name: 무엇을 구분하는지 명확히 (예: \`경조분류\`, \`대상자관계\`, \`사유구분\`)
- type: "text"
- 임직원이 선택/입력하는 값 — 문서에 나온 모든 분류값을 reason 에 후보로 나열
  (예: reason: "본인결혼·자녀결혼·형제자매결혼·배우자결혼 중 1개 선택")

### (2) 규정 변수 N개 — **분류별 정책값** 각각 하나씩
- name: **도메인_분류_(세부)** 순서로. 정책 키워드(축의금/조위금/지원금) 가 있으면 맨 뒤에 세부로.
- type: "number", unit: "원"
- value: 문서에 적힌 금액 (없으면 빈 값, source 를 "도메인 상식" 으로)
- 분류값마다 빠짐없이 — 한 분류라도 있으면 모든 분류에 대해 변수 선언

### 예시 — 결혼 축의금 (1차원 분기)
| 대상자관계 | 금액 |
|---|---|
| 본인 | 1,000,000 |
| 자녀 | 500,000 |
| 형제자매 | 200,000 |

→ 변수 결과:
- 개인 변수: \`대상자관계\` (type=text) — "본인/자녀/형제자매 중 선택"
- 규정 변수: \`결혼_본인\` (number, 원, 1000000)
- 규정 변수: \`결혼_자녀\` (number, 원, 500000)
- 규정 변수: \`결혼_형제자매\` (number, 원, 200000)

분석 로직: switch(ref=대상자관계, "본인"→결혼_본인, "자녀"→결혼_자녀, ...)

### 예시 — 2차원 분기 (분류 × 종류)
| 대상자관계 | 회사지원금 | 상조회지원금 |
|---|---|---|
| 본인 | 1,000,000 | 200,000 |
| 자녀 | 500,000 | 100,000 |

→ 변수 결과 (이름 패턴: \`결혼_<분류값>_<종류>\`):
- 개인 변수: \`대상자관계\` (text)
- 규정: \`결혼_본인_회사지원금\`, \`결혼_본인_상조회지원금\`
- 규정: \`결혼_자녀_회사지원금\`, \`결혼_자녀_상조회지원금\`
- 규정: \`결혼_형제자매_회사지원금\`, \`결혼_형제자매_상조회지원금\`

분석 로직: switch 2개 — 회사지원금용 1개 + 상조회지원금용 1개
- switch "회사지원금산출" ref=대상자관계 ("본인"→결혼_본인_회사지원금, "자녀"→결혼_자녀_회사지원금, ...)
- switch "상조회지원금산출" ref=대상자관계 ("본인"→결혼_본인_상조회지원금, ...)
- formula "최종지원금" = 회사지원금산출 + 상조회지원금산출

⚠ **변수명은 반드시 "도메인_분류값" 또는 "도메인_분류값_종류" 순서로**. 종류가 먼저 오면 자동 분기 매칭이 안 됨.
   ❌ \`회사지원금_결혼_본인\`, \`상조회지원금_결혼_본인\`  → 매칭 실패
   ✅ \`결혼_본인_회사지원금\`, \`결혼_본인_상조회지원금\`  → 자동 매칭 성공

### 다른 흔한 패턴 예시
- 직급별 회비 → \`직급\` (개인 text) + \`회비_사원\`·\`회비_대리\`·\`회비_과장\` (규정)
- 등급별 기준액 → \`평가등급\` (개인 text) + \`상여_S\`·\`상여_A\`·\`상여_B\` (규정)
- 근속별 가산금 → \`근속년수\` (개인 number) + 구간이 연속이면 table 로 (변수 분해 X)

## 문서 간 통합
같은 분류 축이 두 문서에 나뉘어 있어도 **하나의 분류 변수**로. 분류값 후보는 두 문서의 합집합.
같은 정책값이 두 문서에 중복이면 더 최신/구체적인 쪽 채택 (source 에 두 문서 모두 명시).

## 계층 분류(group/subGroup) — 같은 도메인 묶음끼리 묶기

규정 변수가 많아질 때 사용자가 빌더에서 빠르게 찾을 수 있도록 **상위 > 하위** 2단계 계층으로 분류해라.

### 형식
- \`group\` — 상위 분류 (예: "기본정보", "경조사", "급여", "휴가", "평가", "복리후생", "퇴직")
- \`subGroup\` — 하위 분류 (예: 경조사 > "결혼", "사망", "회갑", "출산")
- 같은 의미·도메인의 변수들은 **반드시 같은 group/subGroup** 으로 묶기
- ⚠ **모든 변수는 group 이 채워져야 한다**. "기타 (분류 없음)" 으로 떨어지지 않도록.

### 보편 식별 변수는 항상 group="기본정보", subGroup="" (필수)
임직원 식별·인사정보 변수는 도메인과 무관하게 **반드시 group="기본정보", subGroup=""** 로 분류하라.
하위 묶음은 만들지 말 것 — 항목이 적어 평탄 표시가 깔끔.

대상 항목:
- **성명, 사번, 이름**
- **부서, 소속, 본부, 팀**
- **직급, 직위, 직책**
- **생년월일, 출생일**
- **입사일, 채용일**
- **연락처/이메일/주소** 같은 메타데이터

이들은 어느 도메인 앱이든 사용자 식별 단계에서 입력되며, 도메인 분류와 섞이면 안 됨.

### 예시 — 경조사 도메인

| name | group | subGroup |
|---|---|---|
| 본인결혼축의금 | 경조사 | 결혼 |
| 자녀결혼축의금 | 경조사 | 결혼 |
| 형제자매결혼축의금 | 경조사 | 결혼 |
| 본인사망조위금 | 경조사 | 사망 |
| 배우자사망조위금 | 경조사 | 사망 |
| 직계존속사망조위금 | 경조사 | 사망 |
| 본인회갑축하금 | 경조사 | 회갑 |
| 본인출산축하금 | 경조사 | 출산 |
| 자녀출산축하금 | 경조사 | 출산 |

→ 빌더에서 "경조사" 묶음 펼치면 결혼/사망/회갑/출산 4개 하위, 각각 안에 금액 변수들이 정리됨.

### 예시 — 급여·평가 도메인

| name | group | subGroup |
|---|---|---|
| 기본급 | 급여 | 기본급 |
| 직책수당 | 급여 | 수당 |
| 식대 | 급여 | 수당 |
| 야간근로수당 | 급여 | 수당 |
| 명절상여 | 급여 | 상여 |
| 성과급 | 급여 | 상여 |
| S등급상여 | 평가 | 등급별상여 |
| A등급상여 | 평가 | 등급별상여 |

### 개인 변수에도 적용 가능
개인 변수도 같은 도메인 묶음끼리 group/subGroup 으로 묶어라.
예: \`결혼분류\`(경조사 > 결혼), \`사망분류\`(경조사 > 사망), \`결혼발생일\`(경조사 > 결혼).

### 원칙
- 분류별 정책값 변수들(앞 절의 분해 결과)은 모두 같은 group/subGroup 에 속해야 한다.
- 같은 분류 묶음은 한 번에 한 곳에서 보일 수 있어야 한다 (사용자 검색·검토 편의).
- 계층이 의미 없으면 비워라 — 억지로 묶지 말 것.

# 공통 패턴 참고 — 인사 자동화 앱에 흔히 등장. 단, 핵심 포함 여부는 **문서 간 공통성** 원칙(위 원칙 1) 으로 결정.
# 아래는 "이런 게 있나 점검해보라" 는 참고이지 강제 포함이 아니다.
# 한 문서에만 있는 항목은 보편 식별(성명·사번 등) 외에는 모두 기타로.

# 🔑 grp(규정/개인) 분류 판단 — 문서가 명확히 안 나눠줘도 의미로 판단하라
#  - **개인**: 사람마다 다른 값 = 임직원이 입력/업로드하거나 그 사람 데이터에서 도출되는 값.
#    예: 성명·사번·생년월일·입사일·기본급·직급·**만나이(생년월일에서 도출)·근속년수·평가점수**.
#  - **규정**: 회사가 정한 모두에게 같은 정책 상수.
#    예: 최저임금·**최초적용연령·정년**·기준액·한도·감액률·가산율·기준근속년수.
#  - ⚠ 헷갈리면 "이 값이 사람마다 다른가(개인), 회사가 고정했나(규정)?" 를 물어라.
#    특히 '만나이/나이/연령' 은 그 사람 나이(개인)이고, '적용연령/정년' 은 정책 임계값(규정) — 섞지 말 것.

# 🎯 예시값(value) 채우기 — 결과 화면이 "미적용" 으로 빠지지 않게 (매우 중요)
#  - 개인 변수의 value 는 **현실적인 예시 1건**으로 반드시 채워라 (빌더 미리보기·결과 화면에서 사용).
#  - ⚠ **반드시 첫 번째 적용 경로(paths[0]) 의 진입조건을 모두 만족하는 값**으로 채워라 — 미적용(fallback) 으로 빠지면 산출값이 다 "—" 로 나옴.
#    예: 진입조건이 "만나이 >= 56" 이면 → 생년월일을 만 56세 이상이 되는 날짜(예: 1966-03-10)로. (만나이는 생년월일에서 도출되니 역산해서 채움)
#    조건이 "직군 == \"사무직\"" 이면 → 직군 value 를 "사무직" 으로.
#  - 모든 개인 변수 value 가 **서로 일관된 한 사람의 케이스**여야 한다 (한 시나리오로).
#  - 규정 변수 value 는 문서의 정책값 그대로.

## 임직원 기본 식별·인사정보 (개인 · 핵심)
- **성명, 사번** — 거의 모든 앱의 식별 키. 누락 금지.
- **부서/소속, 직급/직위** — 거의 모든 앱에서 분류·표시에 사용.
- **생년월일, 입사일** — 만나이·근속 계산에 자주 사용. 도메인이 명백히 무관해도 일단 포함.

## 임직원 급여·평가 (개인 · 도메인에 따라 핵심)
- **기본급, 통상임금** — 금액 산출 도메인이면 핵심.
- **평가점수, 등급** — 인사평가·성과 도메인이면 핵심.
- **연차/근속년수** — 휴가·근태·승진 도메인이면 핵심.

## 신청·증빙 (개인 · 적용 도메인이면 핵심)
- **신청일, 발생일, 신청금액, 대상자관계** — 복리후생/경조/지원금 신청 도메인이면 핵심.

## 회사 정책 기준값 (규정 · 핵심)
- **기준액·기준일·한도·최저·최고** — 도메인 금액·기간 계산이 있으면 반드시.
- **연령 기준, 근속 기준, 정년** — 자격 판단이 있으면.
- **률·비율·감액률·가산율** — 차등 적용이 있으면.
- **운영모델·등급기준** — 회사별 정책 분기.

## 처리 흐름 (paths) — 공통 패턴
- 경로 개수는 **분기축의 분류값 개수에 맞춘다**: 이벤트유형/신청구분 등 경로 분기축이
  문서에서 N개 값을 가지면 **N개 적용 경로 + Fallback**. (단일 판정 도메인이면 1경로 + Fallback)
- 각 경로의 conditions 는 AND, 위에서부터 first-match — 좁은 조건이 위로.
- 적용 경로마다 마지막에 LLM 분석 단계.

## 리포트 (report) — 목적·경로 기반 설계 원칙 (매우 중요)

리포트는 **분석 로직이 산출한 값들을 사용자에게 보여주는 결과 화면**이다.
- **분석 로직에서 산출한 값들을 최대한 card 로 노출**하라 (중간 산출도 의미 있으면 보여줌).
- **앱의 목적 = 최종 결과물(마지막 산출 step)은 반드시 포함**하라 — 빠지면 안 됨.
- **그 결과 값이 산출된 핵심 산식은 calc 로 함께 보여줘라** (예: calc bind=피크임금 → "통상임금 × (1-감액률) = 4,400,000").
  사용자가 "이 값이 어떻게 나왔는지" 를 이해하도록. (calc 는 formula step 에만 의미 있음)
- **참고 문서에 그래프·표·산출식이 있고 우리가 파싱한 값으로 만들 수 있으면 최대한 리포트로 재현하라:**
  • 문서의 **구간표/곡선 graph**(예: 연령별 감액 곡선) ↔ table step → **chart** (ctype="gauge", 구간 내 위치)
  • 문서의 **구성요소 표**(예: 통상임금 = 기본급+수당) ↔ classify step → **incexc** (포함/제외 명세)
  • 문서의 **산출식** ↔ formula step → **calc**
  같은 step 을 값(card)·식(calc)·구성(incexc)·곡선(chart) 등 **여러 뷰로 보여주는 건 중복 아님** (서로 다른 정보).
- 단, **같은 값을 같은 팔레트로 두 번** 보여주는 것만 금지 (예: 같은 산출을 card 두 개로). 한 종류당 한 번만.
리포트는 사용자가 결과 화면에서 4 가지 질문에 답을 얻는 도구다:

  Q1. "이 결과가 누구의 것인가?"          → **fields** (식별 정보, 거의 항상)
  Q2. "내 결과가 뭔가?"                   → **card** 또는 **note** (핵심 답)
  Q3. "왜 그런가?"                        → **note** 또는 **compare** (필요할 때만)
  Q4. "이제 뭘 해야 하나?"                → **note** tpl 의 안내 (필요할 때만)

### Step 1. 이 경로의 목적·맥락 먼저
"이 경로가 활성화됐을 때 임직원에게 **단 하나만 알린다면** 그게 뭔가?"
그 한 가지가 리포트의 중심이 되어야 한다.

### Step 2. 그 한 가지를 어떻게 보여줄지 결정
- 숫자/금액 한 줄로 강조 → **card 1개** (bind=핵심 산출 step)
- 자연어 설명이 더 어울림 → **note 만**
- 분기 결과 라벨이 핵심 → **card** (bind=switch step)

### Step 3. 보조 정보 — **명분이 있을 때만 추가**
요소를 추가할 때마다 "이게 없으면 사용자가 헷갈리나?" 자문하라.
명분 없으면 빼라.

| element | 추가하는 경우 | 추가하지 말 것 |
|---|---|---|
| **fields** | 거의 항상 (사용자 식별) | 단일·익명 시나리오 |
| **note**   | 거의 항상 (결과·안내) | — |
| **card**   | 헤드라인 숫자/라벨 1~2 개 | 비핵심 중간 산출 |
| **compare**| 자격 판정이 핵심이고 조건이 복잡할 때 | 조건이 단순하거나 안내문에 풀어쓰면 충분할 때 |
| **chart**  | 시각적 위치·범위·비율이 직관에 명백히 도움될 때 (예: 평가점수 게이지, 구간표 위치) | 단순 숫자 — card 가 더 명확함 |
| **calc**   | 사용자가 산식을 직접 알고 싶어 하는 도메인 (예: 세금·임금 명세) | 대부분의 도메인 — 결과만 보면 충분 |
| **incexc** | 포함/제외 항목 자체가 결과의 일부 (예: 통상임금 구성요소 명세) | 합산 결과만 중요한 경우 |
| **pathlabel** | 적용 경로 라벨을 결과 화면 상단에 보여 줘야 할 때 | 경로 1개거나 fields 라벨로 대체 가능할 때 |

### Step 4. note 안내문 디자인
- 경로 안에 LLM 분석 step 이 있으면 → tpl="{LLM 분석}"
- 없으면 → 핵심 변수 조합 명확한 문장 (예: "{성명} 님의 {경조분류} 케이스에 {최종지원금} 지원 안내")
- fallback 경로면 → 정적 문구 ("해당 케이스는 본 앱 적용 대상이 아닙니다")

### Step 5. **선언된 개인 변수의 전체적 활용** (중요)
사용자가 입력·업로드한 개인 변수를 리포트에서 충분히 활용하라 — 파싱만 되고 어디에도 안 보이는 변수는 사용자 입장에서 "왜 입력했지?" 가 됨.

- **fields(묶음) 의 binds 는 식별 정보만**: 성명·사번·부서·직급 같은 기본 식별 4~5개. 다른 항목까지 다 묶지 말 것.
- **그 외 개인 변수는 개별 field 로**: 한 변수 한 박스. 예: 발생일·신청일·대상자관계 같은 항목은 각각 \`field\` 로 추가.
- **note tpl 에 변수 인용을 적극적으로**: "{성명} 님의 {대상자관계} {경조이벤트유형} 케이스에 {최종지원금} 지원" 같이 본인 컨텍스트 풀어쓰기.
- **card 는 핵심 산출 결과 한두 개만**: 사용자가 입력한 분류값(대상자관계 등)은 card 보다 단일 field 로 충분.
- **유휴 변수 점검**: 이 경로에서 사용자가 입력한 개인 변수 중 리포트에 한 번도 안 나오는 게 있으면, **개별 field 로 추가**하거나 **note tpl 에 인용**해라.
- 단, "전체" 가 "전부" 는 아님 — 의미 없는 항목(예: 비상연락처 같은 메타데이터)은 빼는 게 낫다.

### Step 6. 정렬
report 배열 순서: fields → note → card → 나머지 (compare/chart/calc/incexc) → pathlabel

## 리포트 자가 검토 (출력 전)
1. **각 요소의 명분을 한 줄로 말할 수 있나?** 말할 수 없으면 빼라.
2. **fields 와 note 가 있는가?** 없으면 추가 (안전망).
3. **chart/calc/incexc/compare 가 단지 step 이 있어서 추가된 건 아닌가?** 사용자에게 정말 도움되는지 확인.
4. **리포트가 한눈에 답이 보이는가?** 카드·차트가 너무 많아 핵심이 묻히지 않는가? — 줄여라.
5. **개인 변수 전체적 활용 — 사용자가 입력한 핵심 개인 변수 중 리포트에 한 번도 안 나오는 게 있나?**
   있으면 **개별 field 로 추가**하거나 **note tpl 에 인용**. fields(묶음) binds 에 다 욱여넣지 말 것.
   (단, 메인 흐름과 무관한 메타성 항목은 제외)

원칙:
- fields(묶음) = 식별 정보(성명/사번/부서/직급) 만, 4~5개 선에서
- 그 외 의미 있는 개인 변수 = 개별 field 1개씩
- elements 자체 개수가 좀 많아져도 OK — 사용자에게 자기 입력값이 결과에 잘 반영됐다고 느끼는 게 우선.

# 출력 스키마

{
  "meta": {
    "appName": "...",
    "tagline": "...",
    "purpose": "...",
    "problem": "...",
    "users": "...",
    "security": "...",
    "effects": ["...", "...", "..."],
    "features": ["...", "...", "..."],
    "flow": ["기준 지식화 도메인 표현", "개인 정보 파싱 도메인 표현", "적용 판단 도메인 표현", "산출 및 안내 도메인 표현"],
    "rationale": "왜 이 앱 개요로 구성했는지 — 1~2 문장",
    "sources": ["참고 문서 1: ...", "참고 문서 2: ..."]
  },
  "vars": [
    {
      "name": "변수명_공백없이",
      "grp": "규정" | "개인",
      "type": "number" | "text" | "date" | "select",
      "unit": "원" | "" | "년" | ...,
      "value": "규정변수=문서의 정책값. 개인변수=현실적 예시 1건(아래 ⚠ 규칙대로 채움)",
      "category": "핵심" | "기타",
      "source": "참고 문서 N: 파일명 또는 도메인 상식",
      "reason": "이 변수를 선언한 이유 — 1~2 문장. 기타면 왜 핵심이 아닌지.",
      "desc": "사용자에게 보여줄 한 줄 설명 — 이 변수가 무엇인지 (예: '기본급 산정 방식(분기축)')",
      "options": ["select 타입 전용 — 허용값 목록. 예: \\"밴드\\",\\"호봉\\",\\"표준액\\",\\"미운영\\""],
      "group": "상위 분류 (선택) — 예: '경조사', '급여', '휴가', '평가', '복리후생'",
      "subGroup": "하위 분류 (선택) — 예: 경조사 > '결혼', '사망', '회갑', '출산'"
    }
  ],
  // ⚠ type="select" — **문서가 허용값 목록을 명시한 변수만** (「값: A/B/C」 표기 또는 후보가 표로 열거된 경우).
  //   options 는 문서에 명시된 후보 그대로 — **문서에 없는 후보를 지어내지 말 것** (발명 금지).
  //   select 변수의 desc 끝에는 「값: A/B/C」 표기를 그대로 포함하라.
  //   여러 건을 입력하는 목록 항목(경력내역·보유자격·품목 목록 등)은 select 금지 — text 로.
  //   문서에 후보 목록이 없으면 text 로 두되, value 는 문서 내용으로 판단해 채워도 된다.
  "paths": [
    {
      "label": "결혼 경조사",
      "conditions": ["경조이벤트유형 == \"결혼\""],
      "steps": [
        // 각 step 마다 reason 에 비즈니스 맥락 명시 — "왜 이 단계가 필요한가" 답하라.
        // ref/cases/vars 필드를 명시적으로 채워라 (변수명만 적지 말고 의도를 같이).
        {
          "name": "결혼축의금 산출",
          "type": "switch",
          "expression": "대상자관계 값에 따라 결혼축의금 정책액을 선택",
          "reason": "결혼 축의금은 신청자의 대상자 관계(본인/자녀/형제자매)에 따라 정책 금액이 다르므로 분류값별 정책금액을 선택해야 함",
          "ref": "대상자관계",
          "cases": [
            { "match": "본인",     "outputVar": "결혼축의금_본인" },
            { "match": "자녀",     "outputVar": "결혼축의금_자녀" },
            { "match": "형제자매", "outputVar": "결혼축의금_형제자매" }
          ]
        },
        {
          "name": "신청 경과일",
          "type": "date",
          "expression": "발생일 ↔ 신청일 사이 일수",
          "reason": "신청가능기한 안에 들어왔는지 판단하기 위해 발생일과 신청일 간격을 계산",
          "a": "발생일", "b": "신청일", "out": "day"
        },
        {
          "name": "LLM 분석",
          "type": "llm",
          "expression": "산출 결과들을 자연어 안내문으로",
          "reason": "임직원에게 산출 금액·근거를 친절한 한 문단 안내문으로 전달"
        }
      ],
      "reason": "결혼 경조 신청 시 대상자 관계에 따라 차등 지급되는 축의금을 산출하기 위한 경로",
      "source": "참고 문서 1: 복리후생규정.pdf"
    }
  ],
  "fallback": {
    "label": "미적용",
    "reason": "어떤 케이스가 fallback 으로 빠지는지"
  },
  "report": [
    {
      "pathLabel": "가산형 적용 (만 56~58)",
      "elements": [
        { "kind": "fields", "label": "기본정보", "bind": "성명,사번,부서,직급", "reason": "..." },
        { "kind": "note", "label": "안내문", "bind": "{LLM분석}", "reason": "..." },
        { "kind": "card", "label": "감액률", "bind": "감액률", "reason": "..." }
      ],
      "reason": "이 경로의 리포트를 이렇게 구성한 이유"
    }
  ],
  "rationale": {
    "overall": "전체 설계 핵심 요약 — 왜 이 구조로 만들었는지 3~5 문장",
    "perDocument": [
      { "name": "참고 문서 1: 임금테이블.xlsx", "contribution": "감액률 구간표·기본급 데이터 제공" },
      { "name": "참고 문서 2: 인사정보.docx", "contribution": "임직원 변수(성명·사번·직급 등) 정의" }
    ],
    "others": [
      { "name": "비상연락처", "reason": "임금피크제 적용 판단과 무관 — 기타로 분리" }
    ]
  }
}

# 작성 지침

- meta.flow 는 반드시 4 단계.
- **변수 이름 작성 규칙 (매우 중요)** — 공백/특수문자 없이.
  - ⚠ 아래 언더스코어 규칙은 **"분류별 정책 변수"(switch 로 분기되는 값)에만** 적용한다.
    그 외 일반 변수·산출 step 이름은 \`성명\`·\`기본급\`·\`통상임금산정\`·\`최종월기준액\` 처럼 **언더스코어 없는 깔끔한 이름**으로.
  - (분류별 정책 변수) **상위 > 하위 > 세부 분류** 순으로 작성. 단계 사이는 언더스코어(\`_\`) 로 구분.
  - ✅ 좋은 예 (경조사 도메인):
    • \`결혼_본인\`, \`결혼_자녀\`, \`결혼_형제자매\` (분류 변수가 1차원이면 도메인_분류값)
    • \`결혼_본인_회사지원금\`, \`결혼_자녀_회사지원금\` (2차원이면 도메인_분류_종류)
    • \`결혼_본인_상조회지원금\`, \`결혼_자녀_상조회지원금\`
    • \`사망_본인_조위금\`, \`사망_배우자_조위금\`
  - ❌ 나쁜 예:
    • \`회사지원금_결혼_본인\` (지원금 종류가 먼저 — 도메인이 먼저 와야 함)
    • \`본인결혼축의금\` (구분 없이 한 덩어리)
    • \`결혼축의금_본인\` (의미상은 결혼_본인_축의금 이 맞음)
  - 이유: 빌더의 다중분기(switch) 가 정책 변수들의 **공통 접두/접미** 를 보고 분류값을 자동 추출 →
    같은 패턴으로 시작하지 않으면 분기 자동 구성이 안 됨.
  - 단순 변수(분기 대상 아님)는 일반 이름 — \`성명\`, \`사번\`, \`기본급\` 등.
- **"핵심"** 판정 순서:
  (1) 인사 도메인 보편 필수 항목인가 (성명/사번/부서/직급 같은 기본 식별) → 핵심.
  (2) **2개 이상 참고 문서에 (의미적으로) 공통 등장** 하는가 → 핵심.
  (3) 도메인 메인 판단·산출 산식에 직접 쓰이는가 → 핵심.
  위 세 가지에 해당 안 하면 **기타**.
- **"기타"** 는 다음 중 하나에 해당하면 폭넓게:
  • 한 참고 문서에만 등장하는 부수 항목 (다른 문서엔 없는 특수 케이스)
  • 메인 산출·판정과 직접 관계없는 항목
  • 매우 좁은 특수 케이스·옵션 항목
  • 통계·사후 분석용 메타데이터
  → 너무 광범위한 핵심보다 **핵심은 적고 정확하게, 기타는 자유롭게** 가 사용자 선호.
- paths 는 first-match. 좁은 조건부터.
- **각 경로는 자족적 (매우 중요)** — 경로의 step·conditions 가 참조할 수 있는 이름은
  선언된 변수, shared.steps, **같은 경로의 선행 step** 뿐이다. **다른 경로의 step 참조 절대 금지**
  (런타임엔 매칭된 경로 하나만 실행되므로 다른 경로의 산출은 항상 미정의). 여러 경로가 같은 이름의
  산출(예: 기본급제안액)을 쓰면 **경로마다 각자 정의**하거나 공통 산식이면 shared 로 옮겨라.
- **paths[].conditions 작성법**:
  • 변수 vs 변수: \`"만나이 >= 최초적용연령"\`
  • 변수 vs 숫자: \`"만나이 >= 56"\`
  • 변수 vs 문자열 리터럴: \`"경조분류 == \\"결혼\\""\` (값에 반드시 따옴표)
  • ❌ 따옴표 없는 리터럴은 변수로 오해될 수 있음 — 문자열 비교는 따옴표 필수.

- **paths[].steps 설계 — 변수 이름 패턴 매칭이 아니라 "서비스 맥락 이해" 가 우선**

  ## 단계별 사고 — 분석 로직 설계 절차 (반드시 이 순서로 사고하라)

  ### Step 0. 서비스 본질 파악
  이 앱의 목적은 무엇인가? 누가, 어떤 입력을 주고, 어떤 출력을 받는가?
  (예: "임직원이 경조 신청서를 내면 회사 정책에 따라 지원금액을 산출해 안내한다")

  ### Step 1. 사용자 입력 → 출력 사이의 결정 흐름 그리기
  머릿속에서 한 임직원의 시나리오를 따라가라:
    1) 임직원이 입력하는 것 (개인 변수)
    2) 회사 규정이 정한 것 (규정 변수)
    3) 1과 2 사이에서 일어나는 **판단** (조건 분기, 분류)
    4) 1·2·판단 결과를 조합한 **계산** (산식, 보정, 집계)
    5) 최종 결과 (지원금/적용여부/안내문)

  ### Step 2. 위 결정 흐름을 step 들로 표현
  각 결정/계산 단계를 적절한 step type 으로 분해:
  - "회사가 정한 분류별 금액 중 임직원의 분류에 맞는 것을 고르는 결정" → switch
  - "여러 정책값을 합치거나 곱하거나 나누는 계산" → formula
  - "두 날짜 사이의 경과 일/년/월" → date
  - "기준 값이 어느 구간에 속하는지" → table
  - "여러 항목의 합/평균/최대/최소" → classify
  - "최저·최고 보정" → clamp
  - "단순 yes/no 분기 후 두 값 중 하나" → branch
  - "산출 결과를 자연어로 풀어쓰는 안내" → llm

  ### Step 3. step 의 이름·역할을 비즈니스 용어로 — **깔끔한 변수명처럼**
  step.name 은 그 step 이 비즈니스적으로 무엇을 하는지 드러나되, **변수명처럼 깔끔한 단일 합성어**여야 한다.
  - ⚠ **언더스코어(_)·공백 없이** 자연스러운 한국어 합성어로. (산출 step·계산 결과 이름)
    ✅ \`통상임금산정\`, \`최종월기준액\`, \`적용후월기준액\`, \`만나이계산\`, \`감액률결정\`
    ❌ \`통상임금_산출\` (언더스코어), ❌ \`결혼축의금 산출\` (공백), ❌ \`본인구분지원금\` (의미 모호)
  - ⚠ **일관성(매우 중요)**: 한 번 정한 step 이름을, 뒤의 step·조건·리포트에서 참조할 때 **글자 그대로 똑같이** 쓴다.
    예: step 을 \`통상임금산정\` 으로 지었으면, 그 값을 쓰는 산식·clamp·조건에서도 반드시 \`통상임금산정\` (\`통상임금\` 으로 줄여 쓰지 말 것).
  - 참고: 위 "분류별 정책 변수" 의 언더스코어 규칙(\`결혼_본인\` 등)은 **그 변수들에만** 해당 — 산출 step 이름엔 적용 안 함.

  step.reason 도 "왜 이 단계가 필요한지" 를 비즈니스 맥락으로 작성하라:
  ❌ "switch 로 분기" — 형식만
  ✅ "결혼축의금은 신청자의 대상자 관계(본인/자녀/형제자매)에 따라 금액이 다르므로 분류값에 따른 정책금액을 선택" — 맥락

  ### Step 4. 검토 — "각 step 이 제거되면 무슨 일?"
  각 step 을 제거하면 비즈니스 흐름에서 무엇이 빠지는지 자문하라.
  답이 안 떠오르면 그 step 은 불필요. 답이 명확하면 필수.

  ## 산출 블록 추출 체크리스트 (문서에서 다음 패턴을 발견하면 빠짐없이 step 으로):

  ### A. 분류별 차등 지급 → **switch**
  - 본인/자녀/배우자/직계존속/형제자매 등 분류마다 금액이 다르다 → switch
  - 직급별/등급별/근속별 차등 → switch (또는 table)
  - **cases 의 match 는 분류 변수의 모든 값을 빠짐없이 나열**

  ### B. 금액·일수 계산 → **formula**
  - "기준액 × 적용률" → formula
  - "본인지원금 + 가산금" → formula
  - "통상임금 × 0.7" → formula
  - 산식의 모든 변수를 vars 배열에 명시
  - **사용 가능한 연산**: 사칙(+ - * /), 나머지 \`%\`, 몫 \`//\`(내림나눗셈), 괄호,
    그리고 단항 함수 **floor(내림)·ceil(올림)·round(반올림)** — 이게 전부다.
    • 내림 가산연차: \`floor((근속연수 - 1) / 가산연차주기)\`
    • 원단위 절사: \`floor(보상금 / 1000) * 1000\`
    • 일할계산: \`월급여 * 근무일수 // 총일수\`  (또는 \`월급여 * 근무일수 / 총일수\`)
    • 퍼센트는 \`70%\` 처럼 적어도 되고 \`0.7\` 로 적어도 된다 (둘 다 같은 값으로 처리).
    ⚠ floor/ceil/round **외의 함수는 절대 금지** (min/max/if/sum/날짜함수 등 — 아래 참고).
    ⚠ 상·하한(min/max 캡)은 formula 가 아니라 **clamp**, 합계는 **classify(sum)**, 조건은 **branch/switch** 로.

  ### C. 날짜·기간 → **date**
  - 생년월일 → 만나이 (date, mode=diff, out=year)
  - 발생일 → 신청경과일 (date, mode=diff, out=day)
  - 입사일 → 근속년수 (date, mode=diff, out=year)
  - 🚫 **스프레드시트·SQL 함수 절대 금지** — 엔진엔 그런 함수가 없다. 어떤 필드(값·then/els·산식·case)에도
    \`FORMAT_DATE(...)\`, \`DATE(...)\`, \`YEAR(...)\`, \`MONTH(...)\`, \`TODAY()\`, \`CURRENT_DATE\`, \`IF(...)\`, \`CONCAT(...)\`,
    \`MIN(...)\`, \`MAX(...)\`, \`SUM(...)\`, \`VLOOKUP(...)\` 같은 걸 쓰지 마라.
    ✅ 단, **formula 산식 안에서만** 수학 함수 \`floor()\`·\`ceil()\`·\`round()\` 와 \`%\`(나머지)·\`//\`(몫) 은 사용 가능 (B 참고).
    • 날짜 계산은 오직 date step(diff/part) 으로. 오늘은 "오늘".
    • "당해 7월 1일" 같은 **고정 표시**는 함수가 아니라 그냥 **텍스트 라벨**("당해 7월 1일") 로 적어라.
    ❌ \`FORMAT_DATE(CURRENT_DATE, 'YYYY년 07월 01일')\`   ✅ "당해 7월 1일" (텍스트)

  ### D. 구간별 차등 → **table**
  - 만나이 56~57 → 0%, 58 → 20% 같은 연속 구간 → table (bands)
  - 근속 1~4 → 100%, 5~9 → 110% 같은 차등 → table

  ### E. 합산·집계 → **classify**
  - 통상임금 = 기본급 + 직책수당 + 식대 (포함 항목 집계) → classify (agg=sum)
  - 평균·최대·최소 집계 → classify

  ### F. 상·하한 보정 → **clamp**
  - "최저 X 이상, 최고 Y 이하" 같은 한도 → clamp
  - 최저임금 보장 → clamp(min=최저임금)

  ### G. 단순 if-else → **branch**
  - "임금피크제 적용 시 출생월에 따라 7월/1월 적용" → branch
  - 양자택일 단순 분기 → branch
  - ⚠ **branch 의 참/거짓 출력은 사용자가 이해하는 도메인 라벨**로. true/false·참/거짓·Y/N 같은
    불리언을 그대로 출력하지 마라 (결과 화면에 "false" 가 떠서 무슨 뜻인지 알 수 없음).
    ✅ 출생반기 분기 → then="상반기", els="하반기"   (또는 then="당해 7월 1일", els="익년 1월 1일")
    ❌ then="true"/els="false", then="참"/els="거짓"  ← 사용자에게 의미 없음
    ⚠ 분류 결과가 핵심이면 분기 step(branch)보다 분류 변수+switch 가 더 깔끔할 수 있다.

  ### H. 안내문 생성 → **llm**
  - 적용 경로 끝에 1개 — 산식 결과를 자연어로 풀어쓰는 안내
  - fallback 에는 금지

  ⚠ 위 8가지 중 **문서에 보이는 모든 패턴을 step 으로** — 한 경로에 5~10 step 도 정상.
  ⚠ 산식이 보이는데 "도메인 상식" 으로만 적고 step 안 만들면 누락.
  ⚠ **각 step 의 이름 (name) 은 변수처럼 활용** 가능 — 다음 step 에서 ref/var 로 참조 가능. 의미 있는 이름으로.

  ## 🚫 절대 금지 — 앱의 목적 자체를 산출 step 으로 만들지 말 것 (매우 중요)

  이 앱의 **핵심 목적/판정 자체**(예: "임금피크제 적용 여부", "지원 대상 여부", "승진 자격 여부")는
  **산출 step (branch/switch 등) 으로 만들면 안 된다.** 그 판정은 **paths 의 진입조건 + fallback(미적용)** 구조가
  이미 표현한다. 산출 step 으로 또 만들면 같은 판단을 두 번 하는 중복이고, 빌더에 무의미한 블록이 생긴다.

  ❌ 잘못된 예 (목적을 step 으로):
    branch "적용여부 판단"  condition="만나이 >= 최초적용연령"
       then="적용 대상"   els="미적용 대상"   ← 문서에 없는 "적용 대상" 라벨을 새로 발명해 출력
  ✅ 올바른 예 (목적은 경로 구조로):
    paths[0].conditions = ["만나이 >= 최초적용연령", "만나이 <= 정년"]   ← 적용 대상이면 이 경로로 진입
    fallback.label = "미적용"                                          ← 아니면 자동으로 미적용
    → "적용 여부" 를 묻는 branch step 은 만들지 않는다. 경로 진입 자체가 곧 "적용" 이다.

  ## 🚫 절대 금지 — 문서에 없는 변수/라벨을 발명해 산출 결과로 쓰지 말 것

  산출 step 의 출력(then/els/case 값, formula 변수, table band 값 등)은 **실제 데이터** 여야 한다 —
  참고 문서에 있는 금액·률·일수·기존 변수, 또는 그 계산 결과. **문서에 없는 새 분류 라벨이나 상태값을
  지어내서 출력하지 마라.**

  ❌ then="적용 대상" / els="미적용 대상"  (문서에 없는 상태 라벨 발명)
  ❌ outputVar="적용여부설정" / "대상자플래그"  (정의되지 않은 변수 발명)
  ✅ then/els 가 꼭 필요하면 실제 정책값·금액·기존 변수만 (예: 출생월 분기 → then=상반기적용일, els=하반기적용일).
     단순히 "대상/비대상" 을 말하려는 거라면 그건 step 이 아니라 **경로 진입조건**으로 표현할 일이다.

  ## 🔗 탭 간 일관성 — 변수(vars)와 분석 로직(steps)을 따로 놀게 하지 말 것 (매우 중요)

  변수(1·2탭에서 입력/규정)와 분석 로직(3탭의 step·조건)은 **하나로 연결된 한 시스템**이다.
  각 값이 "어디에 속하는지" 를 먼저 판단하고, 로직은 그 변수를 **참조**해야 한다.

  ### (1) 값의 소속 판단 — 변수냐 산출 step 이냐
  분석 로직이 쓰는 각 값에 대해 다음을 구분하라:
  - **사용자가 실제로 입력·업로드하는 값** → 개인 변수 (grp=개인)
  - **회사 규정이 고정한 값** (기준액·률·기준일·정책 라벨 등) → 규정 변수 (grp=규정)
  - **다른 값에서 계산/도출되는 값** (만나이, 통상임금, 적용후금액 등) → 변수가 아니라 **분석 로직 step**
    → 도출되는 값을 개인 변수로 만들지 마라 (사용자가 입력할 게 아니다).

  ### (2) 로직은 변수를 "참조" — 같은 값을 리터럴로 복붙 금지
  step/조건/분기에서 어떤 값을 쓸 때, 그 값이 **이미 변수(또는 앞 step)로 있으면 그 이름을 참조**하라.
  같은 값을 리터럴(텍스트/숫자)로 다시 적지 마라 — 변수를 고치면 로직도 따라가야 한다.

  ### (3) 중복/유령 변수 금지 — 둘 중 하나만
  같은 개념을 **(a) 변수로 선언 + (b) 로직에서 리터럴로** 동시에 두지 마라. 둘 중 하나로 통일:
  - 변수로 뒀으면 → 로직(분기/산식/switch)이 **그 변수를 참조**
  - 로직 안에서만 쓰는 임시 라벨이면 → **변수로 만들지 마라**

  ### ❌ 실제로 자주 나는 분리 사례 (적용시점)
  - 규정 변수: \`적용시점_상반기출생\` = "당해 7월 1일"  (변수로 선언해 놓고)
  - branch "적용시점 결정": then 에 "당해 7월 1일" 을 **텍스트로 또 적음**  → 둘이 따로 놂.
  ### ✅ 통일된 방법 (둘 중 택1)
  - ⓐ **변수 유지 + 참조**: 규정 변수 \`적용시점_상반기\`·\`적용시점_하반기\` 를 두고,
       \`출생반기\`(개인 text, "상반기"/"하반기") 분류로 **switch** → case 출력을 그 변수로 (switch 는 텍스트 변수값도 출력 가능).
  - ⓑ **변수 없이 라벨만**: 별도 변수 만들지 말고 branch then/els 에 텍스트 라벨만. (단순 안내용)
  → 절대 "변수도 만들고 분기엔 리터럴로 복붙" 하지 마라.

  ## 표준 패턴 — "이벤트유형으로 경로 분기 + 경로 안에서 분류축으로 다중분기"

  이벤트 기반 도메인(경조사·복리후생 신청·휴가 신청·보상 신청 등) 은 보통:
  - **이벤트유형(또는 신청구분)** 으로 paths 분기 (각 이벤트가 하나의 경로)
  ⚠ **분기축의 모든 분류값마다 경로를 빠짐없이 생성하라.** 문서에 분류값이 N개면 정확히 N개 경로.
    하나만 만들고 나머지를 Fallback 으로 떠넘기지 말 것.
    예: 경조분류가 사망/결혼/출산/입학 4종이면 → 반드시 4개 경로 (사망 1개만 만들면 오답).
  - 각 경로 안에서 **대상자/등급/직급/근속 같은 분류 축** 으로 switch 다중분기
  - 분류 축은 보통 모든 경로가 **공유** (예: "대상자관계" 가 결혼·사망·회갑 경로 모두에서 사용)

  ⚠ **진입조건에 쓴 변수는 그 경로 안 switch 의 ref 로 절대 다시 쓰지 말 것.**
     진입조건이 \`이벤트유형 == "X"\` 인 경로 안에서, switch ref 를 또 \`이벤트유형\` 으로 두면
     이미 "X" 로 필터링됐는데 다시 분기하는 무의미한 구조가 된다.
     반드시 다른 분류 변수로.

  ### 도메인 예시 A — 이벤트 기반 (경조 / 복리후생 신청)
  paths[0]:
    label: "<이벤트1>"
    conditions: ["이벤트유형 == \\"<이벤트1>\\""]
    steps:
      1) switch "<이벤트1>지원금산출"
         ref=대상자관계
         cases=[
           {match:"본인",     outputVar:"<이벤트1>_본인"},
           {match:"자녀",     outputVar:"<이벤트1>_자녀"},
           {match:"배우자",   outputVar:"<이벤트1>_배우자"},
           {match:"형제자매", outputVar:"<이벤트1>_형제자매"}
         ]
      2) llm "LLM 분석"

  ### 도메인 예시 B — 연속 산식 (임금피크제 / 퇴직금)
  paths[0]:
    steps:
      1) date    "만나이"            a=생년월일, out=year
      2) classify "통상임금"          items=[기본급, 직책수당, 식대]
      3) table   "감액률"            ref=만나이, bands=[{56-57:0},{58:0.2},...]
      4) formula "피크임금"          vars=[통상임금, 감액률]
      5) clamp   "최종월기준액"      ref=피크임금, min=최저임금월액
      6) llm     "LLM 분석"

  ### 도메인 예시 C — 평가 기반 (성과급 / 승진)
  paths[0]:
    label: "S등급"
    conditions: ["평가등급 == \\"S\\""]
    steps:
      1) formula "성과급" vars=[기본급, 성과배율_S]
      2) llm "LLM 분석"
  paths[1]:
    label: "A등급"
    conditions: ["평가등급 == \\"A\\""]
    steps:
      1) formula "성과급" vars=[기본급, 성과배율_A]
      2) llm "LLM 분석"

  💡 위 세 패턴은 예시 — 실제 도메인에 맞게 응용. 경조·임금·평가 외에도 휴가/근태/교육/보상/징계 등 모든 인사 도메인에 같은 원리 적용.
  💡 정책 변수 이름은 "{도메인}_{분류값}" 또는 "{도메인}_{분류값}_{종류}" 패턴이어야 다중분기 자동 매칭 가능.

- step 의 type 은 정확히 다음 중 하나: date | classify | table | formula | clamp | branch | switch | llm
- switch step 의 cases 는 분류 변수의 모든 분류값에 대해 빠짐없이 — 누락하면 빌더가 자동 삭제.
- 참고 문서가 부족한 부분은 도메인 상식으로 메꾸되 source 를 "도메인 상식" 으로 명시.
- rationale.others 에는 기타로 뺀 변수/요소를 모두 나열하고 각각 이유 명시.
- 처음 출력 후 스스로 다음을 검토 — 보강·교정 뒤 최종 JSON:
  (1) **인사 도메인 보편 필수 항목(성명·사번 등) 이 핵심에 모두 있나?**
  (2) **분류별 다른 값이 있는데 분류 변수 + 분류별 값 변수로 분해 안 한 게 있나?**
       예: 본인결혼·자녀결혼 금액이 다른데 "대상자관계" 개인 변수와 각각의 규정 변수 없으면 누락.
  (3) **핵심에 들어간 항목 중, 한 문서에만 등장하고 다른 문서엔 없는 부수 항목이 섞여 있나?**
       있으면 기타로 옮기고 rationale.others 에 이유 명시.
  (4) **각 paths[].steps 가 그 경로의 비즈니스 흐름을 완전히 표현하는가?**
       경로 라벨이 의미하는 시나리오를 머릿속으로 따라가며, "사용자 입력 → 판단 → 계산 → 결과" 흐름이 step 들로 모두 표현됐는지 확인.
       빠진 단계 있으면 추가 — 단순히 변수 이름 보고가 아니라 그 경로의 **비즈니스 목적**을 보고.
  (5) **각 step 에 reason 이 비즈니스 맥락으로 작성됐나?**
       "switch 로 분기" 같은 형식 설명이 아니라 "왜 이 단계가 비즈니스에서 필요한지" 설명이어야 함.
       reason 이 "사용자가 어떤 결정을 내리고, 회사가 어떻게 응답하는지" 의 일부를 설명하면 OK.
  (6) **switch step 에 ref 가 명시되어 있나? cases 의 outputVar 가 모두 정의된 변수인가?**
       ref 비어 있거나 outputVar 가 없는 변수면 빌더가 자동 보강 시도하지만 정확도 떨어짐 — AI 가 직접 명시해야 정확.
  (6.5) **switch step 의 ref 가 진입조건에 쓰인 변수와 겹치진 않나?**
       겹치면 무의미한 분기 — 다른 분류 변수로 교체. 예: 진입조건이 "경조이벤트유형 == \\"결혼\\"" 인 경로면 switch ref 는 "대상자관계" 등.
  (7) **paths[].conditions 에 따옴표 없는 문자열 비교가 있는가?**
       있으면 따옴표 추가 — 예: \`경조분류 == 결혼\` → \`경조분류 == "결혼"\`
  (8) **모든 문서를 다 봤나? 공통 패턴을 최대로 뽑았나?**
       - 첨부된 모든 문서가 rationale.perDocument 에 등장하는가? 누락된 문서 있으면 다시 읽어라.
       - 두 문서 이상에 의미적으로 공통 등장하는 항목 중 핵심에서 빠진 게 있나? 있으면 추가.
       - 한 문서에만 있는 항목이 핵심에 잘못 들어가 있으면 기타로 옮기되, 보편 필수(성명/사번 등)는 예외.
       - 목표는 **범용성** — 두 문서 사이 공통 패턴을 빠짐없이 뽑는 것.
  (9) **앱의 목적/판정 자체를 산출 step 으로 만든 게 있나?** (🚫 위 금지 규칙)
       - "적용 여부 판단", "대상 여부", "자격 판정" 같은 step 이 있으면 삭제하고, 그 판정은 paths 진입조건 + fallback 으로 옮겨라.
       - then/els/case/outputVar 에 문서에 없는 라벨·변수("적용 대상", "미적용 대상" 등)를 발명한 게 있으면 제거.
       - 산출 step 은 실제 금액·률·일수·기존 변수 계산만 — 상태 라벨 발명 금지.
  (10) **경로 분기축(이벤트유형/신청구분 등)의 모든 분류값마다 path 가 있나?**
       문서의 분류값이 N개인데 paths 가 N개 미만이면 누락된 값의 경로를 추가하라.
       단, 도메인이 단일 판정(적용/미적용)이면 1경로 + fallback 으로 충분 — 억지로 늘리지 말 것.

# 출력
순수 JSON 1개. 다른 텍스트 금지.`;

// 단일 Gemini 호출 → JSON 파싱 + finishReason 에러 처리 (단계형/단일형 공용)
async function genSpecJson(model: any, parts: any[]): Promise<any> {
  const res = await model.generateContent({ contents: [{ role: "user", parts }] });
  const candidate = res.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = (res.response.text() || "").trim();
  const parsed = extractJson(text);
  if (!parsed) {
    if (finishReason === "MAX_TOKENS") {
      throw new Error("참고 문서가 너무 많아 응답이 잘렸습니다. 문서 수/분량을 줄여 주세요.");
    }
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      throw new Error("문서 내용이 안전·인용 필터에 걸렸습니다.");
    }
    throw new Error(`AI 응답을 JSON으로 해석하지 못했습니다 (finishReason=${finishReason || "?"}).`);
  }
  return parsed;
}

// ── 단계형(staged) 분석 지시문 ──
// 큰 SPEC_PREVIEW_PROMPT(규칙·예시)는 그대로 공유하고, 각 단계는 "어떤 키만 출력할지"만 덧붙인다.
// 1단계가 만든 meta+vars 를 2단계 프롬프트에 그대로 주입 → 탭 간 변수명/문맥이 절대 어긋나지 않음.
const STAGE1_DIRECTIVE = `

# ⚠⚠ 이번 호출은 [2단계 분석 중 1단계 — 기초: meta + vars] 입니다 ⚠⚠
- **오직 \`meta\` 와 \`vars\` 두 키만** 담은 JSON 을 출력하세요.
- \`paths\`·\`fallback\`·\`report\`·\`rationale\` 은 이번 단계에서 **절대 출력하지 마세요** (다음 단계에서 생성).
- 이 단계의 \`vars\` 가 다음 단계의 **확정 변수 목록(잠금)** 이 됩니다. 따라서:
  • 규정/개인 · 핵심/기타 변수를 **빠짐없이 정확히** 추출하세요.
  • 분기축이 될 **분류 변수**(예: 경조분류·신청구분·평가등급 등)는 반드시 vars 에 넣고,
    그 **분류값 후보를 reason 에 모두 나열**하세요 (예: "분류값 후보: 사망/결혼/출산/입학").
  • 분류값마다 다른 정책 금액이 있으면 "도메인_분류값" 패턴 규정 변수도 모두 선언.
출력 형식: { "meta": { ...위 스키마... }, "vars": [ ...위 스키마... ] }`;

function buildStage2Directive(meta: any, vars: any[]): string {
  const metaBrief = JSON.stringify({
    appName: meta?.appName || "",
    purpose: meta?.purpose || "",
    users: meta?.users || "",
  });
  const varLines = (vars || [])
    .map((v) => {
      const u = v?.unit ? `, ${v.unit}` : "";
      const cls = v?.category ? `[${v.category}]` : "";
      const grp = v?.subGroup || v?.group || "";
      const reason = typeof v?.reason === "string" ? ` :: ${v.reason.slice(0, 120)}` : "";
      return `- ${v?.name} (${v?.grp}/${v?.type}${u}) ${cls}${grp ? " " + grp : ""}${reason}`;
    })
    .join("\n");
  return `

# ⚠⚠ 이번 호출은 [2단계 분석 중 2단계 — 로직·리포트] 입니다 ⚠⚠
아래는 **1단계에서 이미 확정된 meta 와 변수 목록** 입니다 (탭별 프리뷰의 공유 컨텍스트).
이 컨텍스트를 그대로 유지하고, 절대 변형·재정의하지 마세요.

[확정 meta]
${metaBrief}

[확정 변수 목록 — conditions·steps·report 의 모든 변수 참조는 아래 name 과 글자 그대로 일치해야 함]
${varLines || "(없음)"}

# 규칙 (일관성 — 매우 중요)
- **새 변수를 발명하지 마세요.** conditions/steps/report 의 변수 참조는 위 '확정 변수' name 만 사용.
  (단, step 의 **산출 결과 이름(step.name)** 은 새로 만들 수 있고, 이후 step·report 가 그 이름을 참조 가능.)
- 위 확정 변수 중 **분류축(분류 변수)의 모든 분류값마다 path 를 1개씩 빠짐없이** 생성하세요.
  (분류값은 해당 분류 변수의 reason 에 나열돼 있음 — 하나도 누락 금지.)
- 각 path 의 report 는 그 path 의 step.name 또는 확정 변수만 bind 하세요.
- **오직 \`paths\`·\`fallback\`·\`report\`·\`rationale\` 키만** 출력하세요. \`meta\`·\`vars\` 는 다시 출력하지 마세요.
출력 형식: { "paths": [...], "fallback": {...}, "report": [...], "rationale": {...} }`;
}

export async function generateAppSpecPreview(
  files: SpecRefFile[]
): Promise<AppSpecPreview> {
  if (!files || files.length === 0) {
    throw new Error("참고 문서를 1개 이상 첨부해 주세요");
  }
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 65536,
      temperature: 0.3,
      ...THINKING_CFG, // thinking off — 서버리스 타임아웃 방지 (Vercel Hobby 60s)
    } as any,
  });

  // 참고 문서 parts — 두 단계가 공유 (한 번만 조립)
  const docParts: any[] = [{ text: "\n\n===== [참고 문서] =====" }];
  for (let i = 0; i < files.length; i++) {
    const sub = await fileToParts(files[i], `참고 문서 ${i + 1}`);
    docParts.push(...sub);
  }

  // 단계형 기본 OFF — 단일 호출이 가장 빠름(54→30초). 커버리지 4/4 가 필요하면 SPEC_PREVIEW_STAGED=1 로 켜기.
  const STAGED = process.env.SPEC_PREVIEW_STAGED === "1";

  let parsed: any;
  if (!STAGED) {
    // 단일 호출 (롤백/비교용)
    parsed = await genSpecJson(model, [{ text: SPEC_PREVIEW_PROMPT }, ...docParts]);
  } else {
    // 1단계 — 기초(meta+vars) 확정
    const s1 = await genSpecJson(model, [
      { text: SPEC_PREVIEW_PROMPT },
      { text: STAGE1_DIRECTIVE },
      ...docParts,
    ]);
    const lockedMeta = s1?.meta || {};
    const lockedVars = Array.isArray(s1?.vars) ? s1.vars : [];

    // 2단계 — 1단계 확정 컨텍스트를 잠가서 주입, 로직·리포트 생성
    const s2 = await genSpecJson(model, [
      { text: SPEC_PREVIEW_PROMPT },
      { text: buildStage2Directive(lockedMeta, lockedVars) },
      ...docParts,
    ]);

    // 병합 — meta/vars 는 1단계, 나머지는 2단계
    parsed = {
      meta: lockedMeta,
      vars: lockedVars,
      paths: s2?.paths,
      fallback: s2?.fallback,
      report: s2?.report,
      rationale: s2?.rationale,
    };
  }

  // 누락 키 보강
  return {
    meta: {
      appName: parsed.meta?.appName || "",
      tagline: parsed.meta?.tagline || "",
      purpose: parsed.meta?.purpose || "",
      problem: parsed.meta?.problem || "",
      users: parsed.meta?.users || "",
      security: parsed.meta?.security || "",
      effects: Array.isArray(parsed.meta?.effects) ? parsed.meta.effects : [],
      features: Array.isArray(parsed.meta?.features) ? parsed.meta.features : [],
      flow: Array.isArray(parsed.meta?.flow) ? parsed.meta.flow.slice(0, 4) : [],
      rationale: parsed.meta?.rationale || "",
      sources: Array.isArray(parsed.meta?.sources) ? parsed.meta.sources : [],
    },
    vars: Array.isArray(parsed.vars) ? parsed.vars : [],
    paths: Array.isArray(parsed.paths) ? parsed.paths : [],
    fallback: parsed.fallback || { label: "미적용", reason: "" },
    report: Array.isArray(parsed.report) ? parsed.report : [],
    rationale: {
      overall: parsed.rationale?.overall || "",
      perDocument: Array.isArray(parsed.rationale?.perDocument)
        ? parsed.rationale.perDocument
        : [],
      others: Array.isArray(parsed.rationale?.others) ? parsed.rationale.others : [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// 단계별(요청 분할) 분석 — 타임아웃 방지용.
// 한 요청에 다 넣지 않고 digest → meta → vars → paths → report 를 **각각 별도 HTTP 요청**으로 처리.
// Vercel 60초 캡은 요청당 적용되므로, 각 단계가 60초 안이면 총합이 길어도 타임아웃 없음.
// digest(문서 정리본)를 한 번 만들어 모든 단계가 참조 → 탭 간 컨텍스트·일관성 유지.
// ─────────────────────────────────────────────────────────────────

export type SpecStage =
  | "digest"
  | "meta"
  | "varsReg"
  | "varsPer"
  | "paths"
  | "report";

function getSpecJsonModel() {
  const client = getClient();
  return client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 65536,
      temperature: 0.3,
      ...THINKING_CFG,
    } as any,
  });
}

// 확정 변수 목록을 프롬프트에 주입할 텍스트로 — 이후 단계가 이 name 만 참조하도록
function varListText(vars: any[]): string {
  return (
    (vars || [])
      .map((v) => {
        const u = v?.unit ? `, ${v.unit}` : "";
        const cls = v?.category ? `[${v.category}]` : "";
        const grp = v?.subGroup || v?.group || "";
        const reason =
          typeof v?.reason === "string" ? ` :: ${v.reason.slice(0, 120)}` : "";
        return `- ${v?.name} (${v?.grp}/${v?.type}${u}) ${cls}${grp ? " " + grp : ""}${reason}`;
      })
      .join("\n") || "(없음)"
  );
}

const DIGEST_PROMPT = `당신은 인사 자동화 앱 기획을 위한 "문서 정리 전문가" 입니다.
아래 [참고 문서]들을 **빠짐없이 정확히** 읽고, 앱 기획에 필요한 모든 정보를 구조화된 한국어 텍스트로 정리하세요.

# 반드시 담을 것
- **회사 정책 값**: 기준액·지급액·비율·연령·한도·기한·등급 기준 등 (숫자·단위 그대로, 절대 깨지지 않게).
- **분류 체계와 모든 분류값**: 예) 경조분류 = 사망/결혼/출산/입학. 빠짐없이 나열.
- **개인 정보 항목**: 성명·사번·생년월일·금액 등 임직원이 입력/업로드하는 값.
- **계산 로직·판정 규칙**: 금액 산식, 구간표, 조건 분기, 신청 자격/기한 규칙.
- 각 정보가 **어느 문서에서** 왔는지 표시.

# 형식
- 순수 마크다운 텍스트 (JSON 아님, 코드블록 금지).
- 스캔/이미지 문서의 표·숫자는 OCR 로 정확히 읽되 값이 깨지지 않게 주의 (예: 생년월일·금액).
- 추측으로 지어내지 말 것. 문서에 있는 것만. 모호하면 "(불명확)" 표기.

이제 [참고 문서]를 읽고 정리본을 출력하세요.`;

// 0단계 — 문서를 비전으로 읽어 깨끗한 텍스트 정리본(digest) 생성
async function generateDigest(files: SpecRefFile[]): Promise<string> {
  if (!files || files.length === 0) {
    throw new Error("참고 문서를 1개 이상 첨부해 주세요");
  }
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 65536, temperature: 0.2, ...THINKING_CFG } as any,
  });
  const parts: any[] = [{ text: DIGEST_PROMPT }, { text: "\n\n===== [참고 문서] =====" }];
  for (let i = 0; i < files.length; i++) {
    const sub = await fileToParts(files[i], `참고 문서 ${i + 1}`);
    parts.push(...sub);
  }
  const res = await model.generateContent({ contents: [{ role: "user", parts }] });
  const candidate = res.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = (res.response.text() || "").trim();
  if (!text) {
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      throw new Error("문서 내용이 안전·인용 필터에 걸렸습니다.");
    }
    throw new Error("문서 정리(0단계) 결과가 비어 있습니다. 다시 시도해 주세요.");
  }
  return text;
}

// digest + (선택)확정 이전단계 컨텍스트 + 단계 지시문 → JSON
async function runJsonStage(
  digest: string,
  contextBlocks: string[],
  directive: string
): Promise<any> {
  const model = getSpecJsonModel();
  const parts: any[] = [
    { text: SPEC_PREVIEW_PROMPT },
    { text: `\n\n===== [참고 문서 — 정리본(digest)] =====\n${digest}` },
    ...contextBlocks.map((t) => ({ text: t })),
    { text: directive },
  ];
  return genSpecJson(model, parts);
}

// 1단계 — meta(앱 개요)
async function generateSpecMeta(digest: string): Promise<AppSpecPreview["meta"]> {
  const parsed = await runJsonStage(
    digest,
    [],
    `\n\n# ⚠ 이번 호출 = [meta — 앱 개요] 단계. **오직 \`meta\` 키만** 담은 JSON 출력 (vars/paths/report/rationale 금지).\n출력: { "meta": { ...위 스키마... } }`
  );
  const m = parsed.meta || {};
  return {
    appName: m.appName || "",
    tagline: m.tagline || "",
    purpose: m.purpose || "",
    problem: m.problem || "",
    users: m.users || "",
    security: m.security || "",
    effects: Array.isArray(m.effects) ? m.effects : [],
    features: Array.isArray(m.features) ? m.features : [],
    flow: Array.isArray(m.flow) ? m.flow.slice(0, 4) : [],
    rationale: m.rationale || "",
    sources: Array.isArray(m.sources) ? m.sources : [],
  };
}

// 변수 추출 — grp(규정/개인)별로 분리 호출 (빌더 ① 규정 변수 / ② 개인 변수 탭과 1:1).
async function generateSpecVars(
  digest: string,
  meta: any,
  grp: "규정" | "개인"
): Promise<any[]> {
  const metaBrief = JSON.stringify({
    appName: meta?.appName || "",
    purpose: meta?.purpose || "",
    users: meta?.users || "",
  });
  const extra =
    grp === "개인"
      ? `\n임직원이 입력/업로드하는 값(성명·사번·생년월일·금액·분류 등). 분기축이 될 분류 변수(예: 경조분류·신청구분)는 **문서에 분류값 후보가 명시된 경우에만** type="select" 로 하고 options 에 그 후보를 그대로 나열 (예: ["사망","결혼","출산","입학"]). 문서에 없는 후보를 지어내지 말 것.
⚠ 여러 건을 입력하는 **목록 항목**(경력내역·보유자격·품목 목록 등)은 select 금지 — text 로.
select 변수의 desc 끝에는 「값: A/B/C」 표기를 포함하라. 그 외 변수도 desc 에 사용자용 한 줄 설명을 채워라.`
      : `\n회사가 정한 정책 값만(기준액·지급액·비율·연령·한도·기한·등급 기준 등). 분류값마다 다른 정책 금액이 있으면 "도메인_분류값" 패턴으로 모두 선언.
⚠ 단, **열린 목록**(자격증·품목·정책코드처럼 회사마다 나열이 달라지는 항목)은 개별 항목을 변수로 펼치지 말 것 — 특정 항목명(예: 정보보안기사)이 변수 정의에 박제됨. 총액/결과 변수 1개(예: 자격수당가산액)로 선언.
운영 방식 변수(…유형·…방식·…모델 등)는 **문서에 허용값 목록이 명시된 경우에만** type="select" + options (문서의 후보 그대로, 발명 금지 — desc 끝에 「값: A/B/C」 포함). 목록이 없으면 text 로 두되 value 는 문서의 운영 구조를 읽고 판단해 채워라.
각 변수의 desc 에 사용자용 한 줄 설명을 채워라.`;
  const parsed = await runJsonStage(
    digest,
    [`\n\n[확정 meta]\n${metaBrief}`],
    `\n\n# ⚠ 이번 호출 = [${grp} 변수] 단계. **오직 \`vars\` 키만**, 그리고 **grp='${grp}' 변수만** 담아라 (다른 grp 는 넣지 말 것).${extra}\n출력: { "vars": [ ...위 스키마, 모두 grp="${grp}"... ] }`
  );
  const arr = Array.isArray(parsed.vars) ? parsed.vars : [];
  // 다른 grp 가 섞여 들어오면 제외하고, 요청 grp 로 태깅
  return arr
    .filter((v: any) => !v?.grp || v.grp === grp)
    .map((v: any) => ({ ...v, grp }));
}

// 3단계 — paths/fallback(분석 로직). 확정 vars 잠금 참조.
async function generateSpecPaths(
  digest: string,
  meta: any,
  vars: any[]
): Promise<{ shared: { steps: any[] }; paths: any[]; fallback: any }> {
  const parsed = await runJsonStage(
    digest,
    [
      `\n\n[확정 변수 — conditions·steps 는 이 name 과 글자 그대로 일치, 새 변수 발명 금지 (step.name 신규 산출은 허용)]\n${varListText(vars)}`,
    ],
    `\n\n# ⚠ 이번 호출 = [paths — 분석 로직] 단계. **오직 \`shared\`·\`paths\`·\`fallback\` 키만**.
- **공통 사전 계산**(여러 경로가 함께 쓰는 산출 — 예: 만나이·경과일수·기준 평균값 등 도메인 공통 산출)은 \`shared.steps\` 에 **한 번만** 두세요. 경로마다 똑같은 산식을 복제하지 말 것. shared 의 step.name 은 각 경로 step·조건에서 참조 가능.
- **그 경로에서만 쓰는 산출**(분류별 가산·전용 금액 등)만 \`path.steps\` 에 두세요.
- **각 경로는 자족적** — 경로의 step·conditions 가 참조할 수 있는 이름은 확정 변수, shared.steps, **같은 경로의 선행 step** 뿐. **다른 경로의 step 참조 절대 금지** (런타임엔 매칭된 경로만 실행되므로 항상 미정의 에러). 여러 경로가 같은 이름의 산출(예: 기본급제안액)을 쓰면 **경로마다 각자 정의**하거나 shared 로 옮겨라.
- **산식(formula)의 expression 은 사칙연산·괄호·floor/ceil/round 만** — "표에서 조회", IF, 함수 호출 같은 문구를 넣으면 그 step 은 통째로 버려진다. 표 대응값 조회는 **table(구간표) step 으로 bands 를 구체화**해 표현하고(참고 문서의 실제 값 사용), 구간표로도 표현 불가능하면 스스로 판단해 근사 산식(예: 기준값 * 비율)으로 채워라. 참조가 끊긴 이름을 남기지 말 것.
- 분기축(분류 변수)의 **모든 분류값마다 path 1개씩 빠짐없이** 생성. 하나만 만들고 나머지를 fallback 으로 떠넘기지 말 것.
출력: { "shared": { "steps": [...] }, "paths": [...], "fallback": {...} }`
  );
  return {
    shared: { steps: Array.isArray(parsed.shared?.steps) ? parsed.shared.steps : [] },
    paths: Array.isArray(parsed.paths) ? parsed.paths : [],
    fallback: parsed.fallback || { label: "미적용", reason: "" },
  };
}

// 4단계 — report/rationale(리포트 구성). 확정 vars/paths 참조.
async function generateSpecReport(
  digest: string,
  meta: any,
  vars: any[],
  paths: any[]
): Promise<{ report: any[]; rationale: any }> {
  const pathLabels = (paths || []).map((p: any) => `- ${p?.label}`).join("\n") || "(없음)";
  const parsed = await runJsonStage(
    digest,
    [
      `\n\n[확정 변수]\n${varListText(vars)}`,
      `\n\n[확정 경로]\n${pathLabels}`,
    ],
    `\n\n# ⚠ 이번 호출 = [report — 리포트 구성] 단계. **오직 \`report\`·\`rationale\` 키만**.
각 경로 report 는 그 경로의 step.name 또는 확정 변수만 bind. report 는 경로별 { pathLabel, elements, reason } 배열.
- 차트 요소(kind="chart")는 **반드시 \`ctype\` 명시**: gauge/bar/step/donut/ratio/bullet/stacked/comparison/delta.
- 두 값을 비교하는 차트(comparison=이중막대 · delta=증감 · bullet=목표대비 · ratio=달성률)는 **\`bind\` 와 \`bind2\` 에 각각 한 값씩** (예: bind=기준값, bind2=결과값 — 두 산출/변수를 비교). 콤마로 묶지 말 것.
출력: { "report": [...], "rationale": { overall, perDocument, others } }`
  );
  return {
    report: Array.isArray(parsed.report) ? parsed.report : [],
    rationale: {
      overall: parsed.rationale?.overall || "",
      perDocument: Array.isArray(parsed.rationale?.perDocument) ? parsed.rationale.perDocument : [],
      others: Array.isArray(parsed.rationale?.others) ? parsed.rationale.others : [],
    },
  };
}

// 단계 디스패처 — /api/spec-stage 가 호출. 각 단계가 별도 요청이라 60초 캡 안에 들어옴.
export async function runSpecStage(input: {
  stage: SpecStage;
  files?: SpecRefFile[];
  digest?: string;
  meta?: any;
  vars?: any[];
  paths?: any[];
}): Promise<any> {
  const { stage } = input;
  if (stage === "digest") {
    return { digest: await generateDigest(input.files || []) };
  }
  const digest = (input.digest || "").trim();
  if (!digest) throw new Error("digest 누락 — 0단계(문서 정리)를 먼저 실행하세요");
  if (stage === "meta") return { meta: await generateSpecMeta(digest) };
  if (stage === "varsReg")
    return { vars: await generateSpecVars(digest, input.meta, "규정") };
  if (stage === "varsPer")
    return { vars: await generateSpecVars(digest, input.meta, "개인") };
  if (stage === "paths") return generateSpecPaths(digest, input.meta, input.vars || []);
  if (stage === "report")
    return generateSpecReport(digest, input.meta, input.vars || [], input.paths || []);
  throw new Error(`알 수 없는 stage: ${stage}`);
}

// 프리뷰(JSON 구조) → AppSchema 직접 변환 — LLM 호출 없이 즉시.
// preview 가 이미 모든 정보를 들고 있으므로 두번째 LLM 호출(파싱)을 건너뛴다.
// withIds() 후처리는 동일하게 거쳐 ID 부여·정합성 보정 적용.
export function previewToAppSchema(preview: AppSpecPreview): any {
  // 모든 변수(핵심 + 기타) 빌더에 채움 — 기타도 사용자가 빌더에서 보고 손쉽게 활용/삭제 가능.
  // 기타 변수는 group="기타" 로 묶어서 별도 묶음 카드로 보이도록.
  const allPreviewVars = preview.vars || [];
  const coreVars = allPreviewVars.filter((v) => v.category === "핵심");
  const otherVars = allPreviewVars.filter((v) => v.category === "기타");
  // options/desc 정규화 — select 인데 options 가 부실하면 text 강등, text 인데 options 가 있으면 select 승격.
  const varOptions = (v: SpecPreviewVar): string[] => {
    const raw = Array.isArray(v.options) ? v.options : [];
    const cleaned = raw
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter(Boolean);
    return [...new Set(cleaned)];
  };
  const varTypeOf = (v: SpecPreviewVar): string => {
    const opts = varOptions(v);
    if (v.type === "select") return opts.length >= 2 ? "select" : "text";
    if (v.type === "text" && opts.length >= 2) return "select";
    return v.type;
  };
  const toDraftVar = (v: SpecPreviewVar, fallbackGroup: string) => {
    const type = varTypeOf(v);
    const opts = type === "select" ? varOptions(v) : [];
    // select 의 test 값은 options 안에서만 — 벗어나면 목록에 추가 (문서 발견값 보존)
    let test = v.value || "";
    if (type === "select" && test && !opts.includes(test)) opts.push(test);
    return {
      id: "auto",
      grp: v.grp,
      name: v.name,
      type,
      unit: v.unit || "",
      req: false,
      test,
      desc: typeof v.desc === "string" ? v.desc.trim() : "",
      ...(type === "select" ? { options: opts } : {}),
      group: v.group || fallbackGroup,
      subGroup: v.subGroup || "",
    };
  };
  const draftVars = [
    ...coreVars.map((v) => toDraftVar(v, "")),
    // 기타 변수는 group/subGroup 메타가 없으면 "기타" 묶음으로 강제, 있으면 그대로 사용
    ...otherVars.map((v) => toDraftVar(v, "기타")),
  ];
  // 모든 변수 이름 집합 — formula/switch ref 등 토큰 매핑 시 사용 (기타도 포함해야 산식에서 참조 가능)
  const allCoreNames = new Set(allPreviewVars.map((v) => v.name));
  // step 출력 이름들 — step 끼리 참조(예: 통상임금→피크임금→최종월기준액)가 끊기지 않도록
  // 변수와 함께 "알려진 이름" 으로 취급한다. (이게 없으면 step 참조가 전부 빈값이 되어 isUsableStep 에서 제거됨)
  const allStepNames = new Set<string>();
  for (const p of preview.paths || [])
    for (const st of p.steps || []) if (st?.name) allStepNames.add(st.name);
  for (const st of (preview as any).shared?.steps || [])
    if (st?.name) allStepNames.add(st.name);
  const knownNames = [...allCoreNames, ...allStepNames];
  // 변수 이름 → 숫자값 (table band 의 value 가 변수명일 때 숫자로 환원하기 위함)
  const varNumValue = new Map<string, number>();
  for (const v of allPreviewVars) {
    const raw = v?.value != null ? String(v.value).replace(/,/g, "").trim() : "";
    if (v?.name && /^-?\d+(\.\d+)?$/.test(raw)) varNumValue.set(v.name, Number(raw));
  }
  // LLM 이 쓴 짧은 이름(예: "만나이", "감액률") 을 실제 정의된 변수/step 이름(예: "만나이 계산", "감액률 결정") 으로 해석.
  // 우선순위: 정확 → 정규화 정확 → 정규화 접두(최단) → 정규화 부분포함(최단). 못 찾으면 원본 유지(silent drop 방지).
  const resolveName = (raw: any): string => {
    if (typeof raw !== "string") return "";
    const r = raw.trim();
    if (!r) return "";
    if (allCoreNames.has(r) || allStepNames.has(r)) return r;
    const target = normKey(r);
    if (!target) return r;
    for (const n of knownNames) if (normKey(n) === target) return n;
    const starts = knownNames
      .filter((n) => normKey(n).startsWith(target))
      .sort((a, b) => a.length - b.length);
    if (starts.length) return starts[0];
    const contains = knownNames
      .filter((n) => normKey(n).includes(target))
      .sort((a, b) => a.length - b.length);
    if (contains.length) return contains[0];
    return r;
  };
  // 구간 문자열 → {from,to}. "56-57" / "58" / "60-" / "-57" / "56 이상" / "59 이하" / "초과"/"미만"
  const BAND_HI = 99999, BAND_LO = -99999;
  const parseBand = (range: any): { from: number; to: number } => {
    const s = String(range ?? "").trim();
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(-?\d+)\s*[-~]\s*(-?\d+)$/))) return { from: Number(m[1]), to: Number(m[2]) };
    if ((m = s.match(/^(-?\d+)\s*[-~]\s*$/))) return { from: Number(m[1]), to: BAND_HI };
    if ((m = s.match(/^[-~]\s*(-?\d+)$/))) return { from: BAND_LO, to: Number(m[1]) };
    if ((m = s.match(/^(-?\d+)\s*이상$/))) return { from: Number(m[1]), to: BAND_HI };
    if ((m = s.match(/^(-?\d+)\s*이하$/))) return { from: BAND_LO, to: Number(m[1]) };
    if ((m = s.match(/^(-?\d+)\s*초과$/))) return { from: Number(m[1]) + 1, to: BAND_HI };
    if ((m = s.match(/^(-?\d+)\s*미만$/))) return { from: BAND_LO, to: Number(m[1]) - 1 };
    if ((m = s.match(/^(-?\d+)$/))) return { from: Number(m[1]), to: Number(m[1]) };
    return { from: 0, to: 0 };
  };
  // band 의 value 를 숫자로 — 숫자면 그대로, 변수명이면 그 변수의 값, 못 찾으면 0
  const bandValueToNum = (value: any): number => {
    const s = String(value ?? "").replace(/,/g, "").trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    const resolved = resolveName(value);
    if (varNumValue.has(resolved)) return varNumValue.get(resolved)!;
    if (varNumValue.has(s)) return varNumValue.get(s)!;
    return 0;
  };
  // 수식 문자열 → v5 토큰. 식별자는 resolveName 으로 실제 이름에 매핑. (예: "통상임금 * (1 - 감액률 / 100)")
  const tokenizeExpr = (expr: any): any[] => {
    let s = String(expr ?? "");
    // 유니코드 연산자 정규화 (× ÷ − 등 → * / -)
    s = s.replace(/[×∙·]/g, "*").replace(/÷/g, "/").replace(/[−–—]/g, "-");
    // ⚠ 따옴표(문자열 리터럴) 포함 = "라벨 + 값" 문자열 조합 → 숫자 수식이 아님.
    //   토큰화하면 "세 구간"·"%"·따옴표가 쓰레기 var 토큰이 되고 미정의 변수까지 생기므로,
    //   아예 토큰화하지 않는다(→ 빈 토큰 → isUsableStep 에서 그 산식 step 제거). 라벨은 LLM 안내문이 담당.
    if (/["'“”‘’]/.test(s)) return [];
    // ── 엔진 미지원 수식 차단 (매우 중요) ──
    //   계산 엔진(evalRpn)이 아는 것: 사칙(+ - * /)·나머지(%)·몫(//)·괄호·변수·숫자,
    //   그리고 단항 함수 floor/ceil/round 뿐. 그 외 함수(IF/MIN/SUM/FORMAT_DATE…)·비교·기타 연산자는 못 푼다.
    //   AI 가 이를 어기고 emit 하면 토큰화 시 쓰레기 var 토큰이 되어 런타임 "식 오류"·오답이 난다.
    //   → 미지원 식은 통째로 버린다(빈 토큰 → isUsableStep 이 step 제거). 안내는 LLM 안내문이 담당.
    // (1) `숫자%` 가 (연산자·)·끝) 앞이면 퍼센트 → (숫자/100). (변수 % 숫자 형태의 나머지(modulo)와 구분)
    s = s.replace(/(\d+(?:\.\d+)?)\s*%(?=\s*([)+\-*/]|$))/g, "($1/100)");
    // (2) 함수 호출: `이름(` 의 이름이 허용 함수(floor/ceil/round)가 아니면 미지원 함수 → 버림
    const fnCallRe = /([A-Za-z가-힣ㄱ-힣_][\wㄱ-힣_]*)\s*\(/g;
    let fm: RegExpExecArray | null;
    while ((fm = fnCallRe.exec(s))) {
      if (!FN_NAMES.has(fm[1].toLowerCase())) return [];
    }
    // (3) `숫자(` 또는 `)(` = 암묵적 곱(엔진 미지원) → 버림
    if (/[0-9)]\s*\(/.test(s)) return [];
    // (4) 남은 미지원 기호: 콤마(함수 인자)·^·비교/논리 연산자  (%·// 는 허용)
    if (/[,^<>=!&|]/.test(s)) return [];
    const toks: any[] = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
      if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
      if (c === "/" && s[i + 1] === "/") { toks.push({ t: "op", op: "//" }); i += 2; continue; }
      if ("+-*/%".includes(c)) { toks.push({ t: "op", op: c }); i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        toks.push({ t: "num", v: Number(s.slice(i, j)) });
        i = j;
        continue;
      }
      // 식별자 런 — 연산자/괄호/% 전까지 (내부 공백·한글·영숫자·_ 포함). 끝 공백 trim.
      let j = i;
      while (j < s.length && !"+-*/()%".includes(s[j])) j++;
      const name = s.slice(i, j).trim();
      i = j;
      if (!name) continue;
      // floor/ceil/round → 함수 토큰, 그 외 → 변수
      if (FN_NAMES.has(name.toLowerCase())) toks.push({ t: "fn", fn: name.toLowerCase() });
      else toks.push({ t: "var", name: resolveName(name) });
    }
    return toks;
  };
  // 이름이 변수/step 으로 해석되거나 숫자 리터럴이면 그 값을, 아니면 "" (engine 에서 NaN/오류 나는 미해석 수식·토큰 차단)
  const isKnown = (n: string) => allCoreNames.has(n) || allStepNames.has(n);
  const asKnownOrNum = (raw: any): string => {
    const r = resolveName(raw);
    if (r && (isKnown(r) || /^-?\d+(\.\d+)?$/.test(r.replace(/,/g, "")))) return r;
    return "";
  };
  const buildStep = (s: SpecPreviewStep): any => {
    const sa = s as any;
    const base = { id: "auto", name: s.name || "", unit: "" } as any;
    switch (s.type) {
      case "date": {
        // AI 가 명시한 a/b/out 사용. b 는 날짜 변수/step 으로 해석되면 그 이름, 아니면 "오늘".
        const a = resolveName(s.a) || s.a || "";
        let b = (s.b || "").trim();
        const rb = resolveName(b);
        b = isKnown(rb) ? rb : "오늘";
        const out = s.out || "year";
        return { ...base, type: "date", mode: "diff", a, b, out };
      }
      case "classify": {
        // LLM 이 명시한 items 를 그대로 사용 (이전엔 빈 배열로 버렸음). 문자열·{ref} 둘 다 지원.
        const items = (Array.isArray(sa.items) ? sa.items : [])
          .map((it: any) => {
            const ref = resolveName(typeof it === "string" ? it : it?.ref);
            return ref ? { ref, inc: true } : null;
          })
          .filter(Boolean);
        const agg = ["sum", "count", "avg", "max", "min"].includes(sa.agg) ? sa.agg : "sum";
        return { ...base, type: "classify", agg, items };
      }
      case "table": {
        // ref 는 변수뿐 아니라 step 출력(예: "만나이 계산") 도 허용. bands 는 LLM 출력 그대로 변환.
        const ref = resolveName(s.ref);
        const rawBands = Array.isArray(sa.bands) ? sa.bands : [];
        const bands = rawBands
          .map((b: any) => {
            const hasRange = b && (b.range != null || b.band != null);
            const { from, to } = hasRange
              ? parseBand(b.range ?? b.band)
              : { from: Number(b?.from) || 0, to: Number(b?.to) || 0 };
            // band 의 값 키는 LLM 마다 다양 — v / value / outputVar / var / outputNum 모두 지원
            const rawV = b?.v ?? b?.value ?? b?.outputVar ?? b?.var ?? b?.outputNum;
            const vNum =
              rawV != null && /^-?\d+(\.\d+)?$/.test(String(rawV))
                ? Number(rawV)
                : bandValueToNum(rawV);
            return { from, to, v: vNum };
          });
        return { ...base, type: "table", ref, bands: bands.length ? bands : [{ from: 0, to: 100, v: 0 }] };
      }
      case "formula": {
        // 수식 문자열을 토큰으로 파싱 — 곱셈·괄호·step 참조 모두 보존.
        // 필드명은 expression (SpecPreviewStep) — 과거 sa.formula 로 읽어 항상 빈 토큰이 되던 버그 수정.
        let tokens = tokenizeExpr(sa.expression || sa.formula);
        if (!tokens.some((t: any) => t.t === "var" || t.t === "num")) {
          // 수식 문자열이 없으면 vars 를 + 로 연결 (안전망)
          const vs = (s.vars || []).map((n) => resolveName(n)).filter(Boolean);
          tokens = [];
          for (let i = 0; i < vs.length; i++) {
            if (i > 0) tokens.push({ t: "op", op: "+" });
            tokens.push({ t: "var", name: vs[i] });
          }
        }
        return { ...base, type: "formula", tokens };
      }
      case "clamp": {
        // ref 는 변수·step, min/max 는 변수·step·숫자만 허용 (수식·미해석 문자열은 ""— 런타임 NaN 방지).
        const ref = resolveName(s.ref);
        const min = asKnownOrNum(sa.min);
        const max = asKnownOrNum(sa.max);
        return { ...base, type: "clamp", ref, min, max };
      }
      case "branch": {
        // condition("만나이 >= 최초적용연령") 을 ref/op/rhs 로 파싱. then/els 는 trueVar/falseVar.
        const cond = parseSimpleCondition(sa.condition || "", new Set(knownNames));
        const ref = cond ? resolveName(cond.a) || cond.a : resolveName(s.ref) || "";
        const op = cond?.op || ">=";
        const rhs = cond ? (cond.bMode === "val" ? cond.b : resolveName(cond.b) || cond.b) : 0;
        // 일관성: then/els 가 정의된 '숫자' 변수·step 이면 그 값을 참조(calc)해서 변수와 연결.
        //   (branch calc 은 숫자 전용 — 텍스트 변수는 참조 불가하므로 라벨 텍스트로 둔다.)
        const sideOf = (varName: any, textVal: any) => {
          const primary = typeof varName === "string" ? varName.trim() : "";
          if (primary) {
            const r = resolveName(primary);
            const v = allPreviewVars.find((x) => x.name === r);
            if (allStepNames.has(r) || (v && v.type === "number")) {
              // 숫자 변수·step → 값 참조(calc)로 연결
              return { t: "calc", tok: [{ t: "var", name: r }], text: "" };
            }
            if (v) {
              // 텍스트/날짜 변수 → branch calc 불가(숫자 전용). 변수의 '값'을 라벨로 출력.
              //   ⚠ 변수 '이름' 을 텍스트로 넣으면 repairSteps 가 calc 로 승격해 깨지므로, 이름 대신 값을 쓴다.
              const lit = typeof textVal === "string" && textVal.trim() ? textVal.trim() : (v.value || "");
              return { t: "text", tok: [], text: lit };
            }
          }
          // 변수 아님 → 라벨 텍스트 (LLM 이 준 텍스트 우선)
          const txt = typeof textVal === "string" && textVal.trim() ? textVal.trim() : primary;
          return { t: "text", tok: [], text: txt };
        };
        const th = sideOf(sa.trueVar, sa.trueText ?? sa.then);
        const el = sideOf(sa.falseVar, sa.falseText ?? sa.els);
        return {
          ...base, type: "branch", ref, op, rhs,
          then: th.text, thenT: th.t, thenTok: th.tok,
          els: el.text, elsT: el.t, elsTok: el.tok,
        };
      }
      case "switch": {
        // cases 의 outputVar 를 토큰화 — 변수/step 모두 허용 (resolveName 으로 매핑)
        const cases = (s.cases || []).map((c) => {
          const ov = c.outputVar ? resolveName(c.outputVar) : "";
          if (ov && (allCoreNames.has(ov) || allStepNames.has(ov))) {
            return { match: c.match, t: "calc", tokens: [{ t: "var", name: ov }], text: "" };
          }
          if (typeof c.outputNum === "number") {
            return { match: c.match, t: "calc", tokens: [{ t: "num", v: c.outputNum }], text: "" };
          }
          if (typeof c.outputText === "string") {
            return { match: c.match, t: "text", text: c.outputText, tokens: [] };
          }
          return null;
        }).filter(Boolean);
        // ref 우선순위: (1) AI 가 명시한 s.ref, (2) subGroup 매칭, (3) 빈 값
        let ref = resolveName(s.ref);
        if (!ref) {
          const outputVars = (s.cases || [])
            .map((c) => (c.outputVar ? resolveName(c.outputVar) : ""))
            .filter((n): n is string => !!n && allCoreNames.has(n));
          if (outputVars.length) {
            const v = coreVars.find((x) => x.name === outputVars[0]);
            if (v?.subGroup) {
              const classifier = coreVars.find(
                (x) => x.grp === "개인" && (x.type === "text" || x.type === "select") && x.subGroup === v.subGroup
              );
              if (classifier) ref = classifier.name;
            }
          }
        }
        return { ...base, type: "switch", ref, cases, defaultT: "calc", defaultText: "", defaultTokens: [{ t: "num", v: 0 }] };
      }
      case "llm": {
        // AI 가 명시한 items 우선 사용 (변수명·step 이름 둘 다 가능).
        // 필터링은 약하게 — 빈 문자열·undefined 만 제거. 정의 여부는 후처리에서 검증.
        const aiItems = (s.items || [])
          .filter((n) => typeof n === "string" && n.trim() !== "")
          .map((n) => n.trim());
        return {
          ...base,
          type: "llm",
          name: s.name || "LLM 분석",
          items: aiItems,
          prompt: "",
          lastResult: "",
          lastAt: "",
        };
      }
      default:
        return null;
    }
  };

  // paths 변환 — 사용자가 채운 step 정보 활용
  const draftPaths = (preview.paths || []).map((p) => {
    const builtSteps = (p.steps || []).map(buildStep).filter(Boolean);
    // 자동 보강 — 경로 라벨/조건 기반으로 그 경로의 정책 변수 묶음 + 분류 변수로 switch 생성.
    const autoSwitches = autoBuildSwitchesForPath(
      coreVars,
      p.label || "",
      p.conditions || [],
      builtSteps
    );
    // switch 결과를 다른 step (formula 등) 이 참조할 수 있도록 switch 를 앞쪽에 배치.
    // LLM 만 항상 맨 마지막.
    const llmSteps = builtSteps.filter((s: any) => s?.type === "llm");
    const nonLlm = builtSteps.filter((s: any) => s?.type !== "llm");
    let combined = [...autoSwitches, ...nonLlm, ...llmSteps];

    // LLM 마지막 보장 (적용 경로만) + items 자동 채우기
    // items 가 비어있으면 안내문이 빈약하므로, 이 경로의 의미 있는 출력들로 자동 채움.
    const buildDefaultLlmItems = (): string[] => {
      const items: string[] = [];
      // (1) 이 경로의 산출 step 이름들 (switch/formula/classify/table/clamp/branch/date)
      const stepNames = combined
        .filter((s: any) => s?.name && ["switch", "formula", "classify", "table", "clamp", "branch", "date"].includes(s.type))
        .map((s: any) => s.name);
      items.push(...stepNames);
      // (2) 이 경로 조건에 등장하는 개인 변수 (분류값 등)
      const condVars = extractVarNamesFromConditions(p.conditions || [], allPreviewVars);
      for (const n of condVars) if (!items.includes(n)) items.push(n);
      // (3) 핵심 변수 중 개인 변수 일부 (상위 5개)
      const personalCore = coreVars
        .filter((v) => v.grp === "개인" && v.category === "핵심")
        .map((v) => v.name)
        .slice(0, 5);
      for (const n of personalCore) if (!items.includes(n)) items.push(n);
      return items.slice(0, 10);
    };

    const existingLlm = combined.find((s: any) => s?.type === "llm");
    if (existingLlm) {
      // AI 가 명시한 items 가 비었으면 자동 채움
      if (!Array.isArray(existingLlm.items) || existingLlm.items.length === 0) {
        existingLlm.items = buildDefaultLlmItems();
      }
    } else {
      combined.push({
        id: "auto",
        name: "LLM 분석",
        unit: "",
        type: "llm",
        items: buildDefaultLlmItems(),
        prompt: "",
        lastResult: "",
        lastAt: "",
      });
    }
    return {
      id: "auto",
      label: p.label || "경로",
      conditions: (p.conditions || []).map((c) => parseSimpleCondition(c, allCoreNames)).filter(Boolean),
      steps: combined,
      report: pathReportFromPreview(preview, p.label, p.steps || []),
    };
  });
  // ── 분석이 명시한 공통 사전 계산(shared.steps) 변환 + 경로에서 중복 제거 ──
  const presetSharedSteps: any[] = ((preview as any).shared?.steps || [])
    .map(buildStep)
    .filter(Boolean);
  const presetSharedNames = new Set(
    presetSharedSteps.map((s: any) => s?.name).filter(Boolean)
  );
  if (presetSharedNames.size > 0) {
    for (const p of draftPaths) {
      p.steps = (p.steps || []).filter(
        (s: any) => !(s?.name && presetSharedNames.has(s.name))
      );
    }
  }

  // ── 조건이 참조하는 선행 계산 step 을 공통 사전계산(shared)으로 승격 ──
  // 진입조건은 경로 step 실행 *전에* 평가되므로, 조건이 참조하는 step 은 경로 안에 두면
  // ① 조건 평가 시점에 미계산 → 매칭 실패 ② 빌더에서 변수로 인식 안 됨("값"으로 떨어짐).
  // ⚠ 조건이 실제로 참조하는 step + 그 step 이 의존하는 step 만 옮긴다.
  //    산출·리포트 전용 step(의미상 공통 아님)은 경로에 그대로 둔다.
  const hoistedSharedSteps: any[] = (() => {
    // 1) 모든 경로 조건이 참조하는 이름 (리터럴 b 제외; a 는 항상 참조 취급)
    const condRefs = new Set<string>();
    for (const p of draftPaths) {
      for (const c of p.conditions || []) {
        if (!c || typeof c !== "object") continue;
        if (typeof c.a === "string" && c.a.trim()) condRefs.add(c.a.trim());
        if (c.bMode !== "val" && typeof c.b === "string" && c.b.trim()) condRefs.add(c.b.trim());
      }
    }
    if (condRefs.size === 0) return [];
    // 2) 경로 step 이름 → step (조건이 가리키는 게 변수가 아니라 step 일 때만 승격 대상)
    const stepByName = new Map<string, any>();
    for (const p of draftPaths) for (const s of p.steps || []) if (s?.name) stepByName.set(s.name, s);
    // step 이 참조하는 다른 이름들 (전이 의존 계산용)
    const refsOfStep = (s: any): string[] => {
      const out: string[] = [];
      const add = (n: any) => { if (typeof n === "string" && n.trim()) out.push(n.trim()); };
      if (s.type === "date") { add(s.a); add(s.b); }
      else if (s.type === "classify") for (const it of s.items || []) add(it?.ref);
      else if (s.type === "table") add(s.ref);
      else if (s.type === "clamp") { add(s.ref); add(s.min); add(s.max); }
      else if (s.type === "formula") for (const t of s.tokens || []) if (t?.t === "var") add(t.name);
      else if (s.type === "branch") { add(s.ref); if (typeof s.rhs === "string") add(s.rhs); }
      else if (s.type === "switch") { add(s.ref); for (const c of s.cases || []) for (const t of c.tokens || []) if (t?.t === "var") add(t.name); }
      return out;
    };
    // 3) 전이 폐포: 조건 참조 step + 그 step 이 (경로 안에서) 의존하는 step 들
    const need = new Set<string>();
    const visit = (name: string) => {
      if (need.has(name) || !stepByName.has(name)) return; // 변수/미존재면 무시 (step 만 승격)
      need.add(name);
      for (const r of refsOfStep(stepByName.get(name))) visit(r);
    };
    for (const n of condRefs) visit(n);
    if (need.size === 0) return [];
    // 4) 경로에서 해당 step 제거 + 원래 순서(의존 순서) 유지하며 shared 로 모음 (이름 중복 제거)
    const hoisted: any[] = [];
    const seen = new Set<string>();
    for (const p of draftPaths) {
      const remain: any[] = [];
      for (const s of p.steps || []) {
        if (s?.name && need.has(s.name)) {
          if (!seen.has(s.name)) { hoisted.push(s); seen.add(s.name); }
        } else remain.push(s);
      }
      p.steps = remain;
    }
    return hoisted;
  })();

  const fallbackReport = pathReportFromPreview(preview, preview.fallback?.label || "미적용");
  // 최종 schema
  const draftSchema = {
    meta: {
      appName: preview.meta?.appName || "",
      tagline: preview.meta?.tagline || "",
      purpose: preview.meta?.purpose || "",
      problem: preview.meta?.problem || "",
      users: preview.meta?.users || "",
      security: preview.meta?.security || "",
      effects: preview.meta?.effects || [],
      features: preview.meta?.features || [],
      flow: (preview.meta?.flow && preview.meta.flow.length === 4)
        ? preview.meta.flow
        : ["기준 지식화", "개인 정보 파싱", "적용 여부 판단·분석", "산출 및 안내"],
    },
    vars: draftVars,
    // 분석이 명시한 공통계산 + 조건참조로 승격된 step (이름 중복 제거, preset 우선)
    shared: {
      steps: [
        ...presetSharedSteps,
        ...hoistedSharedSteps.filter((s: any) => !presetSharedNames.has(s?.name)),
      ],
    },
    paths: draftPaths,
    fallback: {
      id: "fallback",
      label: preview.fallback?.label || "미적용",
      conditions: [],
      steps: [],
      report: fallbackReport,
    },
  };
  return withIds(draftSchema);
}

// 분류 변수 + 분류별 정책값 패턴 자동 감지 → switch step 생성
// 같은 subGroup 안에 (1) 개인·text 변수(분류 축) 와 (2) 규정·number 변수 N개(분류별 값) 이 있으면
// 해당 분류 변수를 ref 로 하고 각 정책 변수를 case 로 하는 switch step 자동 생성.
// ⚠ 안전망(fallback) 으로만 동작 — AI 가 step 을 제대로 설계했으면 보통 이 함수는 빈 결과 반환.
// 경로 라벨/조건에서 도메인 키워드 추출 후, 그 키워드를 포함하는 정책 변수 묶음 + 적절한 분류 변수로 switch step 구성.
// 이건 어디까지나 AI 가 누락했을 때의 보호장치. 의미 있는 분석 로직은 AI 가 reason 까지 채워서 제공해야 함.
function autoBuildSwitchesForPath(
  coreVars: SpecPreviewVar[],
  pathLabel: string,
  pathConditions: string[],
  existingSteps: any[]
): any[] {
  const usedRefs = new Set(
    existingSteps.filter((s) => s?.type === "switch").map((s) => s.ref)
  );

  // 1) 경로의 도메인 키워드 추출
  //    label 과 conditions 의 따옴표 안 문자열·식별자에서 한국어 단어 후보 수집
  const domainKeywords = extractDomainKeywords(pathLabel, pathConditions);
  if (domainKeywords.length === 0) return [];

  // 진입조건에 이미 쓰인 변수들은 switch ref 로 쓰면 안 됨 (진입 후엔 이미 필터링됐으므로 의미 없음).
  //   예: 경로의 진입조건이 "경조이벤트유형 == \"결혼\"" 이면, 그 경로 안 switch 의 ref 는
  //   "경조이벤트유형" 이 아닌 다른 분류 변수(예: "대상자관계") 여야 한다.
  const entryVars = extractVarNamesFromConditions(pathConditions, coreVars);

  // 정책 변수 — 규정·number 와 규정·text 모두 포함 (text 도 switch case 출력으로 허용).
  const policyAll = coreVars.filter(
    (v) => v.grp === "규정" && (v.type === "number" || v.type === "text")
  );
  const classifierAll = coreVars.filter(
    (v) =>
      v.grp === "개인" &&
      (v.type === "text" || v.type === "select") &&
      !entryVars.has(v.name)
  );
  if (policyAll.length < 2 || classifierAll.length === 0) return [];

  const out: any[] = [];
  // 도메인 키워드마다 정책 변수 묶음 찾기
  for (const keyword of domainKeywords) {
    const policyVars = policyAll.filter((p) => p.name.includes(keyword));
    if (policyVars.length < 2) continue;

    // 2) 정책 변수들의 공통 접두/접미 제거하여 분류값(case match) 추출
    //    예: ["결혼축의금_본인", "결혼축의금_자녀", "결혼축의금_형제자매"]
    //        → ["본인", "자녀", "형제자매"]
    const policyNames = policyVars.map((x) => x.name);
    const discriminators = policyVars.map((p) =>
      extractDiscriminator(p.name, policyNames)
    );

    // ── 검증 1: discriminator 가 정말 "분류값" 인지 확인 ──
    // (a) 공통 접두/접미 제거가 실제로 일어났는지 — discriminator 가 원본 이름과 같으면 패턴 매칭 실패
    // (b) 모든 discriminator 가 짧고 의미 있는 분류값이어야 함 (변수명 그대로면 분기 의미 없음)
    const hasCommonPattern = discriminators.every(
      (d, i) => d !== policyNames[i] && d.length < policyNames[i].length
    );
    if (!hasCommonPattern) continue; // 변수 이름이 그대로 살아있으면 동질 묶음 아님 → 분기 생성 안 함
    // (c) 분류값 중복 없어야 함
    const discSet = new Set(discriminators);
    if (discSet.size !== discriminators.length) continue;
    // (d) 분류값이 변수 이름들과 겹치면 안 됨 (이름 자체가 분류 값으로 쓰이는 건 비정상)
    const allDefinedNames = new Set(coreVars.map((v) => v.name));
    if (discriminators.some((d) => allDefinedNames.has(d))) continue;
    // (e) 분류값 평균 길이가 너무 길면 (예: 6자 초과) 분류값일 가능성 낮음 (보통 "본인"·"자녀"·"S"·"A" 등 짧음)
    const avgLen = discriminators.reduce((a, d) => a + d.length, 0) / discriminators.length;
    if (avgLen > 6) continue;

    // 3) 분류 변수(classifier) 선택 — 의미 매칭 점수 + 일반적 이름 우선순위
    let classifier: SpecPreviewVar | undefined;
    // a) reason 매칭 점수 (가장 의미 정확)
    const ranked = classifierAll
      .map((c) => ({
        c,
        score: extractCandidatesFromReason(c.reason).filter((cd) =>
          discSet.has(cd)
        ).length,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked.length) classifier = ranked[0].c;
    // b) 일반적 분류 이름 (대상자/관계 우선, 이벤트유형은 보통 진입조건용이라 제외)
    if (!classifier) {
      const strong = /^(대상자관계|대상관계|대상자|관계|대상|구분|분류)$/;
      classifier = classifierAll.find((c) => strong.test(c.name));
    }
    if (!classifier) {
      const loose = /(대상자|관계|구분|분류|종류)/;
      classifier = classifierAll.find((c) => loose.test(c.name));
    }
    // c) keyword 포함
    if (!classifier) {
      classifier = classifierAll.find((c) => c.name.includes(keyword));
    }
    // ── 검증 2: classifier 가 식별 정보(성명·사번·부서 등) 면 절대 분기 ref 안 됨 ──
    // 사번·성명·부서·직급·생년월일·입사일 등은 분기 기준이 아닌 식별값.
    // d) 남은 것 아무거나는 신뢰도 너무 낮으므로 제거 — classifier 못 찾으면 switch 만들지 않음.
    if (!classifier) continue;
    const BASIC_ID = /^(성명|이름|성함|사번|직원번호|사원번호|임직원번호|부서|소속|본부|팀|직급|직위|직책|생년월일|출생일|입사일|채용일|연락처|전화|이메일|주소)$/;
    if (BASIC_ID.test(classifier.name)) continue;
    if (usedRefs.has(classifier.name)) continue;

    // 4) switch step 생성 — 정책 변수 타입에 맞춰 case t 결정
    //    text 정책 변수면 case.t="text" 로 두어 값을 그대로 출력 (숫자로 강제 변환 안 함)
    const cases = policyVars.map((p, i) => {
      if (p.type === "text") {
        return {
          match: discriminators[i],
          t: "text",
          // text 모드는 빌더 runtime 에서 sc[name] 을 직접 못 가져오므로 단일 var 토큰의 calc 모드 사용 (값 그대로 통과)
          // 단, type 표기는 var 의 type 따라감
          tokens: [{ t: "var", name: p.name }],
          text: "",
          // text 정책 변수임을 명시 — 후처리에서 type 보존
          t2: "var-text",
        };
      }
      return {
        match: discriminators[i],
        t: "calc",
        tokens: [{ t: "var", name: p.name }],
        text: "",
      };
    });
    // 정책 변수가 모두 text 면 step 이름도 "선택" 으로
    const allText = policyVars.every((p) => p.type === "text");
    const stepName = allText ? `${keyword}항목선택` : `${keyword}지원금산출`;
    const stepUnit = allText ? "" : "원";
    const defaultOutput = allText
      ? { defaultT: "text", defaultText: "", defaultTokens: [] }
      : { defaultT: "calc", defaultText: "", defaultTokens: [{ t: "num", v: 0 }] };
    // text 정책 변수는 case.t 를 "calc" + 단일 var 토큰 으로 두면 runtime 이 값을 그대로 반환함 (런타임 evalSide 의 단일 var 처리)
    const finalCases = cases.map((c) => ({
      match: c.match,
      t: "calc",
      tokens: c.tokens,
      text: c.text,
    }));
    out.push({
      id: "auto",
      name: stepName,
      unit: stepUnit,
      type: "switch",
      ref: classifier.name,
      cases: finalCases,
      ...defaultOutput,
    });
    usedRefs.add(classifier.name);
  }
  return out;
}

// 경로 라벨·조건에서 도메인 키워드(2자 이상 한국어 명사) 추출.
//   label="결혼 경조사" → ["결혼", "경조사"]
//   condition="경조분류 == 결혼" → ["결혼"]
//   condition="경조이벤트유형 == \"결혼\"" → ["결혼"]
function extractDomainKeywords(label: string, conditions: string[]): string[] {
  const out = new Set<string>();
  const tokenize = (s: string) => {
    if (typeof s !== "string") return [];
    // 따옴표 안 텍스트 추출
    const quoted = [...s.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    // 그 외 한국어 단어들 (2자 이상)
    const words = (s.match(/[가-힣]{2,}/g) || []).filter(
      (w) =>
        !/(경로|적용|예외|조건|미적용|분기|이상|이하|미만|초과|이벤트|유형|구분|분류|관계|대상)$/.test(
          w
        )
    );
    return [...quoted, ...words];
  };
  tokenize(label).forEach((w) => out.add(w));
  for (const c of conditions || []) tokenize(c).forEach((w) => out.add(w));
  // 우선순위 정렬 — 짧은 단어 먼저 (덜 일반적인 게 더 정확한 매칭)
  return [...out].sort((a, b) => a.length - b.length);
}

// 정책 변수 이름에서 분류값(case match) 추출.
//   names=["결혼축의금_본인","결혼축의금_자녀","결혼축의금_형제자매"]
//   → 공통 접두 "결혼축의금_" 제거 → "본인" / "자녀" / "형제자매"
//   names=["본인결혼축의금","자녀결혼축의금","형제자매결혼축의금"]
//   → 공통 접미 "결혼축의금" 제거 → "본인" / "자녀" / "형제자매"
// 조건 문자열들에서 사용된 변수 이름 추출 — 정의된 변수만 인정.
//   conditions=['경조이벤트유형 == "결혼"'], coreVars 에 "경조이벤트유형" 있으면 → Set(["경조이벤트유형"])
function extractVarNamesFromConditions(conditions: string[], coreVars: SpecPreviewVar[]): Set<string> {
  const out = new Set<string>();
  const definedNames = new Set(coreVars.map((v) => v.name));
  for (const c of conditions || []) {
    if (typeof c !== "string") continue;
    // 가능한 식별자(한글/영문/숫자/언더스코어) 토큰 모두 추출 후 정의된 이름과 매칭
    const tokens = c.match(/[가-힣A-Za-z_][가-힣A-Za-z0-9_]*/g) || [];
    for (const t of tokens) if (definedNames.has(t)) out.add(t);
  }
  return out;
}

function extractDiscriminator(name: string, allNames: string[]): string {
  if (allNames.length === 0) return name;
  // 공통 접두
  let prefix = allNames[0];
  for (const n of allNames) {
    while (!n.startsWith(prefix) && prefix.length) prefix = prefix.slice(0, -1);
  }
  // 공통 접미
  let suffix = allNames[0];
  for (const n of allNames) {
    while (!n.endsWith(suffix) && suffix.length) suffix = suffix.slice(1);
  }
  let core = name;
  if (prefix && prefix.length >= 1 && name.startsWith(prefix)) {
    core = name.slice(prefix.length);
  }
  if (suffix && suffix.length >= 1 && core.endsWith(suffix)) {
    core = core.slice(0, core.length - suffix.length);
  }
  // 양옆 구분자(_ - · 공백) 정리
  core = core.replace(/^[_\-·\s]+|[_\-·\s]+$/g, "");
  return core || name;
}

// reason 텍스트에서 분류값 후보 추출 — "본인·자녀·형제자매 중 선택" → ["본인","자녀","형제자매"]
function extractCandidatesFromReason(reason: string): string[] {
  if (typeof reason !== "string") return [];
  // 한글 분류값들을 ·/,/와/, 등으로 구분된 패턴에서 추출
  const m = reason.match(/[가-힣]+(?:\s*[·,/]\s*[가-힣]+)+/);
  if (!m) return [];
  return m[0].split(/\s*[·,/]\s*/).map((s) => s.trim()).filter(Boolean);
}

// 정책 변수 이름에서 분류값 추출 — "본인결혼축의금" + subGroup="결혼" → "본인"
function inferMatchValue(varName: string, subGroupKey: string, candidates: string[]): string {
  let name = varName;
  // subGroup 단어를 정책 변수 이름에서 제거 (예: "결혼")
  if (subGroupKey) {
    name = name.replace(subGroupKey, "");
  }
  // 끝의 정책 키워드 제거
  name = name.replace(/(축의금|축하금|조위금|조의금|부의금|지원금|지원액|지급금|지급액|위로금|장려금|포상금|보전금|상여|수당|회비)$/g, "");
  // 후보에 매칭되는 것 우선
  for (const c of candidates) {
    if (name.includes(c)) return c;
  }
  // 그래도 남은 텍스트 사용 (예: "본인", "자녀", "형제자매")
  return name || varName;
}

// 자연어 조건 → 단순 condition 객체 (best-effort)
// 입력 예시:
//   "만나이 >= 56"              → a="만나이", op=">=", b="56", bMode="val"
//   "경조분류 == \"결혼\""      → a="경조분류", op="==", b="결혼", bMode="val"
//   "경조분류 == 결혼"          → a="경조분류", op="==", b="결혼", bMode="val" (정의된 변수 아니면 리터럴 취급)
//   "만나이 >= 최초적용연령"     → a="만나이", op=">=", b="최초적용연령", bMode="var"
function parseSimpleCondition(cond: string, definedNames?: Set<string>): any | null {
  if (typeof cond !== "string" || !cond.trim()) return null;
  let c = cond.trim()
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/＝/g, "==")
    .replace(/이상$/, ">= 0").replace(/이하$/, "<= 0"); // 단순화
  // 따옴표 안의 공백을 보존하기 위해 "A op B" 패턴을 좀 더 유연하게 매칭
  // - b 부분이 따옴표로 감싸진 경우(예: "결혼") 도 처리
  const m = c.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!m) return null;
  const [, aRaw, op, bRaw] = m;
  const a = aRaw.trim();
  let b = bRaw.trim();
  // b 가 따옴표로 감싸졌으면 벗기고 무조건 리터럴(val)
  let bMode: "val" | "var" = "var";
  const quotedMatch = b.match(/^["'`](.+)["'`]$/);
  if (quotedMatch) {
    b = quotedMatch[1];
    bMode = "val";
  } else if (/^-?\d+(\.\d+)?$/.test(b)) {
    bMode = "val";
  } else if (definedNames && !definedNames.has(b)) {
    // 정의되지 않은 식별자면 리터럴 텍스트로 간주
    bMode = "val";
  } else {
    bMode = "var";
  }
  return { id: "auto", a, op, b, bMode };
}

// pathLabel 에 해당하는 리포트를 preview.report 에서 찾아 변환
function pathReportFromPreview(
  preview: AppSpecPreview,
  label: string,
  pathSteps: any[] = []
): any[] {
  const hit = (preview.report || []).find((r) => r.pathLabel === label);
  let out: any[] = [];
  if (hit) {
    for (const e of hit.elements || []) {
      const item: any = { id: "auto", kind: e.kind, label: e.label || "" };
      const ee = e as any;
      if (e.bind) {
        if (e.kind === "fields" && e.bind.includes(",")) {
          item.binds = e.bind.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
        } else if (e.kind === "chart") {
          // 차트 — "A vs B" / "A,B" 형태면 bind/bind2 로 분리 (비교형 차트용)
          const parts = String(e.bind).split(/\s*(?:vs|VS|,|·|\/)\s*/).map((s) => s.trim()).filter(Boolean);
          item.bind = parts[0] || "";
          if (parts[1]) item.bind2 = parts[1];
          if (ee.bind2) item.bind2 = ee.bind2;
        } else {
          item.bind = e.bind;
        }
      } else if (ee.bind2) {
        item.bind2 = ee.bind2;
      }
      // chart 세부종류 보존 — 없으면 두 값이면 comparison, 한 값이면 (교정 단계에서 step 타입 보고 결정)
      if (e.kind === "chart") {
        item.ctype = ee.ctype || (item.bind2 ? "comparison" : undefined);
        if (ee.bind2 && !item.bind2) item.bind2 = ee.bind2;
      }
      out.push(item);
    }
  }
  // 안전망 — fields / note 가 누락되면 자동 추가 (사용자 식별 + 결과 안내 없으면 리포트 의미 X)
  const hasFields = out.some((e) => e.kind === "fields" || e.kind === "field");
  const hasNote = out.some((e) => e.kind === "note");
  if (!hasFields) {
    const idCandidates = ["성명", "사번", "부서", "직급"];
    const personalCore = (preview.vars || [])
      .filter((v) => v.grp === "개인" && v.category === "핵심")
      .map((v) => v.name);
    const binds = idCandidates.filter((n) => personalCore.includes(n));
    if (binds.length > 0) {
      out.unshift({ id: "auto", kind: "fields", label: "기본정보", binds });
    } else if (personalCore.length > 0) {
      out.unshift({ id: "auto", kind: "fields", label: "기본정보", binds: personalCore.slice(0, 4) });
    }
  }
  if (!hasNote) {
    const isFallback = label === (preview.fallback?.label || "미적용");
    const tpl = isFallback
      ? "해당 케이스는 본 앱 적용 대상이 아닙니다. 지원 범위와 자격 조건을 확인해 주세요."
      : "{LLM 분석}";
    out.push({ id: "auto", kind: "note", label: "안내", tpl });
  }

  // 이미 (값으로) 노출된 이름 집합 — bind / binds / note tpl 참조
  const shown = new Set<string>();
  const collectShown = () => {
    shown.clear();
    for (const e of out) {
      if (Array.isArray((e as any).binds)) for (const b of (e as any).binds) shown.add(b);
      if ((e as any).bind) shown.add((e as any).bind);
      if (e.kind === "note" && typeof (e as any).tpl === "string") {
        for (const m of (e as any).tpl.match(/\{([^}]+)\}/g) || []) shown.add(m.slice(1, -1).trim());
      }
    }
  };
  collectShown();

  // ── 산출 값(분석 로직 결과) 을 리포트에 최대한 노출 + 결과물(앱 목적) 필수 ──
  // 분석 로직이 계산한 step 값들을 card 로 보여준다. 특히 최종 결과물(마지막 산출 step) 은 반드시 포함.
  // (llm 은 note 로 들어가므로 제외. 이미 노출된 값은 중복 추가 안 함.)
  const VALUE_STEP_TYPES = new Set([
    "formula", "clamp", "switch", "table", "classify", "branch", "date",
  ]);
  const valueSteps: string[] = (pathSteps || [])
    .filter((s: any) => s && s.name && VALUE_STEP_TYPES.has(s.type))
    .map((s: any) => String(s.name));
  // 핵심 산식(calc) — "그 값이 어떻게 나왔는지" 식을 보여준다.
  //   calc 팔레트는 formula step 에서만 의미 있음(식=값 표시). 가장 하류 formula = 핵심식.
  const keyFormula =
    (pathSteps || []).filter((s: any) => s && s.name && s.type === "formula").map((s: any) => String(s.name)).pop() || "";
  if (valueSteps.length > 0) {
    const finalResult = valueSteps[valueSteps.length - 1]; // 마지막 산출 = 결과물
    // 핵심식은 calc 로 보여주므로 card 중복 추가 대상에서 제외
    const toAdd = valueSteps.filter((n) => !shown.has(n) && n !== keyFormula);
    // 결과물을 맨 앞으로 (강조)
    toAdd.sort((a, b) => (a === finalResult ? -1 : b === finalResult ? 1 : 0));
    const cards = toAdd.map((n) => ({ id: "auto", kind: "card", label: n, bind: n }));
    for (const n of toAdd) shown.add(n);
    const noteAt = out.findIndex((e) => e.kind === "note");
    if (cards.length) out.splice(noteAt >= 0 ? noteAt : out.length, 0, ...cards);
  }
  // 핵심 산식 calc 요소 (식 = 값). 앱 목적 값의 "산출 근거" 를 보여줌.
  if (keyFormula) {
    const hasCalc = out.some((e) => e.kind === "calc" && e.bind === keyFormula);
    if (!hasCalc) {
      const calcEl = { id: "auto", kind: "calc", label: keyFormula, bind: keyFormula };
      // 같은 값이 이미 card/field 로 있으면 calc 로 교체(식+값 둘 다 보임), 없으면 note 앞에 추가
      const dupIdx = out.findIndex(
        (e) => (e.kind === "card" || e.kind === "field") && e.bind === keyFormula
      );
      if (dupIdx >= 0) {
        out[dupIdx] = calcEl;
      } else {
        const noteAt2 = out.findIndex((e) => e.kind === "note");
        out.splice(noteAt2 >= 0 ? noteAt2 : out.length, 0, calcEl);
      }
      shown.add(keyFormula);
    }
  }

  // ── 개인 변수의 전체적 활용 ──
  // fields(묶음)는 식별 정보만 (성명/사번/부서/직급). 그 외 핵심 개인 변수는 개별 field 로 추가.
  // 사용자가 입력한 변수가 결과 화면에 안 보이면 "왜 입력했지?" 가 됨 — 단, 메타성은 제외.
  const META_EXCLUDE = /(비상연락처|연락처|이메일|email|메모|비고|주소|address|url|링크)/i;
  const unused = (preview.vars || [])
    .filter((v) => v.grp === "개인" && v.category === "핵심")
    .filter((v) => !shown.has(v.name))
    .filter((v) => !META_EXCLUDE.test(v.name));
  if (unused.length > 0) {
    let insertAt = out.findIndex((e) => e.kind === "fields");
    if (insertAt >= 0) {
      insertAt = insertAt + 1;
    } else {
      const noteAt = out.findIndex((e) => e.kind === "note");
      insertAt = noteAt >= 0 ? noteAt : out.length;
    }
    const newFields = unused.map((v) => ({ id: "auto", kind: "field", label: v.name, bind: v.name }));
    out.splice(insertAt, 0, ...newFields);
  }

  // ── 참고 문서의 표/그래프를 파싱한 step 으로부터 재현 (최대한 반영) ──
  //   classify(구성요소 표) → incexc,  table(구간표·감액곡선 등 graph) → chart(gauge 로 구간 내 위치).
  //   formula 산출식은 위에서 calc 로 이미 반영함.
  for (const s of pathSteps || []) {
    if (!s || !s.name) continue;
    const nm = String(s.name);
    if (s.type === "classify") {
      if (!out.some((e) => (e.kind === "incexc" || e.kind === "chart") && (e as any).bind === nm))
        out.push({ id: "auto", kind: "incexc", label: `${nm} 구성`, bind: nm });
    } else if (s.type === "table") {
      if (!out.some((e) => e.kind === "chart" && (e as any).bind === nm))
        out.push({ id: "auto", kind: "chart", ctype: "gauge", label: nm, bind: nm });
    }
  }

  // ── 팔레트 적합성 교정 — 값 종류에 안 맞는 팔레트는 card 로 ──
  // 예: 날짜/단일 숫자 산출(만나이계산)에 막대/도넛 차트는 부적합·미렌더 → card.
  //   chart 는 classify(도넛)·table/clamp(게이지) 에만, incexc 는 classify, calc 는 formula 에만 의미.
  {
    const stepType = new Map<string, string>();
    for (const s of pathSteps || []) if (s?.name) stepType.set(String(s.name), s.type);
    out = out.map((e: any) => {
      const b = e?.bind;
      if (!b || Array.isArray(e.binds)) return e; // fields/note 등은 그대로
      const t = stepType.get(b); // step 타입 (변수면 undefined)
      if (e.kind === "chart") {
        const ct = (e as any).ctype;
        // 비교형 차트 — 두 숫자/산식 값을 비교(이중막대·증감·목표대비·달성률). classify/table 불필요 → 유지.
        const COMPARE = ["comparison", "delta", "bullet", "ratio"];
        if (COMPARE.includes(ct) || (e as any).bind2) {
          return { ...e, ctype: COMPARE.includes(ct) ? ct : "comparison" };
        }
        // 구성형(도넛/누적) → classify, 구간형(막대/계단/게이지) → table/clamp
        if (t === "classify") return { ...e, ctype: ct === "stacked" ? "stacked" : "donut" };
        if (t === "table" || t === "clamp") return { ...e, ctype: (ct === "bar" || ct === "step") ? ct : "gauge" };
        // 단일 숫자/산식 값에 gauge 는 의미 있음(값의 위치) → gauge 로 유지
        if (t === "formula" || t === "date" || t === undefined) return { ...e, ctype: "gauge" };
        const { ctype, ...rest } = e; // 그 외 부적합 → card
        return { ...rest, kind: "card" };
      }
      if (e.kind === "incexc" && t !== "classify") return { ...e, kind: "card" };
      if (e.kind === "calc" && t !== "formula") return { ...e, kind: "card" };
      return e;
    });
  }

  // ── 중복 제거 — "같은 요소 팔레트에 같은 변수" 는 한 번만 ──
  // card/calc/incexc/chart 는 같은 step 의 '다른 뷰'(값·식·구성·곡선)이므로 종류가 다르면 공존 OK.
  // (1) fields 묶음: 묶음 안·묶음 간 같은 변수 중복 제거 (+ 빈 묶음 제거). 묶음에 든 변수 집합 = inFields.
  const inFields = new Set<string>();
  const pass1: any[] = [];
  for (const e of out) {
    if (e.kind === "fields" && Array.isArray((e as any).binds)) {
      const uniq: string[] = [];
      for (const b of (e as any).binds) {
        if (!b || inFields.has(b)) continue; // 묶음 안/묶음 간 중복
        inFields.add(b);
        uniq.push(b);
      }
      if (uniq.length === 0) continue; // 빈 묶음 제거
      pass1.push({ ...e, binds: uniq });
    } else pass1.push(e);
  }
  // (2) value 팔레트: 같은 종류+같은 변수 중복 제거 + 묶음에 든 변수는 개별 card/field 로 또 안 보임.
  const VALUE_KINDS = new Set(["card", "field", "calc", "incexc", "chart"]);
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const e of pass1) {
    const bind = (e as any).bind;
    if (bind) {
      if ((e.kind === "card" || e.kind === "field") && inFields.has(bind)) continue; // 묶음 변수 중복
      if (VALUE_KINDS.has(e.kind)) {
        // chart 는 같은 bind 라도 종류(ctype)·비교대상(bind2)이 다르면 다른 차트 → 키에 포함
        const key =
          e.kind + "::" + bind +
          (e.kind === "chart"
            ? "::" + ((e as any).ctype || "") + "::" + ((e as any).bind2 || "")
            : "");
        if (seen.has(key)) continue; // 같은 종류+같은 값 중복
        seen.add(key);
      }
    }
    deduped.push(e);
  }
  return deduped;
}
