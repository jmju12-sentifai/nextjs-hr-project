"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabase } from "@/lib/supabase";
import type { AppSchema } from "app-renderer";
import { EMPTY_SCHEMA } from "app-renderer";
import { SAMPLE_WAGE_PEAK } from "./lib/sample-wagepeak";
import Tab0Meta from "./components/Tab0Meta";
import TabVars from "./components/TabVars";
import Tab3Logic from "./components/Tab3Logic";
import Tab4Report from "./components/Tab4Report";
import Tab5Preview from "./components/Tab5Preview";

// 생성된 앱 기획서 마크다운 렌더링 (@tailwindcss/typography 미설치 → 명시 스타일)
const SPEC_MD_COMPONENTS = {
  h1: ({ node: _n, ...p }: any) => (
    <h1 className="mb-3 mt-1 text-xl font-bold text-gray-900" {...p} />
  ),
  h2: ({ node: _n, ...p }: any) => (
    <h2 className="mt-5 mb-2 text-base font-bold text-gray-900" {...p} />
  ),
  h3: ({ node: _n, ...p }: any) => (
    <h3 className="mt-4 mb-1.5 text-sm font-bold text-gray-800" {...p} />
  ),
  p: ({ node: _n, ...p }: any) => (
    <p className="mb-2 text-xs leading-relaxed text-gray-700" {...p} />
  ),
  ul: ({ node: _n, ...p }: any) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-xs text-gray-700" {...p} />
  ),
  ol: ({ node: _n, ...p }: any) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 text-xs text-gray-700" {...p} />
  ),
  li: ({ node: _n, ...p }: any) => <li className="leading-relaxed" {...p} />,
  strong: ({ node: _n, ...p }: any) => (
    <strong className="font-bold text-gray-900" {...p} />
  ),
  blockquote: ({ node: _n, ...p }: any) => (
    <blockquote
      className="my-2 border-l-2 border-gray-300 pl-3 text-[11px] text-gray-500"
      {...p}
    />
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
  table: ({ node: _n, ...p }: any) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[11px]" {...p} />
    </div>
  ),
  thead: ({ node: _n, ...p }: any) => <thead className="bg-gray-50" {...p} />,
  tr: ({ node: _n, ...p }: any) => (
    <tr className="border-b border-gray-100 last:border-0" {...p} />
  ),
  th: ({ node: _n, ...p }: any) => (
    <th className="px-2.5 py-1.5 text-left font-bold text-gray-700" {...p} />
  ),
  td: ({ node: _n, ...p }: any) => (
    <td className="px-2.5 py-1.5 align-top text-gray-700" {...p} />
  ),
  code: ({ node: _n, ...p }: any) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px]" {...p} />
  ),
};

// 구조화 프리뷰 → 마크다운 (uploadSpec 파이프라인에 전달용)
function previewToMarkdown(p: any): string {
  const m = p.meta || {};
  const lines: string[] = [];
  lines.push(`# ${m.appName || "(이름 없음)"}`);
  if (m.tagline) lines.push(`\n> ${m.tagline}`);
  lines.push(`\n## 1. 앱 개요\n`);
  if (m.purpose) lines.push(`**목적**: ${m.purpose}\n`);
  if (m.problem) lines.push(`**해결 문제**: ${m.problem}\n`);
  if (m.users) lines.push(`**대상 사용자**: ${m.users}\n`);
  if (m.security) lines.push(`**보안**: ${m.security}\n`);
  if (m.effects?.length) lines.push(`\n**기대 효과**\n${m.effects.map((e: string) => `- ${e}`).join("\n")}`);
  if (m.features?.length) lines.push(`\n**핵심 특징**\n${m.features.map((e: string) => `- ${e}`).join("\n")}`);
  if (m.flow?.length) lines.push(`\n**처리 흐름 4단계**\n${m.flow.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`);
  // 변수 — 핵심만 (기타 변수는 빌더에 직접 채우지 않음)
  const coreVars = (p.vars || []).filter((v: any) => v.category === "핵심");
  const reg = coreVars.filter((v: any) => v.grp === "규정");
  const per = coreVars.filter((v: any) => v.grp === "개인");
  if (reg.length) {
    lines.push(`\n## 2. 규정 변수\n`);
    lines.push(`| 변수명 | 타입 | 단위 | 값 |`);
    lines.push(`|---|---|---|---|`);
    for (const v of reg) lines.push(`| ${v.name} | ${v.type} | ${v.unit || ""} | ${v.value || ""} |`);
  }
  if (per.length) {
    lines.push(`\n## 3. 개인 변수\n`);
    lines.push(`| 변수명 | 타입 | 단위 |`);
    lines.push(`|---|---|---|`);
    for (const v of per) lines.push(`| ${v.name} | ${v.type} | ${v.unit || ""} |`);
  }
  // 경로
  if (p.paths?.length) {
    lines.push(`\n## 4. 분석 로직\n`);
    for (const path of p.paths) {
      lines.push(`\n### ${path.label}`);
      if (path.conditions?.length) lines.push(`- 조건: ${path.conditions.join(" AND ")}`);
      if (path.steps?.length) {
        lines.push(`- 산출:`);
        for (const s of path.steps) lines.push(`  - ${s.name} (${s.type}): ${s.expression}`);
      }
    }
    if (p.fallback?.label) lines.push(`\n### ${p.fallback.label} (Fallback)\n${p.fallback.reason || ""}`);
  }
  // 리포트
  if (p.report?.length) {
    lines.push(`\n## 5. 경로별 리포트 구성\n`);
    for (const r of p.report) {
      lines.push(`\n### ${r.pathLabel}`);
      for (const e of r.elements || []) {
        lines.push(`- ${e.kind} · ${e.label}${e.bind ? ` (bind: ${e.bind})` : ""}`);
      }
    }
  }
  return lines.join("\n");
}

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
  return (
    <Suspense fallback={null}>
      <BuilderInner />
    </Suspense>
  );
}

function BuilderInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("m0");
  const [schema, setSchema] = useState<AppSchema>(EMPTY_SCHEMA);
  const [appId, setAppId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // URL ?appId=... 로 진입 시 해당 앱 자동 로드
  useEffect(() => {
    const id = searchParams?.get("appId");
    if (!id || appId === id) return;
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("apps")
          .select("id, app_schema")
          .eq("id", id)
          .single();
        if (error || !data) throw new Error(error?.message || "앱을 찾을 수 없습니다");
        setSchema(data.app_schema);
        setAppId(data.id);
        setMsg("앱을 불러왔습니다");
      } catch (e: any) {
        setMsg("불러오기 실패: " + (e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 앱 리스트 모달
  const [listOpen, setListOpen] = useState(false);
  const [appList, setAppList] = useState<AppRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");

  // 발행 완료 모달
  // 전체 비우기 확인 모달
  const [confirmClear, setConfirmClear] = useState(false);

  // 앱 기획서 만들기 모달
  const [specGenOpen, setSpecGenOpen] = useState(false);
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [specGenBusy, setSpecGenBusy] = useState(false);
  const [specGenErr, setSpecGenErr] = useState("");
  const [specMarkdown, setSpecMarkdown] = useState("");
  // 탭별 프리뷰 (구조화된 응답)
  const [specPreview, setSpecPreview] = useState<any | null>(null);
  const [specPreviewTab, setSpecPreviewTab] = useState<"0" | "1" | "2" | "3" | "4" | "summary">("summary");

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
      // DB 의 ON DELETE CASCADE 가 app_runs 도 자동 정리해 줌.
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
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
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
      const hasFallback = !!parsed.fallback;
      const counts = {
        vReg: vars.filter((v) => v.grp === "규정").length,
        vPer: vars.filter((v) => v.grp === "개인").length,
        v: vars.length,
        // 조건: 각 경로의 conditions 합 + fallback 도 "대상 아님" 조건 1로 카운트
        j: (parsed.judge?.length || 0) + pathConditions + (hasFallback ? 1 : 0),
        s: (parsed.steps?.length || 0) + sharedSteps + pathSteps + fallbackSteps,
        r: (parsed.report?.length || 0) + pathReport + fallbackReport,
        // 경로: paths + fallback 도 1개 경로로 카운트
        p: paths.length + (hasFallback ? 1 : 0),
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
        llmRunning: false,
      });
      // LLM 분석은 파싱 시점에 미리 실행하지 않는다.
      // - 빌더 3탭 미리보기: 사용자가 직접 실행(테스트 값 기준)
      // - 라이브 앱: 사용자 입력값으로 자동 실행 (apps/[appId]/page.tsx)
    } catch (e: any) {
      const m = e?.message || String(e);
      setMsg("분석 실패: " + m);
      // 401 (로그인 만료) → 로그인 페이지로 안내
      if (m.includes("로그인") || m.includes("401")) {
        if (
          confirm(
            "기획서 분석 실패 — 로그인이 필요합니다.\n\n로그인 페이지로 이동할까요?"
          )
        ) {
          window.location.href = "/login?next=/admin/builder";
        }
      } else {
        alert("기획서 분석 실패\n\n" + m);
      }
    } finally {
      setBusy(false);
    }
  };

  // ── 앱 기획서 만들기 ──
  const openSpecGen = () => {
    setSpecGenErr("");
    setSpecMarkdown("");
    setSpecGenOpen(true);
  };

  const addSpecFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    setSpecFiles((prev) => {
      // 같은 이름·크기 중복 제거
      const key = (f: File) => `${f.name}::${f.size}`;
      const seen = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !seen.has(key(f)))];
    });
  };

  const removeSpecFile = (idx: number) =>
    setSpecFiles((prev) => prev.filter((_, i) => i !== idx));

  const generateSpec = async () => {
    if (specFiles.length === 0) {
      setSpecGenErr("참고 문서를 1개 이상 추가해 주세요");
      return;
    }
    setSpecGenBusy(true);
    setSpecGenErr("");
    setSpecMarkdown("");
    setSpecPreview(null);
    setSpecPreviewTab("summary");
    try {
      const files = await Promise.all(
        specFiles.map(async (f) => ({
          name: f.name,
          mimeType: guessMime(f),
          fileBase64: await fileToBase64(f),
        }))
      );
      const res = await fetch("/api/spec-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "생성 실패");
      }
      const preview = await res.json();
      setSpecPreview(preview);
    } catch (e: any) {
      const m = e?.message || String(e);
      setSpecGenErr(m);
      if (m.includes("로그인") || m.includes("401")) {
        if (
          confirm(
            "앱 기획서 생성 실패 — 로그인이 필요합니다.\n\n로그인 페이지로 이동할까요?"
          )
        ) {
          window.location.href = "/login?next=/admin/builder";
        }
      }
    } finally {
      setSpecGenBusy(false);
    }
  };

  const downloadSpecMd = () => {
    if (!specMarkdown) return;
    const blob = new Blob([specMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const m = specMarkdown.match(/^#\s+(.+)$/m);
    const base = (m?.[1] || "앱기획서").trim().replace(/[\\/:*?"<>|]/g, "_");
    a.download = `${base}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 프리뷰(JSON) → AppSchema 로 즉시 변환해 빌더에 채움 — LLM 호출 없음, 빠름.
  // 프리뷰가 없으면(레거시 markdown 경로) 기존 uploadSpec 파이프라인으로 폴백.
  const fillBuilderFromSpec = async () => {
    if (specPreview) {
      setBusy(true);
      setMsg("프리뷰를 빌더로 변환 중...");
      try {
        const res = await fetch("/api/preview-to-schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview: specPreview }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "변환 실패");
        }
        const schema: AppSchema = await res.json();
        setSchema(schema);
        setMsg("빌더 자동 채우기 완료 — 프리뷰 그대로 반영됨");
        setSpecGenOpen(false);
      } catch (e: any) {
        setMsg("변환 실패: " + (e?.message || e));
        alert("빌더 채우기 실패\n\n" + (e?.message || e));
      } finally {
        setBusy(false);
      }
      return;
    }
    // 폴백: markdown 만 있는 경우 (구버전 호환)
    if (!specMarkdown) return;
    const file = new File([specMarkdown], "생성된_앱기획서.md", {
      type: "text/markdown",
    });
    setSpecGenOpen(false);
    uploadSpec(file);
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
                <button
                  disabled={busy}
                  onClick={openSpecGen}
                  className={
                    "rounded-lg px-4 py-2 text-sm font-medium transition " +
                    (busy
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700")
                  }
                  title="참고 문서(규정·인사정보 등) 여러 개를 올리면 AI 가 빌더 탭별로 어떤 값이 들어갈지 분석합니다"
                >
                  ✍️ 참고 문서 분석
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
                  onClick={() => setConfirmClear(true)}
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

      {specGenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !specGenBusy && setSpecGenOpen(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  ✍️ 참고 문서 분석 — 탭별 프리뷰
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  참고 문서를 올리면 AI 가 빌더 탭별로 어떤 값이 들어갈지 분석하고, 각 항목마다 분석·도출 근거를 함께 제공합니다.
                  관리자는 이를 보고 설계 의도를 이해한 뒤, 필요한 부분을 직접 수정해 빌더에 반영할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => !specGenBusy && setSpecGenOpen(false)}
                  disabled={specGenBusy}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {/* 파일 추가 영역 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    참고 문서{" "}
                    <span className="text-xs font-normal text-gray-400">
                      (여러 개 · PDF·DOCX·TXT·이미지 등)
                    </span>
                  </span>
                  <label
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer " +
                      (specGenBusy
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-violet-600 text-white hover:bg-violet-700")
                    }
                  >
                    + 문서 추가
                    <input
                      type="file"
                      hidden
                      multiple
                      accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,image/*"
                      disabled={specGenBusy}
                      onChange={(e) => {
                        addSpecFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {specFiles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-xs text-gray-400">
                    아직 추가된 문서가 없습니다. "+ 문서 추가"로 참고 자료를 올려주세요.
                  </div>
                ) : (
                  <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {specFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-sm text-gray-400">📄</span>
                          <span className="text-xs text-gray-800 truncate">
                            {f.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0">
                            {(f.size / 1024).toFixed(0)}KB
                          </span>
                        </div>
                        <button
                          onClick={() => removeSpecFile(i)}
                          disabled={specGenBusy}
                          className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-40 shrink-0"
                        >
                          제거
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {specGenErr && (
                <div className="rounded-lg bg-rose-50 border-l-4 border-rose-400 px-3 py-2.5 text-xs text-rose-800">
                  생성 실패: {specGenErr}
                </div>
              )}

              {/* 탭별 프리뷰 */}
              {specPreview && (
                <SpecPreviewPanel
                  preview={specPreview}
                  tab={specPreviewTab}
                  setTab={setSpecPreviewTab}
                  onUpdate={(next) => setSpecPreview(next)}
                />
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] text-gray-500">
                {specGenBusy
                  ? "AI가 참고 문서를 분석해 탭별 프리뷰를 작성 중입니다…"
                  : specPreview
                  ? "탭별 프리뷰를 검토한 뒤 빌더에 자동으로 채울 수 있습니다."
                  : `참고 문서 ${specFiles.length}개`}
              </div>
              <div className="flex items-center gap-2">
                {specPreview && (
                  <button
                    onClick={fillBuilderFromSpec}
                    disabled={specGenBusy || busy}
                    className="rounded-lg bg-emerald-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    이 구성으로 빌더 자동 채우기 →
                  </button>
                )}
                <button
                  onClick={generateSpec}
                  disabled={specGenBusy || specFiles.length === 0}
                  className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  {specGenBusy
                    ? "분석 중…"
                    : specPreview
                    ? "다시 분석"
                    : "탭별 프리뷰 생성"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmClear && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
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
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">전체 비우기</h3>
              <p className="mt-2 text-sm text-gray-600">
                입력된 <b className="text-gray-900">모든 값(메타·변수·로직·리포트)</b>을 비웁니다.
                <br />
                계속하시겠습니까?
              </p>
              <div className="mt-4 rounded-lg bg-rose-50 border-l-4 border-rose-400 px-3 py-2.5 text-left">
                <p className="text-xs text-rose-800 leading-relaxed">
                  ⚠ 저장되지 않은 작업은 되돌릴 수 없습니다.
                  <br />
                  편집 중이던 앱 ID 도 함께 해제됩니다.
                </p>
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setSchema(EMPTY_SCHEMA);
                  setAppId(null);
                  setMsg("비웠습니다");
                  setConfirmClear(false);
                }}
                className="flex-1 py-3.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                비우기
              </button>
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
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-6 pb-4 text-center border-b border-gray-100">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">기획서 분석 완료</h3>
              <p className="mt-1.5 text-xs text-gray-500">
                각 탭별로 다음 항목이 추출되었습니다.
              </p>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-2.5 text-left">
              {/* ⓪ 앱 개요 */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 font-mono tracking-wider">
                    0탭
                  </span>
                  <span className="text-xs font-bold text-gray-900">앱 개요</span>
                </div>
                <div className="px-3 py-2.5 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 shrink-0">앱 명</span>
                    <span
                      className={
                        "font-semibold truncate " +
                        (parseResultModal.appName === "(없음)"
                          ? "text-gray-400 italic"
                          : "text-gray-900")
                      }
                    >
                      {parseResultModal.appName}
                    </span>
                  </div>
                </div>
              </div>

              {/* ① 규정 변수 */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 font-mono tracking-wider">
                      1탭
                    </span>
                    <span className="text-xs font-bold text-gray-900">규정 변수</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-600">
                    <b className="text-blue-700 tabular-nums">{parseResultModal.counts.vReg}</b>개
                  </span>
                </div>
              </div>

              {/* ② 개인 변수 */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 font-mono tracking-wider">
                      2탭
                    </span>
                    <span className="text-xs font-bold text-gray-900">개인 변수</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-600">
                    <b className="text-blue-700 tabular-nums">{parseResultModal.counts.vPer}</b>개
                  </span>
                </div>
              </div>

              {/* ③ 분석 로직 */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 font-mono tracking-wider">
                      3탭
                    </span>
                    <span className="text-xs font-bold text-gray-900">분석 로직</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-600">
                    총 경로 <b className="text-blue-700 tabular-nums">{parseResultModal.counts.p}</b>개
                    · 조건 <b className="text-blue-700 tabular-nums">{parseResultModal.counts.j}</b>개
                  </span>
                </div>
                {parseResultModal.pathBreakdown.length > 0 && (
                  <ul className="divide-y divide-gray-100">
                    {parseResultModal.pathBreakdown.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={
                              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white " +
                              (p.isFallback ? "bg-rose-500" : "bg-blue-500")
                            }
                          >
                            {p.isFallback ? "▣" : i + 1}
                          </span>
                          <span className="text-[11px] text-gray-700 truncate">
                            {p.label}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ④ 리포트 */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 font-mono tracking-wider">
                      4탭
                    </span>
                    <span className="text-xs font-bold text-gray-900">리포트 구성</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-600">
                    총 <b className="text-blue-700 tabular-nums">{parseResultModal.counts.r}</b>개
                  </span>
                </div>
                {parseResultModal.pathBreakdown.length > 0 && (
                  <ul className="divide-y divide-gray-100">
                    {parseResultModal.pathBreakdown.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={
                              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white " +
                              (p.isFallback ? "bg-rose-500" : "bg-blue-500")
                            }
                          >
                            {p.isFallback ? "▣" : i + 1}
                          </span>
                          <span className="text-[11px] text-gray-700 truncate">
                            {p.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-600 shrink-0">
                          <b className="text-gray-900 tabular-nums">{p.reportCount}</b>개
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {parseResultModal.llmCount > 0 && (
                <div className="rounded-lg border-l-4 border-violet-400 bg-violet-50 px-3 py-2.5">
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

function SpecPreviewPanel({
  preview,
  tab,
  setTab,
  onUpdate,
}: {
  preview: any;
  tab: string;
  setTab: (t: any) => void;
  onUpdate: (next: any) => void;
}) {
  const TABS: { key: string; label: string }[] = [
    { key: 'summary', label: '핵심 요약' },
    { key: '0', label: '⓪ 앱 개요' },
    { key: '1', label: '① 규정 변수' },
    { key: '2', label: '② 개인 변수' },
    { key: '3', label: '③ 분석 로직' },
    { key: '4', label: '④ 리포트' },
  ];
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-4 py-2.5 text-xs font-medium whitespace-nowrap transition border-b-2 ' +
              (tab === t.key
                ? 'border-violet-600 text-violet-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5 max-h-[68vh] overflow-auto">
        {tab === 'summary' && <PreviewSummary preview={preview} />}
        {tab === '0' && <PreviewMeta preview={preview} onUpdate={onUpdate} />}
        {tab === '1' && <PreviewVars preview={preview} grp="규정" onUpdate={onUpdate} />}
        {tab === '2' && <PreviewVars preview={preview} grp="개인" onUpdate={onUpdate} />}
        {tab === '3' && <PreviewPaths preview={preview} onUpdate={onUpdate} />}
        {tab === '4' && <PreviewReport preview={preview} />}
      </div>
    </div>
  );
}

function Reason({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="mt-2 rounded-md bg-violet-50/60 border-l-[3px] border-violet-300 px-2.5 py-1.5">
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 shrink-0 mt-0.5">분석 근거</span>
        <span className="text-[11px] text-gray-700 leading-relaxed">{children}</span>
      </div>
    </div>
  );
}

function SourceTag({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 ring-1 ring-blue-200 rounded px-1.5 py-0.5">
      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
      <span className="font-mono">{children}</span>
    </span>
  );
}

function PreviewSummary({ preview }: { preview: any }) {
  const r = preview.rationale || {};
  return (
    <div className="space-y-5 text-sm">
      {/* 안내 */}
      <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3.5 py-2.5 text-[12px] text-gray-700 leading-relaxed">
        각 항목은 <b className="text-violet-900">무엇인지</b>, <b className="text-violet-900">왜 도출했는지</b>, <b className="text-violet-900">어느 문서에서</b> 함께 표시됩니다.
        검토 후 직접 수정해 빌더에 반영할 수 있어요.
      </div>

      {/* 1. 설계 의도 */}
      {r.overall && (
        <section>
          <SectionHeader tone="violet" title="설계 의도" subtitle="이 앱이 무엇을, 어떻게 자동화하는지" />
          <div className="rounded-lg border border-violet-100 bg-white p-3.5 border-l-[3px] border-l-violet-400">
            <p className="text-gray-800 leading-relaxed text-[13px]">{r.overall}</p>
          </div>
        </section>
      )}

      {/* 2. 문서별 분석 기여 */}
      {(r.perDocument || []).length > 0 && (
        <section>
          <SectionHeader tone="blue" title="문서별 분석 기여" subtitle="각 참고 문서가 어디에 기여했는지" />
          <ul className="space-y-2">
            {r.perDocument.map((d: any, i: number) => (
              <li key={i} className="rounded-lg border border-gray-200 bg-white p-2.5 border-l-[3px] border-l-blue-300">
                <div className="flex items-start gap-2.5">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-700 text-[10px] font-mono font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-[12px] break-all">{d.name}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{d.contribution}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. 기타 분류 사유 */}
      {(r.others || []).length > 0 && (
        <section>
          <SectionHeader
            tone="amber"
            title={`기타 분류 사유 (${r.others.length}개)`}
            subtitle="빌더에 포함되지만 핵심 흐름엔 안 쓰는 항목"
          />
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {r.others.map((o: any, i: number) => (
              <li key={i} className="rounded-lg border border-amber-100 bg-amber-50/40 p-2.5">
                <div className="font-semibold text-amber-900 text-[12px] break-all">{o.name}</div>
                <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">{o.reason}</div>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[10px] text-gray-500 leading-relaxed">
            ⓘ 기타로 분류된 항목도 빌더의 "기타" 묶음에 자동으로 포함됩니다.
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle, tone = "gray" }: { title: string; subtitle?: string; tone?: "gray" | "violet" | "blue" | "amber" }) {
  const dotTone: Record<string, string> = {
    gray: "bg-gray-400",
    violet: "bg-violet-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className={"inline-block h-3.5 w-1 rounded-sm " + (dotTone[tone] || dotTone.gray)} />
      <div>
        <h4 className="text-[13px] font-bold text-gray-900">{title}</h4>
        {subtitle && <div className="text-[11px] text-gray-500">{subtitle}</div>}
      </div>
    </div>
  );
}

function PreviewMeta({ preview, onUpdate }: { preview: any; onUpdate: (next: any) => void }) {
  const m = preview.meta || {};
  const setM = (patch: any) => onUpdate({ ...preview, meta: { ...m, ...patch } });
  const setListItem = (key: string, idx: number, val: string) => {
    const arr = [...(m[key] || [])];
    arr[idx] = val;
    setM({ [key]: arr });
  };
  const addListItem = (key: string) => setM({ [key]: [...(m[key] || []), ""] });
  const removeListItem = (key: string, idx: number) => {
    const arr = [...(m[key] || [])];
    arr.splice(idx, 1);
    setM({ [key]: arr });
  };
  const inpCls = "w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200";
  return (
    <div className="space-y-3 text-sm">
      <EditRow k="앱 이름" v={m.appName} onChange={(v) => setM({ appName: v })} inpCls={inpCls} />
      <EditRow k="한 줄 요약" v={m.tagline} onChange={(v) => setM({ tagline: v })} inpCls={inpCls} />
      <EditRow k="목적" v={m.purpose} onChange={(v) => setM({ purpose: v })} inpCls={inpCls} multiline />
      <EditRow k="해결 문제" v={m.problem} onChange={(v) => setM({ problem: v })} inpCls={inpCls} multiline />
      <EditRow k="대상 사용자" v={m.users} onChange={(v) => setM({ users: v })} inpCls={inpCls} />
      <EditRow k="보안" v={m.security} onChange={(v) => setM({ security: v })} inpCls={inpCls} />
      <EditList k="기대 효과" items={m.effects || []} onChange={(i, v) => setListItem("effects", i, v)} onAdd={() => addListItem("effects")} onRemove={(i) => removeListItem("effects", i)} inpCls={inpCls} />
      <EditList k="핵심 특징" items={m.features || []} onChange={(i, v) => setListItem("features", i, v)} onAdd={() => addListItem("features")} onRemove={(i) => removeListItem("features", i)} inpCls={inpCls} />
      <EditList k="처리 흐름 (4단계)" items={m.flow || ["", "", "", ""]} onChange={(i, v) => setListItem("flow", i, v)} onAdd={(m.flow?.length ?? 0) < 4 ? () => addListItem("flow") : undefined} onRemove={(i) => removeListItem("flow", i)} inpCls={inpCls} fixed4 />
      {m.rationale && <Reason>{m.rationale}</Reason>}
      {(m.sources || []).length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {m.sources.map((s: string, i: number) => <SourceTag key={i}>{s}</SourceTag>)}
        </div>
      )}
    </div>
  );
}

function EditRow({ k, v, onChange, inpCls, multiline }: { k: string; v?: string; onChange: (v: string) => void; inpCls: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs items-start">
      <div className="text-gray-500 font-semibold pt-1.5">{k}</div>
      {multiline ? (
        <textarea value={v || ""} onChange={(e) => onChange(e.target.value)} className={inpCls + " min-h-[60px] leading-relaxed"} rows={2} />
      ) : (
        <input value={v || ""} onChange={(e) => onChange(e.target.value)} className={inpCls} />
      )}
    </div>
  );
}

function EditList({ k, items, onChange, onAdd, onRemove, inpCls, fixed4 }: { k: string; items: string[]; onChange: (i: number, v: string) => void; onAdd?: () => void; onRemove: (i: number) => void; inpCls: string; fixed4?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs items-start">
      <div className="text-gray-500 font-semibold pt-1.5">{k}</div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-400 w-5 shrink-0 text-right">{i + 1}.</span>
            <input value={it || ""} onChange={(e) => onChange(i, e.target.value)} className={inpCls} />
            {!fixed4 && (
              <button onClick={() => onRemove(i)} className="text-[10px] rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-rose-700 shrink-0">삭제</button>
            )}
          </div>
        ))}
        {onAdd && (
          <button onClick={onAdd} className="text-[11px] rounded border border-dashed border-violet-300 bg-violet-50/40 px-2 py-1 text-violet-700 hover:bg-violet-50">
            + 항목 추가
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 text-xs">
      <div className="text-gray-500 font-semibold">{k}</div>
      <div className="text-gray-900">{v}</div>
    </div>
  );
}

function PreviewVars({ preview, grp, onUpdate }: { preview: any; grp: '규정' | '개인'; onUpdate: (next: any) => void }) {
  const allVars = preview.vars || [];
  const vars = allVars.filter((v: any) => v.grp === grp);
  const core = vars.filter((v: any) => v.category === '핵심');
  const others = vars.filter((v: any) => v.category === '기타');
  const grpColor = grp === '규정' ? 'sky' : 'emerald';
  const grpEmoji = grp === '규정' ? '📋' : '👤';

  const updateVar = (idx: number, patch: any) => {
    const next = allVars.map((v: any, i: number) => (i === idx ? { ...v, ...patch } : v));
    onUpdate({ ...preview, vars: next });
  };
  const removeVar = (idx: number) => {
    const next = allVars.filter((_: any, i: number) => i !== idx);
    onUpdate({ ...preview, vars: next });
  };
  const addVar = () => {
    const newVar = { name: "", grp, type: "number", unit: grp === "규정" ? "원" : "", value: "", category: "핵심", source: "수기 추가", reason: "관리자가 수동으로 추가" };
    onUpdate({ ...preview, vars: [...allVars, newVar] });
  };
  const indexOfVar = (v: any) => allVars.indexOf(v);
  if (vars.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-gray-500 py-8 text-center">{grpEmoji} {grp} 변수가 없습니다.</div>
        <button onClick={addVar} className="w-full rounded-lg border border-dashed border-violet-300 bg-violet-50/40 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50">
          + {grp} 변수 추가
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {core.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-800 mb-2">{grpEmoji} 핵심 · {grp} ({core.length})</h4>
          <HierarchicalVarList vars={core} grpColor={grpColor} updateVar={updateVar} removeVar={removeVar} indexOfVar={indexOfVar} />
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-amber-800 mb-2">🗂 기타 · {grp} ({others.length})</h4>
          <HierarchicalVarList vars={others} grpColor="amber" updateVar={updateVar} removeVar={removeVar} indexOfVar={indexOfVar} />
        </div>
      )}
      <button onClick={addVar} className="w-full rounded-lg border border-dashed border-violet-300 bg-violet-50/40 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50">
        + {grp} 변수 추가
      </button>
    </div>
  );
}

function HierarchicalVarList({
  vars,
  grpColor,
  updateVar,
  removeVar,
  indexOfVar,
}: {
  vars: any[];
  grpColor: string;
  updateVar: (idx: number, patch: any) => void;
  removeVar: (idx: number) => void;
  indexOfVar: (v: any) => number;
}) {
  const hasHierarchy = vars.some((v) => v.group?.trim());
  const renderCard = (v: any) => (
    <VarCard
      key={indexOfVar(v)}
      v={v}
      grpColor={grpColor}
      onChange={(patch) => updateVar(indexOfVar(v), patch)}
      onRemove={() => removeVar(indexOfVar(v))}
    />
  );
  if (!hasHierarchy) {
    return <div className="space-y-2">{vars.map(renderCard)}</div>;
  }
  const groups: Record<string, Record<string, any[]>> = {};
  for (const v of vars) {
    const g = v.group?.trim() || '_미분류';
    const sg = v.subGroup?.trim() || '_기본';
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(v);
  }
  // 그룹명/하위명 일괄 변경 — 같은 묶음 안의 모든 변수에 적용
  const renameGroup = (oldName: string, newName: string) => {
    const safe = newName.trim();
    if (!safe || safe === oldName) return;
    for (const v of vars) {
      const cur = v.group?.trim() || '_미분류';
      if (cur === oldName) updateVar(indexOfVar(v), { group: safe });
    }
  };
  const renameSub = (gName: string, oldSub: string, newSub: string) => {
    const safe = newSub.trim();
    if (safe === oldSub) return;
    for (const v of vars) {
      const cg = v.group?.trim() || '_미분류';
      const csg = v.subGroup?.trim() || '_기본';
      if (cg === gName && csg === oldSub) updateVar(indexOfVar(v), { subGroup: safe });
    }
  };
  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([g, subs]) => (
        <details key={g} open className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <summary className="cursor-pointer select-none bg-gray-50 px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100">
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">
              {Object.values(subs).reduce((a, x) => a + x.length, 0)}개
            </span>
            <EditableLabel
              value={g === '_미분류' ? '' : g}
              placeholder="기타 (분류 없음)"
              onCommit={(next) => {
                const v = next.trim();
                if (!v) return; // 빈 값 입력 시 변경 안 함
                renameGroup(g, v);
              }}
              size="md"
            />
          </summary>
          <div className="p-2.5 space-y-2.5">
            {Object.entries(subs).map(([sg, items]) => (
              <div key={sg}>
                {sg !== '_기본' && (
                  <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="inline-block h-1 w-1 rounded-full bg-gray-400" />
                    <EditableLabel
                      value={sg}
                      placeholder="하위 묶음"
                      onCommit={(next) => {
                        const v = next.trim();
                        if (!v) return;
                        renameSub(g, sg, v);
                      }}
                      size="sm"
                    />
                  </div>
                )}
                <div className="space-y-1.5">{items.map(renderCard)}</div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

// 항상 input 박스로 표시되는 인라인 편집 라벨.
// summary 안에서도 작동하도록 모든 마우스/포커스 이벤트 전파 차단.
function EditableLabel({
  value,
  placeholder,
  onCommit,
  size = "md",
}: {
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
  size?: "sm" | "md";
}) {
  const [draft, setDraft] = useState(value);
  // 외부에서 value 가 바뀌면 draft 동기화
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  const inpCls =
    size === "sm"
      ? "rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-bold text-gray-800 hover:border-gray-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 min-w-[120px]"
      : "rounded-md border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-bold text-gray-800 hover:border-gray-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 min-w-[160px]";
  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => {
        // summary 의 토글 동작 방지
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      className={inpCls}
      title="클릭해서 이름 수정"
    />
  );
}

function VarCard({
  v,
  grpColor,
  onChange,
  onRemove,
}: {
  v: any;
  grpColor: string;
  onChange: (patch: any) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const grpBg: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-800 ring-sky-200',
    emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  };
  const inp = "rounded border border-gray-200 px-2 py-1 text-xs focus:border-violet-400 focus:outline-none";
  const cardAccent =
    grpColor === 'amber'
      ? 'border-l-amber-300'
      : grpColor === 'emerald'
      ? 'border-l-emerald-300'
      : 'border-l-sky-300';
  return (
    <div className={"rounded-lg border border-gray-100 bg-white p-3 shadow-sm border-l-[3px] " + cardAccent}>
      {/* 1단: 변수가 무엇인지 (what) */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <input
            value={v.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            className={inp + " text-sm font-bold text-gray-900 min-w-[160px]"}
            placeholder="변수명"
          />
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            <select value={v.type || 'number'} onChange={(e) => onChange({ type: e.target.value })} className="bg-transparent outline-none">
              <option value="number">number</option>
              <option value="text">text</option>
              <option value="date">date</option>
            </select>
          </span>
          {v.type === 'number' && (
            <input
              value={v.unit || ''}
              onChange={(e) => onChange({ unit: e.target.value })}
              className={inp + " w-14 text-center text-[10px] font-mono text-gray-600"}
              placeholder="단위"
            />
          )}
          <select
            value={v.category || '핵심'}
            onChange={(e) => onChange({ category: e.target.value })}
            className={"rounded-full text-[10px] font-mono px-2 py-0.5 ring-1 cursor-pointer " + (grpBg[grpColor] || grpBg.sky)}
          >
            <option value="핵심">핵심</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <button onClick={() => setExpanded((x) => !x)} className="text-[10px] rounded border border-gray-200 bg-white px-2 py-0.5 text-gray-600 hover:bg-gray-50">
          {expanded ? '접기' : '상세'}
        </button>
        <button
          onClick={onRemove}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          title="변수 삭제"
          aria-label="삭제"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 2단: 분석된 값 (what value) */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">분석된 값</span>
        <input
          value={v.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          className={inp + " flex-1 min-w-[140px] font-mono bg-yellow-50/40"}
          placeholder="(값 없음 — 입력 시 표시)"
        />
      </div>

      {/* 3단: 왜 이렇게 도출했나 (why) — 항상 보이게 */}
      {(v.reason || v.source) && !expanded && (
        <div className="mt-2 space-y-1.5">
          {v.reason && <Reason>{v.reason}</Reason>}
          {v.source && <div><SourceTag>{v.source}</SourceTag></div>}
        </div>
      )}

      {/* 상세 편집 — 분류/출처/이유 직접 수정 */}
      {expanded && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">상위 묶음</div>
              <input value={v.group || ''} onChange={(e) => onChange({ group: e.target.value })} className={inp + ' w-full'} placeholder="예: 경조사" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">하위 묶음</div>
              <input value={v.subGroup || ''} onChange={(e) => onChange({ subGroup: e.target.value })} className={inp + ' w-full'} placeholder="예: 결혼" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-0.5 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              출처
            </div>
            <input value={v.source || ''} onChange={(e) => onChange({ source: e.target.value })} className={inp + ' w-full font-mono text-blue-700'} placeholder="예: 참고 문서 1: 취업규칙.docx" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-0.5">분석 근거</div>
            <textarea value={v.reason || ''} onChange={(e) => onChange({ reason: e.target.value })} className={inp + ' w-full min-h-[56px] leading-relaxed'} placeholder="왜 이 변수를 선언했는지 / 어떻게 도출했는지 — 1~2 문장" rows={3} />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPaths({ preview, onUpdate }: { preview: any; onUpdate: (next: any) => void }) {
  const paths = preview.paths || [];
  const fb = preview.fallback || {};
  const updatePath = (idx: number, patch: any) => {
    const next = paths.map((p: any, i: number) => (i === idx ? { ...p, ...patch } : p));
    onUpdate({ ...preview, paths: next });
  };
  const updatePathCondition = (idx: number, ci: number, val: string) => {
    const conds = [...(paths[idx]?.conditions || [])];
    conds[ci] = val;
    updatePath(idx, { conditions: conds });
  };
  const addCondition = (idx: number) => {
    const conds = [...(paths[idx]?.conditions || []), ""];
    updatePath(idx, { conditions: conds });
  };
  const removeCondition = (idx: number, ci: number) => {
    const conds = [...(paths[idx]?.conditions || [])];
    conds.splice(ci, 1);
    updatePath(idx, { conditions: conds });
  };
  const removePath = (idx: number) => onUpdate({ ...preview, paths: paths.filter((_: any, i: number) => i !== idx) });
  const addPath = () => onUpdate({ ...preview, paths: [...paths, { label: "새 경로", conditions: [], steps: [], reason: "", source: "수기 추가" }] });
  const setFallback = (patch: any) => onUpdate({ ...preview, fallback: { ...fb, ...patch } });
  const inp = "rounded border border-gray-200 px-2 py-1 text-xs focus:border-violet-400 focus:outline-none";
  return (
    <div className="space-y-4 text-sm">
      {paths.map((p: any, i: number) => (
        <div key={i} className="rounded-lg border border-indigo-100 bg-white p-3.5 space-y-2 border-l-[3px] border-l-indigo-300">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">경로 {i + 1}</span>
            <input value={p.label || ''} onChange={(e) => updatePath(i, { label: e.target.value })} className={inp + " flex-1 text-sm font-bold text-gray-900"} placeholder="경로 라벨 (예: 결혼 경조사)" />
            <button
              onClick={() => removePath(i)}
              className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              title="경로 삭제"
              aria-label="경로 삭제"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-xs text-gray-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">진입 조건</div>
            <div className="space-y-1">
              {(p.conditions || []).map((c: string, ci: number) => (
                <div key={ci} className="flex items-center gap-1.5">
                  <input value={c} onChange={(e) => updatePathCondition(i, ci, e.target.value)} className={inp + " flex-1 font-mono"} placeholder='예: 경조이벤트유형 == "결혼"' />
                  <button
                    onClick={() => removeCondition(i, ci)}
                    className="inline-flex items-center justify-center h-5 w-5 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                    title="조건 삭제"
                  >
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button onClick={() => addCondition(i)} className="text-[11px] rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-gray-700 hover:bg-gray-100">+ 조건 추가</button>
            </div>
          </div>
          {p.steps?.length > 0 && (
            <div className="text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">산출 단계 (요약 — 빌더에서 상세 편집)</div>
              <ul className="text-gray-700 space-y-1 bg-gray-50 rounded p-2 border border-gray-100">
                {p.steps.map((s: any, j: number) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="text-[10px] font-mono bg-white text-gray-600 ring-1 ring-gray-200 rounded px-1.5 py-0.5 shrink-0">{s.type}</span>
                    <span><b className="text-gray-900">{s.name}</b> <span className="text-gray-400">·</span> <span className="font-mono text-gray-600">{s.expression}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">경로 의도</div>
            <textarea value={p.reason || ''} onChange={(e) => updatePath(i, { reason: e.target.value })} className={inp + " w-full min-h-[44px]"} placeholder="이 경로를 왜 만들었는지" rows={2} />
          </div>
        </div>
      ))}
      <button onClick={addPath} className="w-full rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
        + 경로 추가
      </button>
      {fb && (
        <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-3.5 space-y-2 border-l-[3px] border-l-rose-300">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-rose-100 text-rose-700 rounded px-1.5 py-0.5">Fallback</span>
            <input value={fb.label || ''} onChange={(e) => setFallback({ label: e.target.value })} className={inp + " flex-1 text-sm font-bold"} placeholder="미적용 라벨" />
          </div>
          <textarea value={fb.reason || ''} onChange={(e) => setFallback({ reason: e.target.value })} className={inp + " w-full min-h-[44px]"} placeholder="어떤 케이스가 fallback 으로 빠지는지" rows={2} />
        </div>
      )}
    </div>
  );
}

function PreviewReport({ preview }: { preview: any }) {
  const rep = preview.report || [];
  if (rep.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
        리포트 구성이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-5 text-sm">
      {rep.map((r: any, i: number) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* 경로 헤더 */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-[10px] font-mono bg-gray-200 text-gray-700 rounded px-1.5 py-0.5">
              경로 {i + 1}
            </span>
            <h4 className="text-sm font-bold text-gray-900">{r.pathLabel}</h4>
            <span className="ml-auto text-[10px] font-mono text-gray-600 bg-white rounded px-1.5 py-0.5 ring-1 ring-gray-200">
              요소 {(r.elements || []).length}개
            </span>
          </div>
          {/* 요소 리스트 */}
          <div className="p-3 space-y-2">
            {(r.elements || []).map((e: any, j: number) => (
              <ReportElementRow key={j} el={e} index={j + 1} />
            ))}
          </div>
          {/* 경로 리포트 의도 */}
          {r.reason && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <Reason>{r.reason}</Reason>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// kind 별 한글 라벨만 (색·아이콘 제거 — 차분한 UI)
const KIND_LABEL: Record<string, string> = {
  fields: "기본정보 묶음",
  field: "단일 항목",
  pathlabel: "경로 라벨",
  card: "결과 카드",
  compare: "비교표",
  calc: "계산식",
  incexc: "포함/제외",
  chart: "차트",
  note: "안내문",
};

function ReportElementRow({ el, index }: { el: any; index: number }) {
  const label = KIND_LABEL[el.kind] || el.kind || "요소";
  const binds = Array.isArray(el.bind)
    ? el.bind
    : typeof el.bind === "string" && el.bind.includes(",")
    ? el.bind.split(",").map((s: string) => s.trim())
    : el.bind
    ? [el.bind]
    : [];
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
      <div className="flex items-start gap-2.5">
        <span className="text-[10px] font-mono text-gray-400 shrink-0 mt-0.5 min-w-[16px] text-right">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          {/* kind 라벨 + 사용자 라벨 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-gray-500 bg-white ring-1 ring-gray-200 rounded px-1.5 py-0.5">
              {el.kind}
            </span>
            <span className="text-[11px] text-gray-600">{label}</span>
            {el.label && <span className="text-[12px] font-semibold text-gray-900">· {el.label}</span>}
          </div>
          {/* 연결된 변수 (bind/binds) */}
          {binds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">연결</span>
              {binds.map((b: string, i: number) => (
                <span
                  key={i}
                  className="text-[10px] font-mono bg-white text-gray-700 ring-1 ring-gray-200 rounded px-1.5 py-0.5"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
          {/* 템플릿 (note 용) */}
          {el.tpl && (
            <div className="mt-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">템플릿</div>
              <div className="text-[11px] text-gray-700 font-mono bg-white rounded px-2 py-1 mt-0.5 leading-relaxed border border-gray-100">
                {el.tpl}
              </div>
            </div>
          )}
          {/* 분석 근거 */}
          {el.reason && <Reason>{el.reason}</Reason>}
        </div>
      </div>
    </div>
  );
}

