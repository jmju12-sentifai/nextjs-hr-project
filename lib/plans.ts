/**
 * 구독 플랜 단일 소스.
 *
 * 결제 페이지·빌링 확인 라우트·요금 UI·갱신 크론이 모두 이 표를 본다.
 * 금액이나 기간을 다른 곳에 또 적으면 반드시 어긋나므로 여기만 고친다.
 *
 * 금액 근거: docs/homepage-refs/앱 회원 및 과금정책.xlsx
 *   "2. 과금 정책 > HR Pro — 인사담당자 / 월 3,000원(1개 앱) / 월 30,000원(전체 앱)"
 *
 * 이전에는 HRcoach_Menu_Structure_20260810.xlsx 의 "연 30만 원 고정 구독" 을 따랐으나
 * 같은 문서 히어로 항목이 "연 40만 원" 이라 문서 내부부터 어긋나 있었다.
 * 과금정책 문서가 더 최신이고 월 단위로 확정되어 있어 그쪽을 정본으로 삼는다.
 *
 * 정기결제 기간 표기 주의:
 *   토스페이먼츠 정책상 서비스 최대 제공기간이 12개월을 넘으면 입점이 불가하다.
 *   월 단위 자동갱신은 1회 결제로 부여되는 기간이 1개월이라 이 제약에 걸리지 않는다.
 *   months 를 12 보다 크게 잡지 말 것.
 */

export type PlanKey = "pro" | "sme" | "coach" | "coach-plus";

export type Plan = {
  key: PlanKey;
  badge: string;
  title: string;
  sub: string;
  amount: number;
  /** 결제 1회로 부여되는 구독 개월 수 */
  months: number;
  unit: string;
  features: string[];
  /** 메인·요금 페이지에 노출할지. 레거시 플랜은 링크를 끊되 결제 키는 살려둔다. */
  listed: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  pro: {
    key: "pro",
    badge: "HR Pro",
    title: "HRcoach HR Pro 플랜",
    sub: "인사기능별 앱 전체 이용 · 매월 자동결제 · 언제든 해지 가능",
    amount: 30000,
    months: 1,
    unit: "/월",
    features: [
      "인사기능별 앱 전체 이용",
      "산출물 다운로드·이력 관리 무제한",
      "신규 출시 앱 추가 비용 없이 포함",
      "담당자 계정 및 이메일 지원",
    ],
    listed: true,
  },

  // ── 아래는 결제 키 호환용. 요금·메인 페이지에서 노출하지 않는다.
  //    과거 orderId 로 들어온 승인 요청이 플랜을 못 찾아 깨지지 않게만 남긴다.
  sme: {
    key: "sme",
    badge: "SME",
    title: "HRcoach SME 플랜 (구)",
    sub: "연 단위 레거시 플랜",
    amount: 300000,
    months: 12,
    unit: "/년",
    features: [],
    listed: false,
  },
  coach: {
    key: "coach",
    badge: "Coach",
    title: "HRcoach Coach 플랜 (구)",
    sub: "월 단위 레거시 플랜",
    amount: 19900,
    months: 1,
    unit: "/월",
    features: [],
    listed: false,
  },
  "coach-plus": {
    key: "coach-plus",
    badge: "Coach+",
    title: "HRcoach Coach+ 플랜 (구)",
    sub: "월 단위 레거시 플랜",
    amount: 49900,
    months: 1,
    unit: "/월",
    features: [],
    listed: false,
  },
};

/** 신규 결제가 허용되는 플랜. 레거시 키로는 새 구독을 시작할 수 없다. */
export const PURCHASABLE: PlanKey[] = ["pro"];

export const DEFAULT_PLAN: PlanKey = "pro";

export const LISTED_PLANS: Plan[] = Object.values(PLANS).filter((p) => p.listed);

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && v in PLANS;
}

/**
 * 결제창에 띄울 플랜을 고른다.
 *
 * 레거시 키(`/payment?plan=coach`)로 들어와도 신규 결제는 현행 플랜으로 돌린다.
 * 카드사 심사 중에 노출되지 않는 옛 금액으로 결제가 열려 있으면,
 * 심사원이 회신한 최고가와 다른 금액을 보게 되어 지적 사유가 된다.
 */
export function purchasablePlan(raw: unknown): Plan {
  if (isPlanKey(raw) && PURCHASABLE.includes(raw)) return PLANS[raw];
  return PLANS[DEFAULT_PLAN];
}

/** `order_{planKey}_{ts}_{rand}` 에서 플랜을 되짚는다. */
export function planFromOrderId(orderId: string): Plan | null {
  const seg = orderId.split("_")[1];
  return isPlanKey(seg) ? PLANS[seg] : null;
}

export function makeOrderId(planKey: PlanKey): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `order_${planKey}_${Date.now()}_${rand}`;
}

/** 결제 성공 시점 기준으로 다음 청구일을 계산한다. */
export function nextBillingDate(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}
