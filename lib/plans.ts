/**
 * 구독 플랜 단일 소스.
 *
 * 이전에는 결제 페이지·확인 라우트·요금 UI 가 각자 금액을 들고 있었고,
 * 확인 라우트는 결제 금액만 보고 플랜을 되짚으면서 기간을 항상 1개월로 넣었다.
 * 연 단위 플랜을 도입하면 30만 원을 받고 1개월만 부여하는 문제가 되므로
 * 플랜별 금액과 기간을 여기 한곳에 두고 모두가 이걸 본다.
 *
 * 금액 근거: HRcoach_Menu_Structure_20260810.xlsx
 *   "5. 요금 및 구독 관리 > 중소기업(SME) 플랜 — 연 30만 원 고정 구독제"
 */

export type PlanKey = "sme" | "coach" | "coach-plus";

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
  sme: {
    key: "sme",
    badge: "SME",
    title: "HRcoach SME 플랜",
    sub: "인사기능별 앱 전체 · 통합검색 · 산출물 보관함 · 연 단위 고정 구독",
    amount: 300000,
    months: 12,
    unit: "/년",
    features: [
      "인사기능별 앱 전체 이용",
      "산출물 다운로드·이력 관리 무제한",
      "신규 출시 앱 추가 비용 없이 포함",
      "담당자 계정 및 이메일 지원",
    ],
    listed: true,
  },
  // ── 아래 두 개는 기존 결제 링크 호환용. 메인·요금 페이지에서는 노출하지 않는다.
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

export const LISTED_PLANS: Plan[] = Object.values(PLANS).filter((p) => p.listed);

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && v in PLANS;
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
