// 직무 성과책임 18레벨 표 — AI 생성과 O*NET 참고 직업 조회.
//
// 역할 분담
//   AI는 (1) 성과영역 목록·상한 제안, (2) 영역별 레벨 문장 작성만 한다.
//   점수·공란·표 형식은 lib/job-levels/score.ts 와 화면 코드가 규칙으로 처리한다.
//
// 요청을 나누는 이유
//   직무 하나에 문장이 200개를 넘는다. 한 번에 만들면 Vercel 요청당 60초 제한에 걸리고 품질도 떨어지므로,
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
        properties: { level: int, means: str, outcome: str },
        required: ["level", "means", "outcome"],
      },
    },
  },
  required: ["levels"],
};

function jsonModel(temperature: number, schema: ResponseSchema) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 누락");
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 16384,
      temperature,
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
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

async function askJson(prompt: string, temperature: number, schema: ResponseSchema): Promise<any> {
  const waits = [1500, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await trackedGenerate(jsonModel(temperature, schema), {
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
  (l) => `L${l.level} | ${l.group} | ${l.judgment} | ${l.state} | (${l.meansPattern})`,
).join("\n");

// ── 1단계: 성과영역 구조화 ─────────────────────────────────────

export type AreasInput = { jobName: string; industry: string; kraText: string };

export async function proposeAreas(input: AreasInput): Promise<JobArea[]> {
  const prompt = `당신은 HRCoach 성과책임·직무가치 통합운영가이드 v4.1을 따르는 직무분석 전문가입니다.
아래 직무를 독립된 성과영역(KRA)으로 구조화하고, 영역마다 18레벨 중 인정 가능한 상한 레벨을 제안하세요.

## 직무
- 직무명: ${input.jobName}
- 산업·회사 특성: ${input.industry || "(입력 없음)"}
- 사용자가 적은 KRA·주요 업무:
${input.kraText || "(입력 없음)"}

## 18레벨 기준 (L | 레벨군 | 판단·권한 책임 크기 | 대표 성과상태 | 수단 표현 틀)
${LEVEL_TABLE}

## 규칙
1. 사용자가 적은 KRA는 빠짐없이 영역으로 살린다. 이름은 짧은 명사구로 다듬는다(예: '품목분류·허가경로 판정').
2. 적은 KRA가 직무의 핵심을 다 덮지 못하면, 이 직무에서 통상 독립 성과가 성립하는 영역을 보완해 전체 8~18개로 만든다.
3. 세부 작업(Task)을 별도 영역으로 과도하게 쪼개지 않는다. 최종 결과·판단·위험이 같으면 하나의 영역으로 묶는다.
4. target에는 그 영역의 구체적 성과대상과 최종 결과를 한 줄로 쓴다(예: '의료기기 품목·등급·허가경로의 적정성과 오분류 위험').
5. ceiling(상한)은 개인 역량의 한계가 아니라 '그 성과영역에서 지속적으로 부여될 수 있는 최종 판단·권한·영향의 최대치'다.
   - 정형 지원·기록·행정 중심 영역은 L9~L12.
   - 전문 판단이 핵심인 영역(예: 인허가 경로·변경 판정, 품질 판정·CAPA, 급여·노무 기준 해석)은
     전문 방법론 설계(L13), 대안 간 상충 조정(L14), 기능 구조 혁신(L15), 성과도구 효과검증(L16)이 그 영역에서 성립하는 만큼 L13~L16으로 둔다.
     참고로 고객 기준 샘플(렌즈 인허가 17개 영역, 렌즈 품질관리 18개 영역)은 상한이 대부분 L13~L16이었다.
   - L17·L18은 전사 복합 시스템 설계나 상충 조직목적의 최종 조정권이 있는 경우에만. 일반 담당 직무에는 쓰지 않는다.
   - 정부 허가·인증, 최종 승인처럼 담당자가 갖지 않는 권한을 근거로 상한을 올리지 않는다.
6. ceilingReason에는 상한을 그렇게 정한 이유를 한 문장으로 쓴다.
7. onetKeyword에는 이 영역과 가장 가까운 미국 O*NET 직업명을 영어 1~4단어로 쓴다(예: 'Regulatory Affairs Specialists').

## 출력 JSON
{"areas":[{"name":"","target":"","ceiling":12,"ceilingReason":"","onetKeyword":""}]}`;

  const toAreas = (out: any) =>
    listOf(out, "areas")
      .map((a, i) => ({
        id: `a${i + 1}`,
        name: clean(a?.name, 40),
        target: clean(a?.target, 160),
        ceiling: Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(a?.ceiling) || 12))),
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

export type LevelsInput = {
  jobName: string;
  industry: string;
  area: Pick<JobArea, "name" | "target" | "ceiling">;
  otherAreas: string[];
};

// 결과 본문 끝에 오면 안 되는 수행행위 동사 (가이드 5.1, 검수 규칙 F-02)
const ACTIVITY_END = /(관리|운영|검토|작성|수행|지원|담당)한다\.?$/;
const GENERIC = /(해당\s?업무|업무의 적정수행률|적정 수행률)/;

function checkSentences(list: LevelSentence[], ceiling: number): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  for (let L = 1; L <= ceiling; L++) {
    const s = list.find((x) => x.level === L);
    if (!s || !s.means || !s.outcome) { issues.push(`L${L} 문장이 빠졌습니다`); continue; }
    if (ACTIVITY_END.test(s.outcome)) issues.push(`L${L} 결과가 수행행위('~관리한다' 등)로 끝납니다`);
    if (GENERIC.test(s.outcome)) issues.push(`L${L} 결과에 '해당업무' 같은 일반 표현이 있습니다`);
    const key = s.outcome.replace(/\s/g, "");
    if (seen.has(key)) issues.push(`L${L} 결과가 L${seen.get(key)}와 같습니다`);
    else seen.set(key, L);
  }
  return issues;
}

function normalize(raw: any, ceiling: number): LevelSentence[] {
  const arr: any[] = listOf(raw, "levels");
  const byLevel = new Map<number, LevelSentence>();
  for (const x of arr) {
    const level = Math.round(Number(x?.level));
    if (!(level >= 1 && level <= ceiling) || byLevel.has(level)) continue;
    const means = clean(x?.means, 160).replace(/^\(|\)$/g, "").trim();
    let outcome = clean(x?.outcome, 220).replace(/\(모의[^)]*\)/g, "").trim();
    if (outcome && !/[.。]$/.test(outcome)) outcome += ".";
    byLevel.set(level, { level, means, outcome });
  }
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

export async function generateAreaLevels(
  input: LevelsInput,
): Promise<{ sentences: LevelSentence[]; warnings: string[] }> {
  const ceiling = input.area.ceiling;
  const rows = LEVELS.filter((l) => l.level <= ceiling)
    .map((l) => `L${l.level} | ${l.group} | ${l.judgment} | ${l.state} | 수단 틀: (${l.meansPattern})${l.example ? ` | 예: ${l.example}` : ""}`)
    .join("\n");

  const basePrompt = `당신은 HRCoach 성과책임·직무가치 통합운영가이드 v4.1을 따르는 직무분석 전문가입니다.
한 성과영역의 성과책임 문장을 L1부터 L${ceiling}까지 레벨마다 정확히 1개씩 작성하세요.

## 대상
- 직무명: ${input.jobName}
- 산업·회사 특성: ${input.industry || "(입력 없음)"}
- 성과영역: ${input.area.name}
- 핵심 성과대상·최종 결과: ${input.area.target || "(입력 없음)"}
- 같은 직무의 다른 성과영역(이 영역과 겹치는 결과를 쓰지 말 것): ${input.otherAreas.join(", ") || "(없음)"}

## 레벨별 기준 (L | 레벨군 | 판단·권한 책임 크기 | 대표 성과상태 | 수단 틀 | 예시)
예시는 다른 직무(국내 렌즈 인허가)의 문장으로, 형식과 레벨 간 크기 차이를 보여 주는 참고용이다. 예시의 업종 용어를 가져오지 않는다.
${rows}

## 작성 규칙
1. 문장은 '(수단) 결과' 구조다. means에는 괄호 안에 들어갈 수단·판단행동만, outcome에는 관찰 가능한 성과상태와 방향만 쓴다.
2. means는 해당 레벨의 수단 틀을 따르되, ○○ 자리에 이 성과영역의 구체적 성과대상을 넣는다. '~하여'로 끝낸다.
3. outcome은 '무엇의 어떤 상태(률·정확도·일관성·위험 등)를 높인다/낮춘다/확보한다'로 끝낸다.
   '관리한다·운영한다·검토한다·작성한다' 같은 수행행위로 끝내지 않는다. '해당업무', '업무의 적정수행률' 같은 일반 표현을 쓰지 않는다.
4. 레벨이 올라갈수록 판단·권한·영향의 크기가 분명히 커져야 한다. 인접 레벨과 같은 성과지표를 반복하지 않는다.
5. 실제 근거 없는 '승인·확정·최종결정' 책임, 정부·외부기관의 결정 권한을 담당자의 결과로 쓰지 않는다.
6. 점수나 숫자 목표치는 쓰지 않는다. 점수는 시스템이 따로 계산한다.
7. 각 outcome은 120자 이내로 간결하게 쓴다.

## 출력 JSON
{"levels":[{"level":1,"means":"","outcome":""}]}`;

  let sentences = normalize(await askJson(basePrompt, 0.4, LEVELS_SCHEMA), ceiling);
  let issues = checkSentences(sentences, ceiling);

  // 빠진 레벨이나 형식 위반이 있으면 한 번만 다시 쓰게 한다. 두 번째 결과가 더 나쁘면 첫 결과를 유지한다.
  if (issues.length) {
    const retry = `${basePrompt}

## 직전 결과의 문제 (반드시 고쳐서 L1~L${ceiling} 전체를 다시 출력)
${issues.map((s) => `- ${s}`).join("\n")}`;
    try {
      const again = normalize(await askJson(retry, 0.3, LEVELS_SCHEMA), ceiling);
      const againIssues = checkSentences(again, ceiling);
      if (againIssues.length <= issues.length) {
        sentences = again;
        issues = againIssues;
      }
    } catch {
      // 재시도 실패는 첫 결과로 진행한다.
    }
  }
  return { sentences, warnings: issues };
}
