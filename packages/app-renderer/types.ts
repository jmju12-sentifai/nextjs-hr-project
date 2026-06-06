// v5 스키마 — 단일 소스 오브 트루스
export type VarType = "number" | "text" | "date";
export type Unit =
  | ""
  | "원"
  | "일"
  | "명"
  | "%"
  | "배"
  | "점"
  | "개"
  | "년"
  | "월"
  | "시간"
  | "건"
  | "회";
export const UNITS: Unit[] = [
  "",
  "원",
  "일",
  "명",
  "%",
  "배",
  "점",
  "개",
  "년",
  "월",
  "시간",
  "건",
  "회",
];

export type Grp = "규정" | "개인";

export interface Variable {
  id: string;
  grp: Grp;
  name: string;
  type: VarType;
  unit?: Unit;
  req?: boolean;
  test?: string;
}

export type CmpOp = ">=" | "<=" | ">" | "<" | "==" | "!=";

export interface Judge {
  id: string;
  a: string; // var/step name 또는 리터럴 (aMode 가 'val' 이면 리터럴)
  op: CmpOp;
  b: string;
  aMode?: "var" | "val"; // 기본 var
  bMode?: "var" | "val"; // 기본 var
}

// 토큰 — 수식 빌더
export type Token =
  | { t: "var"; name: string }
  | { t: "num"; v: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

export type StepType =
  | "branch"
  | "classify"
  | "table"
  | "formula"
  | "clamp"
  | "date"
  | "llm";

interface StepBase {
  id: string;
  type: StepType;
  name: string;
  unit?: Unit;
}

export interface BranchStep extends StepBase {
  type: "branch";
  ref: string;
  op: CmpOp;
  rhs: number | string;
  then: string;
  thenT?: "text" | "calc";
  thenTok?: Token[];
  els: string;
  elsT?: "text" | "calc";
  elsTok?: Token[];
}

export interface ClassifyItem {
  ref: string;
  inc: boolean;
}
export interface ClassifyStep extends StepBase {
  type: "classify";
  agg: "sum" | "count" | "avg" | "max" | "min";
  items: ClassifyItem[];
}

export interface Band {
  from: number;
  to: number;
  v: number;
}
export interface TableStep extends StepBase {
  type: "table";
  ref: string;
  bands: Band[];
}

export interface FormulaStep extends StepBase {
  type: "formula";
  tokens: Token[];
}

export interface ClampStep extends StepBase {
  type: "clamp";
  ref: string;
  min: string;
  max: string;
}

export interface DateStep extends StepBase {
  type: "date";
  mode: "diff" | "part";
  a: string;
  b?: string;
  out: "year" | "month" | "day";
}

export interface LlmStep extends StepBase {
  type: "llm";
  items: string[]; // 분석에 포함할 변수/산출 이름
  prompt?: string; // 추가 지시문 (선택)
  lastResult?: string;
  lastAt?: string; // ISO 시각
}

export type Step =
  | BranchStep
  | ClassifyStep
  | TableStep
  | FormulaStep
  | ClampStep
  | DateStep
  | LlmStep;

// 리포트 요소
export type ElementKind =
  | "field"
  | "fields"
  | "pathlabel"
  | "card"
  | "compare"
  | "calc"
  | "incexc"
  | "chart"
  | "note";
export type ChartType =
  | "bar"
  | "step"
  | "donut"
  | "gauge"
  | "bullet"
  | "stacked"
  | "comparison"
  | "delta"
  | "ratio";
export type Width = "full" | "half" | "third";
export type Height = 1 | 2 | 3;

export interface ReportElement {
  id: string;
  kind: ElementKind;
  ctype?: ChartType;
  label: string;
  bind: string;
  bind2?: string; // 비교 대상 (bullet chart 의 목표값 등)
  binds?: string[]; // 다중 변수 (fields kind)
  w: Width;
  h: Height;
  wSpan?: number; // 1..6 — 자유 리사이즈 (있으면 w 보다 우선)
  hSpan?: number; // 1..6
  tpl?: string;
  showDesc?: boolean; // 변수 설명 표시 여부 (기본 true)
}

export interface Meta {
  appName: string;
  tagline: string;
  purpose: string;
  problem: string;
  users: string;
  security: string;
  effects: string[];
  features: string[];
  flow: string[]; // 4단계 처리 흐름 (1~4단계 간략 설명)
}

export interface Path {
  id: string;
  label: string;
  conditions: Judge[]; // 모두 충족 시 이 경로 (AND)
  steps: Step[];
  report: ReportElement[];
  note?: string;
}

export interface AppSchema {
  meta: Meta;
  vars: Variable[];
  shared?: { steps: Step[] }; // 공통 사전 계산
  paths?: Path[]; // 적용 가능한 경로 후보 (first-match)
  fallback?: Path; // 매칭 실패 시
  // ----- 레거시 (옛 단일 판정 스키마) — 자동 마이그레이션됨 -----
  judge?: Judge[];
  steps?: Step[];
  report?: ReportElement[];
}

export interface PathMatch {
  id: string;
  label: string;
  ok: boolean;
  conditionResults: { a: any; op: CmpOp; b: any; av: any; bv: any; ok: boolean }[];
}

export type Sc = Record<string, any>;
export type Disp = Record<string, string>;

export interface JudgeResult {
  a: string;
  b: string;
  op: CmpOp;
  av: any;
  bv: any;
  ok: boolean;
  ex: boolean;
}

export interface StepRunResult {
  r: any;
  d: string;
  bad?: boolean;
  skip?: boolean;
}

export interface RunResult {
  sc: Sc;
  disp: Disp;
  res: Record<string, StepRunResult>;
  jres: JudgeResult[]; // 활성 경로의 conditions 결과 (호환)
  applied: boolean; // 활성 경로가 fallback 이 아니면 true
  activePathId: string;
  activePathLabel: string;
  pathMatches: PathMatch[]; // 모든 경로의 매칭 결과 (trace)
}

export const EMPTY_SCHEMA: AppSchema = {
  meta: {
    appName: "",
    tagline: "",
    purpose: "",
    problem: "",
    users: "",
    security: "",
    effects: [],
    features: [],
    flow: ["", "", "", ""],
  },
  vars: [],
  shared: { steps: [] },
  paths: [],
  fallback: {
    id: "fallback",
    label: "미적용",
    conditions: [],
    steps: [],
    report: [],
  },
};
