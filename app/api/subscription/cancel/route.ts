import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 정기결제 해지.
 *
 * 구독 행을 지우지 않는다. auto_renew 만 내려 다음 회차 청구를 멈추고,
 * 이미 결제된 기간(expires_at)까지는 계속 이용하게 둔다.
 * 이미 받은 돈에 해당하는 서비스는 제공하는 것이 환불정책과도 맞는다.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("id, expires_at, auto_renew")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!sub) {
    return NextResponse.json(
      { message: "해지할 구독이 없습니다" },
      { status: 404 },
    );
  }
  if (!sub.auto_renew) {
    return NextResponse.json({
      message: "이미 해지 신청된 구독입니다",
      expiresAt: sub.expires_at,
    });
  }

  const { error: updErr } = await admin
    .from("subscriptions")
    .update({
      auto_renew: false,
      canceled_at: new Date().toISOString(),
      // 빌링키는 더 쓰지 않으므로 지운다. 카드 정보를 필요 이상으로 들고 있지 않는다.
      billing_key: null,
    })
    .eq("id", sub.id);

  if (updErr) {
    return NextResponse.json({ message: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "정기결제가 해지되었습니다",
    expiresAt: sub.expires_at,
  });
}
