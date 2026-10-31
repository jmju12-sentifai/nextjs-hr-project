export const MEMBER_STATES = {
  paid: "유료",
  free: "무료 제공",
  canceling: "해지 예정",
  failed: "결제 실패",
  none: "미구독",
} as const;
export type MemberState = keyof typeof MEMBER_STATES;
export interface Member {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  state: MemberState;
  active: boolean;
  subscription_id: string | null;
  plan: string | null;
  amount: number | null;
  subscription_status: string | null;
  started_at: string | null;
  expires_at: string | null;
  next_billing_at: string | null;
  auto_renew: boolean | null;
  card_company: string | null;
  card_number_masked: string | null;
  renew_fail_count: number | null;
  last_renew_error: string | null;
  grant_id: string | null;
  grant_starts_at: string | null;
  grant_ends_at: string | null;
  grant_reason: string | null;
  last_run_at: string | null;
}
export function formatMemberDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "없음";
}
export function endOfKoreanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("종료일을 선택해 주세요.");
  const d = new Date(value + "T23:59:59+09:00");
  if (
    !Number.isFinite(+d) ||
    new Date(+d + 9 * 3600000).toISOString().slice(0, 10) !== value
  )
    throw new Error("올바른 종료일을 선택해 주세요.");
  return d.toISOString();
}
/** 월말은 다음 달의 마지막 날로 맞춘다. 1월 31일 + 1개월이 3월이 되면 안 된다. */
export function addMonths(value: string, months: number) {
  const d = new Date(new Date(value).getTime() + 9 * 3600000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return new Date(d.getTime() - 9 * 3600000).toISOString();
}
export function grantPreview(
  member: Member,
  duration: string,
  custom: string,
  now = new Date().toISOString(),
) {
  if (!["1", "3", "custom", "unlimited"].includes(duration))
    throw new Error("무료 제공 기간을 선택해 주세요.");
  const paid =
    member.subscription_status === "active" &&
    member.expires_at &&
    new Date(member.expires_at) > new Date(now);
  const startsAt = paid && duration !== "unlimited" ? member.expires_at! : now;
  const endsAt =
    duration === "unlimited"
      ? null
      : duration === "custom"
        ? endOfKoreanDate(custom)
        : addMonths(startsAt, Number(duration));
  if (endsAt && new Date(endsAt) <= new Date(startsAt))
    throw new Error("종료일은 이용 시작일보다 늦어야 합니다.");
  return {
    startsAt,
    endsAt,
    stopsRenewal: !!paid && duration === "unlimited",
    nextBillingAt: paid && member.auto_renew ? endsAt : null,
  };
}
export function receiptUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      (u.hostname === "tosspayments.com" ||
        u.hostname.endsWith(".tosspayments.com") ||
        u.hostname.endsWith(".toss.im"))
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export const ACTION_NAMES: Record<string, string> = {
  grant: "무료 이용 부여",
  revoke: "무료 이용 회수",
  cancel: "정기결제 해지",
  expiry: "종료일 변경",
  terminate: "즉시 종료",
  note: "운영 메모 저장",
  first_payment: "첫 결제",
  renew_payment: "정기결제",
  legacy_payment: "결제",
};
export function memberExpected(m: Member) {
  return {
    subscription_id: m.subscription_id,
    expires_at: m.expires_at,
    grant_id: m.grant_id,
    auto_renew: m.auto_renew,
  };
}
export type PaymentRecord = {
  id: string;
  kind: string;
  amount: number;
  status: string;
  order_id: string;
  receipt_url: string | null;
  error: string | null;
  created_at: string;
};

export function formatMemberTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function actionSummary(detail: { before?: Member; after?: Member }) {
  const b = detail.before,
    a = detail.after;
  if (!b || !a) return "";
  const parts: string[] = [];
  if (b.state !== a.state)
    parts.push(`${MEMBER_STATES[b.state]} → ${MEMBER_STATES[a.state]}`);
  if (b.expires_at !== a.expires_at)
    parts.push(
      `이용 종료일 ${formatMemberDate(b.expires_at)} → ${formatMemberDate(a.expires_at)}`,
    );
  if (b.next_billing_at !== a.next_billing_at)
    parts.push(
      `다음 결제일 ${formatMemberDate(b.next_billing_at)} → ${formatMemberDate(a.next_billing_at)}`,
    );
  if (b.grant_id !== a.grant_id && a.grant_id)
    parts.push(
      `무료 이용 ${formatMemberDate(a.grant_starts_at)}부터 ${a.grant_ends_at ? formatMemberDate(a.grant_ends_at) + "까지" : "기한 없이"}`,
    );
  return parts.join(" · ");
}
