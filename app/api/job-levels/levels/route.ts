import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withUsage } from "@/lib/llm-usage";
import { generateAreaLevels } from "@/lib/job-levels/generate";
import { MAX_LEVEL } from "@/lib/job-levels/levels";

export const runtime = "nodejs";
// 영역 하나씩 별도 요청으로 받는다 — 요청당 60초 제한 안에 들어오게 하려는 분할이다.
export const maxDuration = 60;

// 성과영역 1개 → L1~상한 레벨 문장 (관리자 전용)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const jobName = String(body?.jobName ?? "").trim().slice(0, 80);
    const industry = String(body?.industry ?? "").trim().slice(0, 200);
    const name = String(body?.area?.name ?? "").trim().slice(0, 40);
    const target = String(body?.area?.target ?? "").trim().slice(0, 160);
    const ceiling = Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(body?.area?.ceiling) || 0)));
    const otherAreas = (Array.isArray(body?.otherAreas) ? body.otherAreas : [])
      .map((s: unknown) => String(s ?? "").trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
    if (!jobName || !name || !ceiling) {
      return NextResponse.json({ error: "직무명, 영역 이름, 상한 레벨이 필요합니다" }, { status: 400 });
    }
    const result = await withUsage(
      {
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        isAdmin: true,
        surface: "builder",
        operation: "job_levels_sentences",
        appId: null,
      },
      () => generateAreaLevels({ jobName, industry, area: { name, target, ceiling }, otherAreas }),
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "문장을 만들지 못했습니다" }, { status: 500 });
  }
}
