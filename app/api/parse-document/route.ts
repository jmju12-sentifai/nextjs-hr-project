import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/ai-parser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
