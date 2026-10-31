import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcilePending } from "@/lib/members/billing";
import { memberOverview } from "@/lib/members/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    await reconcilePending(auth.user.id).catch(() => {});
    const admin = createAdminClient(),
      page = Math.max(
        1,
        Math.min(
          100000,
          Number(new URL(req.url).searchParams.get("page")) || 1,
        ),
      );
    const [m, p, pending] = await Promise.all([
      memberOverview(auth.user.id),
      admin
        .from("payments")
        .select("id,kind,amount,status,order_id,receipt_url,error,created_at", {
          count: "exact",
        })
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range((page - 1) * 10, page * 10 - 1),
      admin
        .from("billing_attempts")
        .select("id")
        .eq("user_id", auth.user.id)
        .in("state", ["pending", "processing"])
        .limit(1),
    ]);
    if (!m || p.error || pending.error) throw new Error();
    // 운영 메모·부여 사유·관리자 정보는 회원 응답에 넣지 않는다.
    return NextResponse.json(
      {
        member: {
          state: m.state,
          active: m.active,
          plan: m.plan,
          expires_at: m.expires_at,
          next_billing_at: m.next_billing_at,
          auto_renew: m.auto_renew,
          card_company: m.card_company,
          card_number_masked: m.card_number_masked,
          grant_starts_at: m.grant_starts_at,
          grant_ends_at: m.grant_ends_at,
          grant_id: m.grant_id,
        },
        payments: p.data,
        total: p.count,
        pending: !!pending.data?.length,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "구독 정보를 불러오지 못했습니다. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
