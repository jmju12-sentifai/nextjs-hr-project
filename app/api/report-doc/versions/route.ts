import { NextRequest, NextResponse } from "next/server";
import { validateDoc } from "app-renderer";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingVersionStore, saveDraft } from "@/lib/report-versions";
import { readReportGuide } from "@/lib/report-guide";
import { sanitizeAppId } from "@/lib/llm-usage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const appId = sanitizeAppId(req.nextUrl.searchParams.get("appId"));
  const pathId = req.nextUrl.searchParams.get("pathId");
  if (!appId || !pathId) return NextResponse.json({ error: "앱과 경로를 확인해 주세요." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: app, error: appError } = await db.from("apps").select("app_schema").eq("id", appId).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const { data, error } = await db.from("report_doc_versions").select("id,version,doc,note,status,created_at")
      .eq("app_id", appId).eq("path_id", pathId).order("version", { ascending: false }).limit(40);
    if (error && !isMissingVersionStore(error)) throw error;
    return NextResponse.json({ versions: data || [], storage: error ? "unavailable" : "server", savedSchema: app.app_schema });
  } catch { return NextResponse.json({ error: "이전 버전을 불러오지 못했습니다." }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.text();
    if (body.length > 350_000) return NextResponse.json({ error: "문서 구성이 너무 큽니다." }, { status: 413 });
    const input = JSON.parse(body);
    if (!sanitizeAppId(input.appId) || typeof input.pathId !== "string" || !["restore", "lock"].includes(input.action))
      return NextResponse.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    const { guide } = await readReportGuide();
    let doc = input.doc;
    if (!validateDoc(input.schema, input.pathId, doc, { previous: doc }).ok)
      return NextResponse.json({ error: "현재 문서를 확인해 주세요." }, { status: 400 });
    if (input.action === "lock") {
      if (typeof input.locked !== "boolean" || !doc.blocks.some((b: any) => b.id === input.blockId)) return NextResponse.json({ error: "블록을 확인해 주세요." }, { status: 400 });
      doc = { ...doc, blocks: doc.blocks.map((b: any) => b.id === input.blockId ? { ...b, locked: input.locked } : b) };
    } else {
      const checked = validateDoc(input.schema, input.pathId, input.targetDoc, { previous: input.doc, guide, proposal: true });
      if (!checked.ok) return NextResponse.json({ error: checked.errors[0].message }, { status: 422 });
      doc = input.targetDoc;
    }
    const result = await saveDraft(input.appId, input.pathId, doc, input.action === "lock" ? (input.locked ? "블록 잠금" : "블록 잠금 해제") : "이전 버전으로 되돌리기", auth.user.id);
    return NextResponse.json({ doc, ...result });
  } catch { return NextResponse.json({ error: "변경 내용을 저장하지 못했습니다." }, { status: 503 }); }
}
