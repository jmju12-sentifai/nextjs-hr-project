import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
} from "docx";
import type { AppSchema, Step } from "app-renderer";
import { activePathOf, migrateSchema, tk2disp, unitOf, fmtU } from "app-renderer";

export const runtime = "nodejs";

function allStepsOf(schema: AppSchema): Step[] {
  const m = migrateSchema(schema);
  return [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as Step[]) || []),
  ];
}

const COL = {
  ink: "111827",
  sub: "6B7280",
  blue: "2563EB",
  blueBg: "DBEAFE",
  emerald: "059669",
  emeraldBg: "D1FAE5",
  rose: "DC2626",
  roseBg: "FEE2E2",
  amber: "78350F",
  amberBg: "FEF3C7",
  bg: "F9FAFB",
  line: "E5E7EB",
};

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};
const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
  left: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
  right: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
};

function lab(text: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: text.toUpperCase(), color: COL.sub, size: 16, bold: true, characterSpacing: 24 }),
    ],
    spacing: { after: 60 },
  });
}

function p(text: string, opts: { size?: number; bold?: boolean; color?: string; alignment?: any } = {}) {
  return new Paragraph({
    alignment: opts.alignment,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 22,
        bold: opts.bold,
        color: opts.color || COL.ink,
      }),
    ],
  });
}

function cellCard(children: Paragraph[], opts: { width?: number; shade?: string; bordered?: boolean } = {}): TableCell {
  return new TableCell({
    children,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: "auto" } : undefined,
    borders: opts.bordered ? thinBorder : noBorder,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
  });
}

function elField(el: any, disp: any): Paragraph[] {
  return [lab(el.label), p(String(disp[el.bind] ?? "—"), { alignment: AlignmentType.CENTER })];
}

function elFields(el: any, disp: any): Paragraph[] {
  const binds: string[] = el.binds || [];
  const text = binds.length === 0
    ? "—"
    : binds.map((n) => `${n}  ${disp[n] ?? "—"}`).join("    |    ");
  return [
    ...(el.label ? [lab(el.label)] : []),
    p(text, { alignment: AlignmentType.CENTER }),
  ];
}

function elPathLabel(el: any, pathLabel: string): Paragraph[] {
  return [
    ...(el.label ? [lab(el.label)] : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: pathLabel || "—", size: 22, bold: true, color: COL.blue })],
    }),
  ];
}

function elCard(el: any, disp: any): Paragraph[] {
  return [
    lab(el.label),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: String(disp[el.bind] ?? "—"),
          size: 36,
          bold: true,
          color: COL.blue,
        }),
      ],
    }),
  ];
}

function elCompare(el: any, schema: AppSchema, jres: any[]): Paragraph[] {
  if (!jres || jres.length === 0) {
    return [lab(el.label), p("판정부 비교가 없습니다", { color: COL.sub, size: 18 })];
  }
  return [
    lab(el.label),
    ...jres.map((r) => {
      const av =
        typeof r.av === "number" ? fmtU(r.av, unitOf(schema, r.a)) : String(r.av);
      const bv =
        typeof r.bv === "number" ? fmtU(r.bv, unitOf(schema, r.b)) : String(r.bv);
      return new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text: `${r.a}: `, size: 18, color: COL.sub }),
          new TextRun({ text: `${av} ${r.op} ${bv}`, size: 18 }),
          new TextRun({ text: "   " }),
          new TextRun({
            text: r.ok ? "충족" : "미충족",
            size: 18,
            bold: true,
            color: r.ok ? COL.emerald : COL.rose,
          }),
        ],
      });
    }),
  ];
}

function elCalc(el: any, schema: AppSchema, disp: any): Paragraph[] {
  const st = allStepsOf(schema).find((s) => s.name === el.bind);
  const expr =
    st && st.type === "formula"
      ? tk2disp((st as any).tokens)
          .split(" ")
          .map((w) => (w in disp ? disp[w] : w))
          .join(" ")
      : "(계산식 단계 바인딩)";
  return [
    lab(el.label),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: COL.bg, color: "auto" },
      children: [
        new TextRun({ text: expr + " = ", size: 22, color: COL.ink }),
        new TextRun({ text: String(disp[el.bind] ?? "—"), size: 22, bold: true, color: COL.emerald }),
      ],
    }),
  ];
}

