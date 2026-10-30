"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { hasDoc, run, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc, ReportGuide } from "app-renderer";
import type { ReportProposal } from "@/lib/report-proposals";
import DocReport from "./DocReport";
import DocChatEditor from "./DocChatEditor";
import { useReportGuide } from "./useReportGuide";

const purposes = [{ id: "print", label: "출력·전달" }, { id: "screen", label: "화면 확인" }, { id: "review", label: "담당자 검토" }] as const;

export default function DocProposalEditor({ schema, path, docMode, onModeChange, onApply, appId }: {
  appId?: string | null; schema: AppSchema; path: Path; docMode: boolean;
  onModeChange: (doc: boolean) => void; onApply: (doc?: ReportDoc) => void;
}) {
  const loaded = useReportGuide();
  const [purpose, setPurpose] = useState<ReportGuide["defaultPurpose"] | "">("");
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
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const guide = responseGuide || loaded.guide;
  const fingerprint = JSON.stringify(schema);
  const preview = useMemo(() => run(schema, [], [], path.id), [schema, path.id]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (proposals.length) dialog.current?.showModal();
    else { dialog.current?.close(); trigger.current?.focus(); }
  }, [proposals]);
  function close() { setProposals([]); setConfirmApply(false); }
  async function propose() {
    setBusy(true); setError(""); setNotice(""); setSource(fingerprint);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/report-doc/propose", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, appId, pathId: path.id, purpose: purpose || loaded.guide.defaultPurpose }), signal: controller.signal });
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
      <Link href="/admin/report-guide" target="_blank" className="text-sm text-blue-700 underline underline-offset-4">사이트 공통 가이드 ↗</Link>
    </div>
    {confirmGrid && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p>현재 경로의 문서형 양식을 제거하고 기존 그리드로 돌아갈까요? 저장 전까지 앱에는 반영되지 않습니다.</p>
      <div className="mt-3 flex gap-2"><button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => { onApply(undefined); onModeChange(false); setConfirmGrid(false); setNotice(""); }}>양식 제거 후 전환</button>
        <button className="rounded border px-3 py-2" onClick={() => setConfirmGrid(false)}>취소</button></div>
    </div>}
    {docMode && <>
      <details open={hasDoc(path) ? undefined : true} className="rounded-2xl border border-blue-100 bg-blue-50/60">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-blue-900">{hasDoc(path) ? "다른 양식 제안받기" : "AI 양식 제안"}</summary>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h3 className="text-lg font-bold text-slate-900">이 결과에 맞는 양식을 제안받으세요</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">통지문형·요약형·상세표형을 비교하고 하나를 선택합니다. 숫자는 계산 결과로 채워지며, 미리보기에는 현재 경로의 테스트 값을 사용합니다.</p></div>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-blue-800">{path.label}</span>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-slate-700">주로 사용할 용도
            <select className="mt-1 block rounded-lg border bg-white px-3 py-2.5" value={purpose || loaded.guide.defaultPurpose} onChange={e => setPurpose(e.target.value as ReportGuide["defaultPurpose"])} disabled={busy}>
              {purposes.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <button ref={trigger} disabled={busy || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "양식을 구성하고 검증하는 중…" : "AI 양식 제안"}</button>
          {busy && <button className="px-3 py-2 text-sm underline" onClick={() => { abort.current?.abort(); setBusy(false); }}>대기 취소</button>}
        </div>
        {!loaded.loading && !loaded.available && !loaded.error && <p className="mt-3 text-xs text-slate-600">공통 가이드 저장 준비 전에는 기본 가이드로 제안합니다.</p>}
        {loaded.error && <p role="alert" className="mt-3 text-sm text-red-700">{loaded.error} 페이지를 새로고침해 주세요.</p>}
      </div>
      </details>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
      {hasDoc(path) ? <DocChatEditor key={`${appId}:${path.id}`} schema={schema} path={path} appId={appId} accent={guide.accent} onConfirm={onApply} />
        : <div className="rounded-2xl border border-dashed p-10 text-center text-sm leading-6 text-slate-500">아직 선택한 문서형 양식이 없습니다.<br />AI 제안을 선택한 뒤 저장하면 이 경로에 적용됩니다.</div>}
    </>}
    <dialog ref={dialog} onCancel={close} aria-labelledby="proposal-title" className="m-auto max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-y-auto rounded-2xl bg-slate-100 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
      {proposals[selected] && <>
        <div className="sticky top-0 z-10 border-b bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><h3 id="proposal-title" className="text-lg font-bold">{path.label} · 양식 비교</h3><button aria-label="양식 비교 닫기" onClick={close} className="rounded-lg border px-3 py-2 text-sm">닫기</button></div>
          <div className="mt-4 flex flex-wrap gap-2">{proposals.map((p, i) => <button key={p.id} aria-pressed={selected === i} onClick={() => { setSelected(i); setConfirmApply(false); }} className={`rounded-lg px-4 py-2 text-sm ${selected === i ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{p.name}{p.id === (purpose || loaded.guide.defaultPurpose) ? " · 추천 용도" : ""}</button>)}</div>
        </div>
        <div className="p-3 sm:p-6">
          {notice && <p role="status" className="mb-3 text-sm text-amber-800">{notice}</p>}
          <div className="mb-5 rounded-xl border bg-white p-4 text-sm leading-6"><p>{proposals[selected].reason}</p>
            {proposals[selected].excluded.length > 0 && <details className="mt-2 text-slate-600"><summary className="cursor-pointer">제외한 지표와 이유</summary><ul className="mt-2 list-disc pl-5">{proposals[selected].excluded.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
          </div>
          <DocReport schema={schema} path={{ ...path, doc: proposals[selected].doc }} result={preview} accent={guide.accent} />
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-white p-4">
          <p className="text-xs text-slate-500">{confirmApply ? "현재 문서형 양식을 이 안으로 바꿀까요?" : "선택 후 앱을 저장하면 이용자에게 반영됩니다."}</p>
          <div className="flex gap-2">{confirmApply && <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setConfirmApply(false)}>취소</button>}
            <button className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white" onClick={() => hasDoc(path) && !confirmApply ? setConfirmApply(true) : apply()}>{confirmApply ? "양식 바꾸기" : "이 안으로 선택"}</button></div>
        </div>
      </>}
    </dialog>
  </section>;
}
