import { NextRequest, NextResponse } from "next/server";
import { generateAppSpecDoc, type SpecRefFile } from "@/lib/ai-parser";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
// 참고 문서 여러 개를 LLM 으로 종합하므로 시간이 걸릴 수 있음
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
    const result = await generateAppSpecDoc(files as SpecRefFile[]);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "generate error" },
      { status: 500 }
    );
  }
}
