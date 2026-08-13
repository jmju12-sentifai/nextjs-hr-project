import { NextRequest, NextResponse } from "next/server";
import { generateAppSpecPreview, type SpecRefFile } from "@/lib/ai-parser";
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
    const { files } = await req.json();
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "files (참고 문서 1개 이상) 필요" },
        { status: 400 }
      );
    }
    const valid = (files as any[]).every(
      (f) => f && f.fileBase64 && f.mimeType && f.name
    );
    if (!valid) {
      return NextResponse.json(
        { error: "각 파일은 fileBase64, mimeType, name 을 가져야 합니다" },
        { status: 400 }
      );
    }
    const preview = await withUsage(
      ADMIN_CTX(auth, "spec_preview"),
      () => generateAppSpecPreview(files as SpecRefFile[])
    );
    return NextResponse.json(preview);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "preview error" },
      { status: 500 }
    );
  }
}
