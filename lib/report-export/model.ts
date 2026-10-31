import {
  activePathOf,
  bandNum,
  docPages,
  fillTpl,
  findStep,
  fmtU,
  hasDoc,
  KOP,
  llmStepNames,
  migrateSchema,
  numOf,
  pdate,
  todayStr,
  unitOf,
  validateDoc,
} from "app-renderer";
import type { AppSchema, DocBlock, ReportIssuer } from "app-renderer";

export interface ExportRow {
  label: string;
  value: string;
  amount?: number;
  ratio?: number;
  note?: string;
  muted?: boolean;
  strong?: boolean;
  display?: string;
}
export interface ExportBlock {
  id: string;
  type: DocBlock["type"];
  title?: string;
  text?: string;
  secondary?: string;
  rows: ExportRow[];
  variant?: string;
  element?: any;
}
export interface ExportDocument {
  title: string;
  pathLabel: string;
  subjects: ExportRow[];
  issuer: ReportIssuer;
  issuedAt: string;
  accent: string;
  pages: ExportBlock[][];
}

/** 출력에도 계산 엔진이 만든 값과 확정 양식만 사용한다. AI 호출이나 숫자 재작성은 하지 않는다. */
export function reportExportModel(
  schema: AppSchema,
  result: any,
  options: { issuer?: ReportIssuer; issuedAt?: string; accent?: string } = {},
): ExportDocument {
  const m = migrateSchema(schema),
    path = activePathOf(m, result?.activePathId);
  if (
    !hasDoc(path) ||
    !result?.sc ||
    !result?.disp ||
    !Array.isArray(result.jres)
  )
    throw new Error("출력할 문서와 계산 결과를 확인해 주세요.");
  const validation = validateDoc(m, path.id, path.doc, { previous: path.doc });
  // 기존 확정 양식의 요소는 출력에서도 유지한다. 새 AI 양식 제한은 출력에 적용하지 않는다.
  const invalid = validation.errors.find(error => error.code !== "element");
  if (invalid) throw new Error(invalid.message);
  const units = path.doc.units || {},
    sc = result.sc,
    disp = { ...result.disp, 적용여부: result.activePathLabel || path.label };
  for (const [name, u] of Object.entries(units))
    if (typeof sc[name] === "number") disp[name] = fmtU(sc[name], u);
  const skip = llmStepNames(m),
    unit = (name: string) => units[name] ?? unitOf(m, name);
  const value = (name: string) =>
    skip.has(name) ? "—" : String(disp[name] ?? "—");
  const num = (name?: string) =>
    name && !skip.has(name) ? numOf(name, sc) : null;
  const ref = (r: any): ExportRow => ({
    label: r.label?.trim() || r.bind,
    value: value(r.bind),
    amount: num(r.bind) ?? undefined,
    display: r.display,
    ...(unit(r.bind) === "%" && num(r.bind) !== null
      ? { ratio: num(r.bind)! }
      : {}),
  });
  const operators: Record<string, string> = {
    "*": "×",
    "/": "÷",
    "-": "−",
    "//": "몫",
    "%": "나머지",
  };
  const blocks = (b: DocBlock): ExportBlock => {
    const out: ExportBlock = {
      id: b.id,
      type: b.type,
      title: b.title,
      rows: [],
    };
    switch (b.type) {
      case "headline":
      case "text":
        out.text = fillTpl(b.tpl, disp, skip);
        break;
      case "facts":
      case "kpis":
      case "compare":
        out.rows = b.items.map(ref);
        break;
      case "gauge":
        out.rows = b.items.map((it) => {
          const r = ref(it),
            v = num(it.bind),
            d = it.of ? num(it.of) : 1;
          const ratio = v !== null && d ? v / d : null;
          return {
            ...r,
            value: ratio === null ? "—" : fmtU(ratio, "%"),
            ratio: ratio ?? undefined,
            note: it.of ? `${value(it.of)} 중 ${value(it.bind)}` : undefined,
          };
        });
        break;
      case "formula": {
        const s = findStep(m, b.bind, path.id);
        if (!s || s.type !== "formula")
          throw new Error("산식 정보를 찾을 수 없습니다.");
        const label = (n: string) => b.labels?.[n] || n;
        const expression = (names: boolean) =>
          s.tokens
            .map((t) =>
              t.t === "var"
                ? names
                  ? label(t.name)
                  : value(t.name)
                : t.t === "num"
                  ? fmtU(t.v, "")
                  : t.t === "op"
                    ? operators[t.op] || t.op
                    : t.t === "fn"
                      ? { floor: "내림", ceil: "올림", round: "반올림" }[
                          t.fn
                        ] || t.fn
                      : t.t === "lp"
                        ? "("
                        : ")",
            )
            .join(" ");
        out.text = `${label(b.bind)} = ${expression(true)}`;
        out.secondary = `${value(b.bind)} = ${expression(false)}`;
        out.rows = [
          ...new Set(s.tokens.flatMap((t) => (t.t === "var" ? [t.name] : []))),
        ].map((n) => ({
          label: label(n),
          value: value(n),
          note: b.notes?.[n] || m.vars.find((v) => v.name === n)?.desc,
        }));
        break;
      }
      case "itemized": {
        const s = findStep(m, b.bind, path.id);
        if (!s || s.type !== "classify")
          throw new Error("산정 항목을 찾을 수 없습니다.");
        const total = s.items
          .filter((it) => it.inc)
          .reduce((a, it) => a + Math.max(0, num(it.ref) || 0), 0);
        out.variant = b.variant || "bar";
        out.rows = s.items
          .filter((it) => it.inc || !b.hideExcluded)
          .map((it) => ({
            label: it.ref,
            value: value(it.ref),
            amount: Math.max(0, num(it.ref) || 0),
            ratio:
              it.inc && total
                ? Math.max(0, num(it.ref) || 0) / total
                : undefined,
            muted: !it.inc,
            note: it.inc ? undefined : "제외",
          }));
        out.rows.push({
          label: b.totalLabel || b.bind,
          value: value(b.bind),
          strong: true,
        });
        out.rows.push(
          ...(b.after || []).map((it) => ({
            ...ref(it),
            value: `${it.sign === "-" ? "− " : ""}${value(it.bind)}`,
            strong: true,
          })),
        );
        out.secondary = b.note;
        break;
      }
      case "bandtable": {
        const sources = b.allPaths
          ? (m.paths || []).flatMap((p) =>
              p.steps
                .filter((s) => s.type === "table" && s.name === b.bind)
                .map((s) => ({ p, s })),
            )
          : [];
        if (!sources.length) {
          const s = findStep(m, b.bind, path.id);
          if (s?.type === "table") sources.push({ p: path, s });
        }
        out.variant = b.variant || "chart";
        out.rows = sources.flatMap(({ p, s }: any) =>
          s.bands.map((band: any) => {
            const lo = bandNum(band.from, sc),
              hi = bandNum(band.to, sc),
              v = bandNum(band.v, sc),
              current = num(s.ref);
            return {
              label: `${b.allPaths ? (b.pathLabels?.[p.id] || p.label) + " · " : ""}${lo === hi ? lo : `${lo}–${hi}`}${unit(s.ref)}`,
              value: fmtU(v, unit(b.bind)),
              amount: v,
              strong:
                p.id === path.id &&
                current !== null &&
                current >= lo &&
                current <= hi,
            };
          }),
        );
        out.secondary = b.note;
        break;
      }
      case "flow":
        out.variant = b.variant || "steps";
        out.rows = b.steps.map(ref);
        if (b.endLabel && out.rows.length)
          out.rows[out.rows.length - 1].label = b.endLabel;
        break;
      case "range":
        out.rows = [
          { label: b.bind, value: value(b.bind), strong: true },
          ...[
            { label: "최소", bind: b.min },
            ...(b.mid ? [{ label: "중간", bind: b.mid }] : []),
            { label: "최대", bind: b.max },
          ].map((r) => ({
            label: r.label,
            value:
              num(r.bind) === null ? "—" : fmtU(num(r.bind)!, unit(b.bind)),
            amount: num(r.bind) ?? undefined,
          })),
        ];
        break;
      case "bar":
        out.rows = [
          { ...ref({ bind: b.bind }), strong: true },
          ...b.marks.map(ref),
        ];
        break;
      case "timeline": {
        const points = [...b.points];
        if (points.every((p) => pdate(sc[p.bind])))
          points.sort(
            (a, b) =>
              pdate(sc[a.bind])!.getTime() - pdate(sc[b.bind])!.getTime(),
          );
        out.rows = points.map(ref);
        break;
      }
      case "counts":
        out.rows = b.items.map(ref);
        if (b.total && b.used && num(b.total)! > 0 && num(b.used)! >= 0) {
          out.rows.push({
            label: "남음",
            value: fmtU(
              Math.max(0, num(b.total)! - num(b.used)!),
              unit(b.total),
            ),
            strong: true,
          });
          out.secondary = `사용 비율 ${fmtU(num(b.used)! / num(b.total)!, "%")}`;
        }
        break;
      case "conditions":
        out.rows = result.jres
          .filter((r: any) => !r.ex)
          .map((r: any, i: number) => ({
            label:
              b.labels?.[path.conditions[i]?.id] ||
              `${r.a} ${KOP[r.op as keyof typeof KOP] || r.op} ${r.b}`,
            value: r.ok ? "해당" : "미해당",
            note: `기준 ${typeof r.bv === "number" ? fmtU(r.bv, unit(r.a)) : r.bv} · 본인 ${typeof r.av === "number" ? fmtU(r.av, unit(r.a)) : r.av}`,
            strong: r.ok,
          }));
        break;
      case "element":
        out.element = b.el;
        break;
    }
    return out;
  };
  const issuer = options.issuer || {};
  const clean = (s: unknown) =>
    typeof s === "string" ? s.trim().slice(0, 200) : "";
  return {
    title: path.doc.title?.trim() || `${m.meta.appName || "적용 결과"} 안내서`,
    pathLabel: result.activePathLabel || path.label,
    subjects: (path.doc.subjects || [])
      .filter((n) => disp[n] !== undefined && disp[n] !== "")
      .map((n) => ref({ bind: n })),
    issuer: {
      company: clean(issuer.company),
      dept: clean(issuer.dept),
      contact: clean(issuer.contact),
    },
    issuedAt: /^\d{4}-\d{2}-\d{2}$/.test(options.issuedAt || "")
      ? options.issuedAt!
      : todayStr(),
    accent: /^#[0-9a-f]{6}$/i.test(options.accent || "")
      ? options.accent!
      : "#1858f2",
    pages: docPages(path.doc).map((page) => page.map(blocks)),
  };
}
