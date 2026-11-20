import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withUsage } from "@/lib/llm-usage";
import { proposeAreas } from "@/lib/job-levels/generate";

export const runtime = "nodejs";
// 영역 제안은 AI 1회 + O*NET 검색이라 60초 안에 끝난다.
export const maxDuration = 60;

// 직무명·KRA → 성과영역 목록·상한·O*NET 참고 직업 제안 (관리자 전용)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const jobName = String(body?.jobName ?? "").trim().slice(0, 80);
    const industry = String(body?.industry ?? "").trim().slice(0, 200);
    const kraText = String(body?.kraText ?? "").trim().slice(0, 4000);
    if (!jobName) {
      return NextResponse.json({ error: "직무명을 입력해 주세요" }, { status: 400 });
    }
    const areas = await withUsage(
      {
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        isAdmin: true,
        surface: "builder",
        operation: "job_levels_areas",
        appId: null,
      },
      () => proposeAreas({ jobName, industry, kraText }),
    );
    return NextResponse.json({ areas });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "성과영역을 만들지 못했습니다" }, { status: 500 });
  }
}
