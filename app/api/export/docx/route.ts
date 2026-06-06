import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription } from "@/lib/api-auth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  HeightRule,
  VerticalAlign,
} from "docx";
import type { AppSchema, Step } from "app-renderer";
import { activePathOf, migrateSchema, tk2disp, unitOf, fmtU } from "app-renderer";

export const runtime = "nodejs";

// 한글 폰트 — 시스템에 흔히 설치된 산세리프 (Windows: 맑은 고딕, mac: Apple SD Gothic Neo)
const KFONT = { ascii: "Malgun Gothic", eastAsia: "맑은 고딕", hAnsi: "Malgun Gothic", cs: "Malgun Gothic" };

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
  blueLite: "EFF6FF",
  emerald: "059669",
  emeraldBg: "D1FAE5",
  rose: "DC2626",
  roseBg: "FEE2E2",
  amber: "78350F",
  amberBg: "FEF3C7",
  bg: "F9FAFB",
  line: "E5E7EB",
  slate: "475569",
  slateBg: "94A3B8",
  track: "F1F5F9",
};

const PALETTE = ["2563EB", "10B981", "F59E0B", "EF4444", "8B5CF6", "06B6D4", "EC4899", "84CC16"];

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

function tr(opts: {
  text?: string;
  size?: number;
  bold?: boolean;
  color?: string;
}): TextRun {
  return new TextRun({
    text: opts.text ?? "",
    size: opts.size ?? 20,
    bold: opts.bold,
    color: opts.color || COL.ink,
    font: KFONT,
  });
}

function lab(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        text: (text || "").toUpperCase(),
        color: COL.sub,
        size: 14,
        bold: true,
        characterSpacing: 12,
        font: KFONT,
      }),
    ],
    spacing: { after: 40 },
  });
}

function p(text: string, opts: { size?: number; bold?: boolean; color?: string; alignment?: any; shade?: string } = {}) {
  return new Paragraph({
    alignment: opts.alignment,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: "auto" } : undefined,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 20,
        bold: opts.bold,
        color: opts.color || COL.ink,
        font: KFONT,
      }),
    ],
  });
}

function emptyP() {
  return new Paragraph({ children: [new TextRun({ text: "", font: KFONT })] });
}

// ───── 차트 구성용: 색상 칸 (가로 막대) ─────
// 부모 셀 폭(DXA)에 정확히 맞춰 가로 비율 막대를 구성한다.
function ratioBar(segments: { pct: number; fill: string }[], totalDXA: number, height = 240): Table {
  const inner = Math.max(400, totalDXA - 80);
  const sum = segments.reduce((a, s) => a + Math.max(0, s.pct), 0);
  const segs = sum < 99.5 ? [...segments, { pct: 100 - sum, fill: COL.track }] : segments;
  const widths = segs.map((s) => Math.max(10, Math.floor((Math.max(0, s.pct) / 100) * inner)));
  const actual = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: actual, type: WidthType.DXA },
    columnWidths: widths,
    borders: noBorder as any,
    rows: [
      new TableRow({
        height: { value: height, rule: HeightRule.EXACT },
        children: segs.map(
          (s, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: s.fill, color: "auto" },
              borders: noBorder,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [emptyP()],
            })
        ),
      }),
    ],
  });
}

