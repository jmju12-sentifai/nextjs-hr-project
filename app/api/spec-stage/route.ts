import { NextRequest, NextResponse } from "next/server";
import { runSpecStage, type SpecRefFile, type SpecStage } from "@/lib/ai-parser";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
// 각 단계가 별도 요청 — Hobby 60초 캡은 요청당 적용되므로 단계마다 이 안에 들어옴.
export const maxDuration = 60;

const VALID: SpecStage[] = ["digest", "meta", "varsReg", "varsPer", "paths", "report"];

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const stage = body?.stage as SpecStage;
    if (!stage || !VALID.includes(stage)) {
      return NextResponse.json(
        { error: `stage 는 ${VALID.join("|")} 중 하나여야 합니다` },
        { status: 400 }
      );
    }
    if (stage === "digest") {
      const files = body?.files;
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
    }
    const result = await runSpecStage({
      stage,
      files: body?.files as SpecRefFile[] | undefined,
      digest: body?.digest,
      meta: body?.meta,
      vars: body?.vars,
      paths: body?.paths,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "stage error" },
      { status: 500 }
    );
  }
}
