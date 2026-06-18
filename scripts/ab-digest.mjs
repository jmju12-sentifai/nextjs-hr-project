// 파싱(digest) 단계 A/B — 현재 flash vs Pro 로 같은 문서를 읽고 시간·출력 비교.
// 앱의 generateDigest 와 동일한 프롬프트·설정(thinkingBudget 0)을 그대로 재현.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync } from "node:fs";

const KEY = (readFileSync(".env.local", "utf8").match(/GEMINI_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) throw new Error("GEMINI_API_KEY 없음");

const DIGEST_PROMPT = `당신은 인사 자동화 앱 기획을 위한 "문서 정리 전문가" 입니다.
아래 [참고 문서]들을 **빠짐없이 정확히** 읽고, 앱 기획에 필요한 모든 정보를 구조화된 한국어 텍스트로 정리하세요.

# 반드시 담을 것
- **회사 정책 값**: 기준액·지급액·비율·연령·한도·기한·등급 기준 등 (숫자·단위 그대로, 절대 깨지지 않게).
- **분류 체계와 모든 분류값**: 예) 경조분류 = 사망/결혼/출산/입학. 빠짐없이 나열.
- **개인 정보 항목**: 성명·사번·생년월일·금액 등 임직원이 입력/업로드하는 값.
- **계산 로직·판정 규칙**: 금액 산식, 구간표, 조건 분기, 신청 자격/기한 규칙.
- 각 정보가 **어느 문서에서** 왔는지 표시.

# 형식
- 순수 마크다운 텍스트 (JSON 아님, 코드블록 금지).
- 스캔/이미지 문서의 표·숫자는 OCR 로 정확히 읽되 값이 깨지지 않게 주의 (예: 생년월일·금액).
- 추측으로 지어내지 말 것. 문서에 있는 것만. 모호하면 "(불명확)" 표기.

이제 [참고 문서]를 읽고 정리본을 출력하세요.`;

const file = process.argv[2] || "samples/spec-wagepeak-multipath.png";
const b64 = readFileSync(file).toString("base64");
const parts = [
  { text: DIGEST_PROMPT },
  { text: "\n\n===== [참고 문서] =====" },
  { text: "\n[참고 문서 1]\n" },
  { inlineData: { mimeType: "image/png", data: b64 } },
];

const genAI = new GoogleGenerativeAI(KEY);

async function run(modelId, thinkingBudget) {
  const cfg = { maxOutputTokens: 65536, temperature: 0.2 };
  if (thinkingBudget !== undefined) cfg.thinkingConfig = { thinkingBudget };
  const model = genAI.getGenerativeModel({ model: modelId, generationConfig: cfg });
  const t0 = Date.now();
  try {
    const res = await model.generateContent({ contents: [{ role: "user", parts }] });
    const sec = (Date.now() - t0) / 1000;
    const text = (res.response.text() || "").trim();
    const um = res.response.usageMetadata || {};
    return {
      modelId,
      thinkingBudget,
      sec,
      ok: true,
      chars: text.length,
      promptTokens: um.promptTokenCount,
      outputTokens: um.candidatesTokenCount,
      thoughtTokens: um.thoughtsTokenCount,
      totalTokens: um.totalTokenCount,
      finishReason: res.response.candidates?.[0]?.finishReason,
      text,
    };
  } catch (e) {
    return { modelId, thinkingBudget, sec: (Date.now() - t0) / 1000, ok: false, error: String(e?.message || e) };
  }
}

const runs = [
  ["gemini-3.5-flash", 0],          // 현재 (앱 그대로)
  ["gemini-3.1-pro-preview", 0],    // Pro + thinking off (앱 설정 그대로)
  ["gemini-3.1-pro-preview", undefined], // Pro + thinking 기본값
];

console.log(`문서: ${file}  (${(readFileSync(file).length / 1024).toFixed(0)}KB)\n`);
const out = [];
for (const [m, tb] of runs) {
  process.stdout.write(`▶ ${m} (thinking=${tb === undefined ? "default" : tb}) ... `);
  const r = await run(m, tb);
  out.push(r);
  if (r.ok) {
    console.log(`${r.sec.toFixed(1)}s | out ${r.chars}자 | tok in=${r.promptTokens} out=${r.outputTokens} think=${r.thoughtTokens ?? 0} | ${r.finishReason}`);
    const fn = `/tmp/digest-${m.replace(/[.\-]/g, "_")}-tb${tb}.md`;
    writeFileSync(fn, r.text);
    console.log(`   → ${fn}`);
  } else {
    console.log(`FAIL (${r.sec.toFixed(1)}s): ${r.error}`);
  }
}
writeFileSync("/tmp/ab-digest-summary.json", JSON.stringify(out.map(({ text, ...m }) => m), null, 2));
console.log("\n요약: /tmp/ab-digest-summary.json");
