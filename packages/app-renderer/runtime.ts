// v5 결정론 런타임 — eval 금지, 자체 토크나이저 + RPN
import type {
  AppSchema,
  CmpOp,
  Disp,
  Judge,
  JudgeResult,
  Path,
  PathMatch,
  RunResult,
  Sc,
  Step,
  StepRunResult,
  Token,
  Unit,
} from "./types";

// ----- token <-> string -----
const OPSYM: Record<string, string> = { "*": "×", "/": "÷", "+": "+", "-": "−" };

export function tk2str(tks: Token[] | undefined): string {
  if (!tks) return "";
  return tks
    .map((t) =>
      t.t === "var"
        ? t.name
        : t.t === "num"
        ? String(t.v)
        : t.t === "op"
        ? t.op
        : t.t === "lp"
        ? "("
        : ")"
    )
    .join(" ");
}

export function tk2disp(tks: Token[] | undefined): string {
  if (!tks) return "";
  return tks
    .map((t) =>
      t.t === "var"
        ? t.name
        : t.t === "num"
        ? String(t.v)
        : t.t === "op"
        ? OPSYM[t.op]
        : t.t === "lp"
        ? "("
        : ")"
    )
    .join(" ");
}

// ----- tokenizer -----
type Lex =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "+" | "-" | "*" | "/" | "(" | ")"; v?: undefined };

function tok(s: string): Lex[] {
  const t: Lex[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if ("+-*/()".includes(c)) {
      t.push({ k: c as any });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      t.push({ k: "num", v: +s.slice(i, j) });
      i = j;
      continue;
    }
    let j = i;
    while (j < s.length && !"+-*/() \t".includes(s[j])) j++;
    t.push({ k: "id", v: s.slice(i, j) });
    i = j;
  }
  return t;
}

// ----- RPN -----
type RpnTok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "u" }
  | { k: "+" | "-" | "*" | "/" | "(" };

function rpn(ts: Lex[]): RpnTok[] {
  const o: RpnTok[] = [];
  const op: RpnTok[] = [];
  const P: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, u: 3 };
  let pv: Lex | null = null;
  for (const x of ts) {
    if (x.k === "num" || x.k === "id") {
      o.push(x as any);
    } else if (x.k === "(") {
      op.push({ k: "(" });
    } else if (x.k === ")") {
      while (op.length && op[op.length - 1].k !== "(") o.push(op.pop()!);
      if (!op.length) throw new Error("괄호");
      op.pop();
    } else {
      let k = x.k as string;
      if (
        k === "-" &&
        (pv === null || pv.k === "(" || "+-*/".includes(pv.k as string))
      ) {
        k = "u";
      }
      while (op.length) {
        const t = op[op.length - 1];
        if (t.k === "(") break;
        if (k !== "u" && P[t.k] >= P[k]) o.push(op.pop()!);
        else if (k === "u" && P[t.k] > P["u"]) o.push(op.pop()!);
        else break;
      }
      op.push({ k: k as any });
    }
    pv = x;
  }
  while (op.length) {
    const z = op.pop()!;
    if (z.k === "(") throw new Error("괄호");
    o.push(z);
  }
  return o;
}

export function evstr(expr: string, sc: Sc): number {
  const r = rpn(tok(expr));
  const st: number[] = [];
  for (const x of r) {
    if (x.k === "num") st.push(x.v);
    else if (x.k === "id") {
      if (!(x.v in sc)) throw new Error("미정의: " + x.v);
      const v = sc[x.v];
      if (typeof v !== "number" || isNaN(v))
        throw new Error("숫자 아님: " + x.v);
      st.push(v);
    } else if (x.k === "u") st.push(-(st.pop() as number));
    else {
      const b = st.pop()!;
      const a = st.pop()!;
      st.push(
        x.k === "+" ? a + b : x.k === "-" ? a - b : x.k === "*" ? a * b : a / b
      );
    }
  }
  if (st.length !== 1) throw new Error("식 오류");
  return st[0];
}

export function evtok(tks: Token[] | undefined, sc: Sc): number {
  if (!tks || !tks.length) throw new Error("식 비어 있음");
  return evstr(tk2str(tks), sc);
}

// ----- 단위 포맷 -----
const num0 = (n: number) => Math.round(n).toLocaleString("ko-KR");

