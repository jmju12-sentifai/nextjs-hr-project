import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAdmin } from "@/lib/api-auth";
import { readReportGuide } from "@/lib/report-guide";
import { checkProposals, proposalContext, PROPOSAL_INSTRUCTION } from "@/lib/report-proposals";
import { sanitizeAppId, trackedGenerate, withUsage } from "@/lib/llm-usage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.text();
  if (body.length > 250_000) return NextResponse.json({ error: "앱 구성이 너무 큽니다." }, { status: 413 });
  let input;
  try {
    input = JSON.parse(body);
    if (!input.schema?.meta || !Array.isArray(input.schema.vars) || typeof input.pathId !== "string"
      || (input.purpose && !["print", "screen", "review"].includes(input.purpose))) throw new Error();
    proposalContext(input.schema, input.pathId, { accent: "#1858f2", defaultPurpose: "print", required: [], banned: [], tone: "" });
  } catch { return NextResponse.json({ error: "앱 구성과 선택한 경로를 확인해 주세요." }, { status: 400 }); }
  try {
    const { guide, available } = await readReportGuide();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "AI 연결 설정이 필요합니다. 운영 담당자에게 문의해 주세요." }, { status: 503 });
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash", systemInstruction: PROPOSAL_INSTRUCTION,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } } as any,
    }, { timeout: 45_000 });
    const context = JSON.stringify(proposalContext(input.schema, input.pathId, guide, input.purpose));
    const result = await withUsage({ userId: auth.user.id, userEmail: auth.user.email, isAdmin: true,
      surface: "builder", operation: "doc_propose", appId: sanitizeAppId(input.appId) }, async () => {
      let feedback = "";
      let checked: ReturnType<typeof checkProposals> = { proposals: [], rejected: [] };
      const accepted = new Map<string, (typeof checked.proposals)[number]>();
      // 한 번만 재시도해 검증 실패를 고칠 기회를 주되 비용과 대기시간을 제한한다.
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await trackedGenerate(model, context + feedback);
        let raw: unknown;
        try { raw = JSON.parse(response.response.text()); } catch { raw = null; }
        checked = checkProposals(raw, input.schema, input.pathId, guide);
        checked.proposals.forEach(p => accepted.set(p.id, p));
        if (accepted.size === 3) break;
        feedback = "\n이전 응답:\n" + JSON.stringify(raw) + "\n검증 오류를 고쳐 세 안 전체를 다시 작성하세요:\n" + checked.rejected.join("\n");
      }
      return { proposals: ["print", "screen", "review"].flatMap(id => accepted.has(id) ? [accepted.get(id)!] : []),
        rejected: checked.rejected.filter(message => !Array.from(accepted.values()).some(p => message.startsWith(`${p.name}:`))) };
    });
    if (!result.proposals.length) return NextResponse.json({ error: "검증을 통과한 양식이 없습니다. 필수 표현이 이 앱의 계산에 맞는지 공통 가이드를 확인한 뒤 다시 시도해 주세요." }, { status: 422 });
    return NextResponse.json({ ...result, guide, available });
  } catch (error) {
    console.error("[report-doc/propose]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "양식 제안을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
