// 직무 성과책임 12레벨 표 — AI 생성과 O*NET 참고 직업 조회.
//
// 역할 분담
//   AI는 (1) 성과영역 목록·상한 제안, (2) 영역별 레벨 문장 작성만 한다.
//   공란·표 형식은 화면 코드가 규칙으로 처리한다.
//
// 요청을 나누는 이유
//   직무 하나에 문장이 100개를 넘는다. 한 번에 만들면 Vercel 요청당 60초 제한에 걸리고 품질도 떨어지므로,
//   앱 빌더의 단계별 분석(/api/spec-stage)처럼 영역마다 별도 요청으로 만든다.

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { trackedGenerate } from "@/lib/llm-usage";
import { LEVELS, MAX_LEVEL, type JobArea, type LevelSentence } from "./levels";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);

// 응답 모양을 스키마로 고정한다.
// 스키마 없이 JSON 만 요구했을 때, 같은 입력에서도 가끔 키 이름이 바뀌어 영역을 하나도 읽지 못한 적이 있다(2026-11-13 로컬 테스트).
const str = { type: SchemaType.STRING } as const;
const int = { type: SchemaType.INTEGER } as const;
const AREAS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    areas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { name: str, target: str, ceiling: int, ceilingReason: str, onetKeyword: str },
        required: ["name", "target", "ceiling", "ceilingReason", "onetKeyword"],
      },
    },
  },
  required: ["areas"],
};
const LEVELS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    levels: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { level: int, accountability: str, meaning: str },
        required: ["level", "accountability", "meaning"],
      },
    },
  },
  required: ["levels"],
};

function jsonModel(temperature: number, schema: ResponseSchema, model = MODEL) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 누락");
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 16384,
      temperature,
      // Pro 모델은 생각 단계를 끌 수 없어(0이면 오류) 최소한으로 준다.
      thinkingConfig: { thinkingBudget: /pro/.test(model) ? Math.max(THINKING_BUDGET, 1024) : THINKING_BUDGET },
    } as any,
  });
}

// 스키마가 지켜지지 않은 경우를 대비해, 정해진 키가 없으면 응답 안의 첫 배열을 쓴다.
function listOf(out: any, key: string): any[] {
  if (Array.isArray(out)) return out;
  if (Array.isArray(out?.[key])) return out[key];
  const first = out && typeof out === "object" ? Object.values(out).find(Array.isArray) : undefined;
  return Array.isArray(first) ? first : [];
}

function parseJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(t);
}

// Gemini 의 503(과부하)·429(한도)·500 은 잠깐 뒤 다시 부르면 대개 성공한다.
// 실제 테스트에서 영역 12개 생성 중 503 이 한 번 났다. 요청당 60초 안에 들어오도록 두 번까지만 다시 시도한다.
const TRANSIENT = /\b(429|500|503)\b|overloaded|unavailable|RESOURCE_EXHAUSTED/i;

