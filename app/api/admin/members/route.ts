import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_STATES } from "@/lib/members/types";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const params = new URL(req.url).searchParams,
    page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1)),
    q = (params.get("q") || "").trim().slice(0, 200),
    state = params.get("state") || "";
  const admin = createAdminClient();
  let query = admin
    .from("admin_member_overview")
    .select("*", { count: "exact" });
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (state in MEMBER_STATES) query = query.eq("state", state);
  const [list, ...counts] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1),
    ...["all", ...Object.keys(MEMBER_STATES)].map((s) => {
      let c = admin
        .from("admin_member_overview")
        .select("id", { count: "exact", head: true });
      return s === "all" ? c : c.eq("state", s);
    }),
  ]);
  if (list.error || counts.some((c) => c.error))
    return NextResponse.json(
      { error: "회원 목록을 불러오지 못했습니다. 다시 시도해 주세요." },
      { status: 503 },
    );
  return NextResponse.json(
    {
      members: list.data,
      total: list.count,
      page,
      counts: Object.fromEntries(
        ["all", ...Object.keys(MEMBER_STATES)].map((s, i) => [
          s,
          counts[i].count,
        ]),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
