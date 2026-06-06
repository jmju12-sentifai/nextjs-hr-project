import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription } from "@/lib/api-auth";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
  Svg,
  Path,
  Circle,
  Rect,
  Line,
  G,
  Text as SvgText,
} from "@react-pdf/renderer";
import React from "react";
import type { AppSchema, Disp, JudgeResult, Sc, Step } from "app-renderer";
import { activePathOf, migrateSchema, tk2disp, unitOf, fmtU } from "app-renderer";

export const runtime = "nodejs";

let fontRegistered = false;
function ensureKoreanFont() {
  if (fontRegistered) return;
  Font.register({
    family: "NotoKR",
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
        fontWeight: 400,
      },
    ],
  });
  fontRegistered = true;
}

function allStepsOf(schema: AppSchema): Step[] {
  const m = migrateSchema(schema);
  return [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as Step[]) || []),
  ];
}

const COL = {
  ink: "#111827",
  sub: "#6b7280",
  line: "#e5e7eb",
  bg: "#f9fafb",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  emerald: "#059669",
  emeraldBg: "#d1fae5",
  rose: "#dc2626",
  roseBg: "#fee2e2",
  amber: "#d97706",
  amberBg: "#fef3c7",
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "NotoKR",
    lineHeight: 1.45,
    color: COL.ink,
    backgroundColor: "#fff",
  },
  bar: {
    backgroundColor: COL.blue,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barTitle: { color: "#fff", fontSize: 14, fontWeight: 700 },
  barMeta: { color: "rgba(255,255,255,0.7)", fontSize: 8.5 },
  pathChip: {
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#fff",
    paddingHorizontal: 7,
    paddingVertical: 1,
    fontSize: 9,
    borderRadius: 8,
    marginLeft: 8,
  },
  body: {
    border: `1px solid ${COL.line}`,
    borderTop: 0,
    padding: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  card: {
    border: `1px solid ${COL.line}`,
    borderRadius: 3,
    padding: 9,
  },
  lab: {
    fontSize: 8,
    color: COL.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  val: { fontSize: 11 },
  bigVal: { fontSize: 17, fontWeight: 700, color: COL.blue },
  // table (compare)
  trH: { flexDirection: "row", backgroundColor: COL.bg, paddingVertical: 4 },
  tr: { flexDirection: "row", borderTop: `1px solid ${COL.line}`, paddingVertical: 4 },
  th: { fontSize: 8.5, color: COL.sub, fontWeight: 700, paddingHorizontal: 5 },
  td: { fontSize: 9.5, paddingHorizontal: 5 },
  pillOk: { backgroundColor: COL.emeraldBg, color: COL.emerald, fontSize: 8.5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2 },
  pillBad: { backgroundColor: COL.roseBg, color: COL.rose, fontSize: 8.5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2 },
  // calc
  calcBox: {
    backgroundColor: COL.bg,
    border: `1px solid ${COL.line}`,
    borderRadius: 2,
    padding: 7,
    fontSize: 10,
    fontFamily: "NotoKR",
  },
  calcResult: { color: COL.emerald, fontWeight: 700 },
  // tag
  tagInc: {
    backgroundColor: COL.emeraldBg,
    color: COL.emerald,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
    borderRadius: 2,
    marginRight: 4,
  },
  tagEx: {
    backgroundColor: COL.roseBg,
    color: COL.rose,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
    borderRadius: 2,
    marginRight: 4,
  },
  // note
  noteBox: {
    backgroundColor: COL.amberBg,
    border: `1px solid #fde68a`,
    borderRadius: 3,
    padding: 9,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#78350f",
  },
});

// 6 단위 폭 그리드를 row 로 묶기
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

function flex(el: any) {
  return (({ full: 6, half: 3, third: 2 } as any)[el.w || "full"] as number) / 6;
}
function height(el: any) {
  return Math.max(40, (el.h || 1) * 50);
}

// ───────────── element renderers ─────────────

function renderField(el: any, disp: Disp) {
  return React.createElement(View, { style: { ...styles.card, alignItems: "center" } }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(Text, { style: { ...styles.val, textAlign: "center" }, key: "v" }, String(disp[el.bind] ?? "—")),
  ]);
}

