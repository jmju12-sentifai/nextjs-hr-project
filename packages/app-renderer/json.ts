/** JSONB와 AI 응답의 속성 순서가 달라도 같은 문서로 비교한다. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
    return "{" + fields.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}