export function fmtU(n: any, unit: Unit | string | undefined): string {
  if (typeof n !== "number" || isNaN(n)) return "—";
  if (unit === "%")
    return (Math.round(n * 1000) / 10)
      .toString()
      .replace(/\.0$/, "") + "%";
  return num0(n) + (unit || "");
}

export const fmt = (n: any) => fmtU(n, "");

export function cmp(a: any, o: CmpOp, b: any): boolean {
  switch (o) {
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case "<":
      return a < b;
    case "==":
      return a == b;
    case "!=":
      return a != b;
  }
}

export const KOP: Record<CmpOp, string> = {
  ">=": "이상",
  "<=": "이하",
  ">": "초과",
  "<": "미만",
  "==": "같음",
  "!=": "다름",
};

export const AGG: Record<string, string> = {
  sum: "합계",
  count: "개수",
  avg: "평균",
  max: "최댓값",
  min: "최솟값",
};

// ----- 날짜 -----
export function pdate(s: any): Date | null {
  if (s == null) return null;
  const m = String(s)
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

export function ageY(a: Date, b: Date): number {
  let y = b.getFullYear() - a.getFullYear();
  const md = b.getMonth() - a.getMonth();
  if (md < 0 || (md === 0 && b.getDate() < a.getDate())) y--;
  return y;
}

export function monthsDiff(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth()) -
    (b.getDate() < a.getDate() ? 1 : 0)
  );
}

export function todayStr(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// ----- 변수 풀 / 이름 조회 -----
export function unitOf(schema: AppSchema, name: string): Unit | "" {
  const v = schema.vars.find((x) => x.name === name);
  if (v) return (v.unit as Unit) || "";
  const m = migrateSchema(schema);
  const all: Step[] = [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as Step[]) || []),
  ];
  const st = all.find((s) => s.name === name);
  return ((st && st.unit) || "") as Unit;
}

// ----- 레거시 단일 판정 → 다중 경로로 마이그레이션 -----
export function migrateSchema(schema: AppSchema): AppSchema {
  if (schema.paths) return schema;
  // 레거시: judge/steps/report 가 있으면 경로 1개로 감싼다
  const legacyHasContent =
    (schema.judge && schema.judge.length > 0) ||
    (schema.steps && schema.steps.length > 0) ||
    (schema.report && schema.report.length > 0);
  return {
    ...schema,
    shared: schema.shared || { steps: [] },
    paths: legacyHasContent
      ? [
          {
            id: "main",
            label: "적용 대상",
            conditions: schema.judge || [],
            steps: schema.steps || [],
            report: schema.report || [],
          },
        ]
      : [],
    fallback: schema.fallback || {
      id: "fallback",
      label: "미적용 (기본)",
      conditions: [],
      steps: [],
      report: [],
    },
  };
}

