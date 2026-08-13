// LLM 토큰 사용 계측 — 호출 1건 = llm_usage 1행.
//
// 설계 의도
//   ai-parser.ts 는 순수 라이브러리라 "누가·어느 앱에서" 부른 건지 모른다.
//   함수 시그니처에 ctx 를 넘기려면 4,600줄 파일의 호출부를 전부 고쳐야 하므로,
//   AsyncLocalStorage 로 요청 컨텍스트를 주입한다. API 라우트가 withUsage() 로 감싸기만 하면
//   그 안에서 일어나는 모든 trackedGenerate() 가 컨텍스트를 자동으로 집어 간다.
//
// 기록은 await 한다 (fire-and-forget 금지)
//   Vercel 서버리스는 응답 직후 함수를 얼려버려 백그라운드 INSERT 가 유실된다.
//   대신 실패는 삼켜서, 로깅 문제가 사용자 응답을 막지 않게 한다.

import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/admin";

export type Surface = "app" | "builder";

export type UsageOperation =
  | "llm_summary"
  | "parse_document"
  | "generate_spec"
  | "spec_stage"
  | "spec_preview"
  | "parse_spec";

export type UsageCtx = {
  userId?: string | null;
  userEmail?: string | null;
  isAdmin?: boolean;
  surface: Surface;
  operation: UsageOperation;
  appId?: string | null;
};

const store = new AsyncLocalStorage<UsageCtx>();

/** API 라우트에서 LLM 을 부르는 구간을 감싼다. 안쪽의 trackedGenerate 가 이 컨텍스트를 쓴다. */
export function withUsage<T>(ctx: UsageCtx, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

export function currentUsageCtx(): UsageCtx | undefined {
  return store.getStore();
}

// ── 입력 정리 ──────────────────────────────────────────────
// appId·surface 는 클라이언트가 힌트로 보낸다(빌더의 미리보기도 같은 라우트를 쓰기 때문).
// 반면 user_id·is_admin·토큰 수는 전부 서버가 정하므로 조작할 수 없다.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeAppId(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}

export function sanitizeSurface(v: unknown): Surface {
  return v === "builder" ? "builder" : "app";
}

// service_role 클라이언트는 LLM 호출마다 새로 만들 필요가 없어 한 번만 생성해 재사용한다.
// 키가 없으면(운영 미설정 등) 여기서 던지지만 호출부가 모두 try/catch 로 삼킨다.
let adminClient: ReturnType<typeof createAdminClient> | null = null;
function admin() {
  if (!adminClient) adminClient = createAdminClient();
  return adminClient;
}

// ── 앱 이름 스냅샷 ─────────────────────────────────────────
// 앱이 삭제돼도 원장에 이름이 남도록 기록 시점에 한 번 조회해 함께 넣는다.
// 같은 앱을 반복 호출하므로 프로세스 메모리에 캐시한다.
const appNameCache = new Map<string, string | null>();

async function resolveAppName(appId: string | null): Promise<string | null> {
  if (!appId) return null;
  if (appNameCache.has(appId)) return appNameCache.get(appId) ?? null;
  try {
    const { data } = await admin()
      .from("apps")
      .select("name")
      .eq("id", appId)
      .maybeSingle();
    const name = (data as any)?.name ?? null;
    appNameCache.set(appId, name);
    return name;
  } catch {
    return null;
  }
}

// ── 기록 ───────────────────────────────────────────────────

type UsageRow = {
  user_id: string | null;
  user_email: string | null;
  is_admin: boolean;
  surface: Surface;
  operation: string;
  app_id: string | null;
  app_name: string | null;
  model: string;
  prompt_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  duration_ms: number;
  status: "ok" | "error";
  error_message: string | null;
};

async function insertUsage(row: UsageRow): Promise<void> {
  try {
    const { error } = await admin().from("llm_usage").insert(row);
    if (error) throw new Error(error.message);
  } catch (e: any) {
    // 로깅 실패가 사용자 응답을 막으면 안 된다 — 서버 로그에만 남긴다.
    console.error("[llm_usage] 기록 실패:", e?.message || e);
  }
}

function modelNameOf(model: any): string {
  const raw = String(model?.model || process.env.GEMINI_MODEL || "unknown");
  return raw.replace(/^models\//, ""); // SDK 는 "models/gemini-..." 형태로 담고 있다
}

/**
 * model.generateContent() 를 대신 호출하고 토큰 사용량을 기록한다.
 * req 는 SDK 가 받는 형태 그대로 통과시킨다 (문자열 / {contents:[...]} 둘 다 가능).
 */
export async function trackedGenerate(model: any, req: any): Promise<any> {
  const ctx = store.getStore();
  const t0 = Date.now();
  const modelName = modelNameOf(model);

  const base = {
    user_id: ctx?.userId ?? null,
    user_email: ctx?.userEmail ?? null,
    is_admin: ctx?.isAdmin ?? false,
    surface: ctx?.surface ?? "app",
    // 컨텍스트 없이 호출된 경로가 있으면 'unattributed' 로 드러나게 둔다 (조용히 버리지 않음)
    operation: ctx?.operation ?? "unattributed",
    app_id: ctx?.appId ?? null,
    model: modelName,
  };

  try {
    const res = await model.generateContent(req);
    const u = res?.response?.usageMetadata;
    await insertUsage({
      ...base,
      app_name: await resolveAppName(base.app_id),
      prompt_tokens: u?.promptTokenCount ?? 0,
      output_tokens: u?.candidatesTokenCount ?? 0,
      cached_tokens: u?.cachedContentTokenCount ?? 0,
      total_tokens: u?.totalTokenCount ?? 0,
      duration_ms: Date.now() - t0,
      status: "ok",
      error_message: null,
    });
    return res;
  } catch (e: any) {
    // 실패한 호출도 토큰이 과금되는 경우가 있고, 오류율 자체가 운영 지표라 함께 남긴다.
    await insertUsage({
      ...base,
      app_name: await resolveAppName(base.app_id),
      prompt_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
      duration_ms: Date.now() - t0,
      status: "error",
      error_message: String(e?.message || e).slice(0, 500),
    });
    throw e;
  }
}
