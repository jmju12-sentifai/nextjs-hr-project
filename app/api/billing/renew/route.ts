import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, isPlanKey, makeOrderId, nextBillingDate } from "@/lib/plans";
import { chargeBilling, TossError } from "@/lib/toss";

/**
 * 정기결제 갱신 크론.
 *
 * 청구일이 지난 활성 구독을 골라 저장해둔 billingKey 로 다시 청구한다.
 * Vercel Cron 이 하루 한 번 호출한다(vercel.json).
 *
 * 멱등성: chargeBilling 이 orderId 를 Idempotency-Key 로 넘긴다. 같은 회차를
 * 두 번 부르더라도 토스 쪽에서 한 번만 청구된다.
 */

// 연속 실패가 이만큼 쌓이면 더 시도하지 않고 구독을 만료시킨다.
const MAX_RENEW_FAILURES = 3;
// 한 번의 실행에서 처리할 최대 건수. 크론 타임아웃을 넘기지 않도록 자른다.
const BATCH_SIZE = 50;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Vercel Cron 은 GET 으로 호출하며 Authorization: Bearer $CRON_SECRET 를 붙인다. */
export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ message: "권한 없음" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: due, error } = await admin
    .from("subscriptions")
    .select(
      "id, user_id, plan, amount, billing_key, customer_key, next_billing_at, renew_fail_count",
    )
    .eq("status", "active")
    .eq("auto_renew", true)
    .not("billing_key", "is", null)
    .lte("next_billing_at", now.toISOString())
    .order("next_billing_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[renew] 대상 조회 실패:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const results = { charged: 0, failed: 0, expired: 0 };

  for (const sub of due ?? []) {
    const plan = isPlanKey(sub.plan) ? PLANS[sub.plan] : null;
    if (!plan) {
      console.error("[renew] 알 수 없는 플랜:", sub.plan, sub.id);
      results.failed += 1;
      continue;
    }

    const orderId = makeOrderId(plan.key);
    try {
      const payment = await chargeBilling({
        billingKey: sub.billing_key!,
        customerKey: sub.customer_key!,
        amount: plan.amount,
        orderId,
        orderName: `${plan.title} (정기결제 갱신)`,
      });

      const nextAt = nextBillingDate(now, plan.months);
      await admin
        .from("subscriptions")
        .update({
          payment_key: payment.paymentKey,
          order_id: orderId,
          expires_at: nextAt.toISOString(),
          next_billing_at: nextAt.toISOString(),
          renew_fail_count: 0,
          last_renew_error: null,
        })
        .eq("id", sub.id);

      results.charged += 1;
    } catch (e) {
      const msg =
        e instanceof TossError ? `${e.code}: ${e.message}` : String(e);
      const fails = (sub.renew_fail_count ?? 0) + 1;
      const giveUp = fails >= MAX_RENEW_FAILURES;

      console.error("[renew] 청구 실패:", sub.id, msg, `(${fails}회)`);

      await admin
        .from("subscriptions")
        .update({
          renew_fail_count: fails,
          last_renew_error: msg,
          // 포기 전까지는 하루 뒤 재시도. 한도카드·일시 오류가 풀릴 여지를 준다.
          ...(giveUp
            ? { status: "expired", auto_renew: false }
            : {
                next_billing_at: new Date(
                  now.getTime() + 24 * 60 * 60 * 1000,
                ).toISOString(),
              }),
        })
        .eq("id", sub.id);

      if (giveUp) results.expired += 1;
      else results.failed += 1;
    }
  }

  return NextResponse.json({
    message: "갱신 처리 완료",
    scanned: due?.length ?? 0,
    ...results,
  });
}
