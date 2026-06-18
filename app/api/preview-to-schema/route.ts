import { NextRequest, NextResponse } from "next/server";
import { previewToAppSchema } from "@/lib/ai-parser";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// 프리뷰(JSON) → AppSchema 즉시 변환. LLM 호출 없음 — 빠름.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const { preview } = await req.json();
    if (!preview || typeof preview !== "object") {
      return NextResponse.json({ error: "preview 가 필요합니다" }, { status: 400 });
    }
    const schema = previewToAppSchema(preview);
    return NextResponse.json(schema);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "convert error" },
      { status: 500 }
    );
  }
}
