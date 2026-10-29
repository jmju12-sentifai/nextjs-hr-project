"use client";
import type { CSSProperties, ReactNode } from "react";
import type {
  AppSchema,
  BandTableBlock,
  BarBlock,
  CompareBlock,
  ConditionsBlock,
  CountsBlock,
  Disp,
  DocBlock,
  DocRef,
  FlowBlock,
  FormulaBlock,
  GaugeBlock,
  ItemizedBlock,
  JudgeResult,
  KpisBlock,
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
//
// 색: 사이트 브랜드(잉크·파랑·라임)를 그대로 쓴다. 글자는 잉크·회색 계열만, 값 강조는 파랑,
//     라임은 형광펜·현재 위치 표시에만 (글자색으로 쓰지 않는다).
// 차트: 막대 24px 이하·끝 4px 라운드, 칸 사이 2px 흰 틈, 눈금선은 1px 실선.
//       항목 구분 색은 브랜드 파랑부터 고정 순서 (validate_palette 통과, 옅은 3색은 값 라벨을 항상 붙인다).
// 그림은 SVG 를 비율로 늘리지 않고 HTML 로 배치한다 — 모바일에서도 글자 크기가 유지된다.

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

const CAT = ["#1858f2", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
const SOFT_BAR = "#c4d5fb"; // 강조하지 않는 막대 — 파랑의 옅은 단계
const HATCH = "repeating-linear-gradient(135deg, #b8c3d4 0 2px, #eef2f7 2px 5px)";

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
  const company = issuer?.company?.trim();
  const issuerLine = [company, issuer?.dept?.trim()].filter(Boolean).join(" · ");
  const contact = issuer?.contact?.trim();

  const vars = {
    "--r-ink": "#071a3b",
    "--r-fg": "#3c4a63",
    "--r-muted": "#718099",
    "--r-line": "#e4ebf5",
    "--r-soft": "#f2f6fc",
    "--r-accent": accent || "#1858f2",
    "--r-accent-soft": "#e6efff",
    "--r-lime": "#d8ff22",
  } as CSSProperties;

  return (
    <div className="space-y-5 text-[var(--r-fg)]" style={{ ...vars, wordBreak: "keep-all" }}>
      {pages.map((blocks, pi) => (
        <article
          key={pi}
          className="mx-auto w-full max-w-[794px] overflow-hidden rounded-2xl bg-white text-[13px] leading-relaxed shadow-[0_1px_2px_rgba(7,26,59,0.06),0_18px_40px_-28px_rgba(7,26,59,0.35)]"
        >
          {pi === 0 ? (
            <header className="bg-[var(--r-ink)] px-5 pb-6 pt-6 text-white sm:px-10 sm:pt-8">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[var(--r-lime)]" />
                  {result.activePathLabel}
                </span>
                {company && <span className="text-[13px] font-semibold text-white">{company}</span>}
              </div>
              <h2 className="mt-3 text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">{title}</h2>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span key={s.n} className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px]">
                    <span className="mr-1.5 text-white/55">{s.n}</span>
                    {s.v}
                  </span>
                ))}
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] tabular-nums">
                  <span className="mr-1.5 text-white/55">발행일</span>
                  {issuedAt || todayStr()}
                </span>
              </div>
            </header>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 border-b border-[var(--r-line)] px-5 py-3 text-[11px] text-[var(--r-muted)] sm:px-10">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--r-accent)]" />
              <span className="font-semibold text-[var(--r-ink)]">{title}</span>
              {subjects.length > 0 && <span>· {subjects.slice(0, 2).map((s) => s.v).join(" · ")}</span>}
            </div>
          )}

          <div className="space-y-8 px-5 py-7 sm:px-10 sm:py-9">
            {blocks.map((b) => (
              <Block key={b.id} b={b} ctx={ctx} />
            ))}
          </div>

          <footer className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--r-line)] bg-[var(--r-soft)] px-5 py-3 text-[11px] text-[var(--r-muted)] sm:px-10">
            <span>
              {issuerLine}
              {pi === pages.length - 1 && contact && `${issuerLine ? " · " : ""}문의 ${contact}`}
            </span>
            <span className="tabular-nums">
              {pi + 1} / {pages.length}
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}

// ───────────── 공통 ─────────────