function renderFields(el: any, disp: Disp) {
  const binds: string[] = el.binds || [];
  const text = binds.length === 0
    ? "—"
    : binds.map((n) => `${n}  ${disp[n] ?? "—"}`).join("    |    ");
  return React.createElement(View, { style: { ...styles.card, alignItems: "center" } }, [
    el.label ? React.createElement(Text, { style: styles.lab, key: "l" }, el.label) : null,
    React.createElement(Text, { style: { ...styles.val, textAlign: "center" }, key: "v" }, text),
  ]);
}

function renderPathLabel(el: any, pathLabel: string) {
  return React.createElement(View, { style: { ...styles.card, alignItems: "center" } }, [
    el.label ? React.createElement(Text, { style: styles.lab, key: "l" }, el.label) : null,
    React.createElement(Text, {
      style: { fontSize: 11, fontWeight: 700, color: COL.blue, textAlign: "center" },
      key: "v",
    }, pathLabel || "—"),
  ]);
}

function renderCard(el: any, disp: Disp) {
  return React.createElement(View, { style: { ...styles.card, alignItems: "center" } }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(Text, { style: { ...styles.bigVal, textAlign: "center" }, key: "v" }, String(disp[el.bind] ?? "—")),
  ]);
}

function renderCompare(el: any, schema: AppSchema, jres: JudgeResult[]) {
  if (!jres || jres.length === 0) {
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "판정부 비교가 없습니다"),
    ]);
  }
  const widths = [1.5, 1, 0.8, 1, 0.8];
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(View, { style: styles.trH, key: "h" },
      ["기준", "규정 측", "관계", "대상자 측", "결과"].map((c, i) =>
        React.createElement(Text, { style: [styles.th, { flex: widths[i] }], key: i }, c)
      )
    ),
    ...jres.map((r, i) =>
      React.createElement(View, { style: styles.tr, key: i }, [
        React.createElement(Text, { style: [styles.td, { flex: widths[0] }], key: 0 }, String(r.a)),
        React.createElement(Text, { style: [styles.td, { flex: widths[1] }], key: 1 },
          typeof r.av === "number" ? fmtU(r.av, unitOf(schema, r.a)) : String(r.av)
        ),
        React.createElement(Text, { style: [styles.td, { flex: widths[2] }], key: 2 }, r.op),
        React.createElement(Text, { style: [styles.td, { flex: widths[3] }], key: 3 },
          typeof r.bv === "number" ? fmtU(r.bv, unitOf(schema, r.b)) : String(r.bv)
        ),
        React.createElement(View, { style: [styles.td, { flex: widths[4] }], key: 4 },
          React.createElement(Text, { style: r.ok ? styles.pillOk : styles.pillBad }, r.ok ? "충족" : "미충족")
        ),
      ])
    ),
  ]);
}

function renderCalc(el: any, schema: AppSchema, disp: Disp) {
  const st = allStepsOf(schema).find((s) => s.name === el.bind);
  const expr =
    st && st.type === "formula"
      ? tk2disp((st as any).tokens)
          .split(" ")
          .map((w) => (w in disp ? disp[w] : w))
          .join(" ")
      : "(계산식 단계 바인딩)";
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(View, { style: styles.calcBox, key: "c" }, [
      React.createElement(Text, { key: "e" }, expr + " = "),
      React.createElement(Text, { style: styles.calcResult, key: "r" }, String(disp[el.bind] ?? "—")),
    ]),
  ]);
}

function renderIncExc(el: any, schema: AppSchema) {
  const st = allStepsOf(schema).find((s) => s.name === el.bind);
  if (!st || st.type !== "classify") {
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "분류 단계 바인딩 필요"),
    ]);
  }
  const inc = st.items.filter((i) => i.inc);
  const ex = st.items.filter((i) => !i.inc);
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginBottom: 3 }, key: "i" }, [
      React.createElement(Text, { style: { fontSize: 8.5, color: COL.sub, marginRight: 4 }, key: "lab" }, "포함"),
      ...inc.map((it, i) => React.createElement(Text, { style: styles.tagInc, key: i }, it.ref)),
      inc.length === 0 ? React.createElement(Text, { key: "n", style: { fontSize: 9 } }, "—") : null,
    ].filter(Boolean)),
    React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" }, key: "e" }, [
      React.createElement(Text, { style: { fontSize: 8.5, color: COL.sub, marginRight: 4 }, key: "lab" }, "제외"),
      ...ex.map((it, i) => React.createElement(Text, { style: styles.tagEx, key: i }, it.ref)),
      ex.length === 0 ? React.createElement(Text, { key: "n", style: { fontSize: 9 } }, "—") : null,
    ].filter(Boolean)),
  ]);
}

