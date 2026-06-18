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

// RPN 평가 — evstr / evtok 공용
function evalRpn(r: RpnTok[], sc: Sc): number {
  const st: number[] = [];
  for (const x of r) {
    if (x.k === "num") st.push(x.v);
    else if (x.k === "id") {
      if (!(x.v in sc)) throw new Error("미정의: " + x.v);
      const v = sc[x.v];
      // 숫자가 아니면 — 숫자로 변환 시도 (예: "100", "100.5" 같은 숫자 문자열 허용)
      // 그래도 숫자가 아니면 0 으로 취급 (에러 throw 안 함, 산식 결과만 0이 됨)
      if (typeof v === "number" && !isNaN(v)) {
        st.push(v);
      } else if (typeof v === "string") {
        const cleaned = v.replace(/,/g, "").trim();
        const n = Number(cleaned);
        st.push(isNaN(n) ? 0 : n);
      } else {
        st.push(0);
      }
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

export function evstr(expr: string, sc: Sc): number {
  return evalRpn(rpn(tok(expr)), sc);
}

// 토큰 → Lex 직접 변환 (문자열 왕복 없이).
// ⚠ tk2str+tok 왕복은 변수/step 이름의 내부 공백("통상임금기준액 산출")을 공백에서 잘라
//   "미정의" 에러를 냈다. 토큰은 이미 구조화돼 있으므로 직접 Lex 로 변환해 그 문제를 원천 차단.
function tokensToLex(tks: Token[]): Lex[] {
  const out: Lex[] = [];
  for (const t of tks) {
    if (t.t === "var") out.push({ k: "id", v: t.name });
    else if (t.t === "num") out.push({ k: "num", v: Number(t.v) });
    else if (t.t === "op") out.push({ k: t.op });
    else if (t.t === "lp") out.push({ k: "(" });
    else if (t.t === "rp") out.push({ k: ")" });
  }
  return out;
}

export function evtok(tks: Token[] | undefined, sc: Sc): number {
  if (!tks || !tks.length) throw new Error("식 비어 있음");
  return evalRpn(rpn(tokensToLex(tks)), sc);
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
  extraJudge: { a: string; op: CmpOp; b: string }[] = [],
  forceActivePathId?: string
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
    const raw = v.test;
    const isEmpty = raw == null || String(raw).trim() === "";
    if (v.type === "number") {
      // sc 는 계산용 — 빈 값이면 0 으로 (산식이 NaN 으로 깨지지 않게).
      // disp 는 표시용 — 입력 안 한 변수는 "—" 로 표시 (사용자가 "0" 을 명시한 경우와 구분).
      sc[v.name] = isEmpty ? 0 : Number(raw);
      disp[v.name] = isEmpty ? "—" : fmtU(sc[v.name], v.unit);
    } else {
      sc[v.name] = isEmpty ? "" : (raw as any);
      disp[v.name] = isEmpty ? "—" : (raw as any);
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
      } else if (s.type === "switch") {
        // N-way 분기 — ref 값이 cases 중 어느 match 와 일치하는지 찾아 해당 출력
        const refVal = rv(s.ref);
        const matched = (s.cases || []).find(
          (c) => String(c.match) === String(refVal)
        );
        // 단일 var 토큰이면 그 변수값 그대로 (숫자든 문자열든 OK).
        // 여러 토큰의 산식이면 기존 evtok 사용 (숫자 전용).
        const evalSide = (
          typ: string | undefined,
          tks: Token[] | undefined,
          txt: string | undefined
        ): any => {
          if (typ !== "calc") {
            // 텍스트 출력 — {변수명} 을 현재 값으로 치환 (변수 선택 + 직접입력 혼용 지원)
            return String(txt ?? "").replace(/\{([^}]+)\}/g, (_, n) => {
              const k = String(n).trim();
              if (!(k in sc)) return "{" + n + "}";
              const v = sc[k];
              return typeof v === "number" ? fmt(v) : String(v ?? "");
            });
          }
          if (!Array.isArray(tks) || tks.length === 0) return "";
          // 단일 변수 토큰이면 그 변수값을 그대로 반환 (텍스트 변수도 허용).
          // tokens 스키마 형태: { t: "var", name: "X" }
          if (tks.length === 1 && (tks[0] as any)?.t === "var") {
            const name = (tks[0] as any).name as string;
            return name in sc ? sc[name] : "";
          }
          // 그 외 — 숫자 산식 평가
          return evtok(tks, sc);
        };
        if (matched) {
          r = evalSide(matched.t, matched.tokens as any, matched.text);
        } else {
          r = evalSide(s.defaultT, s.defaultTokens as any, s.defaultText);
        }
        d = typeof r === "number" ? fmtU(r, s.unit) : String(r ?? "");
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

  // 빌더 라이브 검증용 — 특정 경로를 강제로 활성화시켜 시뮬레이션
  // (편집 중인 경로의 산식 검증이 'sc 미정의' 로 떨어지는 문제 방지)
  const forcedPath =
    forceActivePathId &&
    (paths.find((p) => p.id === forceActivePathId) ||
      (fallback.id === forceActivePathId ? fallback : null));
  const matchedPath =
    forcedPath || paths.find((p, i) => pathMatches[i].ok) || fallback;
  const isFallback = matchedPath === fallback;

  // 3) 매칭 경로의 steps 실행 + extraJudge 추가 평가 (RT 조정부 반영)
  for (const s of matchedPath.steps) execStep(s);

  // 4) 활성 경로 conditions 결과 (jres — 호환 형태)
  const activeConds: Judge[] = [
    ...matchedPath.conditions,
    ...extraJudge.map((j) => ({ ...j, id: "rt-" + j.a + j.op + j.b })),
  ];
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
// describeStep — sc(현재 변수 스코프) 가 있으면 현재 매칭되는 case 만 보여줌.
// sc 없으면 모든 case 를 보여줌 (디자인 시점 설명).
// 사용자(임직원) 친화 설명 생성.
// 빌더 용어(분기·계산식·tokens) 대신 일상어로 표현. 결과 화면에서 "왜 이 값인지" 짧게 안내.
export function describeStep(s: Step, sc?: Sc): string {
  if (s.type === "branch") {
    if (sc && s.ref) {
      const a = s.ref in sc ? sc[s.ref] : s.ref;
      const b = typeof s.rhs === "string" && s.rhs in sc ? sc[s.rhs] : s.rhs;
      const cond = cmp(a, s.op, b);
      return cond
        ? "조건에 해당하여 적용된 값입니다."
        : "조건에 해당하지 않아 다른 값이 적용되었습니다.";
    }
    return "조건에 따라 적용되는 값이 달라집니다.";
  }
  if (s.type === "switch") {
    if (sc && s.ref) {
      const refVal = String((s.ref in sc ? sc[s.ref] : "") ?? "");
      const matched = (s.cases || []).find((c) => String(c.match) === refVal);
      if (matched) {
        return `${s.ref} 가 "${matched.match}" 에 해당하여 적용된 값입니다.`;
      }
      return `${s.ref} 가 등록된 분류에 해당하지 않아 기본값이 적용되었습니다.`;
    }
    return `${s.ref || "분류"} 값에 따라 적용되는 값이 달라집니다.`;
  }
  if (s.type === "classify") {
    const items = s.items.filter((x) => x.inc).map((x) => x.ref);
    const aggLabel: Record<string, string> = {
      sum: "합산",
      count: "건수 집계",
      avg: "평균",
      max: "최대값",
      min: "최소값",
    };
    const verb = aggLabel[s.agg || "sum"] || "합산";
    if (items.length === 0) return `${verb} 한 결과입니다.`;
    if (items.length <= 3) return `${items.join(", ")} 항목을 ${verb}한 결과입니다.`;
    return `${items.slice(0, 2).join(", ")} 등 ${items.length}개 항목을 ${verb}한 결과입니다.`;
  }
  if (s.type === "table") {
    return `${s.ref || "기준값"} 이 속한 구간에 따라 회사 규정에서 적용된 값입니다.`;
  }
  if (s.type === "formula") {
    const vars = (s.tokens || [])
      .filter((t: any) => t.t === "var" && t.name)
      .map((t: any) => t.name as string);
    if (vars.length === 0) return "산식으로 계산된 값입니다.";
    if (vars.length === 1) return `${vars[0]} 을(를) 기반으로 계산된 값입니다.`;
    if (vars.length <= 3)
      return `${vars.join(", ")} 을(를) 조합해 계산된 값입니다.`;
    return `${vars.slice(0, 2).join(", ")} 등 여러 항목을 조합해 계산된 값입니다.`;
  }
  if (s.type === "clamp") {
    const parts: string[] = [];
    if (s.min) parts.push(`${s.min} 이상`);
    if (s.max) parts.push(`${s.max} 이하`);
    if (parts.length === 0) return `${s.ref || "값"} 그대로입니다.`;
    return `${s.ref || "값"} 을 ${parts.join(", ")} 범위로 조정한 값입니다.`;
  }
  if (s.type === "date") {
    const u = { year: "년", month: "월", day: "일" }[s.out];
    if (s.mode === "diff") {
      const isToday = s.b === "오늘";
      if (u === "년" && isToday) return `${s.a} 기준으로 산정된 만 나이입니다.`;
      if (isToday) return `${s.a} 부터 오늘까지의 경과 ${u}수입니다.`;
      return `${s.a} 부터 ${s.b} 까지의 ${u}수입니다.`;
    }
    return `${s.a} 의 ${u === "년" ? "연도" : u}을(를) 추출한 값입니다.`;
  }
  if (s.type === "llm") {
    return "위 산출 결과를 종합해 작성된 안내입니다.";
  }
  return "";
}

// 이름(변수 or step)에 대한 한 줄 설명. sc 가 있으면 활성 케이스만 표시.
export function describeName(schema: AppSchema, name: string, sc?: Sc): string {
  if (!name) return "";
  const m = migrateSchema(schema);
  const allSteps: Step[] = [
    ...(m.shared?.steps || []),
    ...((m.paths || []).flatMap((p) => p.steps) || []),
    ...((m.fallback?.steps as Step[]) || []),
  ];
  const st = allSteps.find((s) => s.name === name);
  if (st) return describeStep(st, sc);
  const v = schema.vars.find((v) => v.name === name);
  if (v) {
    // 사용자 친화 — "회사 규정 / 본인이 제공한" 형식
    const owner = v.grp === "규정" ? "회사 규정에 정해진" : "본인이 제공한";
    const subject =
      v.type === "date"
        ? "날짜"
        : v.type === "text"
        ? "정보"
        : v.unit === "원"
        ? "금액"
        : v.unit === "%" || v.unit === "배"
        ? "비율"
        : v.unit === "년" || v.unit === "월" || v.unit === "일" || v.unit === "시간"
        ? `기간(${v.unit})`
        : v.unit === "점" || v.unit === "건" || v.unit === "회" || v.unit === "개" || v.unit === "명"
        ? `수치(${v.unit})`
        : "값";
    return `${owner} ${subject}입니다.`;
  }
  if (name === "적용여부") return "본인 케이스가 적용된 경로명입니다.";
  return "";
}

// 활성 경로 가져오기 (UI 헬퍼)
export function activePathOf(schema: AppSchema, id: string): Path | undefined {
  const s = migrateSchema(schema);
  if (s.fallback && s.fallback.id === id) return s.fallback;
  return (s.paths || []).find((p) => p.id === id);
}
