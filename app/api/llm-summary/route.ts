import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  try {
    const { meta, context, prompt } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY 누락" },
        { status: 500 }
      );
    }

    const lines: string[] = [];
    if (meta?.appName) lines.push(`앱 이름: ${meta.appName}`);
    if (meta?.purpose) lines.push(`목적: ${meta.purpose}`);
    if (meta?.problem) lines.push(`해결 문제: ${meta.problem}`);
    if (meta?.users) lines.push(`사용자: ${meta.users}`);
    const overview = lines.join("\n") || "(개요 없음)";

    const ctxLines: string[] = (context || []).map(
      (c: { name: string; value: string; unit?: string }) =>
        `- ${c.name}: ${c.value}${c.unit ? c.unit : ""}`
    );
    const ctxText = ctxLines.length ? ctxLines.join("\n") : "(분석 대상 값 없음)";

    const system = `당신은 HR 규정 적용 결과를 분석하는 분석가입니다.
[앱 개요]를 맥락으로, [산출 값]을 종합해 사용자에게 의미 있는 한국어 리포트를 정확히 3줄로 작성하세요.
- 1줄: 핵심 판정/결과 요약 (수치·단위 그대로 인용)
- 2줄: 그 결과가 사용자에게 갖는 의미·해석 (왜 그런지, 무엇을 뜻하는지)
- 3줄: 다음 행동 제안 또는 유의사항
- 줄마다 80자 내외
- 인사말·머리말·번호·따옴표·markdown 금지, 본문만
- 정확히 3줄 (빈 줄 없이)`;

    const user = `[앱 개요]
${overview}

[산출 값]
${ctxText}

${prompt ? `[추가 지시]\n${prompt}\n` : ""}3줄 리포트:`;

    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({ model: MODEL, systemInstruction: system });
    const r = await model.generateContent(user);
    const raw = (r.response.text() || "").trim();
    const outLines = raw
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const text = outLines.join("\n");

    return NextResponse.json({ summary: text });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "llm error" },
      { status: 500 }
    );
  }
}
