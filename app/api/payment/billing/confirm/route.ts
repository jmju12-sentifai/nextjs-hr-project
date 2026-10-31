import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { purchasablePlan } from "@/lib/plans";
import {
  attemptId,
  claimAttempt,
  processAttempt,
  BillingPending,
} from "@/lib/members/billing";
import { memberActionError } from "@/lib/members/server";
import { TossError } from "@/lib/toss";
export const maxDuration = 60;
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.authKey !== "string" ||
    body.authKey.length > 500 ||
    !body.authKey ||
    body.customerKey !== auth.user.id.replace(/[^a-zA-Z0-9_\-.]/g, "_")
  )
    return NextResponse.json(
      { message: "카드 등록 정보를 확인해 주세요." },
      { status: 400 },
    );
  const plan = purchasablePlan(body.plan);
  try {
    const attempt = await claimAttempt({
      id: attemptId(`first:${auth.user.id}:${body.authKey}`),
      userId: auth.user.id,
      kind: "first",
      plan: plan.key,
    });
    if (!attempt) throw new BillingPending();
    return NextResponse.json({
      message: "정기결제 등록 완료",
      ...(await processAttempt(
        attempt,
        body.authKey,
        auth.user.email || undefined,
      )),
    });
  } catch (e) {
    if (e instanceof BillingPending)
      return NextResponse.json(
        { message: e.message, pending: true },
        { status: 503 },
      );
    if (e instanceof TossError)
      return NextResponse.json(
        { message: e.message, code: e.code },
        { status: 400 },
      );
    return NextResponse.json(
      { message: memberActionError(e as any) },
      { status: 409 },
    );
  }
}