function elIncExc(el: any, schema: AppSchema): Paragraph[] {
  const st = allStepsOf(schema).find((s) => s.name === el.bind);
  if (!st || st.type !== "classify") {
    return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
  }
  const inc = st.items.filter((i) => i.inc).map((i) => i.ref);
  const ex = st.items.filter((i) => !i.inc).map((i) => i.ref);
  return [
    lab(el.label),
    new Paragraph({
      children: [
        new TextRun({ text: "포함  ", size: 18, color: COL.sub }),
        new TextRun({ text: inc.length ? inc.join(", ") : "—", size: 20, color: COL.emerald, bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "제외  ", size: 18, color: COL.sub }),
        new TextRun({ text: ex.length ? ex.join(", ") : "—", size: 20, color: COL.rose, bold: true }),
      ],
    }),
  ];
}

function elNote(el: any, disp: any): Paragraph[] {
  const text = (el.tpl || "").replace(/\{([^}]+)\}/g, (_: any, n: string) =>
    n in disp ? disp[n] : "{" + n + "}"
  );
  const lines = text.split("\n");
  return [
    lab(el.label),
    ...lines.map(
      (line) =>
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "FEF3C7", color: "auto" },
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: line || " ", size: 22, color: "7C2D12" })],
        })
    ),
  ];
}

