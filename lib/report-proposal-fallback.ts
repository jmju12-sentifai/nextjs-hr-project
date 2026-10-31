import { llmStepNames, migrateSchema } from "app-renderer";
import type { AppSchema, DocBlock, DocBlockType, ReportDoc, ReportGuide } from "app-renderer";
import { checkProposals, PROPOSAL_KINDS } from "./report-proposals";

/** AI가 형식을 완성하지 못해도 실제 계산 참조로만 기본 양식을 구성한다. 검증은 동일하게 적용한다. */
export function basicReportProposals(raw: AppSchema, pathId: string, guide: ReportGuide) {
  const schema = migrateSchema(raw);
  const paths = [...(schema.paths || []), ...(schema.fallback ? [schema.fallback] : [])];
  const path = paths.find(p => p.id === pathId);
  if (!path) return { proposals: [], rejected: ["선택한 조건을 찾을 수 없습니다."] };
  const excludedNames = llmStepNames(schema);
  const allSteps = [...(schema.shared?.steps || []), ...path.steps].filter(s => !excludedNames.has(s.name));
  const stepMap = new Map(allSteps.map(s => [s.name, s]));
  const variables = schema.vars.filter(v => v.type !== "rows" && !excludedNames.has(v.name));
  const names = new Set([...variables.map(v => v.name), ...allSteps.map(s => s.name)]);
  const relevant = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string" && names.has(value) && !relevant.has(value)) {
      relevant.add(value);
      const step = stepMap.get(value);
      if (step) Object.entries(step).filter(([key]) => !["id", "name", "unit", "type"].includes(key)).forEach(([, v]) => visit(v));
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  path.steps.filter(s => !excludedNames.has(s.name)).forEach(s => visit(s.name));
  // 미적용 조건에도 판단에 쓰인 실제 입력은 보여 주되, 없는 경로 조건을 만들지 않는다.
  const conditions = path.id === schema.fallback?.id ? (schema.paths || []).flatMap(p => p.conditions) : path.conditions;
  conditions.forEach(c => { if (c.aMode !== "val") visit(c.a); if (c.bMode !== "val") visit(c.b); });
  const steps = allSteps.filter(s => relevant.has(s.name));
  const subjects = variables.filter(v => v.grp === "개인" && ["text", "select"].includes(v.type)).slice(0, 4).map(v => v.name);
  const facts = [...relevant].filter(n => names.has(n) && !subjects.includes(n)).slice(0, 20);
  const output = path.steps.filter(s => !excludedNames.has(s.name) && s.unit).slice(-3).reverse().map(s => s.name);
  const refs = (list: string[]) => list.map(bind => ({ bind }));
  const unitOf = (name: string) => stepMap.get(name)?.unit ?? variables.find(v => v.name === name)?.unit;
  const clean = (value: string) => !guide.banned.some(word => value.includes(word));

  const candidates = PROPOSAL_KINDS.map(kind => {
    let index = 0;
    const id = () => `basic-${kind.id}-${++index}`;
    const pool: DocBlock[] = [];
    const add = (block: DocBlock) => { pool.push(block); };
    const person = subjects.includes("성명") ? "{성명} 님의 " : "";
    const result = output[0] ? ` 주요 산정 결과는 {${output[0]}}입니다.` : "";
    const headline = `${person}적용 결과는 {적용여부}입니다.${result}`;
    add({ id: id(), type: "headline", tpl: clean(headline) ? headline : "{적용여부}" });
    if (output.length) add({ id: id(), type: "kpis", items: refs(output) });
    if (subjects.length) add({ id: id(), type: "facts", ...(clean("대상자 정보") ? { title: "대상자 정보" } : {}), items: refs(subjects) });
    if (facts.length || !subjects.length) add({ id: id(), type: "facts", ...(clean("판단에 사용된 항목") ? { title: "판단에 사용된 항목" } : {}), items: refs(facts.length ? facts : ["적용여부"]) });
    if (path.conditions.length) add({ id: id(), type: "conditions" });
    for (const step of steps.slice(0, 12)) {
      if (step.type === "formula") add({ id: id(), type: "formula", bind: step.name });
      if (step.type === "classify") add({ id: id(), type: "itemized", bind: step.name, variant: kind.id === "review" ? "table" : "bar" });
      if (step.type === "table") add({ id: id(), type: "bandtable", bind: step.name, variant: kind.id === "review" ? "table" : "chart" });
      if (step.type === "clamp") {
        const marks = [step.min, step.max].filter(n => names.has(n) && unitOf(n) === step.unit);
        if (marks.length) add({ id: id(), type: "bar", bind: step.name, marks: refs(marks) });
        if ([step.min, step.max].every(n => names.has(n) || /^-?\d+(\.\d+)?$/.test(n)))
          add({ id: id(), type: "range", bind: step.ref, min: step.min, max: step.max });
      }
    }
    const optional = new Map<DocBlockType, DocBlock>();
    if (steps.length) optional.set("flow", { id: id(), type: "flow", steps: refs(steps.slice(0, 8).map(s => s.name)) });
    const percent = [...relevant].filter(n => unitOf(n) === "%");
    if (percent.length) optional.set("gauge", { id: id(), type: "gauge", items: refs(percent.slice(0, 3)) });
    const days = [...relevant].filter(n => unitOf(n) === "일");
    if (days.length) optional.set("counts", { id: id(), type: "counts", items: refs(days.slice(0, 6)) });
    const dates = variables.filter(v => relevant.has(v.name) && v.type === "date").map(v => v.name);
    if (dates.length) optional.set("timeline", { id: id(), type: "timeline", points: refs(dates.slice(0, 6)) });
    const sameUnit = output[0] ? [...relevant].filter(n => unitOf(n) && unitOf(n) === unitOf(output[0])) : [];
    if (sameUnit.length > 1) optional.set("compare", { id: id(), type: "compare", items: refs(sameUnit.slice(0, 3)) });
    optional.set("text", { id: id(), type: "text", tpl: "{적용여부}" });
    for (const type of guide.required) if (!pool.some(b => b.type === type) && optional.has(type)) add(optional.get(type)!);
    // 요약형은 핵심 수치/항목과 필수 블록만 남기고 상세 안은 계산 근거를 함께 둔다.
    const blocks = kind.id === "screen" ? pool.filter(b => ["headline", "kpis", "facts"].includes(b.type) || guide.required.includes(b.type)) : pool;
    if (kind.id === "print" && blocks.length > 1) blocks.splice(Math.max(1, Math.ceil(blocks.length / 2)), 0, { id: id(), type: "pagebreak" });
    const title = kind.id === "screen" ? "적용 결과 요약" : kind.id === "review" ? "적용 결과 상세" : "적용 결과 안내";
    const doc: ReportDoc = { ...(clean(title) ? { title } : {}), subjects, blocks };
    if (unitOf("만나이") === "년") doc.units = { 만나이: "세" };
    return { id: kind.id, excluded: [], reason: kind.id === "screen"
      ? "현재 조건의 적용 결과와 주요 항목을 한눈에 확인하는 기본 요약 양식입니다."
      : kind.id === "review" ? "현재 조건에 등록된 항목과 계산 근거를 확인하는 기본 상세 양식입니다."
        : "현재 조건의 적용 결과와 관련 항목을 나누어 안내하는 기본 통지 양식입니다.", doc };
  });
  return checkProposals({ proposals: candidates }, schema, pathId, guide);
}