// 세로 막대 차트 — 부모 셀 폭(DXA) 내부에 맞춤
function verticalBars(bars: { pct: number; fill: string; label: string; value: string; valColor?: string }[], cellDXA: number, height = 1400): Table {
  const colDXA = Math.max(800, cellDXA - 80);
  const n = bars.length || 1;
  const barW = Math.floor(colDXA / n);
  const widths = bars.map(() => barW);
  // 한 행에서 각 셀이 막대 영역. 셀 내부에 빈 단락 + shading된 셀로는 부분 채우기가 어려우므로,
  // 내부에 1열짜리 nested 테이블을 두어 위쪽은 투명/아래쪽은 색.
  const actualW = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: actualW, type: WidthType.DXA },
    columnWidths: widths,
    borders: noBorder as any,
    rows: [
      // 값 라벨 행
      new TableRow({
        children: bars.map(
          (b, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              borders: noBorder,
              margins: { top: 0, bottom: 20, left: 0, right: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: b.value, size: 16, color: b.valColor || COL.ink, font: KFONT, bold: true })],
                }),
              ],
            })
        ),
      }),
      // 막대 행 — 각 셀 안에 nested table로 막대 그리기
      new TableRow({
        height: { value: height, rule: HeightRule.EXACT },
        children: bars.map((b, i) => {
          const fillH = Math.max(40, Math.floor((Math.max(0, Math.min(100, b.pct)) / 100) * height));
          const emptyH = Math.max(0, height - fillH);
          return new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            verticalAlign: VerticalAlign.BOTTOM,
            borders: noBorder,
            margins: { top: 0, bottom: 0, left: 60, right: 60 },
            children: [
              new Table({
                width: { size: widths[i] - 120, type: WidthType.DXA },
                columnWidths: [widths[i] - 120],
                borders: { ...noBorder, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } as any,
                rows: [
                  new TableRow({
                    height: { value: emptyH || 1, rule: HeightRule.EXACT },
                    children: [
                      new TableCell({
                        width: { size: widths[i] - 120, type: WidthType.DXA },
                        borders: noBorder,
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [emptyP()],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: fillH, rule: HeightRule.EXACT },
                    children: [
                      new TableCell({
                        width: { size: widths[i] - 120, type: WidthType.DXA },
                        shading: { type: ShadingType.CLEAR, fill: b.fill, color: "auto" },
                        borders: noBorder,
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [emptyP()],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          });
        }),
      }),
      // 라벨 행
      new TableRow({
        children: bars.map(
          (b, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              borders: noBorder,
              margins: { top: 40, bottom: 0, left: 0, right: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: b.label, size: 14, color: COL.sub, font: KFONT })],
                }),
              ],
            })
        ),
      }),
    ],
  });
}

// ───────────── element renderers ─────────────

function elField(el: any, disp: any): (Paragraph | Table)[] {
  return [
    lab(el.label),
    p(String(disp[el.bind] ?? "—"), { alignment: AlignmentType.CENTER, size: 22 }),
  ];
}

function elFields(el: any, disp: any): (Paragraph | Table)[] {
  const binds: string[] = el.binds || [];
  const text =
    binds.length === 0
      ? "—"
      : binds.map((n) => `${n}  ${disp[n] ?? "—"}`).join("    |    ");
  return [
    ...(el.label ? [lab(el.label)] : []),
    p(text, { alignment: AlignmentType.CENTER, size: 22 }),
  ];
}

function elPathLabel(el: any, pathLabel: string): (Paragraph | Table)[] {
  return [
    ...(el.label ? [lab(el.label)] : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: pathLabel || "—", size: 22, bold: true, color: COL.blue, font: KFONT })],
    }),
  ];
}

function elCard(el: any, disp: any): (Paragraph | Table)[] {
  return [
    lab(el.label),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: String(disp[el.bind] ?? "—"),
          size: 34,
          bold: true,
          color: COL.blue,
          font: KFONT,
        }),
      ],
    }),
  ];
}

function elCompare(el: any, schema: AppSchema, jres: any[]): (Paragraph | Table)[] {
  if (!jres || jres.length === 0) {
    return [lab(el.label), p("판정부 비교가 없습니다", { color: COL.sub, size: 18 })];
  }
  // 표로 구성: 기준 / 규정 측 / 관계 / 대상자 측 / 결과
  const headers = ["기준", "규정 측", "관계", "대상자 측", "결과"];
  const widthDXA = 8800;
  const cw = [Math.floor(widthDXA * 0.28), Math.floor(widthDXA * 0.2), Math.floor(widthDXA * 0.12), Math.floor(widthDXA * 0.2), Math.floor(widthDXA * 0.2)];
  const headRow = new TableRow({
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: { size: cw[i], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: COL.bg, color: "auto" },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: COL.line },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: h, size: 16, color: COL.sub, bold: true, font: KFONT })] })],
        })
    ),
  });
  const dataRows = jres.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: cw[0], type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COL.line }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: String(r.a), size: 18, font: KFONT })] })],
          }),
          new TableCell({
            width: { size: cw[1], type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COL.line }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: typeof r.av === "number" ? fmtU(r.av, unitOf(schema, r.a)) : String(r.av), size: 18, font: KFONT })] })],
          }),
          new TableCell({
            width: { size: cw[2], type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COL.line }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: r.op, size: 18, font: KFONT })] })],
          }),
          new TableCell({
            width: { size: cw[3], type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COL.line }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: typeof r.bv === "number" ? fmtU(r.bv, unitOf(schema, r.b)) : String(r.bv), size: 18, font: KFONT })] })],
          }),
          new TableCell({
            width: { size: cw[4], type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COL.line }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                shading: { type: ShadingType.CLEAR, fill: r.ok ? COL.emeraldBg : COL.roseBg, color: "auto" },
                children: [
                  new TextRun({
                    text: r.ok ? "충족" : "미충족",
                    size: 16,
                    bold: true,
                    color: r.ok ? COL.emerald : COL.rose,
                    font: KFONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  );
  return [
    lab(el.label),
    new Table({
      width: { size: widthDXA, type: WidthType.DXA },
      columnWidths: cw,
      rows: [headRow, ...dataRows],
    }),
  ];
}

function elCalc(el: any, schema: AppSchema, disp: any): (Paragraph | Table)[] {
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
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: expr + " = ", size: 20, color: COL.ink, font: KFONT }),
        new TextRun({ text: String(disp[el.bind] ?? "—"), size: 20, bold: true, color: COL.emerald, font: KFONT }),
      ],
    }),
  ];
}

