// 문서형 리포트 보조 함수 — 화면 렌더러와 출력(PDF·Word)이 같은 규칙을 쓰도록 여기에 둔다.
import type { AppSchema, Disp, DocBlock, Path, ReportDoc, Sc, Step } from "./types";
import { migrateSchema } from "./runtime";
export * from "./doc-validation";

/** 경로에 문서형 양식이 있으면 true. 없으면 기존 그리드(report)로 그린다. */
export function hasDoc(path?: Path | null): path is Path & { doc: ReportDoc } {
  return !!path?.doc && Array.isArray(path.doc.blocks) && path.doc.blocks.length > 0;
}

/**
 * 이름으로 산출 단계를 찾는다.
 * 같은 이름이 경로마다 따로 있을 수 있어(가산형·표준형의 "감액률") 활성 경로 → 공통 → 나머지 순으로 본다.
 */
export function findStep(schema: AppSchema, name: string, pathId?: string): Step | undefined {
  const m = migrateSchema(schema);
  const paths = [...(m.paths || []), ...(m.fallback ? [m.fallback] : [])];
  const active = paths.find((p) => p.id === pathId);
  return (
    active?.steps.find((s) => s.name === name) ||
    m.shared?.steps.find((s) => s.name === name) ||
    paths.flatMap((p) => p.steps).find((s) => s.name === name)
  );
}

/**
 * 리포트를 만들 때 AI가 문장을 쓰는 llm 단계 이름.
 * 문서형 양식은 같은 입력이면 같은 결과가 나와야 하므로 이 값들은 비워서 그린다.
 */
export function llmStepNames(schema: AppSchema): Set<string> {
  const m = migrateSchema(schema);
  const all = [
    ...(m.shared?.steps || []),
    ...(m.paths || []).flatMap((p) => p.steps),
    ...(m.fallback?.steps || []),
  ];
  return new Set(all.filter((s) => s.type === "llm").map((s) => s.name));
}

export interface TplPart {
  text: string;
  /** 계산 값으로 채운 자리 — 강조 표시용 */
  value?: boolean;
}

/** {이름} 자리표시를 계산 값으로 채운다. 값을 모르는 자리는 "—". */
export function tplParts(tpl: string, disp: Disp, skip?: Set<string>): TplPart[] {
  const out: TplPart[] = [];
  const re = /\{([^{}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.push({ text: tpl.slice(last, m.index) });
    const name = m[1].trim();
    const v = skip?.has(name) ? "" : disp[name];
    out.push({ text: v === undefined || v === null || v === "" ? "—" : String(v), value: true });
    last = re.lastIndex;
  }
  if (last < tpl.length) out.push({ text: tpl.slice(last) });
  return out;
}

export function fillTpl(tpl: string, disp: Disp, skip?: Set<string>): string {
  return tplParts(tpl, disp, skip)
    .map((p) => p.text)
    .join("");
}

/** pagebreak 블록 기준으로 쪽을 나눈다. 빈 쪽은 버린다. */
export function docPages(doc: ReportDoc): DocBlock[][] {
  const pages: DocBlock[][] = [[]];
  for (const b of doc.blocks) {
    if (b.type === "pagebreak") pages.push([]);
    else pages[pages.length - 1].push(b);
  }
  const kept = pages.filter((p) => p.length > 0);
  return kept.length ? kept : [[]];
}

/** 이름이면 계산 값, 아니면 숫자 리터럴로 읽는다. */
export function numOf(x: string | undefined, sc: Sc): number | null {
  if (x === undefined || x === null || String(x).trim() === "") return null;
  const key = String(x).trim();
  const v = key in sc ? sc[key] : Number(key);
  return typeof v === "number" && isFinite(v) ? v : null;
}