async function askJson(prompt: string, temperature: number, schema: ResponseSchema, model?: string): Promise<any> {
  const waits = [1500, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await trackedGenerate(jsonModel(temperature, schema, model), {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return parseJson(res.response.text());
    } catch (e: any) {
      const msg = String(e?.message || e);
      const badJson = e instanceof SyntaxError; // 응답이 중간에 끊긴 경우 — 다시 부르면 대개 정상
      if (attempt >= waits.length || !(badJson || TRANSIENT.test(msg))) {
        if (badJson) throw new Error("AI 응답을 읽지 못했습니다. 다시 시도해 주세요.");
        throw new Error(TRANSIENT.test(msg) ? "AI 서버가 잠시 혼잡합니다. 잠시 후 다시 시도해 주세요." : msg);
      }
      await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
}

const clean = (v: unknown, max: number) =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const LEVEL_TABLE = LEVELS.map(
  (l) => `L${l.level} | ${l.group} | ${l.judgment} | ${l.scope} | ${l.question}`,
).join("\n");

// ── 1단계: 성과영역 구조화 ─────────────────────────────────────

export type AreasInput = { jobName: string; industry: string; kraText: string };

export async function proposeAreas(input: AreasInput): Promise<JobArea[]> {
  const prompt = `당신은 HRCoach 12레벨 성과책임 기준을 따르는 직무분석 전문가입니다.
아래 직무를 독립된 성과영역(KRA)으로 구조화하고, 영역마다 12레벨 중 인정 가능한 상한 레벨을 제안하세요.

## 직무
- 직무명: ${input.jobName}
- 산업·회사 특성: ${input.industry || "(입력 없음)"}
- 사용자가 적은 KRA·주요 업무:
${input.kraText || "(입력 없음)"}

## 12레벨 기준 (L | 레벨군 | 판단·권한 기준 | 책임 범위 | 핵심 판정 질문)
${LEVEL_TABLE}

## 규칙
1. 사용자가 적은 KRA는 빠짐없이 영역으로 살린다. 이름은 짧은 명사구로 다듬는다(예: '품목분류·허가경로 판정').
2. 적은 KRA가 직무의 핵심을 다 덮지 못하면, 이 직무에서 통상 독립 성과가 성립하는 영역을 보완해 전체 8~18개로 만든다.
3. 세부 작업(Task)을 별도 영역으로 과도하게 쪼개지 않는다. 최종 결과·판단·위험이 같으면 하나의 영역으로 묶는다.
4. target에는 그 영역의 구체적 성과대상과 최종 결과를 한 줄로 쓴다(예: '의료기기 품목·등급·허가경로의 적정성과 오분류 위험').
5. ceiling(상한)은 개인 역량의 한계가 아니라 '그 성과영역에서 지속적으로 부여될 수 있는 최종 판단·권한·영향의 최대치'다.
   레벨은 직급·연차·숙련도·업무량이 아니라 성과책임의 범위와 판단·결정권의 깊이로 정한다.
   - 정형 지원·기록·행정 중심 영역은 L6~L8.
   - 전문 판단이 핵심인 영역(예: 인허가 경로·변경 판정, 품질 판정·CAPA, 급여·노무 기준 해석)은
     조직 간 기준 정립(L8), 전문 방법·시스템 혁신(L9), 기능 운영구조 혁신(L10)이 그 영역에서 성립하는 만큼 L8~L10으로 둔다.
   - L11·L12는 복수 기능의 상충을 통합 결정하거나 사업 전체의 결과를 최종 책임지는 경우에만. 일반 담당 직무에는 쓰지 않으며, 직함만으로 부여하지 않는다.
   - 정부 허가·인증, 최종 승인처럼 담당자가 갖지 않는 권한을 근거로 상한을 올리지 않는다.
6. ceilingReason에는 상한을 그렇게 정한 이유를 한 문장으로 쓴다.
7. onetKeyword에는 이 영역과 가장 가까운 미국 O*NET 직업명을 영어 1~4단어로 쓴다(예: 'Regulatory Affairs Specialists').

## 출력 JSON
{"areas":[{"name":"","target":"","ceiling":8,"ceilingReason":"","onetKeyword":""}]}`;

  const toAreas = (out: any) =>
    listOf(out, "areas")
      .map((a, i) => ({
        id: `a${i + 1}`,
        name: clean(a?.name, 40),
        target: clean(a?.target, 160),
        ceiling: Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(a?.ceiling) || 8))),
        ceilingReason: clean(a?.ceilingReason, 200),
        onetKeyword: clean(a?.onetKeyword, 60).replace(/[^A-Za-z0-9 ,&/-]/g, ""),
      }))
      .filter((a) => a.name)
      .slice(0, 20);

  // 영역 구성은 표 전체의 뼈대라 같은 입력이면 최대한 같게 나오도록 무작위성을 0으로 둔다
  // (0.3에서 같은 입력 5회 시 영역 수 8~10개, 상한 최대 3단계 차이).
  // 영역이 하나도 안 나오면 입력 문제보다 응답 형식 문제인 경우가 많아 한 번 더 요청한다.
  let areas = toAreas(await askJson(prompt, 0, AREAS_SCHEMA));
  if (!areas.length) areas = toAreas(await askJson(prompt, 0.2, AREAS_SCHEMA));
  if (!areas.length) throw new Error("성과영역을 만들지 못했습니다. 잠시 후 다시 시도하거나, 직무명이나 KRA를 조금 더 구체적으로 적어 주세요.");

  // 같은 키워드는 한 번만 조회한다. 키가 없거나 조회가 실패해도 표 작성에는 영향이 없다.
  const keywords = Array.from(new Set(areas.map((a) => a.onetKeyword).filter(Boolean)));
  const found = new Map<string, { code: string; title: string } | null>();
  await Promise.all(keywords.map(async (k) => found.set(k, await onetSearch(k))));
  return areas.map((a) => ({ ...a, onet: a.onetKeyword ? found.get(a.onetKeyword) ?? null : null }));
}

