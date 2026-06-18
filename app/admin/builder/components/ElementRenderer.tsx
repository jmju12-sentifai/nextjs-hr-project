"use client";
import type {
  AppSchema,
  ChartType,
  Disp,
  Judge,
  JudgeResult,
  ReportElement,
  Sc,
  Step,
} from "app-renderer";
import { describeName, fmtU, migrateSchema, tk2disp, unitOf } from "app-renderer";
import type { Step as RStep } from "app-renderer";

// 새/옛 스키마 모두에서 모든 step 을 평탄화해 검색
function allStepsOf(schema: AppSchema): RStep[] {
  const m = migrateSchema(schema);
  return [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as RStep[]) || []),
  ];
}

interface Props {
  schema: AppSchema;
  el: ReportElement;
  sc: Sc;
  disp: Disp;
  jres: JudgeResult[];
  pathLabel?: string;
  pathConditions?: Judge[];
}

function DescText({ name, text }: { name: string; text: string }) {
  if (!text || !name) return null;
  return (
    <div className="text-[10px] text-gray-500 mt-1.5 shrink-0 leading-snug">
      * <span className="font-medium text-gray-700">{name}</span> : {text}
    </div>
  );
}

export default function ElementRenderer({ schema, el, sc, disp, jres, pathLabel, pathConditions }: Props) {
  const showDesc = el.showDesc !== false; // 기본 true
  const desc = showDesc ? describeName(schema, el.bind, sc) : "";

  if (el.kind === "field") {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 flex items-center justify-center text-center">
          <div className="text-base font-medium break-words tabular-nums">
            {disp[el.bind] ?? "—"}
          </div>
        </div>
        <DescText name={el.bind} text={desc} />
      </div>
    );
  }
  if (el.kind === "fields") {
    const binds = el.binds || [];
    return (
      <div className="w-full h-full flex items-start justify-center min-h-0 overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-center w-full gap-x-10 gap-y-2 text-sm">
          {binds.length === 0 ? (
            <span className="text-xs text-gray-400">변수가 비어 있습니다</span>
          ) : (
            binds.map((n, i) => (
              <span key={n} className="inline-flex items-baseline gap-3 whitespace-nowrap">
                <span className="text-gray-600">{n}</span>
                <b className="text-gray-900 font-semibold tabular-nums">{disp[n] ?? "—"}</b>
                {i < binds.length - 1 && (
                  <span className="text-gray-300 ml-3">|</span>
                )}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }
  if (el.kind === "pathlabel") {
    const conds = pathConditions || [];
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        {el.label && <Lab>{el.label}</Lab>}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 overflow-hidden">
          <div className="inline-flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-medium text-blue-700">
            {pathLabel || "—"}
          </div>
          {conds.length > 0 && (
            <ul className="text-[11px] text-gray-600 space-y-0.5 leading-snug">
              {conds.map((c, i) => (
                <li key={i}>
                  * {c.a} <span className="font-mono">{c.op}</span> {c.b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
  if (el.kind === "card") {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 flex items-center justify-center text-center">
          <div className="font-serif text-3xl font-bold tracking-tight text-blue-700 break-words leading-none tabular-nums">
            {disp[el.bind] ?? "—"}
          </div>
        </div>
        <DescText name={el.bind} text={desc} />
      </div>
    );
  }
  if (el.kind === "compare") {
    if (!jres.length)
      return (
        <div>
          <Lab>{el.label}</Lab>
          <div className="text-xs text-gray-500">판정부 비교가 없습니다</div>
        </div>
      );
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <table className="w-full text-xs text-center">
          <thead>
            <tr className="text-[10px] font-mono uppercase text-gray-500">
              <th className="py-1 px-1 text-center">기준</th>
              <th className="py-1 px-1 text-center">규정 측</th>
              <th className="py-1 px-1 text-center">관계</th>
              <th className="py-1 px-1 text-center">대상자 측</th>
              <th className="py-1 px-1 text-center">결과</th>
            </tr>
          </thead>
          <tbody>
            {jres.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1 px-1 text-center">
                  {r.a}
                  {r.ex && (
                    <span className="ml-1 rounded border px-1 text-[9px] font-mono text-gray-500">
                      예외
                    </span>
                  )}
                </td>
                <td className="py-1 px-1 font-mono text-center">
                  {typeof r.av === "number"
                    ? fmtU(r.av, unitOf(schema, r.a))
                    : r.av}
                </td>
                <td className="py-1 px-1 font-mono text-center">{r.op}</td>
                <td className="py-1 px-1 font-mono text-center">
                  {typeof r.bv === "number"
                    ? fmtU(r.bv, unitOf(schema, r.b))
                    : r.bv}
                </td>
                <td className="py-1 px-1 text-center">
                  <span
                    className={
                      "inline-block rounded px-1.5 py-0.5 text-[10px] " +
                      (r.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700")
                    }
                  >
                    {r.ok ? "충족" : "미충족"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (el.kind === "calc") {
    const st = allStepsOf(schema).find((s) => s.name === el.bind);
    const expr =
      st && st.type === "formula"
        ? tk2disp(st.tokens)
            .split(" ")
            .map((w) => (w in disp ? disp[w] : w))
            .join(" ")
        : "(계산식 단계 바인딩)";
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="rounded bg-gray-50 border px-3 py-2 font-mono text-xs text-center">
            {expr} ={" "}
            <span className="text-emerald-700 font-semibold">
              {disp[el.bind] ?? "—"}
            </span>
          </div>
        </div>
        <DescText name={el.bind} text={desc} />
      </div>
    );
  }
  if (el.kind === "incexc") {
    const st = allStepsOf(schema).find((s) => s.name === el.bind);
    if (!st || st.type !== "classify")
      return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
          <Lab>{el.label}</Lab>
          <div className="flex-1 min-h-0 flex items-center justify-center text-xs text-gray-500">
            분류 단계 바인딩 필요
          </div>
        </div>
      );
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 flex items-center justify-center text-center">
        <div className="text-xs w-full">
          <div className="mb-1 flex flex-wrap justify-center items-center gap-1">
            <span className="text-[10px] font-mono text-gray-500 mr-1">
              포함
            </span>
            {st.items.filter((i) => i.inc).map((i) => (
              <span
                key={i.ref}
                className="inline-block rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px]"
              >
                {i.ref}
              </span>
            ))}
            {st.items.filter((i) => i.inc).length === 0 && "—"}
          </div>
          <div className="flex flex-wrap justify-center items-center gap-1">
            <span className="text-[10px] font-mono text-gray-500 mr-1">
              제외
            </span>
            {st.items.filter((i) => !i.inc).map((i) => (
              <span
                key={i.ref}
                className="inline-block rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px]"
              >
                {i.ref}
              </span>
            ))}
            {st.items.filter((i) => !i.inc).length === 0 && "—"}
          </div>
        </div>
        </div>
        <DescText name={el.bind} text={desc} />
      </div>
    );
  }
  if (el.kind === "chart") {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ChartView schema={schema} el={el} sc={sc} />
        </div>
        <DescText name={el.bind} text={desc} />
      </div>
    );
  }
  if (el.kind === "note") {
    const text = (el.tpl || "").replace(/\{([^}]+)\}/g, (_, n) =>
      n in disp ? disp[n] : "{" + n + "}"
    );
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <Lab>{el.label}</Lab>
        <div className="flex-1 min-h-0 flex items-center justify-center text-center">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
        </div>
      </div>
    );
  }
  return null;
}

function Lab({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-gray-700 mb-1.5">
      {children}
    </div>
  );
}

function ChartView({
  schema,
  el,
  sc,
}: {
  schema: AppSchema;
  el: ReportElement;
  sc: Sc;
}) {
  const ct: ChartType = el.ctype || "bar";
  const st = allStepsOf(schema).find((s) => s.name === el.bind);

  if (ct === "donut") {
    if (!st || st.type !== "classify")
      return (
        <div className="text-xs text-gray-500">분류 단계 바인딩 필요</div>
      );
    const incV = st.items
      .filter((i) => i.inc)
      .reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const exV = st.items
      .filter((i) => !i.inc)
      .reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const tot = incV + exV || 1;
    const pct = Math.round((incV / tot) * 100);
    const r = 22;
    const C = 2 * Math.PI * r;
    const off = C * (1 - incV / tot);
    const u = unitOf(schema, el.bind) || "원";
    return (
      <div className="flex items-center gap-3">
        <svg width="80" height="80" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#F4ECDD" strokeWidth="11" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="#2563eb"
            strokeWidth="11"
            strokeDasharray={C}
            strokeDashoffset={off}
            transform="rotate(-90 36 36)"
          />
          <text
            x="36"
            y="40"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#2563eb"
            fontFamily="ui-monospace"
          >
            {pct}%
          </text>
        </svg>
        <div className="text-xs space-y-1">
          <div>
            <span className="inline-block rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5 mr-1">
              포함
            </span>
            {fmtU(incV, u)}
          </div>
          <div>
            <span className="inline-block rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 mr-1">
              제외
            </span>
            {fmtU(exV, u)}
          </div>
        </div>
      </div>
    );
  }

  if (ct === "stacked") {
    if (!st || st.type !== "classify")
      return <div className="text-xs text-gray-500">분류 단계 바인딩 필요</div>;
    const incItems = st.items
      .filter((i) => i.inc)
      .map((i) => ({ ref: i.ref, v: Number(sc[i.ref] || 0) }));
    const total = incItems.reduce((a, x) => a + x.v, 0) || 1;
    const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
    const u = unitOf(schema, el.bind) || "";
    return (
      <div className="space-y-2">
        <div className="flex h-5 rounded overflow-hidden border">
          {incItems.map((x, i) => (
            <div
              key={i}
              title={`${x.ref}: ${fmtU(x.v, u)}`}
              style={{ width: `${(x.v / total) * 100}%`, background: palette[i % palette.length] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {incItems.map((x, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: palette[i % palette.length] }}
              />
              {x.ref}{" "}
              <span className="font-mono text-gray-500">
                {fmtU(x.v, u)} ({Math.round((x.v / total) * 100)}%)
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (ct === "gauge") {
    const val = Number(sc[el.bind] || 0);
    let min = 0;
    let max = 100;
    const tryNum = (s: string | number | undefined): number | null => {
      if (s == null || s === "") return null;
      const str = String(s);
      const n = parseFloat(str);
      if (!isNaN(n) && String(n) === str.trim()) return n;
      const v = sc[str];
      return typeof v === "number" ? v : null;
    };
    if (st && st.type === "clamp") {
      const mn = tryNum(st.min);
      const mx2 = tryNum(st.max);
      if (mn !== null) min = mn;
      if (mx2 !== null) max = mx2;
    } else if (st && st.type === "table" && st.bands.length) {
      min = Math.min(...st.bands.map((b) => b.from));
      max = Math.max(...st.bands.map((b) => b.to));
    } else {
      max = Math.max(100, val * 1.5 || 100);
    }
    const range = Math.max(max - min, 0.0001);
    const pct = Math.max(0, Math.min(1, (val - min) / range));
    const r = 36;
    const cx = 50;
    const cy = 46;
    const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    const arcLen = Math.PI * r;
    const u = unitOf(schema, el.bind) || "";
    return (
      <div className="h-full w-full flex flex-col items-center justify-center min-h-0 overflow-hidden">
        <svg
          viewBox="0 0 100 58"
          preserveAspectRatio="xMidYMid meet"
          style={{ flex: 1, minHeight: 0, maxWidth: "100%", maxHeight: "100%" }}
        >
          <path
            d={arcPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={arcPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={arcLen * (1 - pct)}
          />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="#2563eb"
            fontFamily="ui-monospace"
          >
            {fmtU(val, u)}
          </text>
        </svg>
        <div className="text-[9px] font-mono text-gray-500 shrink-0">
          {fmtU(min, u)} ~ {fmtU(max, u)}
        </div>
      </div>
    );
  }

  if (ct === "bullet") {
    const val = Number(sc[el.bind] || 0);
    const target = Number(sc[el.bind2 || ""] || 0);
    const maxBase = Math.max(val, target, 1) * 1.2;
    const valPct = Math.max(0, Math.min(100, (val / maxBase) * 100));
    const targetPct = Math.max(0, Math.min(100, (target / maxBase) * 100));
    const u = unitOf(schema, el.bind) || "";
    const ok = target > 0 && val >= target;
    return (
      <div className="space-y-1.5">
        <div className="relative h-6 bg-gray-100 rounded overflow-hidden border">
          <div
            className={"absolute inset-y-0 left-0 " + (ok ? "bg-emerald-500" : "bg-blue-600")}
            style={{ width: `${valPct}%` }}
          />
          {target > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-rose-600"
              style={{ left: `calc(${targetPct}% - 1px)` }}
              title={`목표 ${fmtU(target, u)}`}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span>
            실적 <b>{fmtU(val, u)}</b>
          </span>
          {el.bind2 && (
            <span>
              목표 <b className="text-rose-600">{fmtU(target, u)}</b>
            </span>
          )}
          <span className="font-mono text-gray-500">
            {target > 0 ? Math.round((val / target) * 100) + "%" : "—"}
          </span>
        </div>
      </div>
    );
  }

  if (ct === "comparison") {
    const aV = Number(sc[el.bind] || 0);
    const bV = Number(sc[el.bind2 || ""] || 0);
    const mx = Math.max(Math.abs(aV), Math.abs(bV), 0.0001);
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    const items = [
      { label: el.bind, v: aV, pct: (Math.abs(aV) / mx) * 100, color: "bg-blue-600", border: "border-blue-600", unit: u },
      { label: el.bind2 || "—", v: bV, pct: (Math.abs(bV) / mx) * 100, color: "bg-slate-400", border: "border-slate-400", unit: uB },
    ];
    return (
      <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex items-end gap-3 pt-1">
          {items.map((x, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0">
              <span className="text-[10px] font-mono font-semibold shrink-0">
                {fmtU(x.v, x.unit)}
              </span>
              <div
                className={"w-full rounded-t border " + x.color + " " + x.border}
                style={{ height: `${Math.max(6, x.pct)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-1 shrink-0">
          {items.map((x, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-gray-600 truncate">
              {x.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (ct === "delta") {
    const cur = Number(sc[el.bind] || 0);
    const prev = Number(sc[el.bind2 || ""] || 0);
    const diff = cur - prev;
    const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
    const u = unitOf(schema, el.bind) || "";
    const up = diff > 0;
    const flat = diff === 0;
    const color = flat ? "text-gray-500" : up ? "text-emerald-600" : "text-rose-600";
    const arrow = flat ? "▬" : up ? "▲" : "▼";
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="text-[10px] text-gray-500 font-mono">
          이전 {fmtU(prev, u)} → 현재
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{fmtU(cur, u)}</span>
          <span className={"text-sm font-semibold " + color}>
            {arrow} {fmtU(Math.abs(diff), u)}
            {prev !== 0 && (
              <span className="ml-1 text-xs">
                ({up ? "+" : flat ? "" : "-"}
                {Math.abs(Math.round(pct * 10) / 10)}%)
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  if (ct === "ratio") {
    const num = Number(sc[el.bind] || 0);
    const den = Number(sc[el.bind2 || ""] || 0);
    const pct = den > 0 ? Math.max(0, Math.min(1, num / den)) : 0;
    const r = 36;
    const cx = 50;
    const cy = 46;
    const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    const arcLen = Math.PI * r;
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center min-h-0 overflow-hidden">
        <svg
          viewBox="0 0 100 58"
          preserveAspectRatio="xMidYMid meet"
          style={{ flex: 1, minHeight: 0, maxWidth: "100%", maxHeight: "100%" }}
        >
          <path
            d={arcPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={arcPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={arcLen * (1 - pct)}
          />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#2563eb"
            fontFamily="ui-monospace"
          >
            {Math.round(pct * 100)}%
          </text>
        </svg>
        <div className="text-[9px] font-mono text-gray-500 shrink-0">
          {fmtU(num, u)} / {fmtU(den, uB)}
        </div>
      </div>
    );
  }

  if (!st || st.type !== "table")
    return <div className="text-xs text-gray-500">구간표 단계 바인딩 필요</div>;
  const cur = sc[st.ref];
  const mx = Math.max(...st.bands.map((b) => Math.abs(b.v)), 0.0001);

  if (ct === "bar") {
    return (
      <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex items-end gap-1.5 pt-1">
          {st.bands.map((b, i) => {
            const on = cur >= b.from && cur <= b.to;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-end justify-end h-full min-w-0"
              >
                <div
                  className={
                    "w-full rounded-t border " +
                    (on
                      ? "bg-blue-600 border-blue-600"
                      : "bg-blue-50 border-blue-300")
                  }
                  style={{
                    height: `${Math.max(6, (Math.abs(b.v) / mx) * 100)}%`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1 shrink-0">
          {st.bands.map((b, i) => (
            <div key={i} className="flex-1 text-center text-[9px] font-mono text-gray-500 truncate">
              {b.from}–{b.to}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // step-line
  const n = st.bands.length;
  if (!n) return <div className="text-xs text-gray-500">구간 없음</div>;
  const W = 280;
  const H = 84;
  const xs = st.bands.map((_, i) => 10 + (i / Math.max(n - 1, 1)) * (W - 20));
  const ys = st.bands.map((b) => H - 10 - (Math.abs(b.v) / mx) * (H - 22));
  let path = "";
  st.bands.forEach((_, i) => {
    if (i === 0) path += `M ${xs[i]} ${ys[i]} `;
    else path += `L ${xs[i]} ${ys[i - 1]} L ${xs[i]} ${ys[i]} `;
  });
  const ci = st.bands.findIndex((b) => cur >= b.from && cur <= b.to);
  const u = st.unit || "";
  let dot: React.ReactNode = null;
  if (ci >= 0) {
    const curDisp =
      u === "%"
        ? Math.round(st.bands[ci].v * 1000) / 10 + "%"
        : fmtU(st.bands[ci].v, u);
    dot = (
      <>
        <circle cx={xs[ci]} cy={ys[ci]} r="4" fill="#2563eb" />
        <text
          x={xs[ci]}
          y={ys[ci] - 8}
          fontSize="9.5"
          fill="#2563eb"
          textAnchor="middle"
          fontWeight="700"
        >
          현재 {curDisp}
        </text>
      </>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 4}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", maxHeight: "100%" }}
    >
      <path d={path} stroke="#2563eb" strokeWidth="2" fill="none" />
      {st.bands.map((b, i) => (
        <text
          key={i}
          x={xs[i]}
          y={H - 1}
          fontSize="9"
          fill="#5A574C"
          textAnchor="middle"
        >
          {b.from}
        </text>
      ))}
      {dot}
    </svg>
  );
}
