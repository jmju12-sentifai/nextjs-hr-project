import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TOSS_API = "https://api.tosspayments.com/v1/payments/confirm";

// 결제 최소 금액 검증 (도용·치환 방지 이중 안전망). Toss도 검증하지만 서버에서 한번 더.
const MIN_AMOUNT = 1000;
const KNOWN_PLANS = new Set([
  { plan: "coach", min: 1000 },
  { plan: "coach-plus", min: 40000 },
] as any);

export async function POST(req: Request) {
  const { paymentKey, orderId, amount } = await req.json();
  if (!paymentKey || !orderId || typeof amount !== "number") {
    return NextResponse.json({ message: "필수 파라미터 누락" }, { status: 400 });
  }
  if (amount < MIN_AMOUNT) {
    return NextResponse.json({ message: "결제 금액이 유효하지 않습니다" }, { status: 400 });
  }

  // 1) 본인 인증 — 쿠키 기반 supabase로 user 확보
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다" }, { status: 401 });
  }

  // 2) Idempotency — 같은 paymentKey가 이미 처리되었으면 중복 insert 차단
  const admin = createAdminClient();
  {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("payment_key", paymentKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ message: "이미 처리된 결제입니다" }, { status: 409 });
    }
  }

  // 3) Toss 결제 승인
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { message: "결제 설정 오류 (TOSS_SECRET_KEY 미설정)" },
      { status: 500 }
    );
  }
  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  const res = await fetch(TOSS_API, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? "결제 승인 실패", code: data?.code },
      { status: res.status }
    );
  }

  // 4) Toss 응답 측 amount와 사용자가 보낸 amount 재확인 (변조 방지)
  if (typeof data.totalAmount === "number" && data.totalAmount !== amount) {
    return NextResponse.json(
      { message: "결제 금액 불일치" },
      { status: 400 }
    );
  }

  // 5) 구독 행 생성 — service-role 키로 RLS 우회. 사용자가 직접 만들 수 없게 함.
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  const plan = amount >= 40000 ? "coach-plus" : "coach";

  const { error: insErr } = await admin.from("subscriptions").insert({
    user_id: user.id,
    plan,
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status: "active",
    expires_at: expiresAt.toISOString(),
  });
  if (insErr) {
    console.error("subscriptions insert failed:", insErr.message);
    return NextResponse.json(
      { message: "구독 생성 실패 — 결제는 승인되었으니 고객센터로 문의주세요" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "승인 완료", payment: data });
}
