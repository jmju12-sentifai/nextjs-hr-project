"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hasDoc, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc, ReportGuide } from "app-renderer";
import type { ReportProposal } from "@/lib/report-proposals";
import { withWorkingDoc } from "@/lib/report-workspace";
import DocChatEditor from "./DocChatEditor";
import { useReportGuide } from "./useReportGuide";

const emptyDoc: ReportDoc = { blocks: [] };
export default function DocProposalEditor({ schema, path, docMode, onModeChange, onApply, appId }: {
  appId?: string | null; schema: AppSchema; path: Path; docMode: boolean;
  onModeChange: (doc: boolean) => void; onApply: (doc?: ReportDoc) => void;
}) {
  const loaded = useReportGuide();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<{ id: number; content: string }>();
  const activityId = useRef(0);
  const say = (content: string) => setActivity({ id: ++activityId.current, content });
  const [proposals, setProposals] = useState<ReportProposal[]>([]);
  const [selected, setSelected] = useState(0);
  const [responseGuide, setResponseGuide] = useState<ReportGuide | null>(null);
  const [source, setSource] = useState("");
  const sourceDoc = useRef<ReportDoc>();
  const workingDoc = useRef<ReportDoc>(path.doc || emptyDoc);
  const [confirmGrid, setConfirmGrid] = useState(false);
  const abort = useRef<AbortController>();
  const guide = responseGuide || loaded.guide;
  const fingerprint = JSON.stringify(schema);
  const proposal = proposals[selected];
  const blocked = busy || editing;
  useEffect(() => () => abort.current?.abort(), []);

  function close() {
    setProposals([]);
    say("제안 비교를 마치고 편집하던 양식으로 돌아왔습니다.");
  }
  async function propose() {
    if (blocked) return;
    setBusy(true); setSource(fingerprint);
    sourceDoc.current = workingDoc.current.blocks.length ? workingDoc.current : undefined;
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/report-doc/propose", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: withWorkingDoc(schema, path.id, sourceDoc.current), appId, pathId: path.id }), signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "양식 제안을 가져오지 못했습니다.");
      if (!data.proposals?.length) throw new Error("양식을 만들지 못했습니다. 다시 제안받아 주세요.");
      setResponseGuide(data.guide); setProposals(data.proposals); setSelected(0);
      say(`양식 ${data.proposals.length}개를 준비했습니다. 바꾸고 싶은 내용을 말씀해 주세요.`);
    } catch (e) { if (!controller.signal.aborted) say(e instanceof Error ? e.message : "다시 시도해 주세요."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function apply() {
    if (!proposal || blocked) return;
    if (fingerprint !== source) { say("제안 이후 앱 구성이 바뀌었습니다. 다시 제안받아 주세요."); return; }
    const checked = validateDoc(schema, path.id, proposal.doc, { guide, previous: sourceDoc.current, proposal: true });
    if (!checked.ok) { say(checked.errors[0].message); return; }
    onApply(proposal.doc); setProposals([]);
    say(`${proposal.name}을 편집 양식으로 선택했습니다. 계속 다듬은 뒤 ‘양식 확정’을 누르면 저장됩니다.`);
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="리포트 방식">
        <button type="button" disabled={blocked} aria-pressed={!docMode} className={`rounded-md px-4 py-2 text-sm ${!docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => hasDoc(path) ? setConfirmGrid(true) : onModeChange(false)}>그리드</button>
        <button type="button" disabled={blocked} aria-pressed={docMode} className={`rounded-md px-4 py-2 text-sm ${docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => onModeChange(true)}>문서형</button>
      </div>
      <Link href="/admin/report-guide" target="_blank" className="text-sm text-slate-500 hover:text-blue-700">공통 가이드 ↗</Link>
    </div>
    {confirmGrid && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p>현재 경로의 문서형 양식을 제거하고 기존 그리드로 돌아갈까요? 저장 전까지 앱에는 반영되지 않습니다.</p>
      <div className="mt-3 flex gap-2"><button disabled={blocked} className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => { onApply(undefined); onModeChange(false); setProposals([]); setConfirmGrid(false); }}>양식 제거 후 전환</button>
        <button className="rounded border px-3 py-2" onClick={() => setConfirmGrid(false)}>취소</button></div>
    </div>}
    {docMode && <DocChatEditor key={`${appId}:${path.id}`} schema={schema} path={{ ...path, doc: path.doc || emptyDoc }} appId={appId} accent={guide.accent} onConfirm={onApply}
      previewDoc={proposal?.doc} previewKey={proposal?.id} previewDescription={proposal?.reason}
      onPreviewChange={doc => setProposals(items => items.map((item, i) => i === selected ? { ...item, doc } : item))}
      onWorkingDocChange={doc => { workingDoc.current = doc; }} onBusyChange={setEditing}
      activity={activity} externalBusy={busy ? "새 양식을 만드는 중" : ""} externalError={loaded.error || ""}
      tabs={proposal ? <div className="flex flex-wrap gap-1" aria-label="제안 양식">{proposals.map((p, i) => <button key={p.id} disabled={blocked} aria-pressed={selected === i} onClick={() => setSelected(i)} className={`rounded-lg px-3 py-2 text-sm ${selected === i ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"}`}>{p.name}</button>)}<button disabled={blocked} onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 disabled:opacity-40">{hasDoc(path) ? "기존 양식" : "취소"}</button></div> : undefined}
      toolbar={<>
        <button disabled={blocked || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">{busy ? "양식 만드는 중…" : "새 양식 제안"}</button>
        {busy && <button className="text-sm underline" onClick={() => { abort.current?.abort(); setBusy(false); say("양식 생성을 취소했습니다."); }}>생성 취소</button>}
        {proposal && <button disabled={blocked} onClick={apply} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">이 안으로 선택</button>}
      </>} />}
  </section>;
}
