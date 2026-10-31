import { NextRequest, NextResponse } from "next/server";
import { migrateSchema, stableJson, validateDoc } from "app-renderer";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readReportGuide } from "@/lib/report-guide";
import { isMissingVersionStore } from "@/lib/report-versions";
import { sanitizeAppId } from "@/lib/llm-usage";

function calculationSchema(raw: any) {
  const schema = migrateSchema(raw);
  const path = (p: any) => { const { doc, ...rest } = p; return rest; };
  return stableJson({ ...schema, paths: schema.paths?.map(path), fallback: schema.fallback && path(schema.fallback) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.text();
    if (body.length > 500_000) return NextResponse.json({ error: "문서 구성이 너무 큽니다." }, { status: 413 });
    const input = JSON.parse(body);
    if (!sanitizeAppId(input.appId) || typeof input.pathId !== "string") return NextResponse.json({ error: "앱과 경로를 확인해 주세요." }, { status: 400 });
    const { guide } = await readReportGuide();
    const db = createAdminClient();
    const { data: app, error: appError } = await db.from("apps").select("app_schema").eq("id", input.appId).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    // 다른 탭이나 관리자가 바꾼 앱을 덮어쓰지 않는다. RPC 안에서도 같은 비교를 수행한다.
    if (stableJson(app.app_schema) !== stableJson(input.savedSchema))
      return NextResponse.json({ error: "저장된 앱이 변경되었습니다. 초안을 복사한 뒤 앱을 새로고침해 주세요." }, { status: 409 });
    if (calculationSchema(input.schema) !== calculationSchema(app.app_schema))
      return NextResponse.json({ error: "변수나 계산 구성에 저장하지 않은 변경이 있습니다. 빌더에서 먼저 저장한 뒤 다시 열어 주세요." }, { status: 409 });
    const checked = validateDoc(app.app_schema, input.pathId, input.doc, { previous: input.doc, guide });
    if (!checked.ok) return NextResponse.json({ error: checked.errors[0].message }, { status: 422 });
    const { data, error } = await db.rpc("confirm_report_doc", { p_app_id: input.appId, p_path_id: input.pathId,
      p_doc: input.doc, p_expected_schema: input.savedSchema, p_actor: auth.user.id });
    if (isMissingVersionStore(error)) return NextResponse.json({ error: "버전 저장소 준비가 필요해 저장하지 못했습니다. 작업 내용은 유지됩니다." }, { status: 503 });
    if (error?.message.includes("SCHEMA_CONFLICT")) return NextResponse.json({ error: "다른 작업에서 앱이 변경되었습니다. 새로고침 후 다시 확인해 주세요." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "양식을 저장하지 못했습니다. 작업 내용은 유지됩니다." }, { status: 503 }); }
}
