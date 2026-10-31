"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { hasDoc, run, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc, ReportGuide } from "app-renderer";
import type { ReportProposal } from "@/lib/report-proposals";
import DocReport from "./DocReport";
import DocChatEditor from "./DocChatEditor";
import { useReportGuide } from "./useReportGuide";

export default function DocProposalEditor({ schema, path, docMode, onModeChange, onApply, appId }: {
  appId?: string | null; schema: AppSchema; path: Path; docMode: boolean;
  onModeChange: (doc: boolean) => void; onApply: (doc?: ReportDoc) => void;
}) {
  const loaded = useReportGuide();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposals, setProposals] = useState<ReportProposal[]>([]);
  const [selected, setSelected] = useState(0);
  const [responseGuide, setResponseGuide] = useState<ReportGuide | null>(null);
  const [source, setSource] = useState("");
  const [confirmGrid, setConfirmGrid] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const abort = useRef<AbortController>();
  const comparison = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const guide = responseGuide || loaded.guide;
  const fingerprint = JSON.stringify(schema);
  const preview = useMemo(() => run(schema, [], [], path.id), [schema, path.id]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (proposals.length) {
      comparison.current?.focus({ preventScroll: true });
      comparison.current?.scrollIntoView({ block: "start" });
    }
  }, [proposals]);
  function close() { setProposals([]); setConfirmApply(false); trigger.current?.focus(); }
  async function propose() {
    setBusy(true); setError(""); setNotice(""); setSource(fingerprint);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/report-doc/propose", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, appId, pathId: path.id }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "양식 제안을 가져오지 못했습니다.");
      setResponseGuide(data.guide); setProposals(data.proposals); setSelected(0);
      if (data.rejected?.length) setNotice(`${data.proposals.length}개 안이 검증을 통과했습니다. 나머지 안은 검증에 통과하지 못해 표시하지 않았습니다.`);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "다시 시도해 주세요."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function apply() {
    const proposal = proposals[selected];
    if (fingerprint !== source) { setError("제안 이후 앱 구성이 바뀌었습니다. 다시 제안받아 주세요."); close(); return; }
    const checked = validateDoc(schema, path.id, proposal.doc, { guide, previous: path.doc, proposal: true });
    if (!checked.ok) { setError(checked.errors[0].message); close(); return; }
    onApply(proposal.doc); close(); setNotice("양식을 적용했습니다. 상단의 저장 버튼을 눌러 앱에 반영해 주세요.");
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="리포트 방식">
        <button type="button" aria-pressed={!docMode} className={`rounded-md px-4 py-2 text-sm ${!docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => hasDoc(path) ? setConfirmGrid(true) : onModeChange(false)}>그리드</button>
        <button type="button" aria-pressed={docMode} className={`rounded-md px-4 py-2 text-sm ${docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => onModeChange(true)}>문서형</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/report-guide" target="_blank" className="text-sm text-slate-500 hover:text-blue-700">공통 가이드 ↗</Link>
        {docMode && <button ref={trigger} disabled={busy || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "양식 만드는 중…" : hasDoc(path) ? "새 양식 제안" : "AI 양식 제안"}</button>}
        {busy && <button className="text-sm underline" onClick={() => { abort.current?.abort(); setBusy(false); }}>취소</button>}
      </div>
    </div>
    {confirmGrid && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p>현재 경로의 문서형 양식을 제거하고 기존 그리드로 돌아갈까요? 저장 전까지 앱에는 반영되지 않습니다.</p>
      <div className="mt-3 flex gap-2"><button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => { onApply(undefined); onModeChange(false); setConfirmGrid(false); setNotice(""); }}>양식 제거 후 전환</button>
        <button className="rounded border px-3 py-2" onClick={() => setConfirmGrid(false)}>취소</button></div>
    </div>}
    {docMode && <>
      {loaded.error && <p role="alert" className="text-sm text-red-700">{loaded.error}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
      {proposals[selected] && <section ref={comparison} tabIndex={-1} aria-label="양식 비교" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-900 outline-none">
        <div className="sticky top-0 z-10 rounded-t-2xl border-b bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">양식 비교</h3>
            <div className="flex items-center gap-2">
              <button disabled={busy} onClick={close} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">취소</button>
              <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => hasDoc(path) && !confirmApply ? setConfirmApply(true) : apply()}>{confirmApply ? "양식 바꾸기" : "이 안으로 선택"}</button>
            </div>
          </div>
          {confirmApply && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600"><p>현재 양식을 이 안으로 바꿀까요?</p><button className="underline" onClick={() => setConfirmApply(false)}>기존 양식 유지</button></div>}
          {proposals.length > 1 && <div className="mt-4 flex flex-wrap gap-2">{proposals.map((p, i) => <button key={p.id} aria-pressed={selected === i} onClick={() => { setSelected(i); setConfirmApply(false); }} className={`rounded-lg px-4 py-2 text-sm ${selected === i ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{p.name}</button>)}</div>}
        </div>
        <div className="relative z-0 p-3 sm:p-6">
          <div className="mb-5 rounded-xl border bg-white p-4 text-sm leading-6"><p>{proposals[selected].reason}</p>
            {proposals[selected].excluded.length > 0 && <details className="mt-2 text-slate-600"><summary className="cursor-pointer">제외한 지표와 이유</summary><ul className="mt-2 list-disc pl-5">{proposals[selected].excluded.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
          </div>
          <DocReport schema={schema} path={{ ...path, doc: proposals[selected].doc }} result={preview} accent={guide.accent} />
        </div>
      </section>}
      {/* 제안을 비교하는 동안에도 기존 대화와 초안을 보존한다. */}
      <div hidden={proposals.length > 0}>
        {hasDoc(path) ? <DocChatEditor key={`${appId}:${path.id}`} schema={schema} path={path} appId={appId} accent={guide.accent} onConfirm={onApply} />
          : <div className="rounded-2xl border border-dashed p-10 text-center text-sm leading-6 text-slate-500">AI 양식 제안을 눌러 시작하세요.</div>}
      </div>
    </>}
  </section>;
}
