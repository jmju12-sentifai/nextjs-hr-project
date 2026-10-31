"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_REPORT_GUIDE, DOC_BLOCK_LABELS, validateReportGuide } from "app-renderer";
import type { DocBlockType, ReportGuide } from "app-renderer";
import { useReportGuide } from "../builder/components/useReportGuide";

export default function ReportGuidePage() {
  const loaded = useReportGuide();
  const [guide, setGuide] = useState<ReportGuide>(DEFAULT_REPORT_GUIDE);
  const [banned, setBanned] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (!loaded.loading) { setGuide(loaded.guide); setBanned(loaded.guide.banned.join("\n")); } }, [loaded.loading, loaded.guide]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMessage(""); setError("");
    const value = { ...guide, banned: Array.from(new Set(banned.split("\n").map(s => s.trim()).filter(Boolean))) };
    if (!validateReportGuide(value)) { setError("강조색은 흰 글씨가 읽히는 어두운 색으로 선택하고 입력 길이를 확인해 주세요."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/report-guide", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setGuide(data.guide); setMessage("공통 가이드를 저장했습니다. 열려 있는 리포트는 새로고침하면 새 강조색을 적용합니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8"><div className="mx-auto max-w-3xl">
    <Link href="/admin/applist" className="text-sm text-blue-700">← 앱 목록</Link>
    <h1 className="mt-5 text-2xl font-bold text-slate-900">사이트 공통 리포트 가이드</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">모든 앱의 문서형 리포트에 적용할 기준입니다. 강조색은 기존 문서에도 적용되며, 필수 표현·금지 표현·문체는 새 AI 제안에 적용됩니다.</p>
    {loaded.error && <p role="alert" className="mt-4 text-sm text-red-700">{loaded.error}</p>}
    {!loaded.loading && !loaded.available && !loaded.error && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">현재 기본 가이드로 동작합니다. 저장 기능은 운영 담당자의 준비가 필요합니다.</p>}
    <form onSubmit={save} className="mt-6 space-y-6 rounded-2xl border bg-white p-5 sm:p-8">
      <fieldset disabled={loaded.loading || !!loaded.error || busy} className="space-y-6 disabled:opacity-60">
        <div><label htmlFor="accent" className="block text-sm font-semibold">강조색</label><div className="mt-2 flex flex-wrap items-center gap-3">
          <input id="accent" type="color" value={guide.accent} onChange={e => setGuide({ ...guide, accent: e.target.value })} className="h-10 w-14 cursor-pointer rounded border" />
          <span style={{ background: guide.accent }} className="rounded-lg px-4 py-2 text-sm font-semibold text-white">결과 강조 예시</span><span className="text-sm text-slate-500">{guide.accent}</span></div>
          <p className="mt-2 text-xs text-slate-500">흰 글씨와 충분히 구분되는 색을 선택해 주세요.</p></div>
        <div><p className="text-sm font-semibold">필수 표현</p><p className="mt-1 text-xs leading-5 text-slate-500">모든 양식에 반드시 포함합니다. 산식·산정표·구간표 등은 해당 계산 단계가 있는 앱에서만 사용할 수 있습니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(DOC_BLOCK_LABELS).filter(([k]) => !["element", "pagebreak"].includes(k)).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={guide.required.includes(key as DocBlockType)} onChange={e => setGuide({ ...guide, required: e.target.checked ? [...guide.required, key as DocBlockType] : guide.required.filter(k => k !== key) })} />{label}</label>)}</div></div>
        <label className="block text-sm font-semibold">금지 표현<textarea rows={3} maxLength={3000} value={banned} onChange={e => setBanned(e.target.value)} className="mt-2 block w-full rounded-lg border p-3 font-normal" placeholder="한 줄에 한 표현씩 입력" /></label>
        <label className="block text-sm font-semibold">문체<textarea rows={3} maxLength={1000} value={guide.tone} onChange={e => setGuide({ ...guide, tone: e.target.value })} className="mt-2 block w-full rounded-lg border p-3 font-normal" /></label>
        <button disabled={!loaded.available} className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "저장 중…" : "공통 가이드 저장"}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-blue-800">{message}</p>}
    </form>
  </div></main>;
}
