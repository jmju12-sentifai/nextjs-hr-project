import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppSchema } from "app-renderer";
import { readReportGuide } from "./report-guide";
import { checkProposals, proposalContext, PROPOSAL_INSTRUCTION } from "./report-proposals";
import { sanitizeAppId, trackedGenerate, withUsage } from "./llm-usage";
import { basicReportProposals } from "./report-proposal-fallback";

export class ProposalError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function generateReportProposals(input: { schema: AppSchema; pathId: string; appId?: string; purpose?: "print" | "screen" | "review" }, user: { id: string; email?: string | null }) {
  const { guide, available } = await readReportGuide();
  const key = process.env.GEMINI_API_KEY;

  const model = key ? new GoogleGenerativeAI(key).getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash", systemInstruction: PROPOSAL_INSTRUCTION,
    generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } } as any,
  }, { timeout: 45_000 }) : null;
  const context = JSON.stringify(proposalContext(input.schema, input.pathId, guide, input.purpose));
  const result = await withUsage({ userId: user.id, userEmail: user.email, isAdmin: true,
    surface: "builder", operation: "doc_propose", appId: sanitizeAppId(input.appId) }, async () => {
    let feedback = "";
    let checked: ReturnType<typeof checkProposals> = { proposals: [], rejected: [] };
    const accepted = new Map<string, (typeof checked.proposals)[number]>();
    const diagnostics: { attempt: number; rejected: string[] }[] = [];
    // 보정 기회는 한 번으로 제한하고 남은 안은 검증된 기본 구성으로 보완한다.
    for (let attempt = 0; model && attempt < 2; attempt++) {
      let raw: unknown;
      try {
        const response = await trackedGenerate(model, context + feedback);
        try { raw = JSON.parse(response.response.text()); } catch { raw = null; }
      } catch {
        diagnostics.push({ attempt: attempt + 1, rejected: ["AI 연결 응답을 받지 못했습니다."] });
        break;
      }
      checked = checkProposals(raw, input.schema, input.pathId, guide);
      diagnostics.push({ attempt: attempt + 1, rejected: checked.rejected });
      checked.proposals.forEach(p => accepted.set(p.id, p));
      if (accepted.size === 3) break;
      feedback = "\n이전 응답:\n" + JSON.stringify(raw) + "\n검증 오류를 고쳐 세 안 전체를 다시 작성하세요:\n" + checked.rejected.join("\n");
    }
    const basic = accepted.size < 3 ? basicReportProposals(input.schema, input.pathId, guide) : { proposals: [], rejected: [] };
    const basicIds: string[] = [];
    for (const p of basic.proposals) if (!accepted.has(p.id)) { accepted.set(p.id, p); basicIds.push(p.id); }
    return { proposals: ["print", "screen", "review"].flatMap(id => accepted.has(id) ? [accepted.get(id)!] : []),
      basicIds, diagnostics, rejected: basic.rejected };
  });
  if (!result.proposals.length) throw new ProposalError("필수 항목과 보호된 문구를 함께 담을 수 없어 새 양식을 준비하지 못했습니다. 기존 작업은 유지됩니다.", 422);
  return { ...result, guide, available };
}
