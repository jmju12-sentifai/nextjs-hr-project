"use client";
import type { CSSProperties, ReactNode } from "react";
import type {
  AppSchema,
  BandTableBlock,
  BarBlock,
  ConditionsBlock,
  CountsBlock,
  Disp,
  DocBlock,
  DocRef,
  FlowBlock,
  FormulaBlock,
  ItemizedBlock,
  JudgeResult,
  Path,
  RangeBlock,
  ReportDoc,
  ReportIssuer,
  Sc,
  TimelineBlock,
} from "app-renderer";
import {
  KOP,
  bandNum,
  describeStep,
  docPages,
  findStep,
  fmtU,
  llmStepNames,
  migrateSchema,
  numOf,
  pdate,
  tk2disp,
  todayStr,
  tplParts,
  unitOf,
} from "app-renderer";
import ElementRenderer from "./ElementRenderer";

// 문서형 리포트 — 경로의 doc 블록을 A4 문서처럼 쪽 단위로 그린다.
// 색은 글자 검정·회색과 강조색 하나만 쓴다. 강조색은 사이트 공통 가이드에서 받는다.

export interface DocResult {
  sc: Sc;
  disp: Disp;
  jres: JudgeResult[];
  activePathId: string;
  activePathLabel: string;
}

interface Props {
  schema: AppSchema;
  path: Path & { doc: ReportDoc };
  result: DocResult;
  issuer?: ReportIssuer | null;
  issuedAt?: string;
  accent?: string;
}

interface Ctx {
  schema: AppSchema;
  path: Path;
  /** disp 는 문서 단위(units)를 반영한 값으로 바꿔 둔다 */
  r: DocResult;
  skip: Set<string>;
  units: Record<string, string>;
}

/** 표시 단위 — 문서에서 바꾼 단위가 있으면 그것, 없으면 변수·산출에 정한 단위 */
function uOf(ctx: Ctx, name: string): string {
  return ctx.units[name] ?? unitOf(ctx.schema, name);
}

const OPS: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "%": "나머지", "//": "몫" };
const FNS: Record<string, string> = { floor: "내림", ceil: "올림", round: "반올림" };

