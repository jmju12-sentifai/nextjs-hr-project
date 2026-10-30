import { NextRequest, NextResponse } from "next/server";
import { validateReportGuide } from "app-renderer";
import { requireAdmin } from "@/lib/api-auth";
import { readReportGuide } from "@/lib/report-guide";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readReportGuide(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "공통 가이드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const guide: unknown = await req.json().catch(() => null);
  if (!validateReportGuide(guide)) return NextResponse.json({ error: "가이드 설정을 확인해 주세요. 강조색은 흰색과의 명암비가 충분한 어두운 색을 선택해 주세요." }, { status: 400 });
  try {
    const { error } = await createAdminClient().from("site_settings").upsert({
      key: "report_guide", value: guide, updated_at: new Date().toISOString(), updated_by: auth.user.id,
    });
    if (error) return NextResponse.json({ error: ["42P01", "PGRST205"].includes(error.code)
      ? "공통 가이드 저장 준비가 필요합니다. 운영 담당자에게 문의해 주세요."
      : "가이드를 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
    return NextResponse.json({ guide, available: true });
  } catch {
    return NextResponse.json({ error: "가이드를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
