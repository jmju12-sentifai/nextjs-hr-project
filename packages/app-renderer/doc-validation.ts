import type { AppSchema, DocBlockType, ReportDoc } from "./types";
import { migrateSchema } from "./runtime";

export const DOC_BLOCK_LABELS: Record<DocBlockType, string> = {
  headline: "결론 문장", kpis: "핵심 수치", gauge: "비율 링", compare: "전후 비교",
  formula: "산식", itemized: "산정표", bandtable: "구간 일정표", flow: "산정 흐름",
  range: "범위 내 위치", bar: "기준 대비 막대", timeline: "타임라인", counts: "일수 칸",
  conditions: "조건 근거", facts: "항목 목록", text: "안내문", element: "기존 요소", pagebreak: "쪽 나눔",
};
export interface ReportGuide {
  accent: string;
  defaultPurpose: "print" | "screen" | "review";
  required: DocBlockType[];
  banned: string[];
  tone: string;
}
export const DEFAULT_REPORT_GUIDE: ReportGuide = {
  accent: "#1858f2", defaultPurpose: "print", required: ["headline"], banned: [],
  tone: "임직원이 이해하기 쉬운 간결하고 정중한 안내문",
};
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2000;
export function validateReportGuide(v: unknown): v is ReportGuide {
  if (!object(v) || typeof v.accent !== "string" || !/^#[0-9a-f]{6}$/i.test(v.accent)) return false;
  // 강조색 위의 흰 글씨와 흰 바탕 위의 강조 문구를 모두 읽을 수 있어야 한다.
  const rgb = [1, 3, 5].map(i => parseInt(v.accent.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const contrast = 1.05 / (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 + 0.05);
  return contrast >= 4.5 && ["print", "screen", "review"].includes(v.defaultPurpose)
    && Array.isArray(v.required) && v.required.length <= 16
    && v.required.every((t: unknown) => typeof t === "string" && Object.hasOwn(DOC_BLOCK_LABELS, t) && !["element", "pagebreak"].includes(t))
    && Array.isArray(v.banned) && v.banned.length <= 30 && v.banned.every(string)
    && typeof v.tone === "string" && v.tone.length <= 1000
    && Object.keys(v).every(k => ["accent", "defaultPurpose", "required", "banned", "tone"].includes(k));
}

export interface DocValidationError { blockId?: string; code: string; message: string }
export interface DocValidationOptions {
  guide?: Pick<ReportGuide, "required" | "banned">;
  previous?: ReportDoc;
  proposal?: boolean;
}

/** AI의 JSON은 신뢰하지 않는다. 화면에 넘기기 전에 구조와 계산 참조를 함께 검사한다. */
export function validateDoc(schema: AppSchema, pathId: string, input: unknown, opts: DocValidationOptions = {}) {
  const errors: DocValidationError[] = [];
  const fail = (code: string, message: string, blockId?: string) => errors.push({ code, message, blockId });
  const m = migrateSchema(schema);
  const paths = [...(m.paths || []), ...(m.fallback ? [m.fallback] : [])];
  const path = paths.find(p => p.id === pathId);
  if (!path) { fail("path", "선택한 경로가 없습니다."); return { ok: false, errors }; }
  const steps = [...(m.shared?.steps || []), ...path.steps];
  const stepMap = new Map(steps.map(s => [s.name, s]));
  const names = new Set([...m.vars.map(v => v.name), ...steps.filter(s => s.type !== "llm").map(s => s.name), "적용여부"]);
  // 다른 경로의 같은 이름도 렌더러에서 LLM 값으로 제외되므로 여기서도 막는다.
  const llms = new Set([...(m.shared?.steps || []), ...paths.flatMap(p => p.steps)].filter(s => s.type === "llm").map(s => s.name));
  const ref = (v: unknown, id?: string, literal = false) => {
    if (!string(v) || llms.has(v) || (!names.has(v) && !(literal && /^-?\d+(\.\d+)?$/.test(v))))
      fail("reference", `사용할 수 없는 값 참조: ${typeof v === "string" ? v : "이름 누락"}`, id);
  };
  const text = (v: unknown, id?: string, trusted = false, template = false) => {
    if (typeof v !== "string" || v.length > 2000) { fail("text", "문구 형식을 확인해 주세요.", id); return; }
    if (template) for (const match of v.matchAll(/\{([^{}]+)\}/g)) {
      const name = match[1].trim();
      const unit = (object(input) && object(input.units) ? input.units[name] : undefined)
        ?? stepMap.get(name)?.unit ?? m.vars.find(variable => variable.name === name)?.unit;
      const suffix = v.slice(match.index! + match[0].length).trimStart();
      if (typeof unit === "string" && unit && suffix.startsWith(unit))
        fail("duplicate_unit", `값에 단위가 포함되어 있습니다. {${name}} 뒤의 '${unit}'를 제거해 주세요.`, id);
    }
    const plain = template ? v.replace(/\{([^{}]+)\}/g, (_, name) => { ref(name.trim(), id); return ""; }) : v;
    if (!trusted && /[0-9０-９]/.test(plain)) fail("literal_number", `문구의 숫자는 계산 값 자리표시로 넣어 주세요: ${plain.slice(0, 100)}`, id);
    if (/[{}]/.test(plain)) fail("template", "값 자리표시는 {이름} 형태로 넣어 주세요.", id);
    if (opts.guide?.banned.some(w => v.includes(w))) fail("banned", "공통 가이드에서 금지한 표현이 있습니다.", id);
  };
  if (!object(input) || !Array.isArray(input.blocks) || input.blocks.length < 1 || input.blocks.length > 60) {
    fail("shape", "양식은 한 개 이상, 최대 육십 개 블록으로 구성해야 합니다."); return { ok: false, errors };
  }
  if (Object.keys(input).some(k => !["title", "subjects", "units", "blocks"].includes(k))) fail("shape", "양식에 허용되지 않은 속성이 있습니다.");
  if (input.title !== undefined) text(input.title);
  if (input.subjects !== undefined) {
    if (!Array.isArray(input.subjects) || input.subjects.length > 10) fail("shape", "대상자 항목 형식이 올바르지 않습니다.");
    else input.subjects.forEach(n => ref(n));
  }
  if (input.units !== undefined) {
    if (!object(input.units)) fail("shape", "표시 단위 형식이 올바르지 않습니다.");
    else for (const [name, unit] of Object.entries(input.units)) {
      ref(name);
      const original = stepMap.get(name)?.unit ?? m.vars.find(v => v.name === name)?.unit ?? "";
      if (unit !== original && !(original === "년" && unit === "세") && !(original === "월" && unit === "개월"))
        fail("unit", "표시 단위는 계산 값의 의미를 바꿀 수 없습니다.");
    }
  }
  const ids = new Set<string>();
  const fields: Record<string, string[]> = {
    headline: ["tpl"], text: ["tpl", "muted"], kpis: ["items"], gauge: ["items"], compare: ["items"],
    formula: ["bind", "labels", "notes"], itemized: ["bind", "variant", "totalLabel", "hideExcluded", "after", "note"],
    bandtable: ["bind", "variant", "allPaths", "pathLabels", "refLabel", "valueLabel", "note"],
    flow: ["steps", "variant", "endLabel"], range: ["bind", "min", "max", "mid"], bar: ["bind", "marks"],
    timeline: ["points"], counts: ["items", "total", "used"], conditions: ["labels"], facts: ["items"], element: ["el"], pagebreak: [],
  };
  for (const b of input.blocks) {
    if (!object(b) || !string(b.id) || typeof b.type !== "string" || !Object.hasOwn(fields, b.type)) { fail("block", "블록 종류와 이름을 확인해 주세요."); continue; }
    const id = b.id;
    if (ids.has(id)) fail("duplicate", "블록 이름이 중복되었습니다.", id);
    ids.add(id);
    if (Object.keys(b).some(k => !["id", "type", "title", "locked", ...fields[b.type]].includes(k))) fail("shape", "블록에 허용되지 않은 속성이 있습니다.", id);
    const old = opts.previous?.blocks.find(x => x.id === id && x.locked);
    const trusted = !!old && JSON.stringify(old) === JSON.stringify(b);
    if (b.locked !== undefined && typeof b.locked !== "boolean") fail("shape", "잠금 설정을 확인해 주세요.", id);
    if (opts.proposal && b.locked && !trusted) fail("locked", "새로운 공식 문구를 AI가 임의로 만들 수 없습니다.", id);
    for (const k of ["title", "totalLabel", "refLabel", "valueLabel", "endLabel", "note"]) if (b[k] !== undefined) text(b[k], id, trusted);
    for (const k of ["muted", "allPaths", "hideExcluded"]) if (b[k] !== undefined && typeof b[k] !== "boolean") fail("shape", "표시 설정을 확인해 주세요.", id);
    if (["headline", "text"].includes(b.type)) {
      if (!string(b.tpl)) fail("shape", "안내 문구가 비어 있습니다.", id);
      else text(b.tpl, id, trusted, true);
    }
    if (["formula", "itemized", "bandtable", "range", "bar"].includes(b.type)) ref(b.bind, id);
    const requiredType = ({ formula: "formula", itemized: "classify", bandtable: "table" } as Record<string, string>)[b.type];
    if (requiredType && stepMap.get(b.bind)?.type !== requiredType) fail("step_type", "선택한 표현과 계산 단계의 종류가 맞지 않습니다.", id);
    const variants = ({ itemized: ["bar", "donut", "table"], bandtable: ["chart", "table"], flow: ["steps", "waterfall"] } as Record<string, string[]>)[b.type];
    if (b.variant !== undefined && !variants?.includes(b.variant)) fail("variant", "지원하지 않는 표현 방식입니다.", id);
    const listKey = ["kpis", "gauge", "compare", "counts", "facts"].includes(b.type) ? "items" : b.type === "flow" ? "steps" : b.type === "bar" ? "marks" : b.type === "timeline" ? "points" : undefined;
    for (const key of [...(listKey ? [listKey] : []), ...(b.after !== undefined ? ["after"] : [])]) {
      if (!Array.isArray(b[key]) || !b[key].length || b[key].length > 30) { fail("shape", "표시할 항목 목록을 확인해 주세요.", id); continue; }
      for (const item of b[key]) {
        if (!object(item)) { fail("shape", "항목 형식이 올바르지 않습니다.", id); continue; }
        const allowed = ["bind", "label", ...(b.type === "gauge" ? ["of"] : []), ...(key === "after" ? ["sign"] : [])];
        if (Object.keys(item).some(k => !allowed.includes(k))) fail("shape", "항목에 허용되지 않은 속성이 있습니다.", id);
        ref(item.bind, id);
        if (item.label !== undefined) text(item.label, id, trusted);
        if (item.of !== undefined) ref(item.of, id);
        if (item.sign !== undefined && item.sign !== "-") fail("shape", "차감 표기를 확인해 주세요.", id);
      }
    }
    for (const key of ["labels", "notes", "pathLabels"]) if (b[key] !== undefined) {
      if (!object(b[key])) { fail("shape", "항목 설명 형식이 올바르지 않습니다.", id); continue; }
      for (const [name, value] of Object.entries(b[key])) {
        if (key === "pathLabels") { if (!paths.some(p => p.id === name)) fail("reference", "없는 경로 이름입니다.", id); }
        else if (b.type === "conditions") { if (!path.conditions.some(c => c.id === name)) fail("reference", "없는 조건 이름입니다.", id); }
        else ref(name, id);
        text(value, id, trusted);
      }
    }
    if (b.type === "range") { ref(b.min, id, true); ref(b.max, id, true); if (b.mid !== undefined) ref(b.mid, id, true); }
    if (b.type === "counts") for (const k of ["total", "used"]) if (b[k] !== undefined) ref(b[k], id);
    // 새 제안은 문서 블록만 사용한다. 기존 요소는 이미 확정된 블록을 보존할 때만 허용한다.
    if (b.type === "element" && !trusted) fail("element", "새 양식에는 문서형 표현을 사용해 주세요.", id);
  }
  if (!input.blocks.some(b => object(b) && b.type !== "pagebreak")) fail("empty", "내용이 없는 양식입니다.");
  for (const old of opts.previous?.blocks.filter(b => b.locked) || []) {
    const next = input.blocks.find(b => object(b) && b.id === old.id);
    if (JSON.stringify(next) !== JSON.stringify(old)) fail("locked", "잠긴 블록은 수정하거나 삭제할 수 없습니다.", old.id);
  }
  for (const type of opts.guide?.required || []) if (!input.blocks.some(b => object(b) && b.type === type)) fail("required", `필수 표현이 빠졌습니다: ${DOC_BLOCK_LABELS[type]}`);
  return { ok: errors.length === 0, errors };
}
