import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purchasablePlan, makeOrderId, nextBillingDate } from "@/lib/plans";
import { issueBillingKey, chargeBilling, TossError } from "@/lib/toss";

/**
 * 카드 등록(authKey) → 빌링키 발급 → 첫 회차 청구 → 구독 생성.
 *
 * 단건 결제(/api/payment/confirm)와 달리 금액을 클라이언트에서 받지 않는다.
 * 플랜 표에서 서버가 직접 읽는다. 클라이언트가 보낸 금액을 믿으면
 * 30,000원짜리를 1,000원에 사는 치환 공격이 열린다.
 */
export async function POST(req: Request) {
  const { customerKey, authKey, plan: planRaw } = await req.json();
  if (!customerKey || !authKey) {
    return NextResponse.json({ message: "필수 파라미터 누락" }, { status: 400 });
  }

  // 1) 본인 인증
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다" }, { status: 401 });
  }

  // 2) customerKey 가 정말 이 사용자 것인지 확인.
  //    결제 페이지가 만든 규칙을 그대로 재현해 비교한다. 남의 빌링키를 발급받지 못하게.
  const expected = user.id.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  if (customerKey !== expected) {
    return NextResponse.json(
      { message: "고객 식별자가 일치하지 않습니다" },
      { status: 403 },
    );
  }

  // 3) 금액·기간은 서버가 플랜 표에서 확정한다.
  const plan = purchasablePlan(planRaw);
  const admin = createAdminClient();

  // 4) 이미 활성 구독이 있으면 중복 결제를 막는다.
  {
    const { data: active } = await admin
      .from("subscriptions")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (
      active &&
      (!active.expires_at || new Date(active.expires_at).getTime() > Date.now())
    ) {
      return NextResponse.json(
        { message: "이미 이용 중인 구독이 있습니다" },
        { status: 409 },
      );
    }
  }

  try {
    // 5) authKey → billingKey 교환
    const issued = await issueBillingKey(authKey, customerKey);

    // 6) 첫 회차 청구
    const orderId = makeOrderId(plan.key);
    const payment = await chargeBilling({
      billingKey: issued.billingKey,
      customerKey,
      amount: plan.amount,
      orderId,
      orderName: plan.title,
      customerEmail: user.email ?? undefined,
    });

    // 7) 청구 결과 재확인 — 응답 금액이 플랜 금액과 다르면 기록하지 않는다.
    if (payment.totalAmount !== plan.amount) {
      return NextResponse.json({ message: "결제 금액 불일치" }, { status: 400 });
    }

    const startedAt = new Date();
    const nextAt = nextBillingDate(startedAt, plan.months);

    // 8) 구독 생성 — service-role 로 RLS 우회. 사용자가 직접 만들 수 없게 한다.
    const { error: insErr } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan: plan.key,
      payment_key: payment.paymentKey,
      order_id: orderId,
      amount: plan.amount,
      status: "active",
      started_at: startedAt.toISOString(),
      // 결제 1회로 부여되는 이용기간의 끝. 갱신에 성공하면 뒤로 밀린다.
      expires_at: nextAt.toISOString(),
      next_billing_at: nextAt.toISOString(),
      billing_key: issued.billingKey,
      customer_key: customerKey,
      card_company: issued.cardCompany ?? issued.card?.company ?? null,
      card_number_masked: issued.cardNumber ?? issued.card?.number ?? null,
      auto_renew: true,
    });

    if (insErr) {
      // 결제는 이미 승인된 상태다. 사용자를 실패로 보내되 흔적을 남긴다.
      console.error("subscriptions insert failed:", insErr.message, {
        paymentKey: payment.paymentKey,
        orderId,
      });
      return NextResponse.json(
        {
          message:
            "구독 생성 실패 — 결제는 승인되었으니 고객센터로 문의주세요",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "정기결제 등록 완료",
      amount: plan.amount,
      nextBillingAt: nextAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof TossError) {
      console.error("[Toss billing] ", e.code, e.message);
      return NextResponse.json(
        { message: e.message, code: e.code },
        { status: e.status },
      );
    }
    console.error("[Toss billing] unexpected", e);
    return NextResponse.json(
      { message: "정기결제 등록 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
