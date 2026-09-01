/**
 * 홈 메인의 공용 카탈로그.
 *
 * 출처: docs/homepage-refs/HRcoach_Menu_Structure_20260810.xlsx (Site_Menu_Structure 시트)
 * - SITE_NAV        : 1 Depth 8개를 성격별로 묶은 대메뉴 4개 + 드롭다운
 * - HR_CATEGORIES   : "2. 인사기능별 앱" 의 2 Depth 10개
 *   엑셀 비고 — "통합검색 메뉴에서 기능별로만 구분" → 대메뉴가 아니라 검색 필터로 붙인다.
 *
 * TOOLS / TOOL_ACTIVATION 은 AIToolList 에 하드코딩되어 있던 것을 옮겨왔다.
 * 메인 Quick Search 와 도구 리스트가 같은 원본을 봐야 해서 여기로 끌어올린 것.
 */

export type NavChild = { label: string; href: string; desc?: string };
export type NavItem = { label: string; href: string; children?: NavChild[] };

/**
 * 대메뉴는 엑셀 1 Depth 8개를 성격별로 4개로 묶은 것.
 * 드롭다운에는 원래의 1 Depth 메뉴만 올린다 — 2 Depth(시각화 튜토리얼, VOC, B2B 제휴 등)는
 * 메뉴가 아니라 각 페이지 안의 콘텐츠이므로 desc 로만 흘려준다.
 *   소개        = 1. AI인사솔루션 안내 + 8. K Prime Lab   (읽는 콘텐츠)
 *   앱          = 2. 인사기능별 앱 + 3. 프리미엄앱          (고르는 카탈로그, 과금 방식만 다름)
 *   요금 및 구독 = 5. 요금 및 구독 관리                     (단, 결제 내역은 로그인 전용이라 프로필로)
 *   문의 및 요청 = 6. 앱개발요청게시판 + 7. Contact Us      (사용자가 말을 거는 창구)
 * 4. 내 작업실은 하위 항목이 전부 로그인 후에만 의미가 있어 PROFILE_NAV 로 내렸다.
 */
export const SITE_NAV: NavItem[] = [
  {
    label: "소개",
    href: "/solution",
    children: [
      { label: "AI인사솔루션 안내", href: "/solution", desc: "AI인사앱 소개 · 시각화 튜토리얼 · 활용 노하우" },
      { label: "K Prime Lab", href: "/lab", desc: "비전 및 미션 · R&D 로드맵" },
    ],
  },
  {
    label: "앱",
    href: "/apps",
    children: [
      { label: "인사기능별 앱", href: "/apps", desc: "10개 인사 영역의 앱과 도구" },
      { label: "프리미엄앱", href: "/premium", desc: "제휴 파트너사 · 엔터프라이즈 맞춤형" },
    ],
  },
  { label: "요금 및 구독", href: "/pricing" },
  {
    label: "문의 및 요청",
    href: "/support",
    children: [
      { label: "앱개발요청게시판", href: "/requests", desc: "요청 폼 · 진행 상태 · 유저 투표소" },
      { label: "Contact Us", href: "/support", desc: "고객 지원 센터 · VOC · B2B 제휴 제안" },
    ],
  },
];

/**
 * 로그인 사용자 전용 — 엑셀 "4. 내 작업실".
 * 하위(인사이트 대시보드·마이 앱 번들·산출물 보관함·결제 내역)는 메뉴가 아니라
 * /workspace 페이지 안의 콘텐츠라 여기서는 메뉴 하나로만 노출한다.
 */
export const PROFILE_NAV: NavChild[] = [
  { label: "내 작업실", href: "/workspace", desc: "대시보드 · 앱 번들 · 산출물 보관함 · 결제 내역" },
];

/** 엑셀 "복리수행관리" 는 복리후생관리의 오기로 보고 후자로 표기 */
export const HR_CATEGORIES = [
  "직무 분석 및 설계",
  "채용 및 온보딩",
  "평가 및 성과 관리",
  "보상관리",
  "복리후생관리",
  "교육관리",
  "조직문화/진단",
  "급여/근태/행정관리",
  "인사정보관리",
  "기타관리",
] as const;

export type HrCategory = (typeof HR_CATEGORIES)[number];

export type Tool = {
  no: number;
  category: string;
  hrCategory: HrCategory;
  code: string;
  name: string;
  definition: string;
  oldTime: string;
  aiOutput: string;
  aiTime: string;
  note: string;
};

