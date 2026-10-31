import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chargeBilling,
  issueBillingKey,
  paymentByOrder,
  TossError,
} from "@/lib/toss";
import { PLANS, isPlanKey } from "@/lib/plans";

export const attemptId = (key: string) =>
  createHash("sha256").update(key).digest("hex").slice(0, 48);
export type Attempt = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  kind: "first" | "renew";
  plan: string;
  amount: number;
  months: number;
  order_id: string;
  state: string;
  lease_token: string;
  billing_data: any;
  created_at: string;
  error: string | null;
};
export class BillingPending extends Error {
  constructor() {
    super(
      "결제 결과를 확인 중입니다. 중복 결제하지 마시고 내 작업실에서 이용 상태를 확인해 주세요.",
    );
  }
}
export async function claimAttempt(input: {
  id: string;
  userId: string;
  kind: "first" | "renew";
  subscriptionId?: string | null;
  plan: string;
}) {
  const plan = isPlanKey(input.plan) ? PLANS[input.plan] : null;
  if (!plan) throw new Error("INVALID_PLAN");
  const { data, error } = await createAdminClient().rpc(
    "claim_billing_attempt",
    {
      p_id: input.id,
      p_user: input.userId,
      p_kind: input.kind,
      p_subscription: input.subscriptionId || null,
      p_plan: plan.key,
      p_amount: plan.amount,
      p_months: plan.months,
    },
  );
  if (error) throw error;
  return data as Attempt | null;
}
/** 주입 가능한 결제 함수로 실제 카드 청구 없이 실패·재시도·중복 요청을 검증한다. */
export async function processAttempt(
  attempt: Attempt,
  authKey?: string,
  customerEmail?: string,
  deps = {
    admin: createAdminClient,
    issue: issueBillingKey,
    charge: chargeBilling,
    lookup: paymentByOrder,
  },
) {
  const admin = deps.admin();
  if (attempt.state === "done") {
    const { data, error } = await admin
      .from("subscriptions")
      .select("expires_at")
      .eq("id", attempt.subscription_id!)
      .single();
    if (error) throw error;
    return { amount: attempt.amount, nextBillingAt: data.expires_at };
  }
  if (attempt.state === "failed")
    throw new TossError(
      attempt.error ||
        "승인되지 않은 결제입니다. 카드 등록부터 다시 진행해 주세요.",
      "PREVIOUSLY_FAILED",
      400,
    );
  let card = attempt.billing_data;
  let chargeStarted = !!card;
  try {
    if (!card) {
      if (!authKey)
        throw new TossError(
          "카드 등록을 다시 진행해 주세요.",
          "AUTH_REQUIRED",
          400,
        );
      const issued = await deps.issue(
        authKey,
        attempt.user_id.replace(/[^a-zA-Z0-9_\-.]/g, "_"),
      );
      card = {
        billingKey: issued.billingKey,
        customerKey: issued.customerKey,
        cardCompany: issued.cardCompany ?? issued.card?.company ?? null,
        cardNumber: issued.cardNumber ?? issued.card?.number ?? null,
      };
      const { data, error } = await admin
        .from("billing_attempts")
        .update({ billing_data: card })
        .eq("id", attempt.id)
        .eq("lease_token", attempt.lease_token)
        .eq("state", "processing")
        .select("id")
        .single();
      if (error || !data) throw new Error("카드 등록 결과 저장 실패");
    }
    // 이전 서버가 승인 직후 종료되었을 수 있다. 조회가 불확실하면 새 주문으로 청구하지 않는다.
    const old = Date.now() - new Date(attempt.created_at).getTime() > 60000;
    let payment = old ? await deps.lookup(attempt.order_id) : null;
    if (!payment) {
      if (Date.now() - new Date(attempt.created_at).getTime() > 14 * 86400000)
        throw new BillingPending();
      chargeStarted = true;
      const plan = isPlanKey(attempt.plan) ? PLANS[attempt.plan] : null;
      payment = await deps.charge({
        billingKey: card.billingKey,
        customerKey: card.customerKey,
        amount: attempt.amount,
        orderId: attempt.order_id,
        orderName: plan?.title || "HRcoach 구독",
        customerEmail,
      });
    }
    if (
      payment.status !== "DONE" ||
      payment.totalAmount !== attempt.amount ||
      payment.orderId !== attempt.order_id ||
      !payment.paymentKey
    )
      throw new BillingPending();
    const { data, error } = await admin.rpc("finish_billing_attempt", {
      p_id: attempt.id,
      p_token: attempt.lease_token,
      p_payment: payment,
    });
    if (error) throw new BillingPending();
    return { amount: attempt.amount, nextBillingAt: data.nextBillingAt };
  } catch (error) {
    // 청구 오류도 기존 승인일 수 있다. 조회가 확인되지 않으면 실패로 단정하지 않는다.
    let confirmedAbsent = !chargeStarted;
    if (chargeStarted && !(error instanceof BillingPending)) {
      try {
        const existing = await deps.lookup(attempt.order_id);
        if (
          existing?.status === "DONE" &&
          existing.totalAmount === attempt.amount &&
          existing.orderId === attempt.order_id &&
          existing.paymentKey
        ) {
          const stored = await admin.rpc("finish_billing_attempt", {
            p_id: attempt.id,
            p_token: attempt.lease_token,
            p_payment: existing,
          });
          if (!stored.error)
            return {
              amount: attempt.amount,
              nextBillingAt: stored.data.nextBillingAt,
            };
        }
        confirmedAbsent = existing === null;
      } catch {
        confirmedAbsent = false;
      }
    }
    const definite =
      !chargeStarted ||
      (confirmedAbsent &&
        error instanceof TossError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 409, 429].includes(error.status));
    const message = definite
      ? error instanceof TossError
        ? error.message
        : "카드 등록 결과를 저장하지 못했습니다. 다시 등록해 주세요."
      : "결제 결과 확인 중";
    const { error: storeError } = await admin.rpc("finish_billing_attempt", {
      p_id: attempt.id,
      p_token: attempt.lease_token,
      p_payment: null,
      p_error: message,
      p_definite: definite,
    });
    if (storeError || !definite) throw new BillingPending();
    throw new TossError(
      message,
      error instanceof TossError ? error.code : "REGISTRATION_FAILED",
      400,
    );
  }
}