function elIncExc(el: any, schema: AppSchema): (Paragraph | Table)[] {
  const st = allStepsOf(schema).find((s) => s.name === el.bind);
  if (!st || st.type !== "classify") {
    return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
  }
  const inc = st.items.filter((i) => i.inc).map((i) => i.ref);
  const ex = st.items.filter((i) => !i.inc).map((i) => i.ref);
  return [
    lab(el.label),
    new Paragraph({
      spacing: { before: 30, after: 30 },
      children: [
        new TextRun({ text: "포함  ", size: 16, color: COL.sub, font: KFONT }),
        ...(inc.length
          ? inc.flatMap((r, i) => [
              new TextRun({ text: `  ${r}  `, size: 16, color: COL.emerald, bold: true, font: KFONT }),
              ...(i < inc.length - 1 ? [new TextRun({ text: " · ", size: 14, color: COL.sub, font: KFONT })] : []),
            ])
          : [new TextRun({ text: "—", size: 16, font: KFONT })]),
      ],
    }),
    new Paragraph({
      spacing: { before: 30, after: 30 },
      children: [
        new TextRun({ text: "제외  ", size: 16, color: COL.sub, font: KFONT }),
        ...(ex.length
          ? ex.flatMap((r, i) => [
              new TextRun({ text: `  ${r}  `, size: 16, color: COL.rose, bold: true, font: KFONT }),
              ...(i < ex.length - 1 ? [new TextRun({ text: " · ", size: 14, color: COL.sub, font: KFONT })] : []),
            ])
          : [new TextRun({ text: "—", size: 16, font: KFONT })]),
      ],
    }),
  ];
}

function elNote(el: any, disp: any): (Paragraph | Table)[] {
  const text = (el.tpl || "").replace(/\{([^}]+)\}/g, (_: any, n: string) =>
    n in disp ? disp[n] : "{" + n + "}"
  );
  const lines = text.split("\n");
  return [
    lab(el.label),
    ...lines.map(
      (line: string) =>
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: COL.amberBg, color: "auto" },
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: line || " ", size: 20, color: COL.amber, font: KFONT })],
        })
    ),
  ];
}

// ───────────── chart renderers (시각) ─────────────

