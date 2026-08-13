import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/ai-parser";
import { requireUser } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import {
  withUsage,
  sanitizeAppId,
  sanitizeSurface,
} from "@/lib/llm-usage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { fileBase64, mimeType, slots, appId, surface } = await req.json();
    if (!fileBase64 || !mimeType || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "fileBase64, mimeType, slots 필요" },
        { status: 400 }
      );
    }
    const result = await withUsage(
      {
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        isAdmin: isAdminEmail(auth.user.email),
        surface: sanitizeSurface(surface),
        operation: "parse_document",
        appId: sanitizeAppId(appId),
      },
      () => parseDocument(fileBase64, mimeType, slots)
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "parse error" }, { status: 500 });
  }
}