/** 화면 복귀 시 승인 내역만 조회한다. 이 경로에서는 새 결제를 요청하지 않는다. */
export async function reconcilePending(userId: string) {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("billing_attempts")
    .select("id,plan,subscription_id,kind,created_at,lease_until,billing_data")
    .eq("user_id", userId)
    .in("state", ["pending", "processing"])
    .maybeSingle();
  if (error) throw new BillingPending();
  if (!row || (row.lease_until && new Date(row.lease_until) > new Date()))
    return;
  // 카드 저장 이전에 종료된 작업은 청구를 시작할 수 없었다. 등록 재시도를 즉시 허용한다.
  const uncharged = row.kind === "first" && !row.billing_data;
  const payment = uncharged ? null : await paymentByOrder("hr_" + row.id);
  if (
    !uncharged &&
    !payment &&
    Date.now() - new Date(row.created_at).getTime() < 15 * 86400000
  )
    return;
  const attempt = await claimAttempt({
    id: row.id,
    userId,
    subscriptionId: row.subscription_id,
    kind: row.kind,
    plan: row.plan,
  });
  if (!attempt || attempt.state === "done" || attempt.state === "failed")
    return;
  const { error: stored } = await admin.rpc("finish_billing_attempt", {
    p_id: attempt.id,
    p_token: attempt.lease_token,
    p_payment: payment,
    p_definite: !payment,
    p_error: payment
      ? null
      : uncharged
        ? "카드 등록이 완료되지 않았습니다. 다시 등록해 주세요."
        : "승인 내역 없이 확인 기한이 종료되었습니다. 결제를 다시 진행해 주세요.",
  });
  if (stored) throw new BillingPending();
}
