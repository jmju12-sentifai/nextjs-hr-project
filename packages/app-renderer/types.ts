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
// pick(조회): 필터에 맞는 첫 행의 산식 값 하나를 반환 — 규정 표(rows)에서 키 조회(lookup) 용
//   예: 직급체계표에서 "최소경력<=경력연차<=최대경력" 행의 하한액 꺼내기
export type RowCalcOut = "list" | "sum" | "avg" | "max" | "min" | "count" | "pick";
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
  /** 인사기능별 앱 카테고리. 사이트 목록·검색 필터가 이 값을 본다.
   *  값 목록은 lib/catalog.ts 의 HR_CATEGORIES. 비어 있으면 "기타관리" 로 취급. */
  category?: string;
}

// ───── 문서형 리포트 ─────
// 그리드에 요소를 배치하던 report 와 별개로, 위에서 아래로 읽는 문서 양식.
// 블록은 값을 갖지 않고 변수·산출 이름만 가리킨다 — 숫자는 언제나 계산 엔진 값.
// 문장(tpl)의 {이름} 자리도 같은 규칙으로 채운다.
export type DocBlockType =
  | "headline" // 결론 문장
  | "formula" // 산식 상자
  | "itemized" // 명세서식 산정표
  | "bandtable" // 구간 일정표
  | "flow" // 단계별 산정 흐름
  | "range" // 범위 내 위치
  | "bar" // 하한·목표 대비 막대
  | "timeline" // 타임라인
  | "counts" // 일수 칸
  | "conditions" // 조건 근거표
  | "facts" // 항목 값 목록
  | "kpis" // 핵심 수치 카드 (첫 항목을 크게)
  | "gauge" // 비율 링
  | "compare" // 전후 비교 막대
  | "text" // 안내문
  | "element" // 기존 그리드 요소(차트 9종 등)를 그대로 끼워 넣기
  | "pagebreak";

/** 블록이 가리키는 값 하나. label 이 없으면 이름을 그대로 보여준다. */
export interface DocRef {
  bind: string;
  label?: string;
}

interface DocBlockBase {
  id: string;
  type: DocBlockType;
  title?: string;
  /** 규정 인용·공식 안내처럼 편집 대상에서 빼는 블록 */
  locked?: boolean;
}

