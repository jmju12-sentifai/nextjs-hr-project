import { currentUsageCtx, trackedGenerate, withUsage } from "./llm-usage";

export type ReportStage = "load" | "intent" | "advice" | "edit" | "save";
export type ReportFailureCode = "AI_TIMEOUT" | "AI_RATE_LIMIT" | "AI_UNAVAILABLE" | "AI_CONNECTION" | "AI_CONFIGURATION" | "AI_INVALID_RESPONSE" | "DOCUMENT_LOAD_FAILED" | "DRAFT_SAVE_FAILED" | "INTERNAL_ERROR";
export class ReportAIError extends Error {
  constructor(public code: ReportFailureCode, public stage: ReportStage, public retried = false, public providerStatus?: number) {
    super(code); this.name = "ReportAIError";
  }
}
export function reportFailure(error: unknown, stage: ReportStage): ReportAIError {
  if (error instanceof ReportAIError) return error;
  if (stage === "save") return new ReportAIError("DRAFT_SAVE_FAILED", stage);
  if (stage === "load") return new ReportAIError("DOCUMENT_LOAD_FAILED", stage);
  const e = error as { name?: string; message?: string; status?: number } | null;
  const status = e?.status;
  const message = e?.message || "";
  if (e?.name === "AbortError" || /aborted|timed?\s*out|timeout/i.test(message)) return new ReportAIError("AI_TIMEOUT", stage, false, status);
  if (status === 429) return new ReportAIError("AI_RATE_LIMIT", stage, false, status);
  if (status && status >= 500) return new ReportAIError("AI_UNAVAILABLE", stage, false, status);
  if (status && [400, 401, 403, 404].includes(status)) return new ReportAIError("AI_CONFIGURATION", stage, false, status);
  if (/fetch failed|error fetching|network|ECONN|ENOTFOUND/i.test(message)) return new ReportAIError("AI_CONNECTION", stage, false, status);
  if (e?.name === "SyntaxError") return new ReportAIError("AI_INVALID_RESPONSE", stage);
  return new ReportAIError("INTERNAL_ERROR", stage, false, status);
}
const transient = new Set<ReportFailureCode>(["AI_TIMEOUT", "AI_RATE_LIMIT", "AI_UNAVAILABLE", "AI_CONNECTION", "AI_INVALID_RESPONSE"]);

/** AI 호출만 재시도한다. DB 저장은 중복 실행하지 않고 전체 요청의 시간 예산을 지킨다. */
export async function reportAIJson<T>(options: {
  stage: "intent" | "advice" | "edit"; requestId: string; deadline: number; timeoutMs: number;
  model: (timeout: number) => any; prompt: string; parse: (raw: unknown) => T;
}): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = options.deadline - Date.now();
    if (remaining < 1000) throw new ReportAIError("AI_TIMEOUT", options.stage, attempt > 1);
    const timeout = Math.min(options.timeoutMs, remaining);
    const trace = { requestId: options.requestId, stage: options.stage, attempt, timeoutMs: timeout };
    const start = Date.now();
    try {
      const response = await withUsage({ ...currentUsageCtx()!, trace }, () => trackedGenerate(options.model(timeout), options.prompt));
      let parsed: T;
      try { parsed = options.parse(JSON.parse(response.response.text())); }
      catch { throw new ReportAIError("AI_INVALID_RESPONSE", options.stage); }
      console.info("[report-ai]", JSON.stringify({ ...trace, durationMs: Date.now() - start, outcome: "ok", finishReason: response.response.candidates?.[0]?.finishReason }));
      return parsed;
    } catch (error) {
      const failure = reportFailure(error, options.stage);
      failure.retried = attempt > 1;
      const retry = attempt === 1 && transient.has(failure.code) && options.deadline - Date.now() > 4000;
      console.error("[report-ai]", JSON.stringify({ ...trace, durationMs: Date.now() - start, code: failure.code, providerStatus: failure.providerStatus, retry }));
      if (!retry) throw failure;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  throw new ReportAIError("INTERNAL_ERROR", options.stage);
}

export function reportFailureResponse(failure: ReportAIError) {
  const step = failure.stage === "intent" ? "요청 내용을 확인하는" : failure.stage === "advice" ? "추천 내용을 준비하는" : "문서를 수정하는";
  const unchanged = " 현재 문서는 변경하지 않았습니다.";
  switch (failure.code) {
    case "AI_TIMEOUT": return { status: 504, message: `${step} AI의 응답 시간이 초과됐습니다.${unchanged} 다시 보내 주세요.` };
    case "AI_RATE_LIMIT": return { status: 429, message: `AI 서비스의 요청 한도에 도달했습니다.${unchanged} 잠시 후 다시 보내 주세요.` };
    case "AI_UNAVAILABLE": return { status: 503, message: `AI 서비스가 일시적으로 요청을 처리하지 못했습니다.${unchanged} 잠시 후 다시 보내 주세요.` };
    case "AI_CONNECTION": return { status: 503, message: `AI 서비스에 연결하지 못했습니다.${unchanged} 잠시 후 다시 보내 주세요.` };
    case "AI_CONFIGURATION": return { status: 503, message: `AI 연결 설정에 문제가 있어 요청을 처리하지 못했습니다.${unchanged} 관리자에게 문의해 주세요.` };
    case "AI_INVALID_RESPONSE": return { status: 502, message: `${step} AI 응답을 읽을 수 없어 반영하지 않았습니다.${unchanged} 다시 보내 주세요.` };
    case "DOCUMENT_LOAD_FAILED": return { status: 503, message: `편집에 필요한 앱 정보를 불러오지 못했습니다.${unchanged} 다시 보내 주세요.` };
    case "DRAFT_SAVE_FAILED": return { status: 503, message: `수정안의 작업 기록을 저장하지 못해 화면에 반영하지 않았습니다. 현재 문서는 유지됩니다. 다시 보내 주세요.` };
    default: return { status: 500, message: `요청 처리 중 내부 오류가 발생했습니다.${unchanged} 다시 시도해도 반복되면 관리자에게 문의해 주세요.` };
  }
}
