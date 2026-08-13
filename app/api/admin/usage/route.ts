import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// 관리자 사용량 집계 — 요금제 산정용
//
// 왜 클라이언트가 Supabase 를 직접 읽지 않는가:
//   llm_usage 는 RLS 정책이 하나도 없어 service_role 로만 접근된다.
//   서비스 키를 브라우저로 내보낼 수 없으므로 이 라우트가 대신 읽어 집계해서 내려준다.
//
// 왜 SQL GROUP BY 가 아니라 Node 집계인가:
//   집계 뷰/RPC 를 쓰려면 마이그레이션을 한 번 더 실행해야 한다.
//   현실적인 볼륨(월 수천 행)에서는 Node 집계가 충분히 빠르고 배포가 단순하다.
//   ROW_CAP 을 넘어서면 truncated=true 로 알리고, 그때 SQL 뷰로 옮기면 된다.
//
// 원가(₩) 환산은 여기서 하지 않는다 — 모델 단가는 화면에서 관리자가 입력한다.
// 대신 입력/출력 토큰을 surface(app/builder) 별로 나눠서 내려, 화면이 정확히 곱할 수 있게 한다.
// (입력·출력 단가가 다르고, 관리자 구축분과 사용자 사용분은 성격이 달라 섞으면 안 된다)

const ROW_CAP = 100_000;
const PAGE = 1000;

type UsageRow = {
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  is_admin: boolean;
  surface: string;
  operation: string;
  app_id: string | null;
  app_name: string | null;
  model: string;
  prompt_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  duration_ms: number | null;
  status: string;
};
type RunRow = { created_at: string; user_id: string | null; app_id: string | null };