export interface HeadlineBlock extends DocBlockBase {
  type: "headline";
  tpl: string;
}
export interface FormulaBlock extends DocBlockBase {
  type: "formula";
  bind: string; // formula 단계 이름
  labels?: Record<string, string>; // 이름 → 식에 쓸 표시 이름
  /** 항목 이름 → 뜻 설명. 비우면 변수 설명(desc)이나 산출 단계 설명을 쓴다. */
  notes?: Record<string, string>;
}
export interface ItemizedBlock extends DocBlockBase {
  type: "itemized";
  bind: string; // classify 단계 이름
  /** bar: 구성 막대 + 항목표(기본) · donut: 도넛 + 범례 · table: 표만 */
  variant?: "bar" | "donut" | "table";
  totalLabel?: string;
  hideExcluded?: boolean;
  /** 합계 아래에 이어 붙이는 행 (감액, 적용 후 금액 등). 마지막 행을 결과로 강조한다. */
  after?: (DocRef & { sign?: "-" })[];
  note?: string;
}
export interface BandTableBlock extends DocBlockBase {
  type: "bandtable";
  bind: string; // table 단계 이름
  /** chart: 구간별 막대(기본) · table: 표 */
  variant?: "chart" | "table";
  /** 같은 이름의 구간표를 모든 경로에서 모아 한 표로 (예: 가산형·표준형 감액률) */
  allPaths?: boolean;
  pathLabels?: Record<string, string>; // 경로 id → 유형 열에 쓸 짧은 이름
  refLabel?: string;
  valueLabel?: string;
  note?: string;
}
export interface FlowBlock extends DocBlockBase {
  type: "flow";
  steps: DocRef[];
  /**
   * steps: 단계 목록(기본)
   * waterfall: 금액 증감 폭포 차트 — 첫 단계는 시작 금액, 이후는 직전 대비 변화로 그리고
   *   끝에 최종 금액 막대(endLabel)를 붙인다. 첫 단계와 단위가 다른 단계는 뺀다.
   */
  variant?: "steps" | "waterfall";
  endLabel?: string;
}
export interface RangeBlock extends DocBlockBase {
  type: "range";
  bind: string;
  min: string; // 이름 또는 숫자
  max: string;
  mid?: string;
}
export interface BarBlock extends DocBlockBase {
  type: "bar";
  bind: string;
  marks: DocRef[]; // 하한·목표 같은 기준선
}
export interface TimelineBlock extends DocBlockBase {
  type: "timeline";
  points: DocRef[];
}
export interface CountsBlock extends DocBlockBase {
  type: "counts";
  items: DocRef[];
  /** 둘 다 있으면 칸으로 사용 현황을 그린다 (총량이 60 이하일 때) */
  total?: string;
  used?: string;
}
export interface ConditionsBlock extends DocBlockBase {
  type: "conditions";
  labels?: Record<string, string>; // 조건 id → 표시 이름
}
export interface FactsBlock extends DocBlockBase {
  type: "facts";
  items: DocRef[];
}
export interface KpisBlock extends DocBlockBase {
  type: "kpis";
  /** 비율 장식도 항목별로 편집한다. 생략하면 기존 링 표현을 유지한다. */
  items: (DocRef & { display?: "ring" | "bar" | "value" })[];
}
export interface GaugeBlock extends DocBlockBase {
  type: "gauge";
  /** % 단위 값은 그대로, 아니면 bind ÷ of 를 비율로 그린다 */
  items: (DocRef & { of?: string })[];
}
export interface CompareBlock extends DocBlockBase {
  type: "compare";
  /** 같은 단위의 값들. 첫 값 대비 마지막 값의 증감률을 함께 표시한다. */
  items: DocRef[];
}
export interface TextBlock extends DocBlockBase {
  type: "text";
  tpl: string;
  /** 보조 안내 — 옅은 상자에 작게 */
  muted?: boolean;
}
export interface ElementBlock extends DocBlockBase {
  type: "element";
  el: ReportElement;
}
export interface PageBreakBlock extends DocBlockBase {
  type: "pagebreak";
}

export type DocBlock =
  | HeadlineBlock
  | FormulaBlock
  | ItemizedBlock
  | BandTableBlock
  | FlowBlock
  | RangeBlock
  | BarBlock
  | TimelineBlock
  | CountsBlock
  | ConditionsBlock
  | FactsBlock
  | KpisBlock
  | GaugeBlock
  | CompareBlock
  | TextBlock
  | ElementBlock
  | PageBreakBlock;

export interface ReportDoc {
  /** 문서 제목. 비면 "{앱 이름} 안내서" */
  title?: string;
  /** 머리말 대상자 줄에 넣을 변수 (성명·사번·소속 등) */
  subjects?: string[];
  /** 이 문서에서만 쓰는 표시 단위 (예: 만나이 "년" → "세"). 계산 값은 그대로다. */
  units?: Record<string, string>;
  blocks: DocBlock[];
}

/** 리포트 머리말·꼬리말의 발행 정보. 사용자가 마이페이지에서 한 번 입력한다. */
export interface ReportIssuer {
  company?: string;
  dept?: string;
  contact?: string;
}

export interface Path {
  id: string;
  label: string;
  conditions: Judge[]; // 모두 충족 시 이 경로 (AND)
  steps: Step[];
  report: ReportElement[];
  /** 문서형 양식. blocks 가 있으면 report(그리드) 대신 이것으로 그린다. */
  doc?: ReportDoc;
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
