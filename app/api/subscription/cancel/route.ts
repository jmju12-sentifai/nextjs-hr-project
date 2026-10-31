import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberActionError } from "@/lib/members/server";
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await createAdminClient().rpc("manage_member", {
    p_user: auth.user.id,
    p_actor: auth.user.email || "회원",
    p_action: "cancel",
    p_data: { reason: "회원 본인 해지" },
    p_request: crypto.randomUUID(),
  });
  if (error)
    return NextResponse.json(
      { message: memberActionError(error) },
      { status: 409 },
    );
  return NextResponse.json({
    message: "자동결제를 중지했습니다. 결제한 기간까지 이용할 수 있습니다.",
  });
}
