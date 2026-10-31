import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeAppId } from "@/lib/llm-usage";
import { reportCalculationKey, reportSavedDoc } from "@/lib/report-workspace";
import { proposalContext } from "@/lib/report-proposals";
import { generateReportProposals, ProposalError } from "@/lib/report-proposal-generator";
import type { ReportProposalJob } from "@/lib/report-proposal-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const scope = (db: ReturnType<typeof createAdminClient>, appId: string, userId: string, pathId: string) =>
  db.from("report_proposal_jobs").select("*").eq("app_id", appId).eq("user_id", userId).eq("path_id", pathId);
async function currentJob(db: ReturnType<typeof createAdminClient>, appId: string, userId: string, pathId: string) {
  const { data, error } = await scope(db, appId, userId, pathId).maybeSingle();
  if (error) throw error;
  if (data?.status === "running" && Date.now() - Date.parse(data.started_at) > 130_000) {
    // 실행 환경이 강제 종료되어도 무한 로딩 대신 재시도할 수 있다.
    const expired = await db.from("report_proposal_jobs").update({ status: "failed", error: "양식 생성 시간이 초과됐습니다. 다시 제안받아 주세요." })
      .eq("id", data.id).eq("status", "running").select("*").maybeSingle();
    if (expired.error) throw expired.error;
    return expired.data || (await scope(db, appId, userId, pathId).maybeSingle()).data;
  }
  return data as ReportProposalJob | null;
}
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const appId = sanitizeAppId(req.nextUrl.searchParams.get("appId"));
  const pathId = req.nextUrl.searchParams.get("pathId");
  if (!appId || !pathId) return NextResponse.json({ error: "앱과 조건을 확인해 주세요." }, { status: 400 });
  try { return NextResponse.json({ job: await currentJob(createAdminClient(), appId, auth.user.id, pathId) }); }
  catch { return NextResponse.json({ error: "양식 생성 상태를 불러오지 못했습니다. 다시 확인하고 있습니다." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const text = await req.text();
  if (text.length > 250_000) return NextResponse.json({ error: "앱 구성이 너무 큽니다." }, { status: 413 });
  let input;
  try {
    input = JSON.parse(text);
    if (!sanitizeAppId(input.appId) || typeof input.pathId !== "string" || input.pathId.length > 200) throw new Error();
    proposalContext(input.schema, input.pathId, { accent: "#1858f2", defaultPurpose: "print", required: [], banned: [], tone: "" });
  } catch { return NextResponse.json({ error: "앱을 먼저 저장하고 조건을 확인해 주세요." }, { status: 400 }); }
  try {
    const db = createAdminClient();
    const { data: app, error } = await db.from("apps").select("app_schema").eq("id", input.appId).maybeSingle();
    if (error) throw error;
    if (!app) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const calculation = reportCalculationKey(input.schema);
    if (calculation !== reportCalculationKey(app.app_schema)) return NextResponse.json({ error: "앱 구성이 변경되었습니다. 빌더에서 먼저 저장해 주세요." }, { status: 422 });
    const previous = await currentJob(db, input.appId, auth.user.id, input.pathId);
    if (previous?.status === "running") return NextResponse.json({ job: previous }, { status: 202 });
    const path = [...(input.schema.paths || []), ...(input.schema.fallback ? [input.schema.fallback] : [])].find(p => p.id === input.pathId);
    const job = { id: randomUUID(), status: "running", calculation, saved_doc: reportSavedDoc(app.app_schema, input.pathId),
      source_doc: path?.doc || null, result: null, error: null, started_at: new Date().toISOString() };
    // 동시 클릭/여러 탭의 요청 중 하나만 작업을 확보한다.
    const write = previous
      ? db.from("report_proposal_jobs").update(job).eq("id", previous.id).eq("status", previous.status)
      : db.from("report_proposal_jobs").insert({ ...job, app_id: input.appId, user_id: auth.user.id, path_id: input.pathId });
    const claimed = await write.select("*").maybeSingle();
    if (claimed.error?.code === "23505" || (!claimed.error && !claimed.data))
      return NextResponse.json({ job: await currentJob(db, input.appId, auth.user.id, input.pathId) }, { status: 202 });
    if (claimed.error) throw claimed.error;
    // 응답 연결이 끊겨도 Vercel이 작업을 유지하고 결과를 DB에 남긴다.
    waitUntil((async () => {
      let outcome;
      try { outcome = { status: "completed", result: await generateReportProposals(input, auth.user), error: null }; }
      catch (e) { outcome = { status: "failed", error: e instanceof ProposalError ? e.message : "양식 생성에 실패했습니다. 다시 제안받아 주세요." }; }
      const finished = await db.from("report_proposal_jobs").update(outcome).eq("id", job.id).eq("status", "running");
      if (finished.error) console.error("[report-proposal-job] result persistence failed", finished.error.code);
    })().catch(() => { console.error("[report-proposal-job] background persistence failed"); }));
    return NextResponse.json({ job: claimed.data }, { status: 202 });
  } catch { return NextResponse.json({ error: "양식 생성을 시작하지 못했습니다. 다시 시도해 주세요." }, { status: 503 }); }
}
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!sanitizeAppId(id)) return NextResponse.json({ error: "작업을 확인해 주세요." }, { status: 400 });
  const { error } = await createAdminClient().from("report_proposal_jobs").update({ status: "cancelled" }).eq("id", id).eq("user_id", auth.user.id).eq("status", "running");
  if (error) return NextResponse.json({ error: "생성을 취소하지 못했습니다." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