function Block({ b, ctx }: { b: DocBlock; ctx: Ctx }) {
  const body = (() => {
    switch (b.type) {
      case "headline":
        return <Headline tpl={b.tpl} ctx={ctx} />;
      case "text":
        return b.muted ? (
          <div className="flex gap-2.5 rounded-xl bg-[var(--r-soft)] px-4 py-3.5 text-[12.5px]">
            <InfoIcon />
            <p className="whitespace-pre-wrap">
              <Tpl tpl={b.tpl} ctx={ctx} />
            </p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13.5px] leading-[1.75]">
            <Tpl tpl={b.tpl} ctx={ctx} bold />
          </p>
        );
      case "facts":
        return <Facts items={b.items} ctx={ctx} />;
      case "kpis":
        return <Kpis b={b} ctx={ctx} />;
      case "gauge":
        return <Gauges b={b} ctx={ctx} />;
      case "compare":
        return <Compare b={b} ctx={ctx} />;
      case "formula":
        return <Formula b={b} ctx={ctx} />;
      case "itemized":
        return <Itemized b={b} ctx={ctx} />;
      case "bandtable":
        return <BandTable b={b} ctx={ctx} />;
      case "flow":
        return b.variant === "waterfall" ? <Waterfall b={b} ctx={ctx} /> : <Steps b={b} ctx={ctx} />;
      case "range":
        return <Range b={b} ctx={ctx} />;
      case "bar":
        return <Bullet b={b} ctx={ctx} />;
      case "timeline":
        return <Timeline b={b} ctx={ctx} />;
      case "counts":
        return <Counts b={b} ctx={ctx} />;
      case "conditions":
        return <Conditions b={b} ctx={ctx} />;
      case "element": {
        const h = Math.max(1, Math.min(6, b.el.hSpan ?? (b.el.h || 2)));
        return (
          <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--r-line)] p-4" style={{ height: h * 96 }}>
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
    <section className="space-y-3.5">
      {b.title && (
        <div className="flex items-center gap-3">
          <h3 className="shrink-0 text-[14px] font-bold tracking-[-0.01em] text-[var(--r-ink)]">{b.title}</h3>
          <span className="h-px flex-1 bg-[var(--r-line)]" />
        </div>
      )}
      {body}
    </section>
  );
}

function Headline({ tpl, ctx }: { tpl: string; ctx: Ctx }) {
  return (
    <p className="text-[20px] font-bold leading-[1.5] tracking-[-0.02em] text-[var(--r-ink)] sm:text-[22px]">
      {tplParts(tpl || "", ctx.r.disp, ctx.skip).map((p, i) =>
        p.value ? (
          <span
            key={i}
            className="px-0.5 text-[var(--r-accent)]"
            style={{ background: "linear-gradient(transparent 60%, var(--r-lime) 60%)" }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}

function Tpl({ tpl, ctx, bold }: { tpl: string; ctx: Ctx; bold?: boolean }) {
  return (
    <>
      {tplParts(tpl || "", ctx.r.disp, ctx.skip).map((p, i) => (
        <span key={i} className={p.value && bold ? "font-semibold text-[var(--r-ink)]" : undefined}>
          {p.text}
        </span>
      ))}
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
const plain = (n: number) => fmtU(n, "");

/** 축 눈금용 짧은 금액 — 595만, 1.2억 */
function compact(n: number): string {
  const a = Math.abs(n);
  const t = (x: number) => String(Math.round(x * 10) / 10);
  if (a >= 1e8) return t(n / 1e8) + "억";
  if (a >= 1e4) return t(n / 1e4) + "만";
  return plain(n);
}

/** 0 부터 시작하는 깔끔한 눈금 */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

function Missing({ what }: { what: string }) {
  return <p className="text-[12px] text-[var(--r-muted)]">{what}</p>;
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="none" stroke="var(--r-muted)" strokeWidth="1.4" />
      <rect x="7.3" y="7" width="1.4" height="4.6" rx="0.7" fill="var(--r-muted)" />
      <circle cx="8" cy="4.9" r="0.9" fill="var(--r-muted)" />
    </svg>
  );
}

function Ring({ p, size, stroke, light }: { p: number; size: number; stroke: number; light?: boolean }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, p));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "rgba(255,255,255,0.22)" : "var(--r-accent-soft)"} strokeWidth={stroke} />
      {f > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={light ? "var(--r-lime)" : "var(--r-accent)"}
          strokeWidth={stroke}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - f)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

/** % 단위면 값 자체(0~1)를 비율로, of 가 있으면 bind ÷ of */
function ratioOf(ctx: Ctx, name: string, of?: string): number | null {
  const v = numOf(name, ctx.r.sc);
  if (v === null) return null;
  if (of) {
    const d = numOf(of, ctx.r.sc);
    return d ? v / d : null;
  }
  return uOf(ctx, name) === "%" ? v : null;
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

// ───────────── 수치 ─────────────

function Kpis({ b, ctx }: { b: KpisBlock; ctx: Ctx }) {
  const [hero, ...rest] = b.items;
  if (!hero) return null;
  const heroP = ratioOf(ctx, hero.bind);
  return (
    <div className={"grid gap-3 " + (rest.length ? "sm:grid-cols-[1.25fr_1fr]" : "")}>
      <div className="flex min-h-[132px] flex-col justify-between gap-4 rounded-2xl bg-[var(--r-accent)] p-5 text-white">
        <span className="text-[12px] font-semibold text-white/80">{labelOf(hero)}</span>
        <div className="flex items-end justify-between gap-3">
          <span className="text-[32px] font-bold leading-none tracking-[-0.03em] sm:text-[36px]">{dv(ctx, hero.bind)}</span>
          {heroP !== null && <Ring p={heroP} size={52} stroke={7} light />}
        </div>
      </div>
      {rest.length > 0 && (
        <div className={"grid gap-3 " + (rest.length > 1 ? "grid-cols-2" : "")}>
          {rest.map((it, i) => {
            const p = ratioOf(ctx, it.bind);
            return (
              <div
                key={i}
                className={
                  "flex items-center justify-between gap-2 rounded-2xl bg-[var(--r-soft)] px-4 py-3.5 " +
                  (rest.length === 3 && i === 0 ? "col-span-2" : "")
                }
              >
                <div className="min-w-0">
                  <div className="text-[11.5px] text-[var(--r-muted)]">{labelOf(it)}</div>
                  <div className="mt-0.5 text-[17px] font-bold leading-snug text-[var(--r-ink)]">{dv(ctx, it.bind)}</div>
                </div>
                {p !== null && <Ring p={p} size={36} stroke={5} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Gauges({ b, ctx }: { b: GaugeBlock; ctx: Ctx }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-5">
      {b.items.map((it, i) => {
        const p = ratioOf(ctx, it.bind, it.of);
        if (p === null) return <Missing key={i} what={`비율을 계산할 수 없습니다: ${it.bind}`} />;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="relative">
              <Ring p={p} size={84} stroke={10} />
              <span className="absolute inset-0 grid place-items-center text-[15px] font-bold text-[var(--r-ink)]">
                {fmtU(p, "%")}
              </span>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--r-ink)]">{labelOf(it)}</div>
              {it.of && (
                <div className="text-[11.5px] tabular-nums text-[var(--r-muted)]">
                  {dv(ctx, it.of)} 중 {dv(ctx, it.bind)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Facts({ items, ctx }: { items: DocRef[]; ctx: Ctx }) {
  const cols = items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={"grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--r-line)] bg-[var(--r-line)] " + cols}>
      {items.map((it, i) => (
        <div key={i} className="bg-white px-4 py-3">
          <dt className="text-[11.5px] text-[var(--r-muted)]">{labelOf(it)}</dt>
          <dd className="mt-0.5 text-[14.5px] font-semibold leading-snug text-[var(--r-ink)]">{dv(ctx, it.bind)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Compare({ b, ctx }: { b: CompareBlock; ctx: Ctx }) {
  const rows = b.items
    .map((it) => ({ ...it, v: numOf(it.bind, ctx.r.sc) }))
    .filter((x): x is DocRef & { v: number } => x.v !== null);
  if (rows.length < 2) return <Missing what="비교할 값이 두 개 이상 필요합니다." />;
  const max = Math.max(...rows.map((x) => x.v), 1);
  const first = rows[0].v;
  const lastV = rows[rows.length - 1].v;
  const delta = first ? (lastV - first) / first : null;
  return (
    <div className="space-y-3">
      {delta !== null && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-md bg-[var(--r-ink)] px-2 py-0.5 text-[12px] font-bold tabular-nums text-white">
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {fmtU(Math.abs(delta), "%")}
          </span>
          <span className="text-[12px] text-[var(--r-muted)]">
            {labelOf(rows[0])} 대비 {labelOf(rows[rows.length - 1])}
          </span>
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map((x, i) => {
          const last = i === rows.length - 1;
          const w = (x.v / max) * 100;
          return (
            <div key={i} className="grid grid-cols-[minmax(4.5rem,8.5rem)_1fr] items-center gap-3">
              <span className="text-[12.5px] text-[var(--r-fg)]">{labelOf(x)}</span>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="h-6 shrink rounded-r"
                  style={{ width: `${Math.max(w * 0.72, 1)}%`, background: last ? "var(--r-accent)" : SOFT_BAR }}
                  title={`${labelOf(x)} ${dv(ctx, x.bind)}`}
                />
                <span className={"shrink-0 text-[12.5px] tabular-nums " + (last ? "font-bold text-[var(--r-ink)]" : "")}>
                  {dv(ctx, x.bind)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── 산식·산정 ─────────────

function Formula({ b, ctx }: { b: FormulaBlock; ctx: Ctx }) {
  const st = findStep(ctx.schema, b.bind, ctx.r.activePathId);
  if (!st || st.type !== "formula") return <Missing what={`산식 단계를 찾을 수 없습니다: ${b.bind}`} />;
  const lab = (n: string) => b.labels?.[n]?.trim() || n;
  const Op = ({ children }: { children: ReactNode }) => (
    <span className="grid h-7 min-w-7 place-items-center rounded-full border border-[var(--r-line)] bg-white px-1.5 text-[14px] font-semibold text-[var(--r-fg)]">
      {children}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--r-line)] p-3">
      {st.tokens.map((t, i) => {
        if (t.t === "var")
          return (
            <div key={i} className="rounded-xl bg-[var(--r-soft)] px-4 py-2.5">
              <div className="text-[11px] text-[var(--r-muted)]">{lab(t.name)}</div>
              <div className="text-[18px] font-bold leading-snug text-[var(--r-ink)]">{dv(ctx, t.name)}</div>
            </div>
          );
        if (t.t === "num") return <span key={i} className="px-0.5 text-[18px] font-bold text-[var(--r-ink)]">{plain(t.v)}</span>;
        if (t.t === "op") return <Op key={i}>{OPS[t.op] || t.op}</Op>;
        if (t.t === "fn") return <span key={i} className="text-[13px] font-semibold text-[var(--r-muted)]">{FNS[t.fn] || t.fn}</span>;
        return (
          <span key={i} className="text-[24px] font-light leading-none text-[var(--r-muted)]">
            {t.t === "lp" ? "(" : ")"}
          </span>
        );
      })}
      <Op>=</Op>
      <div className="rounded-xl bg-[var(--r-accent)] px-4 py-2.5 text-white">
        <div className="text-[11px] text-white/75">{lab(b.bind)}</div>
        <div className="text-[18px] font-bold leading-snug">{dv(ctx, b.bind)}</div>
      </div>
    </div>
  );
}

function Itemized({ b, ctx }: { b: ItemizedBlock; ctx: Ctx }) {
  const st = findStep(ctx.schema, b.bind, ctx.r.activePathId);
  if (!st || st.type !== "classify") return <Missing what={`항목 합산 단계를 찾을 수 없습니다: ${b.bind}`} />;
  const variant = b.variant || "bar";
  const unit = uOf(ctx, b.bind);
  // 금액 단위는 한 번만 적는다. %처럼 값 모양이 바뀌는 단위는 칸마다 붙인다.
  const bare = !!unit && unit !== "%";
  const num = (name: string) => {
    if (ctx.skip.has(name)) return "—";
    const v = ctx.r.sc[name];
    return typeof v === "number" ? fmtU(v, bare ? "" : uOf(ctx, name)) : dv(ctx, name);
  };
  const val = (name: string) => {
    const v = ctx.r.sc[name];
    return typeof v === "number" && v > 0 ? v : 0;
  };
  const inc = st.items.filter((it) => it.inc);
  const exc = b.hideExcluded ? [] : st.items.filter((it) => !it.inc);
  const sum = inc.reduce((a, it) => a + val(it.ref), 0);
  // 색은 항목 순서대로 고정. 6개를 넘으면 마지막 색을 이어 쓴다 (값 라벨로 구분).
  const colorOf = (i: number) => CAT[Math.min(i, CAT.length - 1)];
  const share = (name: string) => (sum > 0 ? val(name) / sum : 0);
  const after = b.after || [];
  const chart = variant !== "table";

  const rows = (
    <div className="divide-y divide-[var(--r-line)] border-y border-[var(--r-line)] tabular-nums">
      {inc.map((it, i) => (
        <div key={it.ref} className="flex items-center gap-2.5 py-2">
          {chart && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(i) }} />}
          <span className="min-w-0 flex-1">{it.ref}</span>
          {chart && <span className="w-12 text-right text-[11.5px] text-[var(--r-muted)]">{fmtU(share(it.ref), "%")}</span>}
          <span className="w-24 text-right font-medium text-[var(--r-ink)] sm:w-28">{num(it.ref)}</span>
        </div>
      ))}
      {exc.map((it) => (
        <div key={it.ref} className="flex items-center gap-2.5 py-2 text-[var(--r-muted)]">
          {chart && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: HATCH }} />}
          <span className="min-w-0 flex-1">
            {it.ref}
            <span className="ml-1.5 rounded bg-[var(--r-soft)] px-1.5 py-0.5 text-[10.5px]">제외</span>
          </span>
          <span className="w-24 text-right line-through decoration-[var(--r-muted)]/50 sm:w-28">{num(it.ref)}</span>
        </div>
      ))}
      <div
        className={
          "flex items-center gap-2.5 py-2.5 font-bold text-[var(--r-ink)] " +
          (after.length ? "" : "-mx-2 rounded bg-[var(--r-soft)] px-2")
        }
      >
        <span className="min-w-0 flex-1">{b.totalLabel?.trim() || b.bind}</span>
        <span className="w-24 text-right sm:w-28">{num(b.bind)}</span>
      </div>
      {after.map((a, i) => {
        const last = i === after.length - 1;
        return (
          <div
            key={i}
            className={
              "flex items-center gap-2.5 " +
              (last ? "-mx-2 rounded bg-[var(--r-accent-soft)] px-2 py-2.5 font-bold text-[var(--r-ink)]" : "py-2")
            }
          >
            <span className="min-w-0 flex-1">{labelOf(a)}</span>
            <span className={"w-24 text-right sm:w-28 " + (last ? "text-[var(--r-accent)]" : "")}>
              {a.sign === "-" ? "− " : ""}
              {num(a.bind)}
            </span>
          </div>
        );
      })}
    </div>
  );

  const caption = (b.note || bare) && (
    <p className="text-[11px] text-[var(--r-muted)]">
      {b.note}
      {b.note && bare ? " " : ""}
      {bare && `단위: ${unit}`}
    </p>
  );

  if (variant === "donut") {
    return (
      <div className="space-y-3">
        <div className="grid items-center gap-6 sm:grid-cols-[176px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[176px] w-[176px]">
            <Donut
              parts={inc.map((it, i) => ({ v: val(it.ref), color: colorOf(i), label: `${it.ref} ${num(it.ref)}` }))}
              size={176}
              stroke={26}
            />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[11px] text-[var(--r-muted)]">{b.totalLabel?.trim() || b.bind}</div>
                <div className="text-[16px] font-bold text-[var(--r-ink)]">{num(b.bind)}</div>
              </div>
            </div>
          </div>
          <div className="min-w-0">{rows}</div>
        </div>
        {caption}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variant === "bar" && sum > 0 && (
        <div className="flex h-6 gap-[2px] overflow-hidden rounded">
          {inc.map((it, i) => {
            const s = share(it.ref);
            if (s <= 0) return null;
            return (
              <div
                key={it.ref}
                className="grid min-w-[2px] place-items-center text-[10.5px] font-semibold text-white"
                style={{ flexGrow: s, flexBasis: 0, background: colorOf(i) }}
                title={`${it.ref} ${num(it.ref)} (${fmtU(s, "%")})`}
              >
                {s >= 0.14 ? fmtU(s, "%") : ""}
              </div>
            );
          })}
        </div>
      )}
      {rows}
      {caption}
    </div>
  );
}

function Donut({ parts, size, stroke }: { parts: { v: number; color: string; label: string }[]; size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + p.v, 0);
  const gap = parts.filter((p) => p.v > 0).length > 1 ? 2 : 0;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--r-soft)" strokeWidth={stroke} />
      {total > 0 &&
        parts.map((p, i) => {
          const len = (p.v / total) * C;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{p.label}</title>
            </circle>
          );
          off += len;
          return seg;
        })}
    </svg>
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
  const showPath = !!b.allPaths && sources.length > 1;

  const rows = sources.flatMap((src) =>
    (src.step.bands || []).map((band: any) => {
      const from = bandNum(band.from, ctx.r.sc);
      const to = bandNum(band.to, ctx.r.sc);
      const v = bandNum(band.v, ctx.r.sc);
      return {
        range: (from === to ? plain(from) : `${plain(from)}–${plain(to)}`) + (refUnit || ""),
        path: src.pathLabel,
        v,
        value: fmtU(v, valUnit),
        here: src.pathId === ctx.r.activePathId && typeof cur === "number" && cur >= from && cur <= to,
      };
    })
  );
  const note = b.note && <p className="text-[11px] text-[var(--r-muted)]">{b.note}</p>;

  if (b.variant === "table") {
    return (
      <div className="space-y-2">
        <div className="divide-y divide-[var(--r-line)] border-y border-[var(--r-line)] tabular-nums">
          <div className="flex gap-3 py-1.5 text-[11px] text-[var(--r-muted)]">
            <span className="flex-1">{b.refLabel?.trim() || ref}</span>
            {showPath && <span className="w-20">유형</span>}
            <span className="w-20 text-right">{b.valueLabel?.trim() || b.bind}</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className={
                "flex items-center gap-3 py-2 " +
                (row.here ? "-mx-2 rounded bg-[var(--r-accent-soft)] px-2 font-bold text-[var(--r-ink)]" : "")
              }
            >
              <span className="flex-1">
                {row.range}
                {row.here && <HereTag />}
              </span>
              {showPath && <span className="w-20">{row.path}</span>}
              <span className="w-20 text-right">{row.value}</span>
            </div>
          ))}
        </div>
        {note}
      </div>
    );
  }

  const max = Math.max(...rows.map((x) => x.v), 0);
  const H = 132;
  // 경로가 바뀌는 지점에 묶음 표시
  const groups: { label: string; n: number }[] = [];
  for (const row of rows) {
    const g = groups[groups.length - 1];
    if (g && g.label === row.path) g.n += 1;
    else groups.push({ label: row.path, n: 1 });
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[var(--r-muted)]">
        {b.refLabel?.trim() || ref}별 {b.valueLabel?.trim() || b.bind}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map((row, i) => {
          const h = max > 0 ? (row.v / max) * H : 0;
          return (
            <div key={i} className="flex min-w-0 flex-col items-center">
              <div className="flex w-full flex-col items-center justify-end" style={{ height: H + 44 }}>
                {row.here && (
                  <span className="mb-1 rounded-full bg-[var(--r-lime)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--r-ink)]">
                    현재
                  </span>
                )}
                <span
                  className={
                    "mb-1 text-[12px] tabular-nums " + (row.here ? "font-bold text-[var(--r-ink)]" : "text-[var(--r-fg)]")
                  }
                >
                  {row.value}
                </span>
                <div
                  className="w-6 rounded-t"
                  style={{ height: Math.max(h, 2), background: row.here ? "var(--r-accent)" : SOFT_BAR }}
                  title={`${row.range} ${row.value}`}
                />
              </div>
              <div className="h-px w-full bg-[var(--r-ink)]/25" />
              <span
                className={
                  "mt-1.5 text-center text-[11.5px] tabular-nums " +
                  (row.here ? "font-bold text-[var(--r-ink)]" : "text-[var(--r-muted)]")
                }
              >
                {row.range}
              </span>
            </div>
          );
        })}
      </div>
      {showPath && (
        <div className="grid gap-1" style={{ gridTemplateColumns: groups.map((g) => `${g.n}fr`).join(" ") }}>
          {groups.map((g, i) => (
            <div key={i} className="rounded-md bg-[var(--r-soft)] py-1 text-center text-[11px] font-semibold text-[var(--r-fg)]">
              {g.label}
            </div>
          ))}
        </div>
      )}
      {note}
    </div>
  );
}

function HereTag() {
  return <span className="ml-2 rounded-full bg-[var(--r-lime)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--r-ink)]">현재</span>;
}

function Steps({ b, ctx }: { b: FlowBlock; ctx: Ctx }) {
  return (
    <ol className="relative">
      {b.steps.map((s, i) => {
        const st = findStep(ctx.schema, s.bind, ctx.r.activePathId);
        const how = st ? (st.type === "formula" ? tk2disp(st.tokens) : describeStep(st, ctx.r.sc)) : "";
        const last = i === b.steps.length - 1;
        return (
          <li key={i} className="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 pb-4 last:pb-0">
            {!last && <span className="absolute bottom-0 left-[15px] top-8 w-[2px] bg-[var(--r-line)]" />}
            <span
              className={
                "relative z-10 grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold " +
                (last ? "bg-[var(--r-accent)] text-white" : "border-2 border-[var(--r-accent)] bg-white text-[var(--r-accent)]")
              }
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <div className="font-semibold text-[var(--r-ink)]">{labelOf(s)}</div>
              {how && <div className="mt-0.5 text-[11.5px] text-[var(--r-muted)]">{how}</div>}
            </div>
            <span
              className={"pt-1 text-[14px] font-bold tabular-nums " + (last ? "text-[var(--r-accent)]" : "text-[var(--r-ink)]")}
            >
              {dv(ctx, s.bind)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Waterfall({ b, ctx }: { b: FlowBlock; ctx: Ctx }) {
  const u0 = b.steps[0] ? uOf(ctx, b.steps[0].bind) : "";
  const pts = b.steps
    .filter((s) => uOf(ctx, s.bind) === u0)
    .map((s) => ({ ...s, v: numOf(s.bind, ctx.r.sc) }))
    .filter((s): s is DocRef & { v: number } => s.v !== null);
  if (pts.length < 2) return <Missing what="폭포 차트에는 같은 단위의 금액 단계가 두 개 이상 필요합니다." />;

  type Col = { label: string; lo: number; hi: number; kind: "total" | "down" | "up" | "flat"; text: string };
  const cols: Col[] = [{ label: labelOf(pts[0]), lo: 0, hi: pts[0].v, kind: "total", text: plain(pts[0].v) }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].v;
    const c = pts[i].v;
    const d = c - a;
    cols.push({
      label: labelOf(pts[i]),
      lo: Math.min(a, c),
      hi: Math.max(a, c),
      kind: d < 0 ? "down" : d > 0 ? "up" : "flat",
      text: d === 0 ? "변동 없음" : `${d > 0 ? "+" : "−"}${plain(Math.abs(d))}`,
    });
  }
  const end = pts[pts.length - 1];
  cols.push({ label: b.endLabel?.trim() || labelOf(end), lo: 0, hi: end.v, kind: "total", text: plain(end.v) });

  const ticks = niceTicks(Math.max(...cols.map((x) => x.hi), 1), 3);
  const max = ticks[ticks.length - 1];
  const H = 150;
  const y = (v: number) => (v / max) * H;
  const color = { total: "var(--r-accent)", down: CAT[1], up: CAT[2], flat: "var(--r-ink)" };

  return (
    <div className="space-y-2">
      <div className="relative pl-9">
        {/* 눈금선 — 막대 영역(위 24px 라벨 여백 아래)에 맞춘다 */}
        <div className="pointer-events-none absolute left-0 right-0" style={{ top: 24, height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute left-9 right-0 border-t border-[var(--r-line)]" style={{ bottom: y(t) }}>
              <span className="absolute -left-9 -top-[7px] w-8 text-right text-[10px] tabular-nums text-[var(--r-muted)]">
                {compact(t)}
              </span>
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((x, i) => (
            <div key={i} className="flex min-w-0 flex-col items-center">
              <div className="relative w-full" style={{ height: H + 24 }}>
                <span
                  className={
                    "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11.5px] tabular-nums " +
                    (x.kind === "total" ? "font-bold text-[var(--r-ink)]" : "text-[var(--r-fg)]")
                  }
                  style={{ bottom: y(x.hi) + 4 }}
                >
                  {x.text}
                </span>
                <div
                  className={"absolute left-1/2 w-6 -translate-x-1/2 " + (x.kind === "total" ? "rounded-t" : "rounded-sm")}
                  style={{
                    bottom: y(x.lo),
                    height: x.kind === "flat" ? 2 : Math.max(y(x.hi) - y(x.lo), 2),
                    background: color[x.kind],
                  }}
                  title={`${x.label} ${x.text}`}
                />
              </div>
              <div className="h-px w-full bg-[var(--r-ink)]/25" />
              <span className="mt-1.5 px-1 text-center text-[11px] leading-tight text-[var(--r-fg)]">{x.label}</span>
            </div>
          ))}
        </div>
      </div>
      {u0 && u0 !== "%" && <p className="text-[11px] text-[var(--r-muted)]">단위: {u0}</p>}
    </div>
  );
}

// ───────────── 위치·기간 ─────────────

function Range({ b, ctx }: { b: RangeBlock; ctx: Ctx }) {
  const lo = numOf(b.min, ctx.r.sc);
  const hi = numOf(b.max, ctx.r.sc);
  const v = numOf(b.bind, ctx.r.sc);
  if (lo === null || hi === null || v === null || hi <= lo)
    return <Missing what="범위의 최소·최대 값을 확인할 수 없습니다." />;
  const mid = numOf(b.mid, ctx.r.sc);
  const u = uOf(ctx, b.bind);
  const pos = (x: number) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return (
    <div className="relative h-[90px]">
      <At p={pos(v)} className="top-0">
        <span className="block rounded-lg bg-[var(--r-ink)] px-2.5 py-1 text-[12px] font-bold tabular-nums text-white">
          {dv(ctx, b.bind)}
        </span>
      </At>
      <div
        className="absolute inset-x-0 top-[40px] h-2.5 rounded-full"
        style={{ background: "linear-gradient(90deg, var(--r-accent-soft), #a9c4fb 55%, var(--r-accent))" }}
      />
      <div
        className="absolute top-[34px] h-[22px] w-[22px] rounded-full border-[3px] border-[var(--r-ink)] bg-[var(--r-lime)]"
        style={{ left: `calc(${pos(v) * 100}% - 11px)` }}
      />
      {[
        { p: 0, l: "최소", x: lo },
        ...(mid !== null ? [{ p: pos(mid), l: "중간", x: mid }] : []),
        { p: 1, l: "최대", x: hi },
      ].map((t) => (
        <At key={t.l} p={t.p} className="top-[64px] text-[11px] tabular-nums text-[var(--r-muted)]">
          <span className="font-semibold text-[var(--r-fg)]">{t.l}</span> {fmtU(t.x, u)}
        </At>
      ))}
    </div>
  );
}

function Bullet({ b, ctx }: { b: BarBlock; ctx: Ctx }) {
  const v = numOf(b.bind, ctx.r.sc);
  if (v === null) return <Missing what={`값을 확인할 수 없습니다: ${b.bind}`} />;
  const marks = b.marks
    .map((mk) => ({ ...mk, x: numOf(mk.bind, ctx.r.sc) }))
    .filter((mk): mk is DocRef & { x: number } => mk.x !== null)
    .sort((a, c) => a.x - c.x);
  const ticks = niceTicks(Math.max(v, ...marks.map((mk) => mk.x), 1));
  const max = ticks[ticks.length - 1];
  const u = uOf(ctx, b.bind);
  const p = (x: number) => x / max;
  const inside = p(v) > 0.3;
  return (
    <div className="space-y-1">
      {/* 기준선 이름 — 이웃끼리 겹치지 않게 두 줄로 번갈아 */}
      <div className="relative h-[38px]">
        {marks.map((mk, i) => (
          <At key={i} p={p(mk.x)} className={"text-[11px] tabular-nums " + (i % 2 ? "top-0" : "top-[18px]")}>
            <span className="font-semibold text-[var(--r-ink)]">{labelOf(mk)}</span>{" "}
            <span className="text-[var(--r-muted)]">{fmtU(mk.x, u)}</span>
          </At>
        ))}
      </div>
      <div className="relative h-9">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-y-0 border-l border-[var(--r-line)]" style={{ left: `${p(t) * 100}%` }} />
        ))}
        <div className="absolute inset-x-0 top-[6px] h-6 rounded bg-[var(--r-soft)]" />
        <div
          className="absolute left-0 top-[6px] flex h-6 items-center justify-end rounded-r bg-[var(--r-accent)] pr-2 text-[11.5px] font-bold tabular-nums text-white"
          style={{ width: `${p(v) * 100}%` }}
          title={`${b.bind} ${dv(ctx, b.bind)}`}
        >
          {inside ? dv(ctx, b.bind) : ""}
        </div>
        {marks.map((mk, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[var(--r-ink)]"
            style={{ left: `${p(mk.x) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative h-4">
        {ticks.map((t) => (
          <At key={t} p={p(t)} className="top-0 text-[10px] tabular-nums text-[var(--r-muted)]">
            {compact(t)}
          </At>
        ))}
      </div>
      {!inside && (
        <p className="pt-1 text-[12px] font-bold tabular-nums text-[var(--r-ink)]">
          {b.bind} {dv(ctx, b.bind)}
        </p>
      )}
    </div>
  );
}

function Timeline({ b, ctx }: { b: TimelineBlock; ctx: Ctx }) {
  // 모두 날짜로 읽히면 날짜순으로, 아니면 적힌 순서대로 둔다.
  const pts = b.points.map((p) => ({ ...p, d: pdate(ctx.r.sc[p.bind]) }));
  if (pts.every((p) => p.d)) pts.sort((a, c) => a.d!.getTime() - c.d!.getTime());
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, pts.length)}, minmax(0, 1fr))` }}>
      <span className="absolute left-2 right-0 top-[9px] h-[2px] bg-[var(--r-line)]" />
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        return (
          <li key={i} className="relative flex min-w-0 flex-col items-start pr-3">
            <span
              className={
                "relative z-10 h-[20px] w-[20px] rounded-full border-[3px] border-white " +
                (last ? "bg-[var(--r-lime)] ring-2 ring-[var(--r-ink)]" : "bg-[var(--r-accent)]")
              }
            />
            <span className="mt-2 text-[13px] font-bold leading-snug text-[var(--r-ink)]">{dv(ctx, p.bind)}</span>
            <span className="text-[11.5px] text-[var(--r-muted)]">{labelOf(p)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Counts({ b, ctx }: { b: CountsBlock; ctx: Ctx }) {
  const total = numOf(b.total, ctx.r.sc);
  const used = numOf(b.used, ctx.r.sc);
  const hasPair = total !== null && used !== null && total > 0;
  const cells = hasPair && total! <= 60 ? Math.round(total!) : 0;
  const u = b.total ? uOf(ctx, b.total) : "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {hasPair && (
          <div className="relative">
            <Ring p={used! / total!} size={92} stroke={11} />
            <span className="absolute inset-0 grid place-items-center text-center">
              <span>
                <span className="block text-[17px] font-bold leading-none text-[var(--r-ink)]">{fmtU(used! / total!, "%")}</span>
                <span className="text-[10px] text-[var(--r-muted)]">사용</span>
              </span>
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {b.items.map((it, i) => (
            <div key={i} className="min-w-[84px] rounded-xl bg-[var(--r-soft)] px-4 py-3">
              <div className="text-[11.5px] text-[var(--r-muted)]">{labelOf(it)}</div>
              <div className="text-[22px] font-bold leading-tight text-[var(--r-ink)]">{dv(ctx, it.bind)}</div>
            </div>
          ))}
          {hasPair && (
            <div className="min-w-[84px] rounded-xl bg-[var(--r-accent-soft)] px-4 py-3">
              <div className="text-[11.5px] text-[var(--r-muted)]">남음</div>
              <div className="text-[22px] font-bold leading-tight text-[var(--r-accent)]">
                {fmtU(Math.max(0, total! - used!), u)}
              </div>
            </div>
          )}
        </div>
      </div>
      {cells > 0 && (
        <div className="flex flex-wrap gap-[3px]" aria-label={`${fmtU(total!, u)} 중 ${fmtU(used!, u)} 사용`}>
          {Array.from({ length: cells }, (_, i) => (
            <span
              key={i}
              className={"h-4 w-4 rounded-[4px] " + (i < Math.round(used!) ? "bg-[var(--r-accent)]" : "bg-[var(--r-accent-soft)]")}
            />
          ))}
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
    <ul className="divide-y divide-[var(--r-line)] overflow-hidden rounded-xl border border-[var(--r-line)]">
      {rows.map((r, i) => {
        const j = conds[i];
        const bIsName = j ? j.bMode !== "val" : false;
        const aUnit = uOf(ctx, r.a);
        const label = (j && b.labels?.[j.id]?.trim()) || `${bIsName ? r.b : r.a} ${KOP[r.op]}`;
        return (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
            <span
              className={"grid h-6 w-6 shrink-0 place-items-center rounded-full " + (r.ok ? "bg-[var(--r-accent)]" : "bg-[var(--r-soft)]")}
              aria-hidden
            >
              {r.ok ? (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="var(--r-muted)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className="min-w-[9rem] flex-1 font-semibold text-[var(--r-ink)]">{label}</span>
            <span className="ml-9 flex items-center gap-1.5 text-[12px] tabular-nums sm:ml-0">
              <span className="rounded-full border border-[var(--r-line)] px-2.5 py-0.5 text-[var(--r-muted)]">
                기준 {show(r.bv, bIsName ? uOf(ctx, r.b) || aUnit : aUnit)}
              </span>
              <span className="rounded-full bg-[var(--r-accent-soft)] px-2.5 py-0.5 font-semibold text-[var(--r-ink)]">
                본인 {show(r.av, aUnit)}
              </span>
              <span className={"ml-1 w-14 text-right font-semibold " + (r.ok ? "text-[var(--r-ink)]" : "text-[var(--r-muted)]")}>
                {r.ok ? "해당" : "해당 없음"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