function elChart(el: any, schema: AppSchema, sc: any): Paragraph[] {
  const ct = el.ctype || "bar";
  const st = allStepsOf(schema).find((s) => s.name === el.bind);

  // ── gauge / ratio ──
  if (ct === "gauge" || ct === "ratio") {
    const val = Number(sc[el.bind] || 0);
    let min = 0, max = 100;
    if (ct === "ratio") {
      max = Number(sc[el.bind2 || ""] || 0) || 1;
      min = 0;
    } else if (st && st.type === "clamp") {
      const tryNum = (s: any) => {
        if (s === "" || s == null) return null;
        const n = parseFloat(String(s));
        if (!isNaN(n) && String(n) === String(s).trim()) return n;
        const v = sc[String(s)];
        return typeof v === "number" ? v : null;
      };
      const mn = tryNum(st.min);
      const mx2 = tryNum(st.max);
      if (mn !== null) min = mn;
      if (mx2 !== null) max = mx2;
    } else if (st && st.type === "table" && st.bands.length) {
      min = Math.min(...st.bands.map((b: any) => b.from));
      max = Math.max(...st.bands.map((b: any) => b.to));
    } else if (ct === "gauge") {
      max = Math.max(100, val * 1.5 || 100);
    }
    const range = Math.max(max - min, 0.0001);
    const pct = Math.max(0, Math.min(1, (val - min) / range));
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    return [
      lab(el.label),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: ct === "ratio" ? `${Math.round(pct * 100)}%` : fmtU(val, u),
            size: 36, bold: true, color: COL.blue,
          }),
        ],
      }),
      p(
        ct === "ratio"
          ? `${fmtU(val, u)} / ${fmtU(max, uB)}`
          : `범위 ${fmtU(min, u)} ~ ${fmtU(max, u)}  (달성 ${Math.round(pct * 100)}%)`,
        { color: COL.sub, size: 18, alignment: AlignmentType.CENTER }
      ),
    ];
  }

  // ── bullet ──
  if (ct === "bullet") {
    const val = Number(sc[el.bind] || 0);
    const target = Number(sc[el.bind2 || ""] || 0);
    const u = unitOf(schema, el.bind) || "";
    const ok = target > 0 && val >= target;
    return [
      lab(el.label),
      new Paragraph({
        children: [
          new TextRun({ text: "실적 ", size: 18, color: COL.sub }),
          new TextRun({ text: fmtU(val, u), size: 26, bold: true, color: ok ? COL.emerald : COL.blue }),
          ...(target > 0
            ? [
                new TextRun({ text: "   목표 ", size: 18, color: COL.sub }),
                new TextRun({ text: fmtU(target, u), size: 26, bold: true, color: COL.rose }),
                new TextRun({
                  text: `   (${Math.round((val / target) * 100)}%)`,
                  size: 18, color: COL.sub,
                }),
              ]
            : []),
        ],
      }),
    ];
  }

  // ── stacked ──
  if (ct === "stacked") {
    if (!st || st.type !== "classify")
      return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
    const incItems = st.items.filter((i) => i.inc).map((i) => ({ ref: i.ref, v: Number(sc[i.ref] || 0) }));
    const total = incItems.reduce((a, x) => a + x.v, 0) || 1;
    const u = unitOf(schema, el.bind) || "";
    return [
      lab(el.label),
      ...incItems.map((x) =>
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: `${x.ref}  `, size: 20 }),
            new TextRun({
              text: `${fmtU(x.v, u)}`,
              size: 22, bold: true,
            }),
            new TextRun({
              text: `   (${Math.round((x.v / total) * 100)}%)`,
              size: 18, color: COL.sub,
            }),
          ],
        })
      ),
      p(`합계: ${fmtU(total, u)}`, { color: COL.sub, size: 18 }),
    ];
  }

  // ── comparison ──
  if (ct === "comparison") {
    const aV = Number(sc[el.bind] || 0);
    const bV = Number(sc[el.bind2 || ""] || 0);
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    return [
      lab(el.label),
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: el.bind + " ", size: 20, color: COL.sub }),
          new TextRun({ text: fmtU(aV, u), size: 26, bold: true, color: COL.blue }),
        ],
      }),
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: (el.bind2 || "—") + " ", size: 20, color: COL.sub }),
          new TextRun({ text: fmtU(bV, uB), size: 26, bold: true, color: "475569" }),
        ],
      }),
    ];
  }

  // ── delta ──
  if (ct === "delta") {
    const cur = Number(sc[el.bind] || 0);
    const prev = Number(sc[el.bind2 || ""] || 0);
    const diff = cur - prev;
    const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
    const u = unitOf(schema, el.bind) || "";
    const up = diff > 0;
    const flat = diff === 0;
    const color = flat ? COL.sub : up ? COL.emerald : COL.rose;
    const arrow = flat ? "—" : up ? "▲" : "▼";
    return [
      lab(el.label),
      p(`이전 ${fmtU(prev, u)} → 현재`, { color: COL.sub, size: 16 }),
      new Paragraph({
        children: [
          new TextRun({ text: fmtU(cur, u), size: 36, bold: true }),
          new TextRun({
            text: `   ${arrow} ${fmtU(Math.abs(diff), u)}${prev !== 0 ? ` (${up ? "+" : flat ? "" : "-"}${Math.abs(Math.round(pct * 10) / 10)}%)` : ""}`,
            size: 22, bold: true, color,
          }),
        ],
      }),
    ];
  }

  if (ct === "donut") {
    if (!st || st.type !== "classify")
      return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
    const incV = st.items.filter((i) => i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const exV = st.items.filter((i) => !i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const tot = incV + exV || 1;
    const pct = Math.round((incV / tot) * 100);
    const u = unitOf(schema, el.bind) || "원";
    return [
      lab(el.label + " (도넛)"),
      new Paragraph({
        children: [
          new TextRun({ text: `포함 비율  `, size: 18, color: COL.sub }),
          new TextRun({ text: `${pct}%`, size: 30, bold: true, color: COL.blue }),
        ],
      }),
      p(`포함  ${fmtU(incV, u)}`, { size: 18 }),
      p(`제외  ${fmtU(exV, u)}`, { size: 18 }),
    ];
  }
  // bar/step → 표
  if (!st || st.type !== "table")
    return [lab(el.label), p("구간표 단계 바인딩 필요", { color: COL.sub, size: 18 })];
  const cur = sc[st.ref];
  const u = st.unit || "";
  return [
    lab(el.label + (ct === "step" ? " (계단선)" : " (막대)")),
    ...st.bands.map((b) => {
      const on = cur >= b.from && cur <= b.to;
      return new Paragraph({
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text: `${b.from} ~ ${b.to}: `,
            size: 18,
            color: COL.sub,
          }),
          new TextRun({
            text: fmtU(b.v, u),
            size: 20,
            bold: on,
            color: on ? COL.blue : COL.ink,
          }),
          on
            ? new TextRun({
                text: "  ● 현재",
                size: 16,
                bold: true,
                color: COL.blue,
              })
            : new TextRun({ text: "" }),
        ],
      });
    }),
  ];
}

