"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { AppSchema } from "app-renderer";
import { EMPTY_SCHEMA } from "app-renderer";
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

export default function BuilderPage() {
  const [tab, setTab] = useState("m0");
  const [schema, setSchema] = useState<AppSchema>(EMPTY_SCHEMA);
  const [appId, setAppId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
      const counts = {
        v: parsed.vars?.length || 0,
        j: parsed.judge?.length || 0,
        s: parsed.steps?.length || 0,
        r: parsed.report?.length || 0,
      };
      setMsg(
        `기획서 분석 완료 — 변수 ${counts.v} · 비교 ${counts.j} · 산출 ${counts.s} · 리포트 ${counts.r}`
      );
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
      }
      setMsg(publish ? "발행 완료" : "저장 완료");
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
        <div className="flex items-center justify-center px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="text-sm font-semibold text-slate-600 tracking-wide">
            HR Coach · 규정 적용 앱 빌더
            <span className="ml-2 text-[10px] font-mono text-slate-400 align-middle">v5</span>
          </div>
        </div>
        <div className="bg-gradient-to-b from-blue-50 to-blue-50/0">
          <div className="px-7 pt-7 pb-5">
            <div className="flex justify-between items-start gap-5 flex-wrap pb-6">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-blue-700 font-mono mb-1.5">
                반제품 · 저작 도구 v5
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
    </main>
  );
}
