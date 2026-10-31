import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  attemptId,
  claimAttempt,
  processAttempt,
  BillingPending,
} from "@/lib/members/billing";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  return POST(req);
}
export async function POST(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ message: "권한 없음" }, { status: 401 });
  const admin = createAdminClient(),
    started = Date.now(),
    summary = { charged: 0, failed: 0, pending: 0, skipped: 0 };
  // 미확정 승인을 먼저 복구한다. 새 주문으로 바꿔 이중 청구하지 않는다.
  const pending = await admin
    .from("billing_attempts")
    .select("id,user_id,subscription_id,kind,plan")
    .in("state", ["pending", "processing"])
    .or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`)
    .order("created_at")
    .limit(10);
  const due = await admin
    .from("subscriptions")
    .select("id,user_id,plan,next_billing_at")
    .eq("status", "active")
    .eq("auto_renew", true)
    .not("billing_key", "is", null)
    .lte("next_billing_at", new Date().toISOString())
    .order("next_billing_at")
    .limit(10);
  if (pending.error || due.error)
    return NextResponse.json(
      { message: "갱신 대상을 불러오지 못했습니다." },
      { status: 503 },
    );
  const jobs = [
    ...(pending.data || []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      subscriptionId: a.subscription_id,
      kind: a.kind as "first" | "renew",
      plan: a.plan,
    })),
    ...(due.data || [])
      .filter((s) => !pending.data?.some((a) => a.user_id === s.user_id))
      .map((s) => ({
        id: attemptId(`renew:${s.id}:${s.next_billing_at}`),
        userId: s.user_id,
        subscriptionId: s.id,
        kind: "renew" as const,
        plan: s.plan,
      })),
  ];
  for (const job of jobs) {
    if (Date.now() - started > 20000) break;
    try {
      const a = await claimAttempt(job);
      if (!a) {
        summary.skipped++;
        continue;
      }
      await processAttempt(a);
      summary.charged++;
    } catch (e) {
      if (e instanceof BillingPending) summary.pending++;
      else if ((e as any)?.message?.includes("BILLING_BUSY")) summary.skipped++;
      else summary.failed++;
    }
  }
  return NextResponse.json(summary);
}
