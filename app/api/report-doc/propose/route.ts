import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { proposalContext } from "@/lib/report-proposals";
import { generateReportProposals, ProposalError } from "@/lib/report-proposal-generator";

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
    return NextResponse.json(await generateReportProposals(input, auth.user));
  } catch (error) {
    if (error instanceof ProposalError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[report-doc/propose]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "양식 제안을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
