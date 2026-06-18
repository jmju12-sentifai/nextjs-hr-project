import { NextResponse } from "next/server";
import { generateAppSpecPreview } from "@/lib/ai-parser";

export const runtime = "nodejs";
export const maxDuration = 200;

// TEMP dev-only — thinking off 적용 후 실제 generateAppSpecPreview 시간 재측정. Delete after use.
export async function GET() {
  const txt1 = `[임금피크제 운영세칙]\n최초적용연령: 56세\n정년: 60세\n감액률: 56세 0%, 57세 0%, 58세 20%, 59세 30%, 60세 40%\n통상임금 = 기본급 + 고정수당\n최저임금 하한 보장`;
  const txt2 = `[임직원 인사정보]\n성명, 사번, 생년월일, 입사일, 소속, 직급, 기본급, 고정수당`;
  const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");
  const files: any = [
    { name: "세칙.txt", mimeType: "text/plain", fileBase64: b64(txt1) },
    { name: "인사정보.txt", mimeType: "text/plain", fileBase64: b64(txt2) },
  ];
  const t0 = Date.now();
  try {
    const pv = await generateAppSpecPreview(files);
    return NextResponse.json({ 초: ((Date.now() - t0) / 1000).toFixed(1), vars: (pv.vars || []).length, paths: (pv.paths || []).length });
  } catch (e: any) {
    return NextResponse.json({ 초: ((Date.now() - t0) / 1000).toFixed(1), error: e?.message });
  }
}
