"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { AppSchema } from "app-renderer";
import { EMPTY_SCHEMA, run } from "app-renderer";
import { SAMPLE_WAGE_PEAK } from "./lib/sample-wagepeak";
import Tab0Meta from "./components/Tab0Meta";
import TabVars from "./components/TabVars";
import Tab3Logic from "./components/Tab3Logic";
import Tab4Report from "./components/Tab4Report";
import Tab5Preview from "./components/Tab5Preview";

const TABS = [
  { id: "m0", label: "⓪ 앱 개요" },
  { id: "r1", label: "① 규정 변수" },
  { id: "r2", label: "② 개인 변수" },
  { id: "lg", label: "③ 분석 로직" },
  { id: "rp", label: "④ 리포트 구성" },
  { id: "pv", label: "⑤ 완제품 미리보기" },
];

type AppRow = {
  id: string;
  name: string;
  status: string;
  version: number;
  published_at: string | null;
  created_at: string;
  app_schema: AppSchema;
};

export default function BuilderPage() {
  const [tab, setTab] = useState("m0");
  const [schema, setSchema] = useState<AppSchema>(EMPTY_SCHEMA);
  const [appId, setAppId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 앱 리스트 모달
  const [listOpen, setListOpen] = useState(false);
  const [appList, setAppList] = useState<AppRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");

  // 발행 완료 모달
  const [publishedModal, setPublishedModal] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // 기획서 분석 완료 모달
  const [parseResultModal, setParseResultModal] = useState<{
    appName: string;
    counts: { vReg: number; vPer: number; v: number; p: number; j: number; s: number; r: number };
    pathBreakdown: { label: string; reportCount: number; isFallback?: boolean }[];
    llmCount: number;
    llmRunning: boolean; // true = LLM 자동 실행 중
  } | null>(null);

  const fetchList = async () => {
    setListLoading(true);
    setListErr("");
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("apps")
        .select("id, name, status, version, published_at, created_at, app_schema")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAppList((data || []) as AppRow[]);
    } catch (e: any) {
      setListErr(e.message || "조회 실패");
    } finally {
      setListLoading(false);
    }
  };

  const openList = () => {
    setListOpen(true);
    fetchList();
  };

  const deleteApp = async (row: AppRow) => {
    const label = row.app_schema?.meta?.appName || row.name || row.id;
    if (
      !confirm(
        `"${label}" 앱을 영구 삭제할까요?\n\n해당 앱의 실행 기록(app_runs)도 함께 삭제됩니다. 되돌릴 수 없습니다.`
      )
    )
      return;
    try {
      const sb = getSupabase();
      // 1) FK로 묶인 실행 기록 먼저 정리
      const { error: runsErr } = await sb.from("app_runs").delete().eq("app_id", row.id);
      if (runsErr) throw runsErr;
      // 2) 앱 본체 삭제
      const { error } = await sb.from("apps").delete().eq("id", row.id);
      if (error) throw error;
      setAppList((list) => list.filter((a) => a.id !== row.id));
      if (appId === row.id) {
        setAppId(null);
        setMsg("현재 편집 중이던 앱이 삭제되어 ID가 해제되었습니다.");
      }
    } catch (e: any) {
      alert("삭제 실패: " + (e.message || e));
    }
  };

  const loadApp = async (row: AppRow) => {
    if (!confirm(`"${row.app_schema?.meta?.appName || row.name}" 를 편집기로 불러옵니다. 현재 작성중인 내용은 사라집니다. 계속할까요?`))
      return;
    setSchema(row.app_schema);
    setAppId(row.id);
    setListOpen(false);
    setMsg("앱을 불러왔습니다");
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        // strip "data:...;base64," prefix
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const guessMime = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      txt: "text/plain",
      md: "text/markdown",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return (ext && map[ext]) || "application/octet-stream";
  };

  // 모든 LLM 요약 단계를 자동 실행하여 lastResult 채움
  // 백그라운드로 동작 — UI 블로킹 안 함
  const runAllLLMSummaries = async (initial: AppSchema) => {
    try {
      const result = run(initial);
      const disp = result.disp || {};

      // 모든 경로/공통/fallback 에서 type === 'llm' 단계 수집
      const targets: { pathKey: string; stepId: string; items: string[]; prompt: string }[] = [];
      const collect = (steps: any[] = [], pathKey: string) => {
        for (const s of steps) {
          if (s?.type === "llm") {
            targets.push({
              pathKey,
              stepId: s.id,
              items: Array.isArray(s.items) ? s.items : [],
              prompt: s.prompt || "",
            });
          }
        }
      };
      collect(initial.shared?.steps as any[], "shared");
      (initial.paths || []).forEach((p) => collect(p.steps as any[], p.id));
      collect(initial.fallback?.steps as any[], "fallback");

      // 병렬 호출 — 동시에 진행
      const results = await Promise.all(
        targets.map(async (t) => {
          try {
            const context = t.items.map((name) => ({
              name,
              value: disp?.[name] ?? "—",
            }));
            const res = await fetch("/api/llm-summary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meta: initial.meta,
                context,
                prompt: t.prompt,
              }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "요청 실패");
            return { ...t, summary: j.summary as string };
          } catch (e: any) {
            console.error("LLM auto-run failed:", t.stepId, e?.message);
            return { ...t, summary: null as string | null };
          }
        })
      );

      // 결과를 schema 에 머지
      setSchema((prev) => {
        const next: AppSchema = JSON.parse(JSON.stringify(prev));
        const applyTo = (steps: any[] = []) => {
          for (const s of steps) {
            const hit = results.find((r) => r.stepId === s.id && r.summary);
            if (hit) {
              s.lastResult = hit.summary;
              s.lastAt = new Date().toISOString();
            }
          }
        };
        applyTo(next.shared?.steps as any[]);
        (next.paths || []).forEach((p) => applyTo(p.steps as any[]));
        applyTo(next.fallback?.steps as any[]);
        return next;
      });
    } catch (e: any) {
      console.error("runAllLLMSummaries error:", e);
    } finally {
      setParseResultModal((m) => (m ? { ...m, llmRunning: false } : m));
    }
  };

  const uploadSpec = async (file: File) => {
    setBusy(true);
    setMsg(`기획서 분석 중... (${file.name})`);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/parse-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: guessMime(file) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "파싱 실패");
      }
      const parsed: AppSchema = await res.json();
      setSchema(parsed);

      // 신·구 스키마 모두 합산 — 다중 경로(paths/shared/fallback)와 단일 경로(judge/steps/report)를 모두 카운트
      const paths = parsed.paths || [];
      const sharedSteps = parsed.shared?.steps?.length || 0;
      const fallbackSteps = parsed.fallback?.steps?.length || 0;
      const pathSteps = paths.reduce((a, p) => a + (p.steps?.length || 0), 0);
      const pathConditions = paths.reduce(
        (a, p) => a + (p.conditions?.length || 0),
        0
      );
      const pathReport = paths.reduce((a, p) => a + (p.report?.length || 0), 0);
      const fallbackReport = parsed.fallback?.report?.length || 0;

      const vars = parsed.vars || [];
      const counts = {
        vReg: vars.filter((v) => v.grp === "규정").length,
        vPer: vars.filter((v) => v.grp === "개인").length,
        v: vars.length,
        j: (parsed.judge?.length || 0) + pathConditions,
        s: (parsed.steps?.length || 0) + sharedSteps + pathSteps + fallbackSteps,
        r: (parsed.report?.length || 0) + pathReport + fallbackReport,
        p: paths.length,
      };

      // LLM 요약 단계 개수 — 경로별로 type='llm' 단계 카운트
      const countLLM = (steps: any[] = []) =>
        steps.filter((s) => s?.type === "llm").length;
      const llmCount =
        countLLM(parsed.steps as any[]) +
        countLLM(parsed.shared?.steps as any[]) +
        countLLM(parsed.fallback?.steps as any[]) +
        paths.reduce((a, p) => a + countLLM(p.steps as any[]), 0);

      // 경로별 리포트 카드 개수 — 분기마다 어떤 리포트가 몇 개 있는지
      const pathBreakdown: {
        label: string;
        reportCount: number;
        isFallback?: boolean;
      }[] = [
        ...paths.map((p, i) => ({
          label: p.label || `경로 ${i + 1}`,
          reportCount: p.report?.length || 0,
        })),
        ...(parsed.fallback
          ? [
              {
                label: parsed.fallback.label || "미적용 (Fallback)",
                reportCount: parsed.fallback.report?.length || 0,
                isFallback: true,
              },
            ]
          : []),
      ];

      setMsg(
        `기획서 분석 완료 — 변수 ${counts.v} · 경로 ${counts.p} · 조건 ${counts.j} · 산출 ${counts.s} · 리포트 ${counts.r}`
      );
      setParseResultModal({
        appName: parsed.meta?.appName?.trim() || "(없음)",
        counts,
        pathBreakdown,
        llmCount,
        llmRunning: llmCount > 0,
      });

      // LLM 요약이 있으면 백그라운드로 자동 실행
      if (llmCount > 0) {
        runAllLLMSummaries(parsed);
      }
    } catch (e: any) {
      setMsg("분석 실패: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const save = async (publish: boolean) => {
    setBusy(true);
    setMsg(publish ? "발행 중..." : "임시저장 중...");
    try {
      const sb = getSupabase();
      const payload: any = {
        name: schema.meta.appName || "Untitled",
        app_schema: schema,
        status: publish ? "published" : "draft",
        ...(publish ? { published_at: new Date().toISOString() } : {}),
      };
      let savedId = appId;
      if (appId) {
        const { error } = await sb.from("apps").update(payload).eq("id", appId);
        if (error) throw error;
      } else {
        const { data, error } = await sb
          .from("apps")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setAppId(data.id);
        savedId = data.id;
      }
      setMsg(publish ? "발행 완료" : "저장 완료");
      if (publish && savedId) {
        setPublishedModal({
          id: savedId,
          title: schema.meta.appName || payload.name,
        });
      }
    } catch (e: any) {
      setMsg("저장 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 pt-10 pb-14 px-6 flex justify-center">
      <div className="builder-shell w-full max-w-[1260px] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 overflow-hidden self-start">
        {/* 윈도 타이틀바 */}
        <div className="flex items-center justify-center px-5 py-3 border-b border-blue-700 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="text-sm font-semibold text-white tracking-wide">
            HR Coach · 규정 적용 앱 빌더
          </div>
        </div>
        <div className="bg-gradient-to-b from-blue-50 to-blue-50/0">
          <div className="px-7 pt-7 pb-5">
            <div className="flex justify-between items-start gap-5 flex-wrap pb-6">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-blue-700 font-mono mb-1.5">
                반제품 · 저작 도구
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                규정 적용 앱 빌더
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 flex-wrap justify-end">
                <label
                  className={
                    "rounded-lg px-4 py-2 text-sm font-medium transition cursor-pointer " +
                    (busy
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700")
                  }
                  title="앱 기획서(PDF/DOCX/TXT)를 업로드하면 AI가 5탭을 자동으로 채웁니다"
                >
                  {busy ? "분석 중…" : "📄 기획서 업로드 (AI 자동 채움)"}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,image/*"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSpec(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={openList}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  title="저장·발행된 앱 목록 보기"
                >
                  📋 앱 리스트 보기
                </button>
                <button
                  disabled={busy}
                  onClick={() => save(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  임시저장
                </button>
                <button
                  disabled={busy}
                  onClick={() => save(true)}
                  className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  발행
                </button>
              </div>
              <div className="flex items-center gap-4 justify-end text-xs pr-1">
                <button
                  onClick={() => {
                    setSchema(SAMPLE_WAGE_PEAK);
                    setMsg("임금피크제 예시 불러왔습니다");
                  }}
                  className="text-gray-500 hover:text-blue-700 underline-offset-4 hover:underline transition"
                >
                  임금피크제 예시 불러오기
                </button>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => {
                    if (!confirm("입력된 모든 값을 비웁니다. 진행할까요?")) return;
                    setSchema(EMPTY_SCHEMA);
                    setMsg("비웠습니다");
                  }}
                  className="text-gray-500 hover:text-rose-600 underline-offset-4 hover:underline transition"
                >
                  전체 비우기
                </button>
              </div>
            </div>
          </div>
            <div className="flex gap-1 flex-wrap border-b border-gray-200">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "text-sm px-4 py-2.5 border-b-2 transition -mb-px " +
                    (tab === t.id
                      ? "border-blue-600 text-blue-700 font-semibold"
                      : "border-transparent text-gray-500 hover:text-gray-700")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <section className="px-7 py-6">
        {tab === "m0" && (
          <Tab0Meta
            meta={schema.meta}
            onChange={(meta) => setSchema({ ...schema, meta })}
          />
        )}
        {tab === "r1" && (
          <TabVars
            grp="규정"
            vars={schema.vars}
            onChange={(vars) => setSchema({ ...schema, vars })}
          />
        )}
        {tab === "r2" && (
          <TabVars
            grp="개인"
            vars={schema.vars}
            onChange={(vars) => setSchema({ ...schema, vars })}
          />
        )}
        {tab === "lg" && <Tab3Logic schema={schema} onChange={setSchema} />}
        {tab === "rp" && <Tab4Report schema={schema} onChange={setSchema} />}
        {tab === "pv" && <Tab5Preview schema={schema} />}
        <footer className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center gap-3 text-xs text-gray-500 flex-wrap">
          <div>
            {appId && (
              <>
                앱 ID:{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">
                  {appId}
                </code>{" "}
                <a
                  className="ml-2 text-blue-700 hover:underline"
                  href={`/apps/${appId}`}
                  target="_blank"
                >
                  완제품 열기 →
                </a>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>{msg}</span>
            {(() => {
              const idx = TABS.findIndex((t) => t.id === tab);
              const prev = idx > 0 ? TABS[idx - 1] : null;
              const next = idx < TABS.length - 1 ? TABS[idx + 1] : null;
              return (
                <>
                  {prev && (
                    <button
                      onClick={() => setTab(prev.id)}
                      className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      ← {prev.label}
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => setTab(next.id)}
                      className="rounded-lg bg-blue-600 text-white px-3.5 py-1.5 text-sm font-medium hover:bg-blue-700"
                    >
                      {next.label} →
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </footer>
        </section>
      </div>

      {listOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setListOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">앱 리스트</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  저장·발행된 앱 — 불러오기 / 미리보기 / 삭제
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchList}
                  disabled={listLoading}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  ↻ 새로고침
                </button>
                <button
                  onClick={() => setListOpen(false)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {listLoading && (
                <div className="text-sm text-gray-500 py-10 text-center">불러오는 중…</div>
              )}
              {listErr && (
                <div className="text-sm text-rose-600 py-10 text-center">에러: {listErr}</div>
              )}
              {!listLoading && !listErr && appList.length === 0 && (
                <div className="text-sm text-gray-500 py-10 text-center">
                  저장된 앱이 없습니다. 빌더에서 임시저장 또는 발행해 보세요.
                </div>
              )}
              {!listLoading && appList.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b">
                    <tr>
                      <th className="text-left py-2 pr-2 font-medium">앱명</th>
                      <th className="text-left py-2 px-2 font-medium w-20">상태</th>
                      <th className="text-left py-2 px-2 font-medium w-32">발행일</th>
                      <th className="text-right py-2 pl-2 font-medium w-56">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appList.map((row) => {
                      const label = row.app_schema?.meta?.appName || row.name || "(이름 없음)";
                      const isPub = row.status === "published";
                      const isCurrent = appId === row.id;
                      return (
                        <tr key={row.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 pr-2">
                            <div className="font-medium text-gray-900">
                              {label}
                              {isCurrent && (
                                <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-mono text-blue-700">
                                  편집 중
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{row.id}</div>
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={
                                "inline-block rounded px-2 py-0.5 text-[10px] font-mono " +
                                (isPub
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-500")
                              }
                            >
                              {isPub ? "published" : "draft"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-xs text-gray-500 font-mono">
                            {row.published_at
                              ? new Date(row.published_at).toISOString().slice(0, 10)
                              : "—"}
                          </td>
                          <td className="py-3 pl-2">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => loadApp(row)}
                                className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                불러오기
                              </button>
                              {isPub && (
                                <a
                                  href={`/apps/${row.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  미리보기
                                </a>
                              )}
                              <button
                                onClick={() => deleteApp(row)}
                                className="rounded border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                🗑 삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500">
              총 {appList.length}개 · 발행된 앱은 홈 "인사AI 앱 세트"에 자동 노출됩니다.
            </div>
          </div>
        </div>
      )}

      {parseResultModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setParseResultModal(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">기획서 분석 완료</h3>
              <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 ring-1 ring-blue-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  앱 명
                </span>
                <span
                  className={
                    "text-xs font-semibold truncate " +
                    (parseResultModal.appName === "(없음)"
                      ? "text-gray-400 italic"
                      : "text-gray-900")
                  }
                >
                  {parseResultModal.appName}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                기획서로부터 다음 항목이 추출되었습니다.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { k: "규정 변수", v: parseResultModal.counts.vReg },
                  { k: "개인 변수", v: parseResultModal.counts.vPer },
                  { k: "경로", v: parseResultModal.counts.p },
                  { k: "조건", v: parseResultModal.counts.j },
                ].map((c) => (
                  <div key={c.k} className="rounded-lg bg-gray-50 px-2 py-2.5 ring-1 ring-gray-200">
                    <div className="text-lg font-bold text-gray-900 tabular-nums">{c.v}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{c.k}</div>
                  </div>
                ))}
              </div>

              {parseResultModal.pathBreakdown.length > 0 && (
                <div className="mt-4 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    분석 로직 분기
                  </div>
                  <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {parseResultModal.pathBreakdown.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={
                              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white " +
                              (p.isFallback ? "bg-rose-500" : "bg-blue-500")
                            }
                          >
                            {p.isFallback ? "▣" : i + 1}
                          </span>
                          <span className="text-xs text-gray-800 truncate">
                            {p.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-600 shrink-0">
                          리포트{" "}
                          <b className="text-gray-900 tabular-nums">
                            {p.reportCount}
                          </b>
                          개
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parseResultModal.llmCount > 0 && (
                <div className="mt-4 rounded-lg border-l-4 border-violet-400 bg-violet-50 px-3 py-2.5 text-left">
                  <div className="text-[11px] font-bold text-violet-700 mb-0.5 flex items-center gap-1.5">
                    {parseResultModal.llmRunning ? (
                      <>
                        <svg
                          className="h-3 w-3 animate-spin text-violet-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            strokeWidth="3"
                            opacity="0.25"
                          />
                          <path
                            d="M22 12a10 10 0 0 1-10 10"
                            strokeWidth="3"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        LLM 요약 {parseResultModal.llmCount}개 자동 분석 중…
                      </>
                    ) : (
                      <>⚡ LLM 요약 {parseResultModal.llmCount}개 분석 완료</>
                    )}
                  </div>
                  <div className="text-xs text-violet-800 leading-relaxed">
                    산출 블록에 <b>'LLM 요약'</b>이 있습니다. 분석 결과를 확인하세요.
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100">
              <button
                onClick={() => setParseResultModal(null)}
                className="w-full py-3.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {publishedModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPublishedModal(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">발행 완료</h3>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {publishedModal.title || "(이름 없음)"}
                </span>
                <br />
                앱이 홈 "인사AI 앱 세트"에 노출되었습니다.
              </p>
              <div className="mt-3 inline-block rounded bg-gray-50 px-2.5 py-1 font-mono text-[10px] text-gray-500">
                {publishedModal.id}
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setPublishedModal(null)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100"
              >
                닫기
              </button>
              <a
                href={`/apps/${publishedModal.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setPublishedModal(null)}
                className="flex-1 py-3.5 text-sm font-semibold text-center text-white bg-blue-600 hover:bg-blue-700"
              >
                완제품 열기 →
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
