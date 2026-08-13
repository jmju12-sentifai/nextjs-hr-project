import { NextRequest, NextResponse } from "next/server";
import { parseAppSpec } from "@/lib/ai-parser";
import { requireAdmin } from "@/lib/api-auth";
import { withUsage, type UsageOperation } from "@/lib/llm-usage";

// 관리자 빌더에서 부르는 LLM 호출의 사용량 컨텍스트 (requireAdmin 통과 = 관리자 확정)
const ADMIN_CTX = (
  auth: { user: { id: string; email?: string | null } },
  operation: UsageOperation
) => ({
  userId: auth.user.id,
  userEmail: auth.user.email ?? null,
  isAdmin: true,
  surface: "builder" as const,
  operation,
  appId: null,
});

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
    const result = await withUsage(
      ADMIN_CTX(auth, "parse_spec"),
      () => parseAppSpec(fileBase64, mimeType)
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "parse error" }, { status: 500 });
  }
}