// ----- run -----
export function run(
  rawSchema: AppSchema,
  extraVars: { name: string; type: string; unit?: Unit; val?: string }[] = [],
  extraJudge: { a: string; op: CmpOp; b: string }[] = []
): RunResult {
  const schema = migrateSchema(rawSchema);
  const sc: Sc = {};
  const disp: Disp = {};

  const allVarList = [
    ...schema.vars,
    ...extraVars.map((v) => ({
      id: "rt-" + v.name,
      grp: "조정" as any,
      name: v.name,
      type: v.type as any,
      unit: v.unit,
      test: v.val,
    })),
  ];

  for (const v of allVarList) {
    if (v.type === "number") {
      sc[v.name] = Number(v.test || 0);
      disp[v.name] = fmtU(sc[v.name], v.unit);
    } else {
      sc[v.name] = v.test || "";
      disp[v.name] = v.test || "—";
    }
  }

  const rv = (x: any) => {
    if (typeof x !== "string") return x;
    if (x in sc) return sc[x];
    const n = parseFloat(x);
    return isNaN(n) ? x : n;
  };

  const res: Record<string, StepRunResult> = {};

  // 단일 step 실행 헬퍼
  const execStep = (s: Step) => {
    let r: any;
    let d: string;
    try {
      if (s.type === "branch") {
        const cond = cmp(rv(s.ref), s.op, rv(s.rhs));
        const side = (txt: string, tks: Token[] | undefined, t: string | undefined) => {
          if (t === "calc") return evtok(tks, sc);
          return txt;
        };
        r = cond
          ? side(s.then, s.thenTok, s.thenT || "text")
          : side(s.els, s.elsTok, s.elsT || "text");
        d = typeof r === "number" ? fmtU(r, s.unit) : r;
      } else if (s.type === "classify") {
        const vals = s.items.filter((it) => it.inc).map((it) => Number(sc[it.ref] || 0));
        const a = s.agg || "sum";
        r =
          a === "sum"
            ? vals.reduce((x, y) => x + y, 0)
            : a === "count"
            ? vals.length
            : a === "avg"
            ? vals.length
              ? vals.reduce((x, y) => x + y, 0) / vals.length
              : 0
            : a === "max"
            ? vals.length
              ? Math.max(...vals)
              : 0
            : vals.length
            ? Math.min(...vals)
            : 0;
        d = fmtU(r, s.unit);
      } else if (s.type === "table") {
        const a = rv(s.ref);
        const bd = s.bands.find((b) => a >= b.from && a <= b.to);
        if (!bd) throw new Error("구간 없음: " + a);
        r = bd.v;
        d = fmtU(r, s.unit);
      } else if (s.type === "formula") {
        r = evtok(s.tokens, sc);
        d = fmtU(r, s.unit);
      } else if (s.type === "clamp") {
        let x = Number(rv(s.ref));
        if (s.min !== "") x = Math.max(x, Number(rv(s.min)));
        if (s.max !== "") x = Math.min(x, Number(rv(s.max)));
        r = x;
        d = fmtU(x, s.unit);
      } else if (s.type === "date") {
        const A = pdate(s.a === "오늘" ? todayStr() : sc[s.a]);
        if (!A) throw new Error("날짜 형식 오류: " + s.a);
        if (s.mode === "diff") {
          const B = pdate(s.b === "오늘" ? todayStr() : sc[s.b!]);
          if (!B) throw new Error("날짜 형식 오류: " + s.b);
          r =
            s.out === "year"
              ? ageY(A, B)
              : s.out === "month"
              ? monthsDiff(A, B)
              : Math.round((B.getTime() - A.getTime()) / 86400000);
        } else {
          r =
            s.out === "year"
              ? A.getFullYear()
              : s.out === "month"
              ? A.getMonth() + 1
              : A.getDate();
        }
        d = fmtU(r, s.unit);
      } else if (s.type === "llm") {
        r = s.lastResult || "";
        d = s.lastResult ? s.lastResult : "(분석 미실행)";
      } else {
        r = null;
        d = "—";
      }
      if (s.name) {
        sc[s.name] = r;
        disp[s.name] = d;
      }
      res[s.id] = { r, d, bad: false };
    } catch (e: any) {
      res[s.id] = { r: null, d: String(e?.message || e), bad: true };
      if (s.name) {
        sc[s.name] = NaN;
        disp[s.name] = "—";
      }
    }
  };

  // 1) 공통 산출 (shared.steps) 먼저
  for (const s of schema.shared?.steps || []) execStep(s);

  // 2) 경로 매칭 (first-match) — 모든 경로의 conditions 평가, ok=true 인 첫 경로 선택
  const paths: Path[] = schema.paths || [];
  const fallback: Path = schema.fallback || {
    id: "fallback",
    label: "미적용 (기본)",
    conditions: [],
    steps: [],
    report: [],
  };

  // 리터럴 해석: 숫자처럼 보이면 숫자, 아니면 문자열
  const lit = (s: string) => {
    const n = parseFloat(s);
    return !isNaN(n) && String(n) === String(s).trim() ? n : s;
  };
  const resolveOperand = (s: string, mode: "var" | "val" | undefined) => {
    if (mode === "val") return lit(s);
    return rv(s);
  };

  const evalConds = (conds: Judge[]) => {
    const results = conds.map((j) => {
      const a = resolveOperand(j.a, j.aMode);
      const b = resolveOperand(j.b, j.bMode);
      let ok = false;
      try {
        ok = cmp(a, j.op, b);
      } catch {
        ok = false;
      }
      return { a: j.a, op: j.op, b: j.b, av: a, bv: b, ok };
    });
    const ok = results.length ? results.every((r) => r.ok) : true;
    return { ok, results };
  };

  const pathMatches: PathMatch[] = paths.map((p) => {
    const { ok, results } = evalConds(p.conditions);
    return { id: p.id, label: p.label, ok, conditionResults: results };
  });

  const matchedPath = paths.find((p, i) => pathMatches[i].ok) || fallback;
  const isFallback = matchedPath === fallback;

  // 3) 매칭 경로의 steps 실행 + extraJudge 추가 평가 (RT 조정부 반영)
  for (const s of matchedPath.steps) execStep(s);

  // 4) 활성 경로 conditions 결과 (jres — 호환 형태)
  const activeConds: Judge[] = [...matchedPath.conditions, ...extraJudge];
  const jres: JudgeResult[] = activeConds.map((j) => {
    const a = resolveOperand(j.a, j.aMode);
    const b = resolveOperand(j.b, j.bMode);
    let ok = false;
    try {
      ok = cmp(a, j.op, b);
    } catch {
      ok = false;
    }
    const isExtra = !matchedPath.conditions.find(
      (sj) => sj.a === j.a && sj.op === j.op && sj.b === j.b
    );
    return { a: j.a, b: j.b, op: j.op, av: a, bv: b, ok, ex: isExtra };
  });

  sc["적용여부"] = matchedPath.label;
  disp["적용여부"] = matchedPath.label;

  return {
    sc,
    disp,
    res,
    jres,
    applied: !isFallback,
    activePathId: matchedPath.id,
    activePathLabel: matchedPath.label,
    pathMatches,
  };
}

