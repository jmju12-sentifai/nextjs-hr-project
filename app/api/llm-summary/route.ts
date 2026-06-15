import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireActiveSubscription } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const auth = await requireActiveSubscription();
  if ("error" in auth) return auth.error;
  try {
    const { meta, context, prompt } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY 누락" },
        { status: 500 }
      );
    }

    // 메타는 도메인 힌트 정도로만 — 앱 소개를 베껴 쓰지 않게 최소화
    const overview = meta?.appName ? `도메인: ${meta.appName}` : "";

    const ctxLines: string[] = (context || []).map(
      (c: { name: string; value: string; unit?: string }) =>
        `- ${c.name} = ${c.value}${c.unit ? c.unit : ""}`
    );
    const hasUsableValues = ctxLines.length > 0 &&
      (context || []).some((c: any) => {
        const v = String(c?.value ?? "").trim();
        return v !== "" && v !== "—" && v !== "null" && v !== "undefined";
      });
    const ctxText = hasUsableValues ? ctxLines.join("\n") : "(분석할 산출 값이 없습니다)";

    const system = `당신은 임직원 본인 한 명의 산출 결과를 그 본인에게 풀어 설명해 주는 안내 도우미입니다.

# 가장 중요 — 절대 규칙
- 출력은 **반드시 [본인 산출 값] 에 들어있는 실제 수치·라벨을 직접 인용**해서 그 한 명의 결과를 설명해야 한다.
- ❌ 앱 소개·서비스 설명·일반론·기능 안내·운영 가치(효율성·정확성·신속성·규정 준수 등) 금지.
- ❌ "지원받으실", "산출해 드립니다", "안내해 드립니다" 같이 **앱의 기능을 설명하는 문장** 금지.
- ✅ "본인의 경조이벤트유형은 결혼이며, 결혼 축의금 1,000,000원이 지급됩니다." 같이 **그 본인 케이스의 실제 값을 인용**.
- 산출 값에 등장한 모든 의미 있는 항목(분류값·금액·일수 등) 을 본문에 직접 인용하라. 인용 못 하면 그 줄은 만들지 마라.
- [본인 산출 값] 이 비어 있거나 "—"·null 만 있으면, 정확히 한 줄로 \`분석할 산출 값이 아직 없습니다.\` 만 출력하라.

# 시점·태도
- **임직원 본인에게 말하듯이** 작성 — "본인의 / 귀하의 ... 입니다".
- 관리자/HR/시스템/도구 관점, 명령조("~하십시오") 금지.
- 안내·설명조("~입니다", "~확인해 주세요", "~참고하세요").

# 구성 (정확히 3줄)
- 1줄: **본인 케이스의 핵심 결과** — [본인 산출 값] 의 분류·금액·일수 등을 직접 인용. 수치·단위 그대로.
- 2줄: 그 결과가 **왜 그렇게 산출됐는지** — [본인 산출 값] 의 분류·조건을 근거로 한 줄 설명.
- 3줄: 본인이 알아둘 다음 행동·유의사항 — 산출 값에 명시되어 있으면 그것, 아니면 일반적 조언(신청 기한 등) 한 줄.

# 형식
- 줄마다 80자 내외, 정확히 3줄, 빈 줄·머리말·번호·따옴표·markdown 금지, 본문만.
- 가능한 모든 줄에 [본인 산출 값] 의 항목을 1개 이상 인용.`;

    const user = `${overview ? `[도메인 힌트 — 톤 결정에만 사용, 베껴 쓰지 말 것]\n${overview}\n\n` : ""}[본인 산출 값 — 반드시 이 값들을 인용해 설명]
${ctxText}

${prompt ? `[추가 지시]\n${prompt}\n` : ""}위 [본인 산출 값] 을 임직원 본인에게 풀어 설명하는 3줄 (산출 값을 직접 인용; 산출 값이 없으면 "분석할 산출 값이 아직 없습니다." 한 줄):`;

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
