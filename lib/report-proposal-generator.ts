import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppSchema } from "app-renderer";
import { readReportGuide } from "./report-guide";
import { checkProposals, proposalContext, PROPOSAL_INSTRUCTION } from "./report-proposals";
import { sanitizeAppId, trackedGenerate, withUsage } from "./llm-usage";

export class ProposalError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function generateReportProposals(input: { schema: AppSchema; pathId: string; appId?: string; purpose?: "print" | "screen" | "review" }, user: { id: string; email?: string | null }) {
  const { guide, available } = await readReportGuide();
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProposalError("AI 연결 설정이 필요합니다. 운영 담당자에게 문의해 주세요.", 503);
  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash", systemInstruction: PROPOSAL_INSTRUCTION,
    generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } } as any,
  }, { timeout: 45_000 });
  const context = JSON.stringify(proposalContext(input.schema, input.pathId, guide, input.purpose));
  const result = await withUsage({ userId: user.id, userEmail: user.email, isAdmin: true,
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
  if (!result.proposals.length) throw new ProposalError("검증을 통과한 양식이 없습니다. 공통 가이드를 확인한 뒤 다시 시도해 주세요.", 422);
  return { ...result, guide, available };
}
