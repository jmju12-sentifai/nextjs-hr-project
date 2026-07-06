// v5 스키마 — 단일 소스 오브 트루스
// select: 정해진 옵션 중 하나만 값이 될 수 있는 선택형 변수 (내부 계산·비교는 text 와 동일하게 문자열)
// rows: 여러 건이 행으로 쌓이는 목록 변수 (경력내역·신청내역 등). 컬럼 구조(cols)를 선언하고
//       값은 행 객체 배열 — 건수 제한 없음. 계산은 rowcalc 블록이 담당.
export type VarType = "number" | "text" | "date" | "select" | "rows";

// rows 변수의 컬럼 정의
export interface RowCol {
  name: string; // 컬럼명 (행 산식·필터에서 이 이름으로 참조)
  type: "number" | "text" | "select";
  unit?: Unit;
  options?: string[]; // type="select" 전용
}
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
  // 계층 분류 — 같은 도메인 묶음(예: "경조사" > "결혼") 표시용. 선택적.
  group?: string;
  subGroup?: string;
  // type="select" 전용 — 허용값 목록. 파싱·수기 입력 모두 이 안에서만 값 결정.
  options?: string[];
  // type="rows" 전용 — 컬럼 구조. 값(test/입력)은 행 객체 배열의 JSON 문자열 또는 배열.
  cols?: RowCol[];
  // 변수 설명 — 사용자 입력 화면에서 도움말로 노출. 모든 타입 공통 (선택).
  desc?: string;
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
//   op: 사칙(+ - * /) + 나머지(%) + 몫(// = 내림나눗셈)
//   fn: 단항 함수 — floor(내림)·ceil(올림)·round(반올림). 항상 lp 가 뒤따른다: fn lp ... rp
export type FnName = "floor" | "ceil" | "round";
export type Token =
  | { t: "var"; name: string }
  | { t: "num"; v: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" | "%" | "//" }
  | { t: "fn"; fn: FnName }
  | { t: "lp" }
  | { t: "rp" };

export type StepType =
  | "branch"
  | "switch"
  | "classify"
  | "table"
  | "formula"
  | "clamp"
  | "date"
  | "rowcalc"
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

// 구간 경계·값은 숫자 또는 변수/산출 이름(런타임에 동적 조회).
// 이름 참조를 쓰면 회사별 규정 문서 파싱 값에 따라 구간표가 움직인다 (하드코딩 방지).
export type BandVal = number | string;
export interface Band {
  from: BandVal;
  to: BandVal;
  v: BandVal;
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
  // diff: 두 날짜 차이 · part: 날짜에서 년/월/일 추출 · add: 기준 날짜 + n(년/월/일) → 날짜
  mode: "diff" | "part" | "add";
  a: string;
  b?: string;
  // mode="add" 전용 — 더할 수량. 숫자 또는 변수/산출 이름 (out 단위로 가산)
  n?: number | string;
  out: "year" | "month" | "day";
}

// switch — N-way 문자열/숫자 분기 (ref 값에 따라 케이스별 산출)
// 예: 결혼분류 == "본인" → 본인결혼축의금 / "자녀" → 자녀결혼축의금 / 기본값 → 0
export interface SwitchCase {
  match: string; // 비교할 값 (문자열 또는 숫자 문자열)
  t: "text" | "calc"; // 출력 타입
  text?: string; // t="text" 일 때 출력 문자열
  tokens?: Token[]; // t="calc" 일 때 산식 토큰
}
export interface SwitchStep extends StepBase {
  type: "switch";
  ref: string; // 비교 대상 변수명 (보통 type=text 인 분류 변수)
  cases: SwitchCase[];
  // 어느 케이스에도 매칭 안 됐을 때의 출력 (옵션)
  defaultT?: "text" | "calc";
  defaultText?: string;
  defaultTokens?: Token[];
}

// rowcalc — 목록(rows) 변수의 행별 계산 (루프 없는 map/filter/reduce 선언 블록)
//   필터 통과한 행마다 tokens 산식을 평가(컬럼명·전역 변수·매핑값 참조 가능)하고,
//   out=list 면 행별 결과 목록(각 행 + "값" 컬럼), 그 외엔 집계된 숫자 하나를 출력.
export interface RowFilter {
  col: string; // 컬럼명
  op: CmpOp;
  val: string; // 리터럴 또는 전역 변수/산출 이름
}
export interface RowMap {
  col: string; // 매핑 기준 컬럼 (보통 select 컬럼 — 예: 환산구분)
  cases: { match: string; value: number | string }[]; // value: 숫자 또는 전역 변수/산출 이름
  default?: number | string;
}
export type RowCalcOut = "list" | "sum" | "avg" | "max" | "min" | "count";
export interface RowCalcStep extends StepBase {
  type: "rowcalc";
  ref: string; // 목록 변수 이름 또는 선행 rowcalc(out=list) 이름
  filters?: RowFilter[]; // AND — 비우면 전체 행
  tokens: Token[]; // 행 산식. var 토큰은 컬럼명 → 매핑값("매핑값") → 전역 순으로 해석
  map?: RowMap; // 선택 — 행 산식에서 "매핑값" 이름으로 참조
  out: RowCalcOut;
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
  | SwitchStep
  | ClassifyStep
  | TableStep
  | FormulaStep
  | ClampStep
  | DateStep
  | RowCalcStep
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
  | "note"
  // list: 여러 건이 한 문자열에 담긴 목록 값(경력내역·보유자격 등)을 줄 단위로 정리해 표시
  | "list";
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