function renderNote(el: any, disp: Disp) {
  const text = (el.tpl || "").replace(/\{([^}]+)\}/g, (_: any, n: string) =>
    n in disp ? disp[n] : "{" + n + "}"
  );
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(View, { style: styles.noteBox, key: "n" },
      React.createElement(Text, null, text)
    ),
  ]);
}

function renderChart(el: any, schema: AppSchema, sc: Sc) {
  const ct = el.ctype || "bar";
  const st = allStepsOf(schema).find((s) => s.name === el.bind);

  // ── gauge / ratio (반원 게이지) ──
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
    const r = 26;
    const cx = 50, cy = 36;
    const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    const arcLen = Math.PI * r;
    const u = unitOf(schema, el.bind) || "";
    const center = ct === "ratio" ? `${Math.round(pct * 100)}%` : fmtU(val, u);
    return React.createElement(View, { style: { ...styles.card, alignItems: "center" } }, [
      React.createElement(Text, { style: { ...styles.lab, textAlign: "center", alignSelf: "stretch" }, key: "l" }, el.label),
      React.createElement(View, { key: "wrap", style: { width: 130, height: 60, alignItems: "center", justifyContent: "center", position: "relative" } }, [
        React.createElement(Svg as any, { width: 130, height: 60, viewBox: "0 0 100 46", key: "s" }, [
          React.createElement(Path as any, {
            key: "bg", d: arcPath, fill: "none", stroke: "#e5e7eb", strokeWidth: "8",
          }),
          React.createElement(Path as any, {
            key: "fg", d: arcPath, fill: "none", stroke: COL.blue, strokeWidth: "8",
            strokeDasharray: String(arcLen), strokeDashoffset: String(arcLen * (1 - pct)),
          }),
        ]),
        // 중앙 값 — SVG 밖에서 Text 로 (한글 폰트 정상 적용)
        React.createElement(Text, {
          key: "c",
          style: { position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 11, fontWeight: 700, color: COL.blue },
        }, center),
      ]),
      React.createElement(Text, { style: { fontSize: 8, color: COL.sub, marginTop: 2, textAlign: "center", alignSelf: "stretch" }, key: "rng" },
        ct === "ratio"
          ? `${fmtU(val, u)} / ${fmtU(max, unitOf(schema, el.bind2 || "") || u)}`
          : `${fmtU(min, u)} ~ ${fmtU(max, u)}`),
    ]);
  }

  // ── bullet ──
  if (ct === "bullet") {
    const val = Number(sc[el.bind] || 0);
    const target = Number(sc[el.bind2 || ""] || 0);
    const maxBase = Math.max(val, target, 1) * 1.2;
    const valPct = Math.max(2, Math.min(100, (val / maxBase) * 100));
    const targetPct = Math.max(0, Math.min(100, (target / maxBase) * 100));
    const u = unitOf(schema, el.bind) || "";
    const ok = target > 0 && val >= target;
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      // 트랙
      React.createElement(View, {
        key: "track",
        style: {
          position: "relative",
          width: "100%",
          height: 14,
          backgroundColor: "#f1f5f9",
          borderRadius: 2,
          marginTop: 4,
          borderWidth: 0.5,
          borderColor: COL.line,
          overflow: "hidden",
        },
      }, [
        // 값 막대
        React.createElement(View, {
          key: "v",
          style: {
            position: "absolute",
            top: 0, bottom: 0, left: 0,
            width: `${valPct}%`,
            backgroundColor: ok ? COL.emerald : COL.blue,
          },
        }),
      ]),
      // 목표 마커 (트랙 밖에 absolute, 트랙 위에 표시)
      target > 0 ? React.createElement(View, {
        key: "tmark-wrap",
        style: { position: "relative", height: 0 },
      }, [
        React.createElement(View, {
          key: "tmark",
          style: {
            position: "absolute",
            top: -18,
            left: `${targetPct}%`,
            width: 1.5,
            height: 18,
            backgroundColor: COL.rose,
          },
        }),
      ]) : null,
      React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 }, key: "txt" }, [
        React.createElement(Text, { style: { fontSize: 8.5 }, key: "v" }, `실적 ${fmtU(val, u)}`),
        target > 0 ? React.createElement(Text, { style: { fontSize: 8.5, color: COL.rose }, key: "t" }, `목표 ${fmtU(target, u)}`) : null,
        React.createElement(Text, { style: { fontSize: 8.5, color: COL.sub }, key: "p" },
          target > 0 ? `${Math.round((val / target) * 100)}%` : "—"),
      ]),
    ]);
  }

  // ── stacked ──
  if (ct === "stacked") {
    if (!st || st.type !== "classify") {
      return React.createElement(View, { style: styles.card }, [
        React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
        React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "분류 단계 바인딩 필요"),
      ]);
    }
    const incItems = st.items.filter((i: any) => i.inc).map((i: any) => ({ ref: i.ref, v: Number(sc[i.ref] || 0) }));
    const total = incItems.reduce((a: number, x: any) => a + x.v, 0) || 1;
    const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
    const u = unitOf(schema, el.bind) || "";
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(View, {
        key: "track",
        style: {
          flexDirection: "row",
          width: "100%",
          height: 14,
          marginTop: 4,
          borderRadius: 2,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: COL.line,
        },
      },
        incItems.map((x: any, i: number) =>
          React.createElement(View, {
            key: i,
            style: {
              width: `${(x.v / total) * 100}%`,
              backgroundColor: palette[i % palette.length],
            },
          })
        )
      ),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }, key: "lg" },
        incItems.map((x: any, i: number) =>
          React.createElement(Text, { key: i, style: { fontSize: 8, color: palette[i % palette.length] } },
            `■ ${x.ref}  ${fmtU(x.v, u)} (${Math.round((x.v / total) * 100)}%)`
          )
        )
      ),
    ]);
  }

  // ── comparison ──
  if (ct === "comparison") {
    const aV = Number(sc[el.bind] || 0);
    const bV = Number(sc[el.bind2 || ""] || 0);
    const mx = Math.max(Math.abs(aV), Math.abs(bV), 0.0001);
    const u = unitOf(schema, el.bind) || "";
    const uB = unitOf(schema, el.bind2 || "") || u;
    const H = 70;
    const aPct = (Math.abs(aV) / mx) * 100;
    const bPct = (Math.abs(bV) / mx) * 100;
    const bars = [
      { label: el.bind, v: aV, pct: aPct, color: COL.blue, unit: u, valColor: COL.blue },
      { label: el.bind2 || "—", v: bV, pct: bPct, color: "#94a3b8", unit: uB, valColor: "#475569" },
    ];
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      // 막대 영역
      React.createElement(View, {
        key: "bars",
        style: {
          flexDirection: "row",
          alignItems: "flex-end",
          height: H,
          gap: 12,
          marginTop: 4,
        },
      },
        bars.map((b, i) => React.createElement(View, {
          key: i,
          style: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: H },
        }, [
          React.createElement(Text, { key: "v", style: { fontSize: 8, color: b.valColor, marginBottom: 2 } }, fmtU(b.v, b.unit)),
          React.createElement(View, {
            key: "bar",
            style: {
              width: "100%",
              height: `${Math.max(6, b.pct)}%`,
              backgroundColor: b.color,
            },
          }),
        ]))
      ),
      // 라벨
      React.createElement(View, {
        key: "labels",
        style: { flexDirection: "row", gap: 12, marginTop: 4 },
      },
        bars.map((b, i) => React.createElement(Text, {
          key: i,
          style: { flex: 1, fontSize: 8, color: COL.sub, textAlign: "center" },
        }, b.label))
      ),
    ]);
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
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Text, { style: { fontSize: 8, color: COL.sub }, key: "p" }, `이전 ${fmtU(prev, u)} → 현재`),
      React.createElement(View, { style: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }, key: "r" }, [
        React.createElement(Text, { style: { fontSize: 16, fontWeight: 700 }, key: "v" }, fmtU(cur, u)),
        React.createElement(Text, { style: { fontSize: 10, color, fontWeight: 700 }, key: "d" },
          `${arrow} ${fmtU(Math.abs(diff), u)}${prev !== 0 ? ` (${up ? "+" : flat ? "" : "-"}${Math.abs(Math.round(pct * 10) / 10)}%)` : ""}`),
      ]),
    ]);
  }

  if (ct === "donut") {
    if (!st || st.type !== "classify") {
      return React.createElement(View, { style: styles.card }, [
        React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
        React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "분류 단계 바인딩 필요"),
      ]);
    }
    const incV = st.items.filter((i) => i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const exV = st.items.filter((i) => !i.inc).reduce((a, i) => a + Number(sc[i.ref] || 0), 0);
    const tot = incV + exV || 1;
    const pct = Math.round((incV / tot) * 100);
    const r = 22;
    const C = 2 * Math.PI * r;
    const off = C * (1 - incV / tot);
    const u = unitOf(schema, el.bind) || "원";
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(View, { style: { flexDirection: "row", alignItems: "center", gap: 10 }, key: "c" }, [
        React.createElement(Svg as any, { width: 70, height: 70, viewBox: "0 0 72 72", key: "s" }, [
          React.createElement(Circle as any, {
            key: "bg", cx: "36", cy: "36", r: String(r), fill: "none", stroke: "#dbeafe", strokeWidth: 10
          }),
          React.createElement(Circle as any, {
            key: "fg", cx: "36", cy: "36", r: String(r), fill: "none",
            stroke: COL.blue, strokeWidth: 10,
            strokeDasharray: String(C),
            strokeDashoffset: String(off),
            transform: "rotate(-90 36 36)",
          }),
          React.createElement(SvgText as any, {
            key: "t", x: "36", y: "40", textAnchor: "middle",
            fontSize: "12", fontWeight: "700", fill: COL.blue,
          }, `${pct}%`),
        ]),
        React.createElement(View, { key: "leg", style: { fontSize: 9 } }, [
          React.createElement(Text, { key: "i", style: { marginBottom: 3 } }, `포함  ${fmtU(incV, u)}`),
          React.createElement(Text, { key: "e" }, `제외  ${fmtU(exV, u)}`),
        ]),
      ]),
    ]);
  }

  // bar | step
  if (!st || st.type !== "table") {
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "구간표 단계 바인딩 필요"),
    ]);
  }
  const cur = sc[st.ref];
  const mx = Math.max(...st.bands.map((b) => Math.abs(b.v)), 0.0001);
  const W = 260;
  const H = 70;

  if (ct === "bar") {
    const n = st.bands.length;
    const barW = (W - 16) / Math.max(n, 1) * 0.7;
    const gap = (W - 16) / Math.max(n, 1) * 0.3;
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Svg as any, { width: W, height: H + 12, viewBox: `0 0 ${W} ${H + 12}`, key: "s" }, [
        ...st.bands.map((b, i) => {
          const h = Math.max(4, (Math.abs(b.v) / mx) * H);
          const x = 8 + i * (barW + gap);
          const y = H - h;
          const on = cur >= b.from && cur <= b.to;
          return React.createElement(G as any, { key: i }, [
            React.createElement(Rect as any, {
              key: "r", x: String(x), y: String(y),
              width: String(barW), height: String(h),
              fill: on ? COL.blue : COL.blueBg,
              stroke: COL.blue, strokeWidth: "0.5",
            }),
            React.createElement(SvgText as any, {
              key: "t", x: String(x + barW / 2), y: String(H + 9),
              textAnchor: "middle", fontSize: "7", fill: COL.sub,
            }, `${b.from}~${b.to}`),
          ]);
        }),
      ]),
    ]);
  }

  // step-line
  const n = st.bands.length;
  if (!n) {
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
      React.createElement(Text, { style: { fontSize: 9, color: COL.sub }, key: "n" }, "구간 없음"),
    ]);
  }
  const xs = st.bands.map((_, i) => 10 + (i / Math.max(n - 1, 1)) * (W - 20));
  const ys = st.bands.map((b) => H - 6 - (Math.abs(b.v) / mx) * (H - 16));
  let pathD = "";
  st.bands.forEach((_, i) => {
    if (i === 0) pathD += `M ${xs[i]} ${ys[i]} `;
    else pathD += `L ${xs[i]} ${ys[i - 1]} L ${xs[i]} ${ys[i]} `;
  });
  const ci = st.bands.findIndex((b) => cur >= b.from && cur <= b.to);
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(Svg as any, { width: W, height: H + 10, viewBox: `0 0 ${W} ${H + 10}`, key: "s" }, [
      React.createElement(Path as any, {
        key: "p", d: pathD, stroke: COL.blue, strokeWidth: "1.6", fill: "none",
      }),
      ...st.bands.map((b, i) =>
        React.createElement(SvgText as any, {
          key: "x" + i, x: String(xs[i]), y: String(H + 7),
          fontSize: "7", textAnchor: "middle", fill: COL.sub,
        }, String(b.from))
      ),
      ci >= 0
        ? React.createElement(Circle as any, {
            key: "dot", cx: String(xs[ci]), cy: String(ys[ci]),
            r: "3", fill: COL.blue,
          })
        : null,
    ]),
  ]);
}