function renderEl(el: any, schema: AppSchema, result: any): (Paragraph | Table)[] {
  const { sc, disp, jres } = result;
  if (el.kind === "field") return elField(el, disp);
  if (el.kind === "fields") return elFields(el, disp);
  if (el.kind === "pathlabel") return elPathLabel(el, result.activePathLabel || "");
  if (el.kind === "card") return elCard(el, disp);
  if (el.kind === "compare") return elCompare(el, schema, jres);
  if (el.kind === "calc") return elCalc(el, schema, disp);
  if (el.kind === "incexc") return elIncExc(el, schema);
  if (el.kind === "note") return elNote(el, disp);
  if (el.kind === "chart") return elChart(el, schema, sc);
  return [lab(el.label), p(`[${el.kind}]`)];
}

// 그리드 행 분할 (PDF와 동일)
function groupRows(els: any[]): any[][] {
  const rows: any[][] = [];
  let cur: any[] = [];
  let curW = 0;
  const wt = (e: any) => ({ full: 6, half: 3, third: 2 }[e.w || "full"] as number);
  for (const el of els) {
    const w = wt(el);
    if (el.w === "full" || curW + w > 6) {
      if (cur.length) rows.push(cur);
      cur = [el];
      curW = w;
      if (el.w === "full") {
        rows.push(cur);
        cur = [];
        curW = 0;
      }
    } else {
      cur.push(el);
      curW += w;
    }
  }
  if (cur.length) rows.push(cur);
  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const { schema, result } = await req.json();
    if (!schema || !result)
      return NextResponse.json({ error: "schema, result 필요" }, { status: 400 });

    const activePath = activePathOf(schema, result.activePathId);
    const reportEls = activePath?.report || schema.report || [];
    const today = new Date().toISOString().slice(0, 10);
    const title =
      (schema.meta?.appName || "분석 리포트").replace(/ ?읍$/, "") + " 안내서";

    const children: (Paragraph | Table)[] = [];

    // 헤더 — 큰 박스 (Table 1행 1열로 컬러 헤더 구현)
    children.push(
      new Table({
        width: { size: 9072, type: WidthType.DXA },
        columnWidths: [9072],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 9072, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: COL.blue, color: "auto" },
                borders: noBorder,
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: title, size: 28, bold: true, color: "FFFFFF" }),
                      new TextRun({
                        text: `   [${result.activePathLabel || "—"}]`,
                        size: 18,
                        color: "FFFFFF",
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `AUTO · ${today}`,
                        size: 14,
                        color: "FFFFFF",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));

    // 본문 — 행마다 표로 멀티컬럼 (DXA 고정 폭으로 Word 호환성 보장)
    const PAGE_W = 9072; // A4 - 1" 좌우 여백 ≈ 9072 twips
    const rows = groupRows(reportEls);
    for (const row of rows) {
      const totalW = row.reduce(
        (a, e) => a + (({ full: 6, half: 3, third: 2 } as any)[e.w || "full"] as number),
        0
      );
      const colWidths = row.map((el) => {
        const slot = ({ full: 6, half: 3, third: 2 } as any)[el.w || "full"] as number;
        return Math.floor((slot / totalW) * PAGE_W);
      });
      const cells = row.map((el, i) => {
        const inner = renderEl(el, schema, result);
        return new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          borders: thinBorder,
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: inner as any,
        });
      });
      children.push(
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: [new TableRow({ children: cells })],
        })
      );
      children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
    }

    if (reportEls.length === 0) {
      children.push(p("리포트가 비어 있습니다.", { color: COL.sub, size: 20 }));
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="report.docx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "docx error" }, { status: 500 });
  }
}
