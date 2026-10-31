import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberActionError, memberOverview } from "@/lib/members/server";
import { reconcilePending } from "@/lib/members/billing";
import { endOfKoreanDate } from "@/lib/members/types";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (!uuid.test(params.userId))
    return NextResponse.json(
      { error: "회원을 찾을 수 없습니다." },
      { status: 404 },
    );
  const admin = createAdminClient(),
    p = new URL(req.url).searchParams,
    pp = Math.max(1, Math.min(100000, Number(p.get("paymentsPage")) || 1)),
    ap = Math.max(1, Math.min(100000, Number(p.get("actionsPage")) || 1));
  try {
    await reconcilePending(params.userId).catch(() => {});
    const [member, payments, grants, note, actions, usage, pending] =
      await Promise.all([
        memberOverview(params.userId),
        admin
          .from("payments")
          .select(
            "id,kind,amount,status,order_id,receipt_url,error,created_at",
            { count: "exact" },
          )
          .eq("user_id", params.userId)
          .order("created_at", { ascending: false })
          .order("id")
          .range((pp - 1) * 10, pp * 10 - 1),
        admin
          .from("subscription_grants")
          .select(
            "id,starts_at,ends_at,reason,granted_by,revoked_at,revoked_by",
          )
          .eq("user_id", params.userId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("member_notes")
          .select("note,updated_at,updated_by")
          .eq("user_id", params.userId)
          .maybeSingle(),
        admin
          .from("admin_actions")
          .select("id,actor_email,action,detail,created_at", { count: "exact" })
          .eq("target_user_id", params.userId)
          .order("created_at", { ascending: false })
          .order("id")
          .range((ap - 1) * 10, ap * 10 - 1),
        admin.rpc("member_usage", { p_user: params.userId }),
        admin
          .from("billing_attempts")
          .select("id,created_at,error")
          .eq("user_id", params.userId)
          .in("state", ["pending", "processing"])
          .maybeSingle(),
      ]);
    if (!member)
      return NextResponse.json(
        { error: "회원을 찾을 수 없습니다." },
        { status: 404 },
      );
    if ([payments, grants, note, actions, usage, pending].some((r) => r.error))
      throw new Error();
    return NextResponse.json(
      {
        member,
        payments: payments.data,
        paymentsTotal: payments.count,
        grants: grants.data,
        note: note.data,
        actions: actions.data,
        actionsTotal: actions.count,
        usage: usage.data,
        pending: pending.data,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "회원 정보를 불러오지 못했습니다. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
export async function POST(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  if (
    !uuid.test(params.userId) ||
    !body ||
    !uuid.test(body.requestId || "") ||
    !["grant", "revoke", "cancel", "expiry", "terminate", "note"].includes(
      body.action,
    )
  )
    return NextResponse.json(
      { error: "입력 내용을 확인해 주세요." },
      { status: 400 },
    );
  const data: Record<string, unknown> = {};
  if (body.action === "note") {
    if (typeof body.note !== "string" || body.note.length > 5000)
      return NextResponse.json(
        { error: "메모는 5,000자까지 입력할 수 있습니다." },
        { status: 400 },
      );
    data.note = body.note;
  } else {
    if (
      typeof body.reason !== "string" ||
      !body.reason.trim() ||
      body.reason.length > 500
    )
      return NextResponse.json(
        { error: "처리 사유를 500자 이내로 입력해 주세요." },
        { status: 400 },
      );
    data.reason = body.reason.trim();
    if (!body.expected || typeof body.expected !== "object")
      return NextResponse.json(
        { error: "화면을 새로고침한 뒤 다시 처리해 주세요." },
        { status: 409 },
      );
    data.expected = body.expected;
    if (body.action === "grant") {
      if (!["1", "3", "custom", "unlimited"].includes(body.duration))
        return NextResponse.json(
          { error: "무료 제공 기간을 선택해 주세요." },
          { status: 400 },
        );
      data.duration = body.duration;
    }
    if (body.action === "revoke") {
      if (!uuid.test(body.grantId || ""))
        return NextResponse.json(
          { error: "무료 제공 내역을 선택해 주세요." },
          { status: 400 },
        );
      data.grantId = body.grantId;
    }
    if (
      body.action === "expiry" ||
      (body.action === "grant" && body.duration === "custom")
    ) {
      try {
        data.endsAt = endOfKoreanDate(body.endsAt);
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 400 },
        );
      }
    }
  }
  const { error } = await createAdminClient().rpc("manage_member", {
    p_user: params.userId,
    p_actor: auth.user.email || auth.user.id,
    p_action: body.action,
    p_data: data,
    p_request: body.requestId,
  });
  if (error) {
    console.error("[members/manage]", {
      code: error.code,
      action: body.action,
    });
    return NextResponse.json(
      { error: memberActionError(error) },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