// ── O*NET 참고 직업 ─────────────────────────────────────────
// 1차 범위는 '참고 직업 표시'까지다. 점수 계산에는 쓰지 않는다(O*NET 값은 직업 단위라 레벨별 차이를 만들지 못한다).
// 호출 방식은 케이프라임 ATS 리포트 워크플로(n8n)에서 쓰던 O*NET Web Services v2 검색과 같다.
async function onetSearch(keyword: string): Promise<{ code: string; title: string } | null> {
  const key = process.env.ONET_API_KEY;
  if (!key || !keyword) return null;
  try {
    const url = `https://api-v2.onetcenter.org/online/search?keyword=${encodeURIComponent(keyword)}&end=1`;
    const r = await fetch(url, {
      headers: { "X-API-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const o = d?.occupation?.[0];
    return o?.code && o?.title ? { code: String(o.code), title: String(o.title) } : null;
  } catch {
    return null;
  }
}

// ── 2단계: 영역별 레벨 문장 ─────────────────────────────────
//
// 문장 형식은 기획서 v1.1 5장을 따른다: '성과책임. (의미: 실제 달성 상황과 책임범위 설명.)'
//   성과책임 본문은 한 문장·한 핵심성과로, 구체적 성과 목적어와 방향성 술어로 끝낸다. 수단(괄호)은 쓰지 않는다.

export type LevelsInput = {
  jobName: string;
  industry: string;
  area: Pick<JobArea, "name" | "target" | "ceiling">;
  otherAreas: string[];
};

// 기획서의 권장 술어. 본문은 이 중 하나로 끝나야 한다.
export const DIRECTION_ENDINGS = ["제고한다", "향상한다", "증대한다", "확대한다", "상향한다", "감소시킨다", "절감한다", "단축한다"];
const DIRECTION_END = new RegExp(`(${DIRECTION_ENDINGS.join("|")})\\.$`);
// 업무행위로 끝나는 문장 (기획서: 관리한다·확인한다·처리한다·해결한다 등 금지)
const ACTIVITY_END = /(관리|확인|처리|해결|운영|검토|작성|수행|지원|담당|강화)한다\.?$/;
// 여러 술어를 잇는 복문 (예: '~을 분석하고 ~을 제고한다')
const COMPOUND = /(하고|하며|하여|하면서|시키고|시키며)\s/;
const GENERIC = /(해당\s?업무|업무의 적정수행률|적정 수행률)/;
// 레벨 문장에 쓰는 모델.
// 2026-11-26 같은 5개 영역(60문장) 비교: gemini-3.5-flash 는 교정 단계를 거쳐도 비단어·비문이 약 20%('작수한', '직불 임금',
// '대손실충금' 등)였고, gemini-3.1-pro-preview 는 교정 없이 0건이었다. 고객이 HR 전문가라 문장 품질을 우선해 Pro 를 쓴다.
// 환경변수로 바꿀 수 있다(예: 단가·속도 때문에 Flash 로 되돌릴 때).
const LEVELS_MODEL = process.env.JOB_LEVELS_MODEL || "gemini-3.1-pro-preview";
// Flash 계열일 때만 교정 단계를 쓴다.
const NEEDS_PROOFREAD = !/pro/.test(LEVELS_MODEL);
// 영역 하나가 요청 하나이고 요청당 60초 제한이 있다. Pro 는 한 번 작성에 20~45초라,
// 시간이 이만큼 지났으면 재작성·교정을 건너뛰고 남은 문제는 화면에 '확인 필요'로 보여 준다.
const RETRY_IF_UNDER_MS = 25_000;
const PROOFREAD_IF_UNDER_MS = 35_000;
const MAX_BODY = 80;
const MAX_MEANING = 60;
// 아래 규칙은 고객 기획서 기준으로 독립 검수(2026-11-26, 생성 문장 143개)에서 반복 지적된 문제들이다.
// '~를 통한 ~을 감소시킨다' 같은 비문
const TONGHAN = /통한\s/;
// 결과 대신 내가 한 행위의 실행 정도를 성과로 쓴 경우
// ('승인된 인력계획의 적기 이행률'처럼 계획·합의의 이행률은 기획서 예시에도 있는 결과 지표라 허용한다)
const ACTION_RATE = /(표준화\s?이행률|절차\s?이행률|개선율|개선도|확립률|정립률|수립률|실행률|추진율|도입률|표준화\s?수준|관리\s?효율)/;
// 성과 목적어를 '및'으로 두 개 이은 경우 (예: '일정 준수율 및 평가 완료율을')
const TWO_RESULTS = /(률|율|도|성)\s*및\s+[^\s]+/;
// 수단을 '및'으로 두 개 이은 경우 (예: '이견 조정 및 기준 정립으로')
const TWO_MEANS = /(조정|조율|분석|개선|정립|수립|확립|표준화|재설계|혁신)\s*및\s+[^.]*?(조정|조율|분석|개선|정립|수립|확립|표준화|재설계|혁신)(으로|로)\s/;
// '단축한다'는 시간·기간에만 쓴다
const TIME_WORD = /(시간|기간|기일|일수|리드타임|주기|소요|일정|지연|회전일)/;

// 의미가 본문을 거의 그대로 되풀이하는지: 의미 글자쌍의 70% 이상이 본문에 있으면 되풀이로 본다.
function repeatsBody(body: string, meaning: string): boolean {
  const pairs = (t: string) => {
    const c = t.replace(/[\s.,·]/g, "");
    const out: string[] = [];
    for (let i = 0; i < c.length - 1; i++) out.push(c.slice(i, i + 2));
    return out;
  };
  const m = pairs(meaning);
  if (m.length < 4) return false;
  const b = new Set(pairs(body));
  return m.filter((x) => b.has(x)).length / m.length >= 0.7;
}

export function checkSentences(list: LevelSentence[], ceiling: number): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  const stems = new Map<string, number>();
  for (let L = 1; L <= ceiling; L++) {
    const s = list.find((x) => x.level === L);
    if (!s || !s.accountability) { issues.push(`L${L} 문장이 빠졌습니다`); continue; }
    const body = s.accountability;
    if (!s.meaning) issues.push(`L${L} '의미'가 빠졌습니다`);
    if (ACTIVITY_END.test(body)) issues.push(`L${L} 성과책임이 업무행위('~관리한다' 등)로 끝납니다`);
    else if (!DIRECTION_END.test(body)) issues.push(`L${L} 성과책임이 권장 술어(${DIRECTION_ENDINGS.join("·")})로 끝나지 않습니다`);
    // '(TO)'·'(KPI)'처럼 짧은 영문 약어를 단 괄호는 수단이 아니므로 허용한다.
    if (/[()]/.test(body.replace(/\([A-Za-z0-9&\s]{1,8}\)/g, ""))) issues.push(`L${L} 성과책임에 괄호가 있습니다(수단·의미는 본문에 넣지 않음)`);
    if (COMPOUND.test(body) || (body.match(/다\./g) || []).length > 1) issues.push(`L${L} 성과책임이 한 문장·한 핵심성과가 아닙니다(복문)`);
    if (body.length > MAX_BODY) issues.push(`L${L} 성과책임이 ${MAX_BODY}자를 넘습니다`);
    if (GENERIC.test(body)) issues.push(`L${L} 성과책임에 '해당업무' 같은 일반 표현이 있습니다`);
    // 의미 길이는 기준(60자)보다 여유를 두고 확인한다. 조금 긴 것까지 다시 쓰게 하면 요청 시간만 늘어난다.
    if (s.meaning.length > MAX_MEANING + 30) issues.push(`L${L} '의미'가 너무 깁니다`);
    if (s.meaning && repeatsBody(body, s.meaning)) issues.push(`L${L} '의미'가 성과책임 본문을 되풀이합니다`);
    if (TONGHAN.test(body)) issues.push(`L${L} '~를 통한 ~을' 비문입니다. '~으로'로 고쳐 쓰십시오`);
    if (ACTION_RATE.test(body)) issues.push(`L${L} 성과가 결과가 아니라 행위의 실행 정도(개선율·확립률 등)입니다`);
    const object = body.split(/(?:으로|로)\s/).pop() || body;
    if (TWO_RESULTS.test(object)) issues.push(`L${L} 성과 목적어가 두 개입니다('A 및 B를')`);
    if (TWO_MEANS.test(body)) issues.push(`L${L} 수단이 두 개입니다('A 및 B로')`);
    if (/단축한다\.$/.test(body) && !TIME_WORD.test(object)) issues.push(`L${L} '단축한다'는 시간·기간에만 씁니다`);
    if (L <= 7 && /전사/.test(body)) issues.push(`L${L} 담당 범위 레벨에 '전사'를 썼습니다`);
    if (/이견을\s?합의/.test(body + s.meaning)) issues.push(`L${L} '이견을 합의'는 말의 짝이 맞지 않습니다('이견을 조정')`);
    if (L === 1 && /(정확|오류|누락)/.test(s.meaning)) issues.push(`L1 의미에 정확성(L2의 책임)이 섞였습니다`);
    if (L === 11 && /(조정|조율|합의)/.test(body + s.meaning)) issues.push(`L11에 L8의 '조정·조율'을 썼습니다. 서로 다른 기능의 '통합 결정'으로 쓰십시오`);
    if (L >= 9 && /(근본적으로|전면|완전히|원점)/.test(s.meaning)) issues.push(`L${L} 의미가 구체적이지 않습니다('근본적으로·전면' 대신 무엇을 어떻게 바꾸는지)`);
    const key = body.replace(/\s/g, "");
    const stem = key.replace(DIRECTION_END, "");
    if (seen.has(key)) issues.push(`L${L} 성과책임이 L${seen.get(key)}와 같습니다`);
    else if (stems.has(stem)) issues.push(`L${L} 성과책임이 L${stems.get(stem)}와 술어만 다릅니다`);
    seen.set(key, L);
    stems.set(stem, L);
  }
  return issues;
}

function normalize(raw: any, ceiling: number): LevelSentence[] {
  const arr: any[] = listOf(raw, "levels");
  const byLevel = new Map<number, LevelSentence>();
  const withPeriod = (t: string) => (t && !/[.。]$/.test(t) ? `${t}.` : t);
  for (const x of arr) {
    const level = Math.round(Number(x?.level));
    if (!(level >= 1 && level <= ceiling) || byLevel.has(level)) continue;
    // 본문에 의미를 붙여 보낸 경우 떼어 낸다.
    let accountability = clean(x?.accountability, 200);
    let meaning = clean(x?.meaning, 300);
    const inBody = accountability.match(/\s*\(\s*의미\s*[:：]\s*(.*?)\)?\s*$/);
    if (inBody) {
      accountability = accountability.slice(0, inBody.index).trim();
      if (!meaning) meaning = inBody[1].trim();
    }
    meaning = meaning.replace(/^\(?\s*의미\s*[:：]\s*/, "").replace(/\)\s*$/, "").trim();
    byLevel.set(level, { level, accountability: withPeriod(accountability), meaning: withPeriod(meaning) });
  }
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

export function levelsPrompt(input: LevelsInput): string {
  const ceiling = input.area.ceiling;
  const rows = LEVELS.map((l) => `L${l.level} | ${l.group} | ${l.judgment} | ${l.scope} | ${l.question}`).join("\n");
  const examples = LEVELS.filter((l) => l.level <= ceiling)
    .map((l) => `L${l.level} | ${l.example.accountability} | ${l.example.meaning}`)
    .join("\n");

  return `당신은 HRCoach 12레벨 성과책임 기준을 따르는 직무분석 전문가입니다.
한 성과영역의 성과책임 후보를 L1부터 L${ceiling}까지 레벨마다 정확히 1개씩 작성하세요.

## 대상
- 직무명: ${input.jobName}
- 산업·회사 특성: ${input.industry || "(입력 없음)"}
- 성과영역: ${input.area.name}
- 핵심 성과대상·최종 결과: ${input.area.target || "(입력 없음)"}
- 같은 직무의 다른 성과영역(이 영역과 겹치는 결과를 쓰지 말 것): ${input.otherAreas.join(", ") || "(없음)"}

## 12레벨 기준 (L | 레벨군 | 판단·권한 기준 | 책임 범위 | 핵심 판정 질문)
${rows}

상위 레벨 구분: L8은 조직 간 기준과 이견을 조정하는 책임, L9는 전문 수행방법·시스템의 혁신, L10은 그 기능 전체의 구조·역할·자원 재설계다.
L11은 복수 기능의 상충을 통합 결정하며 공동 최종결과 자체를 책임지고, L12는 사업의 존속·성장 등 본질적 결과를 최종 책임진다.
L10까지는 이 성과영역이 속한 기능 안의 책임이며, 전사·사업 전체의 결과는 L11·L12에서만 쓴다.
L11의 '복수 기능'은 생산·영업·재무·인사처럼 서로 다른 기능이다. 같은 기능 안의 세부 업무(예: 인사 안의 채용·평가·보상)를 묶은 것은 L11이 아니다.

## 예시 (L | 성과책임 | 의미)
다른 직무(제조기업 품질관리 / 공정 불량관리)의 문장이다. 형식과 레벨 간 책임 크기의 차이를 보여 주는 참고용이며, 예시의 업종 용어와 문장을 그대로 가져오지 않는다.
${examples}

## 작성 규칙
1. accountability(성과책임)는 '[필요 시 전제·레벨별 차별요인] + [구체적 성과 목적어] + [방향성 술어]'로 된 한 문장이다. 하나의 핵심성과만 쓴다.
   - 성과 목적어는 하나만 쓴다. 'A률 및 B률을'처럼 둘을 잇지 않는다.
   - 성과 목적어는 업무 대상의 결과 상태(불량률, 정확도, 재발률, 예측 정확도, 손실 비용 등)로 쓴다.
     '표준화 이행률·개선율·확립률·표준화 수준·관리 효율'처럼 내가 한 행위를 얼마나 했는지를 목적어로 쓰지 않는다.
   - 차별요인(수단)은 '~으로' 한 번만 쓴다. 'A 조정 및 B 정립으로'처럼 둘을 잇지 않고, '~를 통한'·'~를 통해' 대신 '~으로'를 쓴다.
2. accountability는 다음 술어 중 하나로 끝내고, 목적어와 호응하게 쓴다: ${DIRECTION_ENDINGS.join(", ")}.
   단축한다는 시간·기간에만, 감소시킨다·절감한다는 줄여야 할 것(불량률·비용·위험)에, 제고한다·향상한다·상향한다는 높여야 할 것에,
   증대한다·확대한다는 양·규모·범위에 쓴다.
3. '관리한다·확인한다·처리한다·해결한다·운영한다·검토한다' 같은 업무행위로 끝내지 않는다.
   '~하고·~하며·~하여'로 술어를 잇는 복문, 업무 나열, 불필요한 수식어, 괄호를 쓰지 않는다. 예시처럼 ${MAX_BODY}자 이내로 간결하게 쓴다.
4. meaning(의미)에는 실제로 무엇을 달성하는 상황인지와 책임이 어디까지인지를 쉬운 말 한 문장으로 쓴다.
   본문을 되풀이하지 않고, 바로 아래 레벨과 무엇이 다른지가 드러나게 쓴다. 예시처럼 ${MAX_MEANING}자 이내로 짧게 쓰고, '의미:'나 괄호는 붙이지 않는다.
   L1의 의미는 정해진 작업을 기한까지 끝내는 것까지만 쓴다('정확히·오류 없이'는 L2의 책임이다).
   예시의 의미 문구('개별 건 처리에 그치지 않고', '사업책임자가 …를 판단하고' 등)를 그대로 옮기지 말고 이 영역의 말로 쓴다.
   L9 이상의 의미는 '근본적으로·전면·완전히'처럼 기준표를 되풀이하는 말 대신, 이 영역에서 무엇을 어떻게 바꾸는지 구체적으로 쓴다.
5. 레벨이 올라갈수록 통제 범위·판단권·성과의 크기가 분명히 커져야 한다. 각 레벨은 그 레벨의 핵심 판정 질문에 '예'가 되는 책임을 쓴다.
   업무명만 바꾼 공통문장, 술어만 바꾼 문장, 인접 레벨과 같은 성과지표의 반복을 쓰지 않는다.
   L1~L7은 담당 범위의 책임이므로 '전사'를 쓰지 않는다.
   L5의 성과는 제거한 원인 때문에 반복되던 바로 그 문제의 재발률·발생률로 쓴다.
   L10의 '기능'은 이 업무영역이 속한 부서 단위 기능 전체(예: 품질기능, 구매기능, 인사기능, 영업관리 기능)다. 업무영역 자체(예: 납기관리, 채권관리)를 기능이라 부르지 않는다.
   L11은 서로 다른 기능의 상충 목표·자원을 '통합 결정'하여 공동 최종결과를 책임지는 수준이다. '조정·조율·합의'는 L8의 말이므로 L11에 쓰지 않고, 의미에 '기여한다'처럼 책임을 흐리는 말을 쓰지 않는다.
6. 근거 없는 권한·목표·실적을 확정하지 않는다. 정부·외부기관의 결정 권한을 담당자의 결과로 쓰지 않는다.
   품질·안전·법규·승인 요건은 모든 레벨의 전제로 유지한다(필요하면 '~를 전제로').
7. 숫자 목표치나 점수는 쓰지 않는다. 목표치는 별도로 합의한다.
8. 사전에 없는 말·오타·비문 없이 바른 한국어로 쓰고, 말의 짝을 맞춘다(예: '이견을 합의'가 아니라 '이견을 조정', '기준을 합의'). 입력에 없는 전제(예: 해외 사업, 글로벌)를 지어내지 않는다.

## 출력 JSON
{"levels":[{"level":1,"accountability":"","meaning":""}]}`;
}

// ── 교정 ──
// 독립 검수에서 비단어·오타·비문이 생성 문장의 약 9%였다(예: '대손실충금', '~를 통한 ~을 감소시킨다', 영어 단어 섞임).
// 같은 모델이라도 '고치기만 하는' 좁은 요청에서는 이런 오류를 잘 잡으므로, 다 쓴 뒤 한 번 교정한다.
// 교정이 점검 규칙을 새로 어기는 문장은 교정 전 문장을 그대로 둔다.
export function proofreadPrompt(list: LevelSentence[], context: string): string {
  const rows = list.map((s) => `L${s.level} | ${s.accountability} | ${s.meaning}`).join("\n");
  return `당신은 한국어 인사(HR) 문서 교정자입니다. 아래는 '${context}'의 레벨별 성과책임 문장입니다 (L | 성과책임 | 의미).
내용·레벨·문장 구조는 바꾸지 말고, 다음 오류만 고치세요. 오류가 없는 문장은 글자 하나 바꾸지 말고 그대로 돌려주세요.
1. 오타, 사전에 없는 말, 업무 문서에 쓰지 않는 어색한 낱말, 같은 단어의 반복
   (예: '대손실충금'→'대손충당금', '납기관측'→'납기 추적', '분석 분석'→'분석')
2. 조사·어미가 맞지 않는 비문(예: '원인 제거를 통한 재발률을 감소시킨다'→'원인 제거로 재발률을 감소시킨다', '입력 작업을 기한 내 완료율을'→'입력의 기한 내 완료율을')
3. 목적어와 술어가 호응하지 않는 경우(단축한다는 시간·기간에만, 감소시킨다·절감한다는 줄여야 할 것에, 제고한다·향상한다·상향한다는 높여야 할 것에)
4. 영문 알파벳으로 쓴 일반 단어(예: regulatory)는 한국어로 바꾼다.
   데이터·시스템·모델 같은 외래어와 RA·R&D·KPI 같은 업계 약어는 오류가 아니므로 그대로 둔다.
성과책임은 반드시 ${DIRECTION_ENDINGS.join(", ")} 중 하나로 끝나야 하고, 괄호를 쓰지 않습니다. 의미에는 '의미:'나 괄호를 붙이지 않습니다.

${rows}

## 출력 JSON (입력과 같은 레벨 전부)
{"levels":[{"level":1,"accountability":"","meaning":""}]}`;
}

export async function proofread(list: LevelSentence[], ceiling: number, context: string): Promise<LevelSentence[]> {
  if (!list.length) return list;
  let fixed: LevelSentence[];
  try {
    fixed = normalize(await askJson(proofreadPrompt(list, context), 0, LEVELS_SCHEMA, LEVELS_MODEL), ceiling);
  } catch {
    return list; // 교정 실패는 교정 전 문장으로 진행한다.
  }
  const issuesAt = (l: LevelSentence[], L: number) => checkSentences(l, ceiling).filter((x) => x.startsWith(`L${L} `)).length;
  let out = list;
  for (const f of fixed) {
    const i = out.findIndex((s) => s.level === f.level);
    if (i < 0 || !f.accountability || !f.meaning) continue;
    const trial = out.map((s, k) => (k === i ? f : s));
    if (issuesAt(trial, f.level) <= issuesAt(out, f.level)) out = trial;
  }
  return out;
}

export async function generateAreaLevels(
  input: LevelsInput,
): Promise<{ sentences: LevelSentence[]; warnings: string[] }> {
  const ceiling = input.area.ceiling;
  const basePrompt = levelsPrompt(input);
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let sentences = normalize(await askJson(basePrompt, 0.4, LEVELS_SCHEMA, LEVELS_MODEL), ceiling);
  let issues = checkSentences(sentences, ceiling);

  // 빠진 레벨이나 형식 위반이 있으면 한 번만 다시 쓰게 한다. 두 번째 결과가 더 나쁘면 첫 결과를 유지한다.
  if (issues.length && elapsed() < RETRY_IF_UNDER_MS) {
    const retry = `${basePrompt}

## 직전 결과의 문제 (반드시 고쳐서 L1~L${ceiling} 전체를 다시 출력)
${issues.map((s) => `- ${s}`).join("\n")}`;
    try {
      const again = normalize(await askJson(retry, 0.3, LEVELS_SCHEMA, LEVELS_MODEL), ceiling);
      const againIssues = checkSentences(again, ceiling);
      if (againIssues.length <= issues.length) {
        sentences = again;
        issues = againIssues;
      }
    } catch {
      // 재시도 실패는 첫 결과로 진행한다.
    }
  }
  if (NEEDS_PROOFREAD && elapsed() < PROOFREAD_IF_UNDER_MS) {
    sentences = await proofread(sentences, ceiling, `${input.jobName} / ${input.area.name}`);
  }
  return { sentences, warnings: checkSentences(sentences, ceiling) };
}