function elChart(el: any, schema: AppSchema, sc: any, cellDXA: number): (Paragraph | Table)[] {
  const ct = el.ctype || "bar";
  const st = allStepsOf(schema).find((s) => s.name === el.bind);

  // ── gauge / ratio (수평 진행 바로 표현) ──
  if (ct === "gauge" || ct === "ratio") {
    const val = Number(sc[el.bind] || 0);
    let min = 0,
      max = 100;
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
        spacing: { before: 40, after: 60 },
        children: [
          new TextRun({
            text: ct === "ratio" ? `${Math.round(pct * 100)}%` : fmtU(val, u),
            size: 32,
            bold: true,
            color: COL.blue,
            font: KFONT,
          }),
        ],
      }),
      ratioBar([{ pct: pct * 100, fill: COL.blue }], cellDXA, 280),
      new Paragraph({
        spacing: { before: 60 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text:
              ct === "ratio"
                ? `${fmtU(val, u)} / ${fmtU(max, uB)}`
                : `${fmtU(min, u)} ~ ${fmtU(max, u)}  (달성 ${Math.round(pct * 100)}%)`,
            size: 14,
            color: COL.sub,
            font: KFONT,
          }),
        ],
      }),
    ];
  }

  // ── bullet (실적/목표 진행 바) ──
  if (ct === "bullet") {
    const val = Number(sc[el.bind] || 0);
    const target = Number(sc[el.bind2 || ""] || 0);
    const maxBase = Math.max(val, target, 1) * 1.2;
    const valPct = Math.max(2, Math.min(100, (val / maxBase) * 100));
    const u = unitOf(schema, el.bind) || "";
    const ok = target > 0 && val >= target;
    return [
      lab(el.label),
      ratioBar([{ pct: valPct, fill: ok ? COL.emerald : COL.blue }], cellDXA, 280),
      new Paragraph({
        spacing: { before: 60 },
        children: [
          new TextRun({ text: "실적 ", size: 16, color: COL.sub, font: KFONT }),
          new TextRun({ text: fmtU(val, u), size: 22, bold: true, color: ok ? COL.emerald : COL.blue, font: KFONT }),
          ...(target > 0
            ? [
                new TextRun({ text: "    목표 ", size: 16, color: COL.sub, font: KFONT }),
                new TextRun({ text: fmtU(target, u), size: 22, bold: true, color: COL.rose, font: KFONT }),
                new TextRun({ text: `   (${Math.round((val / target) * 100)}%)`, size: 16, color: COL.sub, font: KFONT }),
              ]
            : []),
        ],
      }),
    ];
  }

  // ── stacked (가로 누적 막대) ──
  if (ct === "stacked") {
    if (!st || st.type !== "classify")
      return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
    const incItems = st.items.filter((i) => i.inc).map((i) => ({ ref: i.ref, v: Number(sc[i.ref] || 0) }));
    const total = incItems.reduce((a, x) => a + x.v, 0) || 1;
    const u = unitOf(schema, el.bind) || "";
    const segs = incItems.map((x, i) => ({ pct: (x.v / total) * 100, fill: PALETTE[i % PALETTE.length] }));
    return [
      lab(el.label),
      ratioBar(segs, cellDXA, 280),
      new Paragraph({
        spacing: { before: 80 },
        children: incItems.flatMap((x, i) => [
          new TextRun({ text: "■ ", size: 18, color: PALETTE[i % PALETTE.length], font: KFONT }),
          new TextRun({
            text: `${x.ref}  ${fmtU(x.v, u)} (${Math.round((x.v / total) * 100)}%)    `,
            size: 14,
            color: COL.sub,
            font: KFONT,
          }),
        ]),
      }),
    ];
  }

  // ── comparison (세로 막대 2개) ──
  if (ct === "comparison") {
    const aV = Number(sc[el.bind] || 0);
    const bV = Number(sc[el.bind2 || ""] || 0);
    const mx = Math.max(Math.abs(aV), Math.abs(bV), 0.0001);
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    return [
      lab(el.label),
      verticalBars(
        [
          {
            pct: (Math.abs(aV) / mx) * 100,
            fill: COL.blue,
            label: el.bind,
            value: fmtU(aV, u),
            valColor: COL.blue,
          },
          {
            pct: (Math.abs(bV) / mx) * 100,
            fill: COL.slateBg,
            label: el.bind2 || "—",
            value: fmtU(bV, uB),
            valColor: COL.slate,
          },
        ],
        cellDXA,
        1400
      ),
    ];
  }

  // ── delta (이전→현재) ──
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
      p(`이전 ${fmtU(prev, u)} → 현재`, { color: COL.sub, size: 14 }),
      new Paragraph({
        spacing: { before: 40 },
        children: [
          new TextRun({ text: fmtU(cur, u), size: 32, bold: true, font: KFONT }),
          new TextRun({
            text: `   ${arrow} ${fmtU(Math.abs(diff), u)}${prev !== 0 ? ` (${up ? "+" : flat ? "" : "-"}${Math.abs(Math.round(pct * 10) / 10)}%)` : ""}`,
            size: 20,
            bold: true,
            color,
            font: KFONT,
          }),
        ],
      }),
    ];
  }

  // ── donut (포함 비율 — 가로 진행 바로 표현 + 범례) ──
  if (ct === "donut") {
    if (!st || st.type !== "classify")
      return [lab(el.label), p("분류 단계 바인딩 필요", { color: COL.sub, size: 18 })];
    const incV = st.items.filter((i) => i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const exV = st.items.filter((i) => !i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const tot = incV + exV || 1;
    const pct = (incV / tot) * 100;
    const u = unitOf(schema, el.bind) || "원";
    return [
      lab(el.label),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 60 },
        children: [
          new TextRun({ text: `포함 비율  `, size: 16, color: COL.sub, font: KFONT }),
          new TextRun({ text: `${Math.round(pct)}%`, size: 28, bold: true, color: COL.blue, font: KFONT }),
        ],
      }),
      ratioBar(
        [
          { pct, fill: COL.blue },
          { pct: 100 - pct, fill: COL.blueLite },
        ],
        cellDXA,
        280
      ),
      new Paragraph({
        spacing: { before: 80 },
        children: [
          new TextRun({ text: "■ ", size: 18, color: COL.blue, font: KFONT }),
          new TextRun({ text: `포함  ${fmtU(incV, u)}    `, size: 14, color: COL.sub, font: KFONT }),
          new TextRun({ text: "■ ", size: 18, color: COL.blueLite, font: KFONT }),
          new TextRun({ text: `제외  ${fmtU(exV, u)}`, size: 14, color: COL.sub, font: KFONT }),
        ],
      }),
    ];
  }

  // ── bar / step (구간표 기반 세로 막대) ──
  if (!st || st.type !== "table")
    return [lab(el.label), p("구간표 단계 바인딩 필요", { color: COL.sub, size: 18 })];
  const cur = sc[st.ref];
  const u = st.unit || "";
  const mx = Math.max(...st.bands.map((b) => Math.abs(b.v)), 0.0001);
  const bars = st.bands.map((b) => {
    const on = cur >= b.from && cur <= b.to;
    return {
      pct: (Math.abs(b.v) / mx) * 100,
      fill: on ? COL.blue : COL.blueBg,
      label: `${b.from}~${b.to}`,
      value: fmtU(b.v, u),
      valColor: on ? COL.blue : COL.sub,
    };
  });
  return [
    lab(el.label + (ct === "step" ? " (계단선)" : " (막대)")),
    verticalBars(bars, cellDXA, 1400),
  ];
}

