import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { stableJson, validateDoc } from "app-renderer";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readReportGuide } from "@/lib/report-guide";
import { proposalContext, PROPOSAL_INSTRUCTION } from "@/lib/report-proposals";
import { ADVICE_INSTRUCTION, applyEditResult, applySuggestion, asksForAdvice, checkAdvice, EDIT_INSTRUCTION, INTENT_INSTRUCTION, REFUSAL } from "@/lib/report-edit";
import { saveDraft } from "@/lib/report-versions";
import { sanitizeAppId, withUsage } from "@/lib/llm-usage";

import { ReportAIError, reportAIJson, reportFailure, reportFailureResponse, type ReportStage } from "@/lib/report-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.text();
  if (body.length > 350_000) return NextResponse.json({ error: "문서 구성이 너무 큽니다." }, { status: 413 });
  let input: any;
  try {
    input = JSON.parse(body);
    if (!sanitizeAppId(input.appId) || typeof input.pathId !== "string" || typeof input.message !== "string"
      || !input.message.trim() || input.message.length > 2000 || !input.schema?.vars
      || (input.selectedBlockId !== undefined && typeof input.selectedBlockId !== "string")) throw new Error();
    if (!validateDoc(input.schema, input.pathId, input.doc, { previous: input.doc }).ok) throw new Error();
    if (input.selectedBlockId && !input.doc.blocks.some((b: any) => b.id === input.selectedBlockId)) throw new Error();
  } catch { return NextResponse.json({ error: "저장된 앱과 편집할 문서를 확인해 주세요." }, { status: 400 }); }
  const selected = input.doc.blocks.find((b: any) => b.id === input.selectedBlockId);
  if (selected?.locked) return NextResponse.json({ kind: "refuse", reason: "locked", reply: REFUSAL });
  const requestId = randomUUID();
  const deadline = Date.now() + 90_000;
  let stage: ReportStage = "load";
  try {
    const { data: app, error } = await createAdminClient().from("apps").select("id").eq("id", input.appId).maybeSingle();
    if (error) throw error;
    if (!app) return NextResponse.json({ error: "앱을 먼저 저장해 주세요." }, { status: 404 });
    const { guide } = await readReportGuide();
    if (input.suggestion !== undefined) {
      const original = input.doc.blocks.find((b: any) => b.id === input.suggestion?.blockId);
      if (!original || stableJson(original) !== stableJson(input.suggestionSourceBlock))
        return NextResponse.json({ error: "제안 후 문서가 바뀌었습니다. 다시 추천받아 주세요." }, { status: 409 });
      const edited = applySuggestion(input.schema, input.pathId, input.doc, input.suggestion, guide, input.selectedBlockId);
      if (!edited.ok) return NextResponse.json({ kind: "refuse", reply: edited.error });
      if (!edited.changes.length) return NextResponse.json({ kind: "unchanged", reply: "이미 같은 표현이 적용되어 있습니다." });
      stage = "save";
      const saved = await saveDraft(input.appId, input.pathId, edited.doc, input.message, auth.user.id);
      return NextResponse.json({ kind: "edit", ...edited, ...saved, reply: `‘${original.title || "선택한 항목"}’에 선택한 표현을 반영했습니다.` });
    }
    if (!process.env.GEMINI_API_KEY) throw new ReportAIError("AI_CONFIGURATION", "intent");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const config = { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } } as any;
    const history = Array.isArray(input.history) ? input.history.slice(-6).filter((m: any) => ["user", "assistant"].includes(m?.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) })) : [];
    const result = await withUsage({ userId: auth.user.id, userEmail: auth.user.email, isAdmin: true, surface: "builder", operation: "doc_edit", appId: input.appId }, async () => {
      stage = "intent";
      const intent = await reportAIJson({ stage, requestId, deadline, timeoutMs: 20_000,
        model: timeout => client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash", systemInstruction: INTENT_INSTRUCTION,
          generationConfig: { ...config, maxOutputTokens: 500 } }, { timeout }),
        prompt: JSON.stringify({ message: input.message, history, doc: input.doc, selectedBlock: selected || null, lockedBlocks: input.doc.blocks.filter((b: any) => b.locked) }),
        parse: raw => {
          const value = (raw as any)?.intent;
          if (!["advice", "layout", "wording", "style", "data", "logic", "locked", "other"].includes(value)) throw new Error("invalid intent");
          return value as string;
        },
      });
      // 분류가 끝나기 전에는 수정 모델을 호출하지 않는다.
      if (["data", "logic", "locked"].includes(String(intent))) return { kind: "refuse" as const, reason: String(intent), reply: REFUSAL };
      const context = { context: proposalContext(input.schema, input.pathId, guide), doc: input.doc,
        message: input.message, selectedBlockId: input.selectedBlockId, history };
      if (intent === "advice" || intent === "other" || asksForAdvice(input.message)) {
        stage = "advice";
        return reportAIJson({ stage, requestId, deadline, timeoutMs: 30_000,
          model: timeout => client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            systemInstruction: PROPOSAL_INSTRUCTION + "\n이제 전체 양식 생성이 아닌 대화 상담입니다. 이하 상담 출력 규칙만 따릅니다.\n" + ADVICE_INSTRUCTION,
            generationConfig: { ...config, maxOutputTokens: 6000 } }, { timeout }),
          prompt: JSON.stringify(context),
          parse: raw => checkAdvice(raw, input.schema, input.pathId, input.doc, guide, input.selectedBlockId),
        });
      }
      if (!["layout", "wording", "style"].includes(String(intent))) return { kind: "refuse" as const, reason: String(intent), reply: REFUSAL };
      let feedback = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        stage = "edit";
        const raw: any = await reportAIJson({ stage, requestId, deadline, timeoutMs: 30_000,
          model: timeout => client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            systemInstruction: PROPOSAL_INSTRUCTION + "\n이제 전체 양식 생성이 아닌 기존 문서 편집 작업입니다. 이하 편집 출력 규칙을 따릅니다.\n" + EDIT_INSTRUCTION,
            generationConfig: { ...config, maxOutputTokens: 12000 } }, { timeout }),
          prompt: JSON.stringify(context) + feedback,
          parse: raw => { if (!(raw as any)?.doc) throw new Error("invalid edit"); return raw; },
        });
        const edited = applyEditResult(input.schema, input.pathId, input.doc, raw?.doc, guide, input.selectedBlockId);
        if (edited.ok) {
          if (!edited.changes.length) return { kind: "unchanged" as const, reply: "요청을 확인했지만 반영할 변경이 없습니다. 수정할 부분과 원하는 표현을 조금 더 구체적으로 알려주세요." };
          stage = "save";
          const saved = await saveDraft(input.appId, input.pathId, edited.doc, input.message, auth.user.id);
          return { kind: "edit" as const, ...edited, ...saved, reply: `${edited.changes.length}곳을 수정했습니다. 미리보기와 변경 내역을 확인해 주세요.` };
        }
        feedback = "\n이전 응답:\n" + JSON.stringify(raw) + "\n검증 오류를 수정하세요:\n" + edited.error;
      }
      return { kind: "refuse" as const, reason: "validation", reply: "요청한 변경이 문서 검증을 통과하지 못해 원본을 유지했습니다. 요청을 나누거나 수정할 블록을 선택해 다시 시도해 주세요." };
    });
    return NextResponse.json(result);
  } catch (e) {
    const failure = reportFailure(e, stage);
    const response = reportFailureResponse(failure);
    console.error("[report-doc/edit]", JSON.stringify({ requestId, stage: failure.stage, code: failure.code, retried: failure.retried, providerStatus: failure.providerStatus }));
    return NextResponse.json({ error: response.message, code: failure.code, stage: failure.stage, requestId }, { status: response.status });
  }
}