// step 한 줄 설명 (Tab3 sayStep의 plain-text 버전)
export function describeStep(s: Step): string {
  const KOP: Record<string, string> = {
    ">=": "이상",
    "<=": "이하",
    ">": "초과",
    "<": "미만",
    "==": "같음",
    "!=": "다름",
  };
  if (s.type === "branch") {
    const side = (txt: string, tks: any, t: any) =>
      t === "calc" ? `계산식[${tk2disp(tks) || "…"}]` : `"${txt}"`;
    return `${s.ref || "?"} ${KOP[s.op] || s.op} ${s.rhs} → 참: ${side(
      s.then,
      s.thenTok,
      s.thenT
    )}, 거짓: ${side(s.els, s.elsTok, s.elsT)}`;
  }
  if (s.type === "classify") {
    const items = s.items.filter((x) => x.inc).map((x) => x.ref).join(", ") || "?";
    return `${AGG[s.agg || "sum"]}( ${items} )`;
  }
  if (s.type === "table") return `${s.ref || "?"} 가 속한 구간의 단계값`;
  if (s.type === "formula") return `계산식: ${tk2disp(s.tokens) || "(비어 있음)"}`;
  if (s.type === "clamp") {
    const parts: string[] = [];
    if (s.min) parts.push(`${s.min} 이상`);
    if (s.max) parts.push(`${s.max} 이하`);
    return `${s.ref || "?"} 를 ${parts.length ? parts.join(", ") + "로 보정" : "(범위 미설정)"}`;
  }
  if (s.type === "date") {
    const u = { year: "년", month: "월", day: "일" }[s.out];
    return s.mode === "diff"
      ? `${s.a || "?"} ↔ ${s.b || "?"} 차이(${u})`
      : `${s.a || "?"} 의 ${u === "년" ? "연도" : u} 추출`;
  }
  if (s.type === "llm") {
    const items = (s as any).items?.length ? (s as any).items.join(", ") : "(항목 없음)";
    return `LLM 3줄 분석 · 대상: ${items}`;
  }
  return "";
}

// 이름(변수 or step)에 대한 한 줄 설명
export function describeName(schema: AppSchema, name: string): string {
  if (!name) return "";
  const m = migrateSchema(schema);
  const allSteps: Step[] = [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as Step[]) || []),
  ];
  const st = allSteps.find((s) => s.name === name);
  if (st) return describeStep(st);
  const v = schema.vars.find((v) => v.name === name);
  if (v) {
    const unit = v.unit ? ` · ${v.unit}` : "";
    return `${v.grp} 변수 (${v.type}${unit})`;
  }
  if (name === "적용여부") return "매칭된 경로 라벨";
  return "";
}

// 활성 경로 가져오기 (UI 헬퍼)
export function activePathOf(schema: AppSchema, id: string): Path | undefined {
  const s = migrateSchema(schema);
  if (s.fallback && s.fallback.id === id) return s.fallback;
  return (s.paths || []).find((p) => p.id === id);
}