function renderEl(el: any, schema: AppSchema, result: any, cellDXA: number): (Paragraph | Table)[] {
  const { sc, disp, jres } = result;
  if (el.kind === "field") return elField(el, disp);
  if (el.kind === "fields") return elFields(el, disp);
  if (el.kind === "pathlabel") return elPathLabel(el, result.activePathLabel || "");
  if (el.kind === "card") return elCard(el, disp);
  if (el.kind === "compare") return elCompare(el, schema, jres);
  if (el.kind === "calc") return elCalc(el, schema, disp);
  if (el.kind === "incexc") return elIncExc(el, schema);
  if (el.kind === "note") return elNote(el, disp);
  if (el.kind === "chart") return elChart(el, schema, sc, cellDXA);
  return [lab(el.label), p(`[${el.kind}]`)];
}

// 그리드 행 분할 (PDF와 동일)
function groupRows(els: any[]): any[][] {
  const rows: any[][] = [];
  let cur: any[] = [];
  let curW = 0;
  const wt = (e: any) => (({ full: 6, half: 3, third: 2 } as any)[e.w || "full"] as number);
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
  const auth = await requireActiveSubscription();
  if ("error" in auth) return auth.error;
  try {
    const { schema, result } = await req.json();
    if (!schema || !result)
      return NextResponse.json({ error: "schema, result 필요" }, { status: 400 });

    const activePath = activePathOf(schema, result.activePathId);
    const reportEls = activePath?.report || schema.report || [];
    const today = new Date().toISOString().slice(0, 10);
    const title =
      (schema.meta?.appName || "분석 리포트").replace(/ ?앱$/, "") + " 안내서";

    const children: (Paragraph | Table)[] = [];

    // 헤더 바 — 파란 단색 배경 + 흰 글씨
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
                margins: { top: 200, bottom: 200, left: 240, right: 240 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: title, size: 28, bold: true, color: "FFFFFF", font: KFONT }),
                      new TextRun({ text: `   [${result.activePathLabel || "—"}]`, size: 18, color: "FFFFFF", font: KFONT }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `AUTO · ${today}`, size: 14, color: "E5E7EB", font: KFONT }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(emptyP());

    // 본문 — 행마다 표로 멀티컬럼
    const PAGE_W = 9072;
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
        const cellInnerDXA = Math.max(800, colWidths[i] - 400); // 셀 margins(200+200) 제외
        const inner = renderEl(el, schema, result, cellInnerDXA);
        return new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          borders: thinBorder,
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
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
      children.push(emptyP());
    }

    if (reportEls.length === 0) {
      children.push(p("리포트가 비어 있습니다.", { color: COL.sub, size: 20 }));
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: KFONT, size: 20 },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            },
          },
          children,
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(buffer as any, {
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