function renderEl(schema: AppSchema, el: any, sc: Sc, disp: Disp, jres: JudgeResult[], pathLabel: string) {
  if (el.kind === "field") return renderField(el, disp);
  if (el.kind === "fields") return renderFields(el, disp);
  if (el.kind === "pathlabel") return renderPathLabel(el, pathLabel);
  if (el.kind === "card") return renderCard(el, disp);
  if (el.kind === "compare") return renderCompare(el, schema, jres);
  if (el.kind === "calc") return renderCalc(el, schema, disp);
  if (el.kind === "incexc") return renderIncExc(el, schema);
  if (el.kind === "note") return renderNote(el, disp);
  if (el.kind === "chart") return renderChart(el, schema, sc);
  return React.createElement(View, { style: styles.card }, [
    React.createElement(Text, { style: styles.lab, key: "l" }, el.label),
    React.createElement(Text, { key: "v" }, `[${el.kind}]`),
  ]);
}

// ───────────── main ─────────────

export async function POST(req: NextRequest) {
  const auth = await requireActiveSubscription();
  if ("error" in auth) return auth.error;
  try {
    ensureKoreanFont();
    const { schema, result } = await req.json();
    if (!schema || !result)
      return NextResponse.json({ error: "schema, result 필요" }, { status: 400 });

    const activePath = activePathOf(schema, result.activePathId);
    const reportEls = activePath?.report || schema.report || [];
    const rows = groupRows(reportEls);
    const today = new Date()
      .toISOString()
      .slice(0, 10);
    const title =
      (schema.meta?.appName || "분석 리포트").replace(/ ?앱$/, "") + " 안내서";

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: styles.page },

        // 상단 컬러 헤더 바
        React.createElement(View, { style: styles.bar }, [
          React.createElement(View, { key: "l", style: { flexDirection: "row", alignItems: "center" } }, [
            React.createElement(Text, { style: styles.barTitle, key: "t" }, title),
            React.createElement(
              Text,
              { style: styles.pathChip, key: "p" },
              result.activePathLabel || "—"
            ),
          ]),
          React.createElement(Text, { style: styles.barMeta, key: "m" }, `AUTO · ${today}`),
        ]),

        // 본문 — 그리드 행
        React.createElement(
          View,
          { style: styles.body },
          rows.length === 0
            ? [React.createElement(Text, { key: "e", style: { color: COL.sub, fontSize: 10, textAlign: "center", padding: 20 } }, "리포트가 비어 있습니다.")]
            : rows.map((rowEls, ri) =>
                React.createElement(
                  View,
                  { style: styles.row, key: ri },
                  rowEls.map((el, ei) =>
                    React.createElement(
                      View,
                      { style: { flex: flex(el) * 6, minHeight: height(el) }, key: ei },
                      renderEl(schema, el, result.sc, result.disp, result.jres, result.activePathLabel)
                    )
                  )
                )
              )
        )
      )
    );

    const buffer = await renderToBuffer(doc as any);
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "pdf error" }, { status: 500 });
  }
}