export const TOOLS: Tool[] = [
  {
    no: 1,
    category: "직무",
    hrCategory: "직무 분석 및 설계",
    code: "A01",
    name: "직무분석/직무기술서 생성기",
    definition:
      "현업관리자/인사담당이 직무 업무유형 질문에 맞게 답변을 하고, 회사기준을 업로드하면 자동으로 직무분석 결과 및 직무 기술서를 생성함 (성과책임 및 역량모델, 직무평가 포함)",
    oldTime: "2박3일",
    aiOutput: "직무분석결과 및 직무기술서",
    aiTime: "12분",
    note: "",
  },
  {
    no: 2,
    category: "채용",
    hrCategory: "채용 및 온보딩",
    code: "B02",
    name: "지원자 직무적합도 ATS 레포트 생성기",
    definition:
      "직무 모집요강과 지원자 이력서를 업로드하면, 지원자 개인에 대한 직무 적합도 평가기준별 점수와 채용가부 의견 등 종합레포트를 자동 제공함",
    oldTime: "인당 10분",
    aiOutput: "직무적합도 ATS레포트",
    aiTime: "2분",
    note: "인기",
  },
  {
    no: 3,
    category: "평가",
    hrCategory: "평가 및 성과 관리",
    code: "C02",
    name: "조직별 평가결과 현황표 도출기",
    definition:
      "본부단위 구성원 평가표를 업로드하면, 평가등급 배분 전체 현황과 직급별·팀별·직무별 분포도 수준에 대한 레포트를 제공",
    oldTime: "3시간",
    aiOutput: "조직별 평가레포트",
    aiTime: "5분",
    note: "",
  },
];

export const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  직무: { bg: "bg-blue-50", text: "text-blue-600" },
  채용: { bg: "bg-emerald-50", text: "text-emerald-600" },
  평가: { bg: "bg-violet-50", text: "text-violet-600" },
  인력운영: { bg: "bg-orange-50", text: "text-orange-600" },
  "보상/복지": { bg: "bg-sky-50", text: "text-sky-600" },
  교육: { bg: "bg-teal-50", text: "text-teal-600" },
  조직문화: { bg: "bg-rose-50", text: "text-rose-500" },
  기타: { bg: "bg-gray-100", text: "text-gray-500" },
};

export type DifyTool = "report-summary";
export type Activation =
  | { kind: "dify"; tool: DifyTool }
  | { kind: "ats" }
  | { kind: "eval" };

export const DIFY_CONFIG: Record<
  DifyTool,
  { title: string; src: string; helper: string }
> = {
  "report-summary": {
    title: "보고서/자료 요약기",
    src: "https://udify.app/workflow/wiiyddzOMb3Wq8QA",
    helper: "요약할 보고서/자료 파일을 업로드한 후 실행을 눌러 주세요.",
  },
};

export const TOOL_ACTIVATION: Record<number, Activation> = {
  1: { kind: "dify", tool: "report-summary" },
  2: { kind: "ats" },
  3: { kind: "eval" },
};

export const NEW_BADGE_TOOLS = new Set([2, 3]);

/** 도구를 열기 위한 목적지. 로그인/구독 가드는 각 목적지가 담당한다. */
export function toolHref(no: number): string {
  const act = TOOL_ACTIVATION[no];
  if (!act) return "/";
  if (act.kind === "ats") return "/tools/ats";
  if (act.kind === "eval") return "/tools/eval";
  return `/?tool=${no}`;
}

/* ── Quick Search 인덱스 ─────────────────────────────────── */

export type SearchItem = {
  id: string;
  kind: "tool" | "app";
  title: string;
  category: HrCategory;
  /** 무엇을 하는 앱인지 — 검색 대상 */
  summary: string;
  /** 산출물 이름 — 엑셀 Home > Quick Search 의 "필요 인사 산출물" 검색용 */
  output: string;
  /** 앱의 4단계 처리 흐름(app_schema.meta.flow). 도구에는 없다. */
  flow?: string[];
  href: string;
  badge?: "NEW" | "HOT";
};

export function toolsToSearchItems(): SearchItem[] {
  return TOOLS.map((t) => ({
    id: `tool-${t.no}`,
    kind: "tool" as const,
    title: t.name,
    category: t.hrCategory,
    summary: t.definition,
    output: t.aiOutput,
    href: toolHref(t.no),
    badge: NEW_BADGE_TOOLS.has(t.no)
      ? ("NEW" as const)
      : t.note === "인기"
        ? ("HOT" as const)
        : undefined,
  }));
}

/** 제목·요약·산출물·카테고리를 한 번에 훑는 단순 부분일치. 색인 규모가 작아 이걸로 충분하다. */
export function filterSearchItems(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return items.filter((it) => {
    const hay = `${it.title} ${it.summary} ${it.output} ${it.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
