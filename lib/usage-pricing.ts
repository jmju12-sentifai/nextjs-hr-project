// Google 유료 Standard 요금, USD / 100만 토큰. 음성·검색·캐시 보관료는 제외한다.
// 공식 가격표를 확인한 날짜와 함께 관리해 모델별 비용을 섞지 않는다.
export const PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
export const PRICING_CHECKED_AT = "2026-11-01";
export const DEFAULT_USAGE_FX = 1400; // 원가 비교용 기준값이며 실시간 환율이 아니다.
export const MODEL_PRICES: Record<string, { input: number; output: number; cached: number }> = {
  "gemini-2.5-flash": { input: 0.30, output: 2.50, cached: 0.03 },
  "gemini-3.5-flash": { input: 1.50, output: 9.00, cached: 0.15 },
};

export function modelPrice(model: string) {
  const key = model.replace(/^models\//, "");
  return Object.hasOwn(MODEL_PRICES, key) ? MODEL_PRICES[key] : undefined;
}

export function usageCostUsd(row: {
  model: string; prompt_tokens: number; output_tokens: number; cached_tokens: number;
}): number | null {
  const prompt = Math.max(0, row.prompt_tokens);
  const output = Math.max(0, row.output_tokens);
  // 실패하여 사용량이 없는 호출은 모델 단가가 없어도 비용 0이다.
  if (prompt === 0 && output === 0) return 0;
  const price = modelPrice(row.model);
  if (!price) return null; // 모르는 모델을 다른 모델의 가격으로 계산하지 않는다.
  const cached = Math.min(prompt, Math.max(0, row.cached_tokens));
  return ((prompt - cached) * price.input + cached * price.cached + output * price.output) / 1e6;
}

export function usageFx(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value : DEFAULT_USAGE_FX;
}