export default function DocReport({ schema, path, result, issuer, issuedAt, accent }: Props) {
  const doc = path.doc;
  const pages = docPages(doc);
  const units = doc.units || {};
  const disp: Disp = { ...result.disp };
  for (const [name, u] of Object.entries(units)) {
    if (typeof result.sc[name] === "number") disp[name] = fmtU(result.sc[name], u);
  }
  const r: DocResult = { ...result, disp };
  const ctx: Ctx = { schema, path, r, skip: llmStepNames(schema), units };
  const title = doc.title?.trim() || `${(schema.meta?.appName || "적용 결과").replace(/ ?앱$/, "")} 안내서`;
  const subjects = (doc.subjects || [])
    .map((n) => ({ n, v: disp[n] }))
    .filter((x) => x.v !== undefined && x.v !== "");
  const issuerLine = [issuer?.company, issuer?.dept].map((s) => s?.trim()).filter(Boolean).join(" · ");
  const contact = issuer?.contact?.trim();

  return (
    <div
      className="space-y-4 text-gray-900"
      style={{ "--doc-accent": accent || "#1d4ed8" } as CSSProperties}
    >
      {pages.map((blocks, pi) => (
        <article
          key={pi}
          className="mx-auto w-full max-w-[794px] bg-white border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-6 sm:px-10 sm:py-9 text-[13px] leading-relaxed"
        >
          {pi === 0 ? (
            <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b-2 border-gray-900 pb-4 mb-6">
              <div className="min-w-0">
                <h2 className="text-[22px] font-bold tracking-[-0.02em] leading-tight">{title}</h2>
                <div className="mt-2 text-[12px] text-gray-600 tabular-nums">발행일 {issuedAt || todayStr()}</div>
                {subjects.length > 0 && (
                  <div className="text-[12px] text-gray-600">
                    {subjects.map((s) => `${s.n} ${s.v}`).join(" · ")}
                  </div>
                )}
              </div>
              {issuer?.company?.trim() && (
                <div className="text-[15px] font-semibold text-right">{issuer.company.trim()}</div>
              )}
            </header>
          ) : (
            <div className="mb-6 border-b border-gray-300 pb-2 text-[11px] text-gray-500">
              {title}
              {subjects.length > 0 && ` · ${subjects.slice(0, 2).map((s) => s.v).join(" · ")}`}
            </div>
          )}

          <div className="space-y-7">
            {blocks.map((b) => (
              <Block key={b.id} b={b} ctx={ctx} />
            ))}
          </div>

          <footer className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-300 pt-3 text-[11px] text-gray-500">
            <span>
              {issuerLine}
              {pi === pages.length - 1 && contact && `${issuerLine ? " · " : ""}문의 ${contact}`}
            </span>
            <span className="tabular-nums">
              {pi + 1}/{pages.length}
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}

// ───────────── 블록 ─────────────

function Block({ b, ctx }: { b: DocBlock; ctx: Ctx }) {
  const body = (() => {
    switch (b.type) {
      case "headline":
        return (
          <p className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">
            <Tpl tpl={b.tpl} ctx={ctx} />
          </p>
        );
      case "text":
        return (
          <p className={"whitespace-pre-wrap " + (b.muted ? "text-gray-600" : "")}>
            <Tpl tpl={b.tpl} ctx={ctx} plain />
          </p>
        );
      case "facts":
        return <Facts items={b.items} ctx={ctx} />;
      case "formula":
        return <Formula b={b} ctx={ctx} />;
      case "itemized":
        return <Itemized b={b} ctx={ctx} />;
      case "bandtable":
        return <BandTable b={b} ctx={ctx} />;
      case "flow":
        return <Flow b={b} ctx={ctx} />;
      case "range":
        return <Range b={b} ctx={ctx} />;
      case "bar":
        return <Bar b={b} ctx={ctx} />;
      case "timeline":
        return <Timeline b={b} ctx={ctx} />;
      case "counts":
        return <Counts b={b} ctx={ctx} />;
      case "conditions":
        return <Conditions b={b} ctx={ctx} />;
      case "element": {
        const h = Math.max(1, Math.min(6, b.el.hSpan ?? (b.el.h || 2)));
        return (
          <div className="flex flex-col overflow-hidden rounded border border-gray-200 p-4" style={{ height: h * 96 }}>
            <ElementRenderer
              schema={ctx.schema}
              el={b.el}
              sc={ctx.r.sc}
              disp={ctx.r.disp}
              jres={ctx.r.jres}
              pathLabel={ctx.r.activePathLabel}
              pathConditions={ctx.path.conditions || []}
            />
          </div>
        );
      }
      default:
        return null;
    }
  })();
  if (!body) return null;
  return (
    <section className="space-y-2.5">
      {b.title && <h3 className="border-b border-gray-900 pb-1 text-[13px] font-semibold">{b.title}</h3>}
      {body}
    </section>
  );
}

function Tpl({ tpl, ctx, plain }: { tpl: string; ctx: Ctx; plain?: boolean }) {
  return (
    <>
      {tplParts(tpl || "", ctx.r.disp, ctx.skip).map((p, i) =>
        p.value && !plain ? (
          <span key={i} className="text-[color:var(--doc-accent)] tabular-nums">
            {p.text}
          </span>
        ) : (
          <span key={i} className={p.value ? "tabular-nums" : undefined}>
            {p.text}
          </span>
        )
      )}
    </>
  );
}

/** 값 표시 — llm 단계는 문서형 양식에서 비운다 */
function dv(ctx: Ctx, name: string): string {
  if (ctx.skip.has(name)) return "—";
  const v = ctx.r.disp[name];
  return v === undefined || v === null || v === "" ? "—" : String(v);
}
const labelOf = (r: DocRef) => r.label?.trim() || r.bind;

function Missing({ what }: { what: string }) {
  return <p className="text-[12px] text-gray-400">{what}</p>;
}

function Facts({ items, ctx }: { items: DocRef[]; ctx: Ctx }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,9rem)_1fr] border-t border-gray-200">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="border-b border-gray-200 py-1.5 pr-3 text-gray-600">{labelOf(it)}</dt>
          <dd className="border-b border-gray-200 py-1.5 font-medium tabular-nums">{dv(ctx, it.bind)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Term({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] leading-tight text-gray-500">{label}</span>
      <span
        className={
          "text-[17px] font-semibold tabular-nums leading-snug " +
          (strong ? "text-[color:var(--doc-accent)]" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Sym({ children }: { children: ReactNode }) {
  return <span className="pb-0.5 text-[17px] text-gray-500">{children}</span>;
}

function Formula({ b, ctx }: { b: FormulaBlock; ctx: Ctx }) {
  const st = findStep(ctx.schema, b.bind, ctx.r.activePathId);
  if (!st || st.type !== "formula") return <Missing what={`산식 단계를 찾을 수 없습니다: ${b.bind}`} />;
  const lab = (n: string) => b.labels?.[n]?.trim() || n;
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3 border border-gray-300 px-4 py-3">
      {st.tokens.map((t, i) => {
        if (t.t === "var") return <Term key={i} label={lab(t.name)} value={dv(ctx, t.name)} />;
        if (t.t === "num") return <Sym key={i}>{fmtU(t.v, "")}</Sym>;
        if (t.t === "op") return <Sym key={i}>{OPS[t.op] || t.op}</Sym>;
        if (t.t === "fn") return <Sym key={i}>{FNS[t.fn] || t.fn}</Sym>;
        return <Sym key={i}>{t.t === "lp" ? "(" : ")"}</Sym>;
      })}
      <Sym>=</Sym>
      <Term label={lab(b.bind)} value={dv(ctx, b.bind)} strong />
    </div>
  );
}

function Itemized({ b, ctx }: { b: ItemizedBlock; ctx: Ctx }) {
  const st = findStep(ctx.schema, b.bind, ctx.r.activePathId);
  if (!st || st.type !== "classify") return <Missing what={`항목 합산 단계를 찾을 수 없습니다: ${b.bind}`} />;
  const unit = uOf(ctx, b.bind);
  // 금액 단위는 표 아래 한 번만 적는다. %처럼 값 모양이 바뀌는 단위는 칸마다 붙인다.
  const bare = !!unit && unit !== "%";
  const num = (name: string) => {
    if (ctx.skip.has(name)) return "—";
    const v = ctx.r.sc[name];
    return typeof v === "number" ? fmtU(v, bare ? "" : uOf(ctx, name)) : dv(ctx, name);
  };
  const rows = st.items.filter((it) => it.inc || !b.hideExcluded);
  const after = b.after || [];
  return (
    <div className="space-y-1.5">
      <Scroll>
        <table className="w-full min-w-[280px] tabular-nums">
          <thead>
            <tr className="border-b border-gray-900 text-[11px] text-gray-500">
              <th className="py-1.5 text-left font-medium">항목</th>
              <th className="py-1.5 text-right font-medium">금액</th>
              <th className="w-16 py-1.5 text-right font-medium">반영</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.ref} className="border-b border-gray-200">
                <td className="py-1.5">{it.ref}</td>
                <td className={"py-1.5 text-right " + (it.inc ? "" : "text-gray-500")}>{num(it.ref)}</td>
                <td className="py-1.5 text-right text-gray-500">{it.inc ? "포함" : "제외"}</td>
              </tr>
            ))}
            <tr className={"font-semibold " + (after.length ? "border-b border-gray-200" : "border-b border-gray-900")}>
              <td className="py-1.5">{b.totalLabel?.trim() || b.bind}</td>
              <td className="py-1.5 text-right">{num(b.bind)}</td>
              <td />
            </tr>
            {after.map((a, i) => {
              const last = i === after.length - 1;
              return (
                <tr key={i} className={last ? "border-y border-gray-900 font-semibold" : "border-b border-gray-200"}>
                  <td className="py-1.5">{labelOf(a)}</td>
                  <td className={"py-1.5 text-right " + (last ? "text-[color:var(--doc-accent)]" : "")}>
                    {a.sign === "-" ? "− " : ""}
                    {num(a.bind)}
                  </td>
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>
      </Scroll>
      {(b.note || bare) && (
        <p className="text-[11px] text-gray-500">
          {b.note}
          {b.note && bare ? " " : ""}
          {bare && `단위: ${unit}`}
        </p>
      )}
    </div>
  );
}

function BandTable({ b, ctx }: { b: BandTableBlock; ctx: Ctx }) {
  const m = migrateSchema(ctx.schema);
  const sources: { pathId: string; pathLabel: string; step: any }[] = [];
  if (b.allPaths) {
    for (const p of m.paths || []) {
      for (const s of p.steps) {
        if (s.type === "table" && s.name === b.bind) {
          sources.push({ pathId: p.id, pathLabel: b.pathLabels?.[p.id]?.trim() || p.label, step: s });
        }
      }
    }
  }
  if (sources.length === 0) {
    const s = findStep(ctx.schema, b.bind, ctx.r.activePathId);
    if (s && s.type === "table") sources.push({ pathId: ctx.r.activePathId, pathLabel: "", step: s });
  }
  if (sources.length === 0) return <Missing what={`구간표 단계를 찾을 수 없습니다: ${b.bind}`} />;

  const ref = sources[0].step.ref as string;
  const refUnit = uOf(ctx, ref);
  const valUnit = uOf(ctx, b.bind);
  const cur = ctx.r.sc[ref];
  const showPath = b.allPaths && sources.length > 1;
  const n = (x: number) => fmtU(x, "");

  const rows = sources.flatMap((src) =>
    (src.step.bands || []).map((band: any) => {
      const from = bandNum(band.from, ctx.r.sc);
      const to = bandNum(band.to, ctx.r.sc);
      const here =
        src.pathId === ctx.r.activePathId && typeof cur === "number" && cur >= from && cur <= to;
      return {
        range: (from === to ? n(from) : `${n(from)}–${n(to)}`) + (refUnit || ""),
        path: src.pathLabel,
        value: fmtU(bandNum(band.v, ctx.r.sc), valUnit),
        here,
      };
    })
  );

  return (
    <div className="space-y-1.5">
      <Scroll>
        <table className="w-full min-w-[280px] tabular-nums">
          <thead>
            <tr className="border-b border-gray-900 text-[11px] text-gray-500">
              <th className="py-1.5 text-left font-medium">{b.refLabel?.trim() || ref}</th>
              {showPath && <th className="py-1.5 text-left font-medium">유형</th>}
              <th className="py-1.5 text-right font-medium">{b.valueLabel?.trim() || b.bind}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={"border-b border-gray-200 " + (row.here ? "bg-gray-100 font-semibold" : "")}>
                <td className="py-1.5 pl-1">
                  {row.range}
                  {row.here && <span className="ml-1.5 text-[11px] text-[color:var(--doc-accent)]">현재</span>}
                </td>
                {showPath && <td className="py-1.5">{row.path}</td>}
                <td className="py-1.5 pr-1 text-right">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      {b.note && <p className="text-[11px] text-gray-500">{b.note}</p>}
    </div>
  );
}

function Flow({ b, ctx }: { b: FlowBlock; ctx: Ctx }) {
  return (
    <ol className="border-y border-gray-900">
      {b.steps.map((s, i) => {
        const st = findStep(ctx.schema, s.bind, ctx.r.activePathId);
        const how = st ? (st.type === "formula" ? tk2disp(st.tokens) : describeStep(st, ctx.r.sc)) : "";
        const last = i === b.steps.length - 1;
        return (
          <li
            key={i}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-gray-200 py-2 last:border-b-0"
          >
            <span className="tabular-nums text-gray-500">{i + 1}</span>
            <div className="min-w-0">
              <div className="font-medium">{labelOf(s)}</div>
              {how && <div className="text-[11px] text-gray-500">{how}</div>}
            </div>
            <span className={"font-semibold tabular-nums " + (last ? "text-[color:var(--doc-accent)]" : "")}>
              {dv(ctx, s.bind)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 0~1 위치에 놓는 라벨. 위치만큼만 왼쪽으로 당겨 양 끝에서도 칸 밖으로 나가지 않는다. */
function At({ p, className, children }: { p: number; className?: string; children: ReactNode }) {
  const pct = Math.max(0, Math.min(1, p)) * 100;
  return (
    <div
      className={"absolute whitespace-nowrap " + (className || "")}
      style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}
    >
      {children}
    </div>
  );
}

function Range({ b, ctx }: { b: RangeBlock; ctx: Ctx }) {
  const lo = numOf(b.min, ctx.r.sc);
  const hi = numOf(b.max, ctx.r.sc);
  const v = numOf(b.bind, ctx.r.sc);
  if (lo === null || hi === null || v === null || hi <= lo)
    return <Missing what="범위의 최소·최대 값을 확인할 수 없습니다." />;
  const mid = numOf(b.mid, ctx.r.sc);
  const u = uOf(ctx, b.bind);
  const pos = (x: number) => (x - lo) / (hi - lo);
  return (
    <div className="relative h-[76px]">
      <At p={pos(v)} className="top-0 text-[12px] font-semibold tabular-nums text-[color:var(--doc-accent)]">
        {dv(ctx, b.bind)}
      </At>
      <div className="absolute inset-x-0 top-[30px] h-1.5 rounded-full bg-gray-200" />
      <div
        className="absolute top-[25px] h-4 w-4 rounded-full border-2 border-white bg-[color:var(--doc-accent)] shadow"
        style={{ left: `calc(${Math.max(0, Math.min(1, pos(v))) * 100}% - 8px)` }}
      />
      {[
        { p: 0, l: "최소", x: lo },
        ...(mid !== null ? [{ p: pos(mid), l: "중간", x: mid }] : []),
        { p: 1, l: "최대", x: hi },
      ].map((t) => (
        <At key={t.l} p={t.p} className="top-[46px] text-[11px] tabular-nums text-gray-500">
          {t.l} {fmtU(t.x, u)}
        </At>
      ))}
    </div>
  );
}

function Bar({ b, ctx }: { b: BarBlock; ctx: Ctx }) {
  const v = numOf(b.bind, ctx.r.sc);
  if (v === null) return <Missing what={`값을 확인할 수 없습니다: ${b.bind}`} />;
  const marks = b.marks
    .map((mk) => ({ ...mk, x: numOf(mk.bind, ctx.r.sc) }))
    .filter((mk): mk is DocRef & { x: number } => mk.x !== null);
  const max = Math.max(v, ...marks.map((mk) => mk.x), 1) * 1.06;
  const u = uOf(ctx, b.bind);
  return (
    <div className="relative h-[84px]">
      <At p={v / max} className="top-0 text-[12px] font-semibold tabular-nums text-[color:var(--doc-accent)]">
        {dv(ctx, b.bind)}
      </At>
      <div className="absolute inset-x-0 top-[26px] h-5 bg-gray-100" />
      <div
        className="absolute left-0 top-[26px] h-5 bg-[color:var(--doc-accent)]"
        style={{ width: `${(v / max) * 100}%` }}
      />
      {marks.map((mk, i) => (
        <div key={i}>
          <div
            className="absolute top-[20px] h-8 border-l-2 border-gray-900"
            style={{ left: `${(mk.x / max) * 100}%` }}
          />
          <At p={mk.x / max} className={"text-[11px] tabular-nums text-gray-600 " + (i % 2 ? "top-[66px]" : "top-[52px]")}>
            {labelOf(mk)} {fmtU(mk.x, u)}
          </At>
        </div>
      ))}
    </div>
  );
}

function Timeline({ b, ctx }: { b: TimelineBlock; ctx: Ctx }) {
  // 모두 날짜로 읽히면 날짜순으로, 아니면 적힌 순서대로 둔다.
  const pts = b.points.map((p) => ({ ...p, d: pdate(ctx.r.sc[p.bind]) }));
  if (pts.every((p) => p.d)) pts.sort((a, c) => a.d!.getTime() - c.d!.getTime());
  return (
    <Scroll>
      <ol
        className="relative grid min-w-[280px]"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, pts.length)}, minmax(0, 1fr))` }}
      >
        <div className="absolute inset-x-0 top-[30px] border-t border-gray-400" />
        {pts.map((p, i) => (
          <li key={i} className="relative flex flex-col items-start pr-2">
            <span className="h-[22px] text-[12px] font-semibold tabular-nums">{dv(ctx, p.bind)}</span>
            <span className="relative z-10 my-1 h-2.5 w-2.5 rounded-full bg-[color:var(--doc-accent)]" />
            <span className="text-[11px] text-gray-600">{labelOf(p)}</span>
          </li>
        ))}
      </ol>
    </Scroll>
  );
}

function Counts({ b, ctx }: { b: CountsBlock; ctx: Ctx }) {
  const total = numOf(b.total, ctx.r.sc);
  const used = numOf(b.used, ctx.r.sc);
  const cells = total !== null && used !== null && total > 0 && total <= 60 ? Math.round(total) : 0;
  const u = b.total ? uOf(ctx, b.total) : "";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        {b.items.map((it, i) => (
          <div key={i}>
            <div className="text-[11px] text-gray-500">{labelOf(it)}</div>
            <div className="text-[22px] font-semibold tabular-nums leading-tight">{dv(ctx, it.bind)}</div>
          </div>
        ))}
      </div>
      {cells > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: cells }, (_, i) => (
              <span
                key={i}
                className={
                  "h-3.5 w-3.5 border " +
                  (i < Math.round(used!) ? "border-[color:var(--doc-accent)] bg-[color:var(--doc-accent)]" : "border-gray-400")
                }
              />
            ))}
          </div>
          <p className="text-[11px] tabular-nums text-gray-500">
            {fmtU(total!, u)} 중 {fmtU(used!, u)} 사용 · {fmtU(Math.max(0, total! - used!), u)} 남음
          </p>
        </div>
      )}
    </div>
  );
}

function Conditions({ b, ctx }: { b: ConditionsBlock; ctx: Ctx }) {
  const conds = ctx.path.conditions || [];
  const rows = ctx.r.jres.filter((r) => !r.ex);
  if (rows.length === 0) return <Missing what="이 경로에는 판정 조건이 없습니다." />;
  const show = (v: any, unit: string) => (typeof v === "number" ? fmtU(v, unit) : String(v ?? "—"));
  return (
    <Scroll>
      <table className="w-full min-w-[280px] tabular-nums">
        <thead>
          <tr className="border-b border-gray-900 text-[11px] text-gray-500">
            <th className="py-1.5 text-left font-medium">조건</th>
            <th className="py-1.5 text-right font-medium">기준</th>
            <th className="py-1.5 text-right font-medium">본인</th>
            <th className="w-20 py-1.5 text-right font-medium">결과</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const j = conds[i];
            const bIsName = j ? j.bMode !== "val" : false;
            const aUnit = uOf(ctx, r.a);
            const label = (j && b.labels?.[j.id]?.trim()) || `${bIsName ? r.b : r.a} ${KOP[r.op]}`;
            return (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5">{label}</td>
                <td className="py-1.5 text-right">{show(r.bv, bIsName ? uOf(ctx, r.b) || aUnit : aUnit)}</td>
                <td className="py-1.5 text-right">{show(r.av, aUnit)}</td>
                <td className={"py-1.5 text-right " + (r.ok ? "" : "text-gray-500")}>{r.ok ? "해당" : "해당 없음"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroll>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}