/** PostgREST 는 한 번에 1000행이 상한이라 끝까지 페이지를 넘겨 가져온다. */
async function fetchAll<T>(
  sb: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string,
  from: string,
  to: string
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let offset = 0; offset < ROW_CAP; offset += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

/** 입력·출력 토큰을 함께 담는 누적기 — 원가는 입력/출력 단가가 달라 반드시 분리해야 한다 */
type Acc = { calls: number; prompt: number; output: number; total: number };
const acc = (): Acc => ({ calls: 0, prompt: 0, output: 0, total: 0 });
function add(a: Acc, r: UsageRow) {
  a.calls++;
  a.prompt += num(r.prompt_tokens);
  a.output += num(r.output_tokens);
  a.total += num(r.total_tokens);
}
/** surface 별로 나눠 담는다 — 관리자 구축분과 사용자 사용분은 요금제에서 쓰임이 다르다 */
type Split = { all: Acc; app: Acc; builder: Acc };
const split = (): Split => ({ all: acc(), app: acc(), builder: acc() });
function addSplit(s: Split, r: UsageRow) {
  add(s.all, r);
  add(r.surface === "builder" ? s.builder : s.app, r);
}
const flat = (s: Split) => ({
  calls: s.all.calls,
  promptTokens: s.all.prompt,
  outputTokens: s.all.output,
  totalTokens: s.all.total,
  appCalls: s.app.calls,
  appPromptTokens: s.app.prompt,
  appOutputTokens: s.app.output,
  appTokens: s.app.total,
  builderCalls: s.builder.calls,
  builderPromptTokens: s.builder.prompt,
  builderOutputTokens: s.builder.output,
  builderTokens: s.builder.total,
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const sp = req.nextUrl.searchParams;
    const days = Math.min(Math.max(parseInt(sp.get("days") || "30", 10) || 30, 1), 3650);
    const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
    const from = sp.get("from")
      ? new Date(sp.get("from")!)
      : new Date(to.getTime() - days * 86400_000);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "기간 형식 오류" }, { status: 400 });
    }
    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    const sb = createAdminClient();

    // 계측 시작 시점 — 이보다 앞선 app_runs 는 토큰 기록이 아예 없다.
    // 이 경계를 무시하고 "실행 1건당 토큰"을 내면 과거 실행이 분모에 섞여 단가가 과소 집계된다.
    const { data: firstRow } = await sb
      .from("llm_usage")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const instrumentedFrom: string | null = (firstRow as any)?.created_at ?? null;

    const [usage, runs, appsRes, subsRes] = await Promise.all([
      fetchAll<UsageRow>(
        sb,
        "llm_usage",
        "created_at,user_id,user_email,is_admin,surface,operation,app_id,app_name,model,prompt_tokens,output_tokens,cached_tokens,total_tokens,duration_ms,status",
        fromISO,
        toISO
      ),
      fetchAll<RunRow>(sb, "app_runs", "created_at,user_id,app_id", fromISO, toISO),
      sb.from("apps").select("id,name,status"),
      sb.from("subscriptions").select("user_id,status,plan,expires_at"),
    ]);

    // app_runs 에는 이메일이 없다. auth 목록에서 채워야 "(알 수 없음)" 으로 남지 않는다.
    const emailOf = new Map<string, string>();
    try {
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        const list = data?.users || [];
        for (const u of list) if (u.email) emailOf.set(u.id, u.email);
        if (list.length < 200) break;
      }
    } catch {
      // 이메일 조회 실패는 치명적이지 않다 — 집계는 그대로 진행한다
    }

    const appName = new Map<string, string>();
    const appStatus = new Map<string, string>();
    for (const a of (appsRes.data || []) as any[]) {
      appName.set(a.id, a.name);
      appStatus.set(a.id, a.status);
    }

    // 활성 구독만 — status 가 'active' 여도 expires_at 이 지났으면 만료로 본다
    const subOf = new Map<string, string>();
    for (const s of (subsRes.data || []) as any[]) {
      if (s.status !== "active") continue;
      if (s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) continue;
      subOf.set(s.user_id, s.plan || "active");
    }

    const U = usage.rows;
    const R = runs.rows;
    const isInstrumented = (t: string) => !instrumentedFrom || t >= instrumentedFrom;
    const Rm = R.filter((r) => isInstrumented(r.created_at));

    // ── 합계 ────────────────────────────────────────────────
    const tot = split();
    for (const r of U) addSplit(tot, r);
    const totals = {
      ...flat(tot),
      errorCalls: U.filter((r) => r.status !== "ok").length,
      runs: R.length,
      instrumentedRuns: Rm.length,
      users: new Set([...U.map((r) => r.user_id), ...R.map((r) => r.user_id)].filter(Boolean)).size,
      apps: (appsRes.data || []).length,
    };

    // ── 사용자별 ────────────────────────────────────────────
    // "어떤 앱을 썼는지" 는 llm_usage 와 app_runs 를 합쳐야 정확하다.
    // run-logic 은 LLM 을 쓰지 않으므로 실행은 있는데 토큰이 0인 앱이 정상적으로 존재한다.
    type UserAgg = {
      userId: string | null; email: string | null; isAdmin: boolean;
      subscription: string | null; s: Split; errorCalls: number;
      runs: number; appIds: Set<string>; lastUsedAt: string | null;
    };
    const users = new Map<string, UserAgg>();
    const ensureUser = (id: string | null, email: string | null, isAdmin: boolean) => {
      const k = id || "(unknown)";
      let u = users.get(k);
      if (!u) {
        u = {
          userId: id, email, isAdmin,
          subscription: id ? subOf.get(id) || null : null,
          s: split(), errorCalls: 0, runs: 0, appIds: new Set(), lastUsedAt: null,
        };
        users.set(k, u);
      }
      if (!u.email && email) u.email = email;
      if (isAdmin) u.isAdmin = true;
      return u;
    };
    for (const r of U) {
      const u = ensureUser(
        r.user_id,
        r.user_email ?? (r.user_id ? emailOf.get(r.user_id) ?? null : null),
        r.is_admin
      );
      addSplit(u.s, r);
      if (r.status !== "ok") u.errorCalls++;
      if (r.app_id) u.appIds.add(r.app_id);
      if (!u.lastUsedAt || r.created_at > u.lastUsedAt) u.lastUsedAt = r.created_at;
    }
    for (const r of R) {
      const u = ensureUser(r.user_id, r.user_id ? emailOf.get(r.user_id) ?? null : null, false);
      u.runs++;
      if (r.app_id) u.appIds.add(r.app_id);
      if (!u.lastUsedAt || r.created_at > u.lastUsedAt) u.lastUsedAt = r.created_at;
    }
    const byUser = [...users.values()]
      .map((u) => ({
        userId: u.userId, email: u.email, isAdmin: u.isAdmin,
        subscription: u.subscription, errorCalls: u.errorCalls, runs: u.runs,
        appCount: u.appIds.size,
        apps: [...u.appIds].map((id) => appName.get(id) || "(삭제된 앱)"),
        lastUsedAt: u.lastUsedAt,
        ...flat(u.s),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || b.runs - a.runs);

    // ── 앱별 ────────────────────────────────────────────────
    type AppAgg = {
      appId: string | null; name: string; status: string | null;
      s: Split; runs: number; instrumentedRuns: number; userIds: Set<string>;
    };
    const apps = new Map<string, AppAgg>();
    const ensureApp = (id: string | null, snapshot: string | null) => {
      const k = id || "(앱 없음)";
      let a = apps.get(k);
      if (!a) {
        a = {
          appId: id,
          name: id ? appName.get(id) || snapshot || "(삭제된 앱)" : "(앱과 무관 — 기획서 등)",
          status: id ? appStatus.get(id) ?? null : null,
          s: split(), runs: 0, instrumentedRuns: 0, userIds: new Set(),
        };
        apps.set(k, a);
      }
      return a;
    };
    // 실행·호출이 한 번도 없던 앱도 0으로 보이도록 전체 앱을 먼저 등록한다.
    for (const a of (appsRes.data || []) as any[]) ensureApp(a.id, a.name);
    for (const r of U) {
      const a = ensureApp(r.app_id, r.app_name);
      addSplit(a.s, r);
      if (r.user_id) a.userIds.add(r.user_id);
    }
    for (const r of R) {
      const a = ensureApp(r.app_id, null);
      a.runs++;
      if (isInstrumented(r.created_at)) a.instrumentedRuns++;
      if (r.user_id) a.userIds.add(r.user_id);
    }
    const byApp = [...apps.values()]
      .map((a) => ({
        appId: a.appId, name: a.name, status: a.status,
        runs: a.runs, instrumentedRuns: a.instrumentedRuns, users: a.userIds.size,
        ...flat(a.s),
        // 요금제 설계에서 가장 중요한 숫자 — 실행 1건당 토큰.
        // 분자는 사용자 사용분만, 분모는 계측 이후 실행만.
        tokensPerRun: a.instrumentedRuns > 0 ? Math.round(a.s.app.total / a.instrumentedRuns) : null,
        promptPerRun: a.instrumentedRuns > 0 ? Math.round(a.s.app.prompt / a.instrumentedRuns) : null,
        outputPerRun: a.instrumentedRuns > 0 ? Math.round(a.s.app.output / a.instrumentedRuns) : null,
      }))
      .sort(
        (a, b) =>
          b.totalTokens - a.totalTokens || b.runs - a.runs || a.name.localeCompare(b.name, "ko")
      );

    // ── 사용자 × 앱 교차 ────────────────────────────────────
    // "이 사용자가 어느 앱을 얼마나" — 화면 드릴다운과 CSV 교차표가 같은 데이터를 쓴다.
    // 활동이 있는 조합만 담는다(희소) — 사용자 × 앱 전체 곱을 만들면 금방 커진다.
    type UA = {
      userId: string | null; email: string | null; isAdmin: boolean;
      appId: string | null; appName: string;
      s: Split; runs: number; lastUsedAt: string | null;
    };
    const ua = new Map<string, UA>();
    const ensureUA = (
      uid: string | null, email: string | null, isAdmin: boolean,
      aid: string | null, snapshot: string | null
    ) => {
      const k = `${uid || "?"}|${aid || "-"}`;
      let x = ua.get(k);
      if (!x) {
        x = {
          userId: uid, email, isAdmin, appId: aid,
          appName: aid
            ? appName.get(aid) || snapshot || "(삭제된 앱)"
            : "(앱과 무관 — 기획서 등)",
          s: split(), runs: 0, lastUsedAt: null,
        };
        ua.set(k, x);
      }
      if (!x.email && email) x.email = email;
      if (isAdmin) x.isAdmin = true;
      return x;
    };
    for (const r of U) {
      const x = ensureUA(
        r.user_id,
        r.user_email ?? (r.user_id ? emailOf.get(r.user_id) ?? null : null),
        r.is_admin, r.app_id, r.app_name
      );
      addSplit(x.s, r);
      if (!x.lastUsedAt || r.created_at > x.lastUsedAt) x.lastUsedAt = r.created_at;
    }
    for (const r of R) {
      const x = ensureUA(
        r.user_id, r.user_id ? emailOf.get(r.user_id) ?? null : null,
        false, r.app_id, null
      );
      x.runs++;
      if (!x.lastUsedAt || r.created_at > x.lastUsedAt) x.lastUsedAt = r.created_at;
    }
    const byUserApp = [...ua.values()]
      .map((x) => ({
        userId: x.userId, email: x.email, isAdmin: x.isAdmin,
        appId: x.appId, appName: x.appName,
        runs: x.runs, lastUsedAt: x.lastUsedAt,
        ...flat(x.s),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || b.runs - a.runs);

    // ── 모델별 ──────────────────────────────────────────────
    const models = new Map<string, { s: Split; errorCalls: number; durSum: number; durN: number }>();
    for (const r of U) {
      let m = models.get(r.model);
      if (!m) { m = { s: split(), errorCalls: 0, durSum: 0, durN: 0 }; models.set(r.model, m); }
      addSplit(m.s, r);
      if (r.status !== "ok") m.errorCalls++;
      if (r.duration_ms != null) { m.durSum += num(r.duration_ms); m.durN++; }
    }
    const byModel = [...models.entries()]
      .map(([model, m]) => ({
        model, errorCalls: m.errorCalls,
        avgDurationMs: m.durN > 0 ? Math.round(m.durSum / m.durN) : null,
        ...flat(m.s),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // ── 관리자 / 사용자 ─────────────────────────────────────
    const bySurface = ["app", "builder"].map((s) => {
      const rows = U.filter((r) => r.surface === s);
      const a = acc();
      for (const r of rows) add(a, r);
      return {
        surface: s, calls: a.calls,
        promptTokens: a.prompt, outputTokens: a.output, totalTokens: a.total,
        users: new Set(rows.map((r) => r.user_id).filter(Boolean)).size,
      };
    });
    const ops = new Map<string, { surface: string; operation: string; a: Acc }>();
    for (const r of U) {
      const k = `${r.surface}|${r.operation}`;
      let o = ops.get(k);
      if (!o) { o = { surface: r.surface, operation: r.operation, a: acc() }; ops.set(k, o); }
      add(o.a, r);
    }
    const byOperation = [...ops.values()]
      .map((o) => ({
        surface: o.surface, operation: o.operation, calls: o.a.calls,
        promptTokens: o.a.prompt, outputTokens: o.a.output, totalTokens: o.a.total,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // ── 월별 추이 ───────────────────────────────────────────
    // 요금제는 '월' 단위로 정해지므로 월별 흐름이 있어야 성장률과 다음 달을 가늠할 수 있다.
    const months = new Map<string, { s: Split; runs: number; users: Set<string> }>();
    const ensureMonth = (iso: string) => {
      const k = iso.slice(0, 7);
      let m = months.get(k);
      if (!m) { m = { s: split(), runs: 0, users: new Set() }; months.set(k, m); }
      return m;
    };
    for (const r of U) {
      const m = ensureMonth(r.created_at);
      addSplit(m.s, r);
      if (r.user_id) m.users.add(r.user_id);
    }
    for (const r of R) {
      const m = ensureMonth(r.created_at);
      m.runs++;
      if (r.user_id) m.users.add(r.user_id);
    }
    const byMonth = [...months.entries()]
      .map(([month, m]) => ({ month, runs: m.runs, users: m.users.size, ...flat(m.s) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ── 요금제 산정용 파생 지표 ─────────────────────────────
    // 관리자 구축분(builder)을 빼고 순수 사용자 사용분만으로 계산해야 단가가 부풀지 않는다.
    const endUsers = byUser.filter((u) => !u.isAdmin && u.appTokens > 0);
    const sorted = endUsers.map((u) => u.appTokens).sort((a, b) => a - b);
    const pct = (p: number) =>
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
    const top10Count = Math.max(1, Math.ceil(endUsers.length * 0.1));
    const endUserTotal = endUsers.reduce((a, u) => a + u.appTokens, 0);
    const top10Tokens = [...endUsers]
      .sort((a, b) => b.appTokens - a.appTokens)
      .slice(0, top10Count)
      .reduce((a, u) => a + u.appTokens, 0);

    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400_000));

    const derived = {
      endUserCount: endUsers.length,
      medianTokensPerUser: pct(0.5),
      p90TokensPerUser: pct(0.9),
      maxTokensPerUser: sorted.length ? sorted[sorted.length - 1] : 0,
      tokensPerRun: Rm.length > 0 ? Math.round(tot.app.total / Rm.length) : null,
      promptPerRun: Rm.length > 0 ? Math.round(tot.app.prompt / Rm.length) : null,
      outputPerRun: Rm.length > 0 ? Math.round(tot.app.output / Rm.length) : null,
      top10SharePct: endUserTotal > 0 ? Math.round((top10Tokens / endUserTotal) * 1000) / 10 : 0,
      instrumentedFrom,
      periodDays,
      // 조회 기간이 30일이 아닐 수 있으므로 월 환산 계수를 함께 내려준다
      monthFactor: 30 / periodDays,
    };

    return NextResponse.json({
      range: { from: fromISO, to: toISO, days },
      totals, derived, byUser, byApp, byUserApp, byModel, bySurface, byOperation, byMonth,
      // 요금제 시뮬레이터가 쓸, 사용자별 '사용자 사용분' 토큰 (관리자 제외)
      endUserTokens: endUsers.map((u) => ({
        email: u.email, prompt: u.appPromptTokens, output: u.appOutputTokens, total: u.appTokens,
      })),
      truncated: usage.truncated || runs.truncated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "집계 실패" }, { status: 500 });
  }
}
