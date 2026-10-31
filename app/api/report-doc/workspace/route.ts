import { NextRequest, NextResponse } from "next/server";
import { stableJson } from "app-renderer";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeAppId } from "@/lib/llm-usage";
import { reportSavedDoc, validWorkspace } from "@/lib/report-workspace";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const appId = sanitizeAppId(req.nextUrl.searchParams.get("appId"));
  const pathId = req.nextUrl.searchParams.get("pathId");
  if (!appId || !pathId) return NextResponse.json({ error: "앱과 조건을 확인해 주세요." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: app, error: appError } = await db.from("apps").select("app_schema").eq("id", appId).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const { data, error } = await db.from("report_editor_workspaces").select("workspace,revision")
      .eq("app_id", appId).eq("user_id", auth.user.id).eq("path_id", pathId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ workspace: data?.workspace || null, revision: data?.revision || 0,
      userId: auth.user.id, savedDoc: reportSavedDoc(app.app_schema, pathId) });
  } catch { return NextResponse.json({ error: "작업 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const text = await req.text();
    if (text.length > 2_000_000) return NextResponse.json({ error: "작업 기록이 너무 큽니다." }, { status: 413 });
    const input = JSON.parse(text);
    const appId = sanitizeAppId(input.appId);
    if (!appId || typeof input.pathId !== "string" || !Number.isInteger(input.revision) || input.revision < 0)
      return NextResponse.json({ error: "작업 기록을 확인해 주세요." }, { status: 400 });
    const db = createAdminClient();
    const { data: app, error: appError } = await db.from("apps").select("app_schema").eq("id", appId).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    if (!validWorkspace(input.workspace, app.app_schema, input.pathId))
      return NextResponse.json({ error: "앱 구성에 저장하지 않은 변경이 있습니다. 빌더에서 먼저 저장해 주세요." }, { status: 422 });
    if (input.workspace.savedDoc !== reportSavedDoc(app.app_schema, input.pathId))
      return NextResponse.json({ error: "저장된 양식이 변경되었습니다. 새로고침해 최신 작업을 확인해 주세요." }, { status: 409 });
    const row = { workspace: input.workspace, revision: input.revision + 1, updated_at: new Date().toISOString() };
    // 여러 탭의 자동 저장이 서로의 최신 작업을 덮어쓰지 않는다.
    const query = input.revision === 0
      ? db.from("report_editor_workspaces").insert({ ...row, app_id: appId, user_id: auth.user.id, path_id: input.pathId })
      : db.from("report_editor_workspaces").update(row).eq("app_id", appId).eq("user_id", auth.user.id).eq("path_id", input.pathId).eq("revision", input.revision);
    const { data, error } = await query.select("revision").maybeSingle();
    if (error?.code === "23505" || (!error && !data)) {
      const latest = await db.from("report_editor_workspaces").select("workspace,revision")
        .eq("app_id", appId).eq("user_id", auth.user.id).eq("path_id", input.pathId).maybeSingle();
      // 새로고침 직전 전송과 복원 재전송이 겹쳐도 같은 내용이면 저장 성공이다.
      if (!latest.error && latest.data && stableJson(latest.data.workspace) === stableJson(input.workspace))
        return NextResponse.json({ revision: latest.data.revision });
      return NextResponse.json({ error: "다른 탭에서 작업이 저장되었습니다. 새로고침해 이어서 편집해 주세요." }, { status: 409 });
    }
    if (error) throw error;
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "작업 기록을 보관하지 못했습니다. 현재 화면의 내용은 유지됩니다." }, { status: 503 }); }
}
