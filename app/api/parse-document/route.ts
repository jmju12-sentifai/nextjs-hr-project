import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/ai-parser";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { fileBase64, mimeType, slots } = await req.json();
    if (!fileBase64 || !mimeType || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "fileBase64, mimeType, slots 필요" },
        { status: 400 }
      );
    }
    const result = await parseDocument(fileBase64, mimeType, slots);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "parse error" }, { status: 500 });
  }
}
