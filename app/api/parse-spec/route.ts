import { NextRequest, NextResponse } from "next/server";
import { parseAppSpec } from "@/lib/ai-parser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
