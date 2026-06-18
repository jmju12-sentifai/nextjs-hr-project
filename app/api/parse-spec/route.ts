import { NextRequest, NextResponse } from "next/server";
import { parseAppSpec } from "@/lib/ai-parser";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: "fileBase64, mimeType 필요" }, { status: 400 });
    }
    const result = await parseAppSpec(fileBase64, mimeType);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "parse error" }, { status: 500 });
  }
}
