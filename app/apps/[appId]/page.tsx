"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { AppSchema, Grp, Variable } from "app-renderer";
import { activePathOf, fmtU, migrateSchema, run, todayStr } from "app-renderer";
import ElementRenderer from "@/app/admin/builder/components/ElementRenderer";

const PVTABS = [
  ["msaas", "M SaaS 설명", ""],
  ["f1", "기준 지식화", "1"],
  ["f2", "개인 정보 파싱", "2"],
  ["f3", "적용 여부 판단·분석", "3"],
  ["f4", "산출 및 안내", "4"],
] as const;

// 401/402 응답이 오면 사용자에게 알리고 적절한 페이지로 이동시킨다.
// 보안은 서버가 처리; 이 함수는 UX 처리용.
async function handleAuthError(res: Response, currentPath: string): Promise<boolean> {
  if (res.status === 401) {
    alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
    return true;
  }
  if (res.status === 402) {
    alert("구독이 만료·취소되었습니다. 결제 페이지로 이동합니다.");
    window.location.href = `/pricing?next=${encodeURIComponent(currentPath)}`;
    return true;
  }
  return false;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function coerceValue(raw: any, type: string): any {
  if (raw === null || raw === undefined) return null;
  if (type === "number") {
    if (typeof raw === "number") return raw;
    const cleaned = String(raw).replace(/[^\d.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  if (type === "date") {
    const s = String(raw);
    const m = s.match(/(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return s;
  }
  return String(raw);
}

export default function AppPage() {
  const params = useParams<{ appId: string }>();
  const [app, setApp] = useState<{
    id: string;
    name: string;
    version: number;
    app_schema: AppSchema;
  } | null>(null);
  const [pvtab, setPvtab] = useState<string>("msaas");
  const [filled, setFilled] = useState<Record<string, any>>({});
  const [uploads, setUploads] = useState<{ [k in Grp]?: { fname: string; ok: boolean } }>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // f4 진입 시 app_runs 에 1행 기록 (한 세션 1회) — 메타데이터만 저장 (PII 제외)
  const runLogged = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("apps")
          .select("id, name, version, app_schema")
          .eq("id", params.appId)
          .single();
        if (error) throw error;
        setApp(data as any);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.appId]);

  // 빌더의 test 값은 사용 안 함 — 사용자가 업로드/수기 입력으로 채운 값만 반영
  const liveSchema = useMemo<AppSchema | null>(() => {
    if (!app) return null;
    return {
      ...app.app_schema,
      vars: app.app_schema.vars.map((v) => ({
        ...v,
        test: v.name in filled ? String(filled[v.name] ?? "") : "",
      })),
    };
  }, [app, filled]);

  const result = useMemo(() => (liveSchema ? run(liveSchema) : null), [liveSchema]);

  // f4 첫 진입 시 app_runs 1행 기록 (메타데이터만, PII 제외)
  useEffect(() => {
    if (pvtab !== "f4" || runLogged.current || !app || !result) return;
    runLogged.current = true;
    const reqVars = (liveSchema?.vars || []).filter((v) => v.req);
    const filledReq = reqVars.filter(
      (v) =>
        v.name in filled &&
        filled[v.name] !== "" &&
        filled[v.name] !== null &&
        filled[v.name] !== undefined
    );
    const sb = createBrowserSupabase();
    void (async () => {
      try {
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) return; // 비로그인이면 기록 안 함 (layout 가드 통과한 사용자만 도달 가능)
        await sb.from("app_runs").insert({
          app_id: app.id,
          app_version: app.version,
          user_id: user.id,
          status: "viewed_report",
          user_identifier: user.email ?? user.id,
          // input_data 와 result 는 PII 보호를 위해 메타데이터만 — 자유 jsonb
          input_data: {
            vars_total: liveSchema?.vars.length ?? 0,
            vars_required_total: reqVars.length,
            vars_required_filled: filledReq.length,
          },
          result: {
            applied: result.applied,
            active_path_id: result.activePathId,
            active_path_label: result.activePathLabel,
          },
        });
      } catch (e) {
        // fire-and-forget — 실패해도 UX 영향 없음
        console.warn("app_runs log skipped:", e);
      }
    })();
  }, [pvtab, app, liveSchema, filled, result]);

  if (loading) return <main className="p-8">로딩 중...</main>;
  if (err) return <main className="p-8 text-rose-600">에러: {err}</main>;
  if (!app || !liveSchema || !result) return <main className="p-8">앱을 찾을 수 없습니다.</main>;

  const schema = liveSchema;
  const m = schema.meta;
  const activePath = activePathOf(schema, result.activePathId);

  // 그룹별 필수 변수 충족 여부 — 사용자가 채운 값만 인정
  const isFilled = (name: string) =>
    name in filled &&
    filled[name] !== "" &&
    filled[name] !== null &&
    filled[name] !== undefined;
  const groupReady = (grp: Grp) =>
    schema.vars
      .filter((v) => v.grp === grp && v.req)
      .every((v) => isFilled(v.name));
  const regReady = groupReady("규정");
  const perReady = groupReady("개인");

  // 탭별 접근 가능 여부 — 이전 단계의 필수 변수 모두 채워야 다음 진입
  const tabAvailable: Record<string, boolean> = {
    msaas: true,
    f1: true,
    f2: regReady,
    f3: regReady && perReady,
    f4: regReady && perReady,
  };
  const tabBlockedReason: Record<string, string> = {
    f2: "규정 그룹 필수 변수를 먼저 채워주세요",
    f3: "개인 정보 그룹 필수 변수를 먼저 채워주세요",
    f4: "개인 정보 그룹 필수 변수를 먼저 채워주세요",
  };
  const goTab = (k: string) => {
    if (!tabAvailable[k]) {
      alert(tabBlockedReason[k] || "이전 단계를 먼저 완료해 주세요");
      return;
    }
    setPvtab(k);
  };

  const nextOf: Record<string, string> = { msaas: "f1", f1: "f2", f2: "f3", f3: "f4" };
  const prevOf: Record<string, string> = { f1: "msaas", f2: "f1", f3: "f2", f4: "f3" };

  return (
    <main className="mx-auto max-w-5xl p-5">
      <div className="mb-3">
        <a
          href="/#tools"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          다른 앱 사용하기
        </a>
      </div>
      <div className="border rounded overflow-hidden bg-white">
        <div className="bg-blue-600 text-white px-5 py-3.5">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            {m.appName || app.name}
            <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5 font-mono">
              개인 1명 단위 처리
            </span>
          </h3>
          <p className="text-xs opacity-75 mt-1">
            {m.tagline || m.purpose || ""}
          </p>
        </div>
        <div className="flex bg-gray-50 border-b flex-wrap">
          {PVTABS.map(([k, name, num], idx) => {
            const ok = tabAvailable[k];
            const active = pvtab === k;
            const isLast = idx === PVTABS.length - 1;
            const isFirst = idx === 0;
            return (
              <div
                key={k}
                className="relative group flex-1 min-w-[130px] border-r"
              >
                <button
                  onClick={() => goTab(k)}
                  disabled={!ok}
                  className={
                    "w-full text-center py-3 text-xs " +
                    (active
                      ? "bg-white text-gray-900 font-semibold border-b-2 border-blue-600"
                      : ok
                      ? "text-gray-500 hover:bg-gray-100"
                      : "text-gray-300 cursor-not-allowed bg-gray-50")
                  }
                >
                  {num ? (
                    <span
                      className={
                        "inline-flex w-4 h-4 rounded-full text-[9px] items-center justify-center mr-1 font-mono " +
                        (ok
                          ? "bg-gray-200 text-gray-700"
                          : "bg-gray-100 text-gray-300")
                      }
                    >
                      {ok ? num : "🔒"}
                    </span>
                  ) : (
                    "📖 "
                  )}
                  {name}
                </button>
                {!ok && (
                  <div
                    role="tooltip"
                    className={
                      "pointer-events-none absolute top-full mt-2 z-30 hidden group-hover:block whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg " +
                      (isLast
                        ? "right-2"
                        : isFirst
                        ? "left-2"
                        : "left-1/2 -translate-x-1/2")
                    }
                  >
                    <span className="mr-1">⚠</span>
                    {tabBlockedReason[k]}
                    <span
                      className={
                        "absolute -top-1 h-2 w-2 rotate-45 bg-gray-900 " +
                        (isLast
                          ? "right-6"
                          : isFirst
                          ? "left-6"
                          : "left-1/2 -translate-x-1/2")
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-5 bg-white min-h-[380px]">
          {pvtab === "msaas" && <MSaaS meta={m} />}
          {pvtab === "f1" && (
            <ParseFrame
              schema={schema}
              grp="규정"
              upTitle="취업규칙 / 인사규정 업로드"
              filled={filled}
              setFilled={setFilled}
              upload={uploads["규정"]}
              setUpload={(u) => setUploads((s) => ({ ...s, 규정: u }))}
            />
          )}
          {pvtab === "f2" && (
            <ParseFrame
              schema={schema}
              grp="개인"
              upTitle="1인 인사 데이터 업로드"
              filled={filled}
              setFilled={setFilled}
              upload={uploads["개인"]}
              setUpload={(u) => setUploads((s) => ({ ...s, 개인: u }))}
            />
          )}
          {pvtab === "f3" && <Analyze schema={schema} result={result} activePath={activePath} />}
          {pvtab === "f4" && (
            <ReportView
              schema={schema}
              activePath={activePath}
              result={result}
              sc={result.sc}
              disp={result.disp}
              jres={result.jres}
            />
          )}

          {(() => {
            const prevKey = prevOf[pvtab];
            const nextKey = nextOf[pvtab];
            if (!prevKey && !nextKey) return null;
            const nextOk = nextKey ? tabAvailable[nextKey] : false;
            const nextBlocked = nextKey && !nextOk ? tabBlockedReason[nextKey] : "";
            return (
              <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3">
                {prevKey ? (
                  <button
                    onClick={() => goTab(prevKey)}
                    className="rounded border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    ← 이전
                  </button>
                ) : <span />}
                <div className="flex items-center gap-3">
                  {nextBlocked && (
                    <span className="text-xs text-rose-600">⚠ {nextBlocked}</span>
                  )}
                  {nextKey && (
                    <button
                      onClick={() => goTab(nextKey)}
                      disabled={!nextOk}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      다음 →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// MSaaS 패널 — 미리보기와 동일
// ──────────────────────────────────────────────────────────────

function Lab({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold tracking-wide text-gray-700 mb-1.5">
      {children}
    </div>
  );
}

function Pstep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs flex items-center gap-2">
      <span className="inline-flex w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] items-center justify-center font-mono shrink-0">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function MSaaS({ meta }: { meta: any }) {
  const defaultFlow = [
    "기준 지식화",
    "개인 정보 파싱",
    "적용 여부 판단·분석",
    "산출 및 안내",
  ];
  const flow: string[] =
    Array.isArray(meta.flow) && meta.flow.length === 4
      ? meta.flow.map((s: string, i: number) => s || defaultFlow[i])
      : defaultFlow;
  const stepColors = [
    "bg-sky-500 ring-sky-100",
    "bg-blue-500 ring-blue-100",
    "bg-indigo-500 ring-indigo-100",
    "bg-violet-500 ring-violet-100",
  ];
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-7 shadow-sm">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm ring-1 ring-blue-100">
            ⓪ Overview
          </div>
          <h4 className="font-serif text-2xl font-bold text-gray-900">
            {meta.appName || "(앱명 미설정)"}
          </h4>
          {meta.tagline && (
            <p className="mt-2 text-sm text-gray-700">{meta.tagline}</p>
          )}
          {meta.purpose && (
            <p className="mt-4 text-sm leading-relaxed text-gray-700">{meta.purpose}</p>
          )}
          {meta.security && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200">
              🔒 {meta.security}
            </div>
          )}
        </div>
      </div>

      {meta.effects?.filter(Boolean).length > 0 && (
        <div>
          <Lab>기대 효과</Lab>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {meta.effects.filter(Boolean).map((e: string, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-white p-4 text-xs shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-base text-amber-500">
                  ✦
                </div>
                <p className="text-gray-700 leading-relaxed">{e}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Lab>전체 프로세스</Lab>
        <ol className="relative rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="absolute left-[31px] top-6 bottom-6 w-px bg-gradient-to-b from-sky-200 via-blue-200 via-indigo-200 to-violet-200" />
          {flow.map((s, i) => (
            <li key={i} className="relative flex items-center gap-3 py-2">
              <span
                className={
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-4 " +
                  stepColors[i % stepColors.length]
                }
              >
                {i + 1}
              </span>
              <div className="flex-1 text-sm font-semibold text-gray-900">{s}</div>
            </li>
          ))}
        </ol>
      </div>

      {meta.features?.filter(Boolean).length > 0 && (
        <div>
          <Lab>핵심 특징</Lab>
          <ul className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm divide-y divide-gray-100">
            {meta.features.filter(Boolean).map((f: string, i: number) => (
              <li
                key={i}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm text-emerald-600">
                  ✓
                </span>
                <span className="text-sm text-gray-800 leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(meta.problem || meta.users) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meta.problem && (
            <div className="rounded-xl border-l-4 border-rose-300 bg-rose-50/40 p-4 text-xs">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                해결하려는 문제
              </div>
              <p className="text-gray-700 leading-relaxed">{meta.problem}</p>
            </div>
          )}
          {meta.users && (
            <div className="rounded-xl border-l-4 border-blue-300 bg-blue-50/40 p-4 text-xs">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                대상 사용자
              </div>
              <p className="text-gray-700 leading-relaxed">{meta.users}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ParseFrame — 실제 파일 업로드 + AI 파싱
// ──────────────────────────────────────────────────────────────

function ParseFrame({
  schema,
  grp,
  upTitle,
  filled,
  setFilled,
  upload,
  setUpload,
}: {
  schema: AppSchema;
  grp: Grp;
  upTitle: string;
  filled: Record<string, any>;
  setFilled: (f: Record<string, any>) => void;
  upload: { fname: string; ok: boolean } | undefined;
  setUpload: (u: { fname: string; ok: boolean } | undefined) => void;
}) {
  const vs = schema.vars.filter((v) => v.grp === grp);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const slotsHas = (v: Variable) =>
    v.name in filled &&
    filled[v.name] !== "" &&
    filled[v.name] !== null &&
    filled[v.name] !== undefined;
  const miss = vs.filter((v) => v.req && !slotsHas(v));

  const handleUpload = async (file: File) => {
    setBusy(true);
    setMsg("문서 분석 중...");
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type,
          slots: vs.map((s) => ({ name: s.name, type: s.type, unit: s.unit })),
        }),
      });
      if (await handleAuthError(res, window.location.pathname)) return;
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `요청 실패 (HTTP ${res.status})`);
      }
      const data = await res.json();
      const merged = { ...filled };
      let n = 0;
      for (const s of vs) {
        const raw = data[s.name];
        if (raw === null || raw === undefined || raw === "") continue;
        merged[s.name] = coerceValue(raw, s.type);
        n++;
      }
      setFilled(merged);
      setUpload({ fname: file.name, ok: true });
      setMsg(`문서 분석 완료 — ${n}개 항목 채워짐`);
    } catch (e: any) {
      setUpload({ fname: file.name, ok: false });
      setMsg("실패: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const stepNum = grp === "규정" ? 1 : 2;
  const stepColor = grp === "규정"
    ? "bg-sky-500 ring-sky-100"
    : "bg-blue-500 ring-blue-100";
  const panelTitle =
    grp === "규정"
      ? `${schema.meta.appName || ""} 규정·기준 지식화`.trim()
      : `${schema.meta.appName || ""} 개인 정보 파싱`.trim();
  const panelDesc =
    grp === "규정"
      ? "회사 규정·기준 문서를 업로드하여 적용 기준값을 자동으로 추출합니다."
      : "임직원 1인의 인사·급여 데이터를 업로드하여 변수값을 자동으로 추출합니다.";
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          className={
            "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-4 " +
            stepColor
          }
        >
          {stepNum}
        </span>
        <div>
          <h4 className="text-base font-semibold text-gray-900">{panelTitle}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{panelDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              📂 {upTitle}
            </h4>
            <div className="text-xs text-gray-500 mt-1 mb-3">
              PDF · Docx · Xlsx 업로드 → 자동 파싱
            </div>
            <label
              className={
                "block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors " +
                (upload?.ok
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white"
                  : upload && !upload.ok
                  ? "border-rose-300 bg-gradient-to-br from-rose-50 to-white"
                  : "border-gray-200 bg-gray-50/60 hover:bg-gray-100")
              }
            >
              <input
                type="file"
                hidden
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.xlsx"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <div
                className={
                  "mx-auto mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-base text-white " +
                  (upload?.ok
                    ? "bg-emerald-500"
                    : upload && !upload.ok
                    ? "bg-rose-500"
                    : busy
                    ? "bg-gray-400"
                    : "bg-gray-300")
                }
              >
                {busy ? "⏳" : upload?.ok ? "✓" : upload && !upload.ok ? "✕" : "⬆"}
              </div>
              <div className="text-xs font-semibold mt-1 text-gray-900 truncate">
                {busy
                  ? "문서 분석 중..."
                  : upload
                  ? upload.fname
                  : "클릭하여 파일 선택"}
              </div>
              <div
                className={
                  "text-[10px] mt-1 font-mono " +
                  (upload?.ok
                    ? "text-emerald-700"
                    : upload && !upload.ok
                    ? "text-rose-700"
                    : "text-gray-500")
                }
              >
                {busy
                  ? "잠시만 기다려 주세요"
                  : upload?.ok
                  ? "파싱 완료 · 우측에서 확인"
                  : upload && !upload.ok
                  ? "파싱 실패 · 수기 입력"
                  : "PDF · DOCX · XLSX · 이미지 가능"}
              </div>
            </label>
            {msg && (
              <p className="text-[11px] text-gray-500 mt-2 font-mono">{msg}</p>
            )}
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[11px] text-rose-700 leading-relaxed shadow-sm">
            ⓘ 파싱이 정확하지 않다면 우측 표에서 직접 값을 수정할 수 있습니다.
            민감 정보는 분석 후 즉시 폐기됩니다.
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              🧾 파싱 결과
              <span className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
                {grp} 항목
              </span>
            </h4>
            <span
              className={
                "text-[11px] font-medium rounded-full px-2.5 py-1 " +
                (miss.length
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
              }
            >
              {miss.length ? `⚠ 필수 누락 ${miss.length}건` : "✓ 전 항목 확인됨"}
            </span>
          </div>
          {vs.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">변수 없음</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {vs.map((v) => {
                const val = v.name in filled ? filled[v.name] : "";
                const has = val !== "" && val !== null && val !== undefined;
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-sm"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-800 truncate">{v.name}</span>
                      {v.req && (
                        <span
                          className={
                            "text-[9px] rounded px-1.5 py-0.5 font-mono shrink-0 ring-1 " +
                            (grp === "개인"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-gray-100 text-gray-600 ring-gray-200")
                          }
                        >
                          필수
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">
                        {v.type}
                        {v.unit ? " · " + v.unit : ""}
                      </span>
                    </div>
                    <input
                      type={
                        v.type === "number"
                          ? "number"
                          : v.type === "date"
                          ? "date"
                          : "text"
                      }
                      value={val ?? ""}
                      onChange={(e) =>
                        setFilled({
                          ...filled,
                          [v.name]:
                            v.type === "number"
                              ? e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                              : e.target.value,
                        })
                      }
                      className={
                        "w-40 rounded-lg border px-2.5 py-1.5 text-xs font-mono text-right shrink-0 " +
                        (!has && v.req
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-gray-200 bg-white text-gray-900")
                      }
                      placeholder={!has && v.req ? "누락" : "—"}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Analyze 패널
// ──────────────────────────────────────────────────────────────

function Analyze({ schema, result, activePath }: any) {
  const mig = migrateSchema(schema);
  const allSteps = [
    ...(mig.shared?.steps || []),
    ...((activePath?.steps as any[]) || []),
  ];
  const cards = (activePath?.report || []).filter((e: any) => e.kind === "card").slice(0, 4);
  const { sc, disp, jres, res, applied, pathMatches } = result;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-4 bg-indigo-500 ring-indigo-100">
          3
        </span>
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            {schema.meta.appName || ""} 적용 여부 판단 결과
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            규정 기준과 대상자 정보를 비교하여 적용 여부·수준을 분석합니다.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-gray-900">경로 매칭 결과</h5>
          <span className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
            first-match
          </span>
        </div>
        <ul className="space-y-1.5">
          {pathMatches.map((pm: any) => {
            const active = pm.id === result.activePathId;
            return (
              <li
                key={pm.id}
                className={
                  "flex items-center gap-3 text-xs px-3 py-2 rounded-lg transition " +
                  (active
                    ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800"
                    : "bg-gray-50/60 text-gray-600")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                    (active
                      ? "bg-emerald-500 text-white"
                      : pm.ok
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-200 text-gray-500")
                  }
                >
                  {active || pm.ok ? "✓" : "·"}
                </span>
                <span className={"flex-1 " + (active ? "font-semibold" : "")}>
                  {pm.label}
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  {pm.conditionResults.length === 0
                    ? "(조건 없음)"
                    : pm.conditionResults
                        .map(
                          (c: any) =>
                            `${c.a}${c.op}${c.b}${c.ok ? "✓" : "✗"}`
                        )
                        .join(" · ")}
                </span>
                {active && (
                  <span className="text-[10px] font-medium rounded-full bg-emerald-500 text-white px-2 py-0.5">
                    활성
                  </span>
                )}
              </li>
            );
          })}
          {result.activePathId === mig.fallback?.id && (
            <li className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white text-[10px]">
                ▣
              </span>
              <span className="flex-1 font-semibold">{mig.fallback?.label}</span>
              <span className="text-[10px] font-medium rounded-full bg-rose-500 text-white px-2 py-0.5">
                활성 · fallback
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-5 text-center text-xs text-gray-500">
            요약 카드가 없습니다.
          </div>
        ) : (
          cards.map((e: any) => (
            <div
              key={e.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                {e.label}
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1.5">
                {disp[e.bind] ?? "—"}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-900 mb-3">
            판단 근거 비교표
          </h5>
          {jres.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">
              판정부 비교 없음
            </div>
          ) : (
            <ElementRenderer
              schema={schema}
              el={{ id: "x", kind: "compare", label: "", bind: "", w: "full", h: 1 }}
              sc={sc}
              disp={disp}
              jres={jres}
            />
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-900 mb-3">
            산출 로직{" "}
            <span className="text-xs font-normal text-gray-500">(활성 경로)</span>
          </h5>
          {allSteps.filter((s: any) => s.name).length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">
              산출 단계 없음
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {allSteps
                .filter((s: any) => s.name)
                .map((s: any) => {
                  const r = res[s.id];
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1 items-baseline py-2 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="text-gray-600 whitespace-nowrap">
                        {s.name}
                      </span>
                      <span
                        className={
                          "font-mono font-semibold text-right break-words min-w-0 " +
                          (r && r.bad ? "text-rose-600" : "text-gray-900")
                        }
                      >
                        {r ? r.d : "—"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
          <div
            className={
              "mt-4 rounded-lg p-3 text-xs font-semibold flex items-center gap-2 " +
              (applied
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200")
            }
          >
            <span className="text-base">{applied ? "✓" : "✗"}</span>
            <span className="text-[11px] uppercase tracking-wider opacity-70">
              판정
            </span>
            <span className="font-bold">{result.activePathLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ReportView 패널 — 안내서 + PDF/DOCX/JSON 다운로드
// ──────────────────────────────────────────────────────────────

function ReportView({ schema, activePath, result, sc, disp, jres }: any) {
  const list = (activePath?.report || []) as any[];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const download = async (kind: "pdf" | "docx") => {
    setBusy(true);
    setMsg(`${kind.toUpperCase()} 생성 중...`);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, result }),
      });
      if (await handleAuthError(res, window.location.pathname)) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `${kind} 실패`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(schema.meta?.appName || "report").replace(/\s+/g, "_")}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`${kind.toUpperCase()} 다운로드 완료`);
    } catch (e: any) {
      setMsg("실패: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    const payload = {
      appName: schema.meta?.appName || "",
      activePathId: result?.activePathId,
      activePathLabel: result?.activePathLabel,
      applied: result?.applied,
      vars: result?.disp,
      pathMatches: result?.pathMatches,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(schema.meta?.appName || "report").replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("JSON 다운로드 완료");
  };

  const DownloadBar = (
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <span className="text-xs text-gray-500 mr-auto">{msg}</span>
      <button
        disabled={busy || list.length === 0}
        onClick={() => download("pdf")}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        📄 PDF
      </button>
      <button
        disabled={busy || list.length === 0}
        onClick={() => download("docx")}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        📝 DOCX
      </button>
      <button
        disabled={busy}
        onClick={downloadJson}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        JSON
      </button>
    </div>
  );

  if (list.length === 0) {
    return (
      <div>
        <div className="border rounded">
          <ReportHead title={schema.meta.appName} pathLabel={result.activePathLabel} />
          <div className="p-8 text-center text-xs text-gray-500">
            이 경로의 리포트가 비어 있습니다.
          </div>
        </div>
        <div className="mt-3">{DownloadBar}</div>
      </div>
    );
  }
  return (
    <>
      <div className="border rounded">
        <ReportHead title={schema.meta.appName} pathLabel={result.activePathLabel} />
        <div className="p-5 grid grid-cols-6 grid-flow-row-dense auto-rows-[96px] gap-4 bg-slate-50/40">
          {list.map((e: any) => {
            const wSp = Math.max(
              1,
              Math.min(
                6,
                e.wSpan ?? (({ full: 6, half: 3, third: 2 } as any)[e.w || "full"] || 6)
              )
            );
            const hSp = Math.max(1, Math.min(6, e.hSpan ?? (e.h || 1)));
            return (
              <div
                key={e.id}
                style={{ gridColumn: `span ${wSp} / span ${wSp}`, gridRow: `span ${hSp} / span ${hSp}` }}
                className={
                  "overflow-hidden flex flex-col min-h-0 " +
                  (e.kind === "fields"
                    ? "pt-0 pb-2"
                    : e.kind === "note"
                    ? "rounded-xl bg-amber-50 border-l-4 border-amber-300 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
                    : "rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]")
                }
              >
                <ElementRenderer
                  schema={schema}
                  el={e}
                  sc={sc}
                  disp={disp}
                  jres={jres}
                  pathLabel={result.activePathLabel}
                  pathConditions={activePath?.conditions || []}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3">{DownloadBar}</div>
    </>
  );
}

function ReportHead({ title, pathLabel }: { title: string; pathLabel?: string }) {
  return (
    <div className="bg-blue-600 text-white px-4 py-3 font-serif text-base font-semibold flex justify-between items-center rounded-t">
      <span>
        {title ? title.replace(/ ?앱$/, "") : "적용 결과"} 안내서
        {pathLabel && <span className="text-white/80 text-sm"> — {pathLabel}</span>}
      </span>
      <span className="font-mono text-[10px] opacity-65">AUTO · {todayStr()}</span>
    </div>
  );
}
