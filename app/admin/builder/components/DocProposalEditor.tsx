"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hasDoc, stableJson, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc } from "app-renderer";
import { reportCalculationKey, withWorkingDoc, type ReportChatState } from "@/lib/report-workspace";
import DocChatEditor from "./DocChatEditor";
import { useReportGuide } from "./useReportGuide";
import { useReportWorkspace } from "./useReportWorkspace";

const emptyDoc: ReportDoc = { blocks: [] };
export default function DocProposalEditor({ schema, path, docMode, onModeChange, onApply, appId }: {
  appId?: string | null; schema: AppSchema; path: Path; docMode: boolean;
  onModeChange: (doc: boolean) => void; onApply: (doc?: ReportDoc) => void;
}) {
  const loaded = useReportGuide();
  const session = useReportWorkspace(appId, path.id, schema, docMode);
  const { workspace, update, flush } = session;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<{ id: number; content: string }>();
  const activityId = useRef(0);
  const say = (content: string) => setActivity({ id: ++activityId.current, content });
  const proposals = workspace?.proposals || [];
  const selected = workspace?.selected || 0;
  const workingDoc = useRef<ReportDoc>(path.doc || emptyDoc);
  const [confirmGrid, setConfirmGrid] = useState(false);
  const abort = useRef<AbortController>();
  const guide = workspace?.guide || loaded.guide;
  const fingerprint = reportCalculationKey(schema);
  const proposal = proposals[selected];
  const blocked = busy || editing || !workspace;
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (workspace?.docMode && !docMode) onModeChange(true);
    if (workspace && !workspace.docMode && docMode) { if (hasDoc(path)) onApply(undefined); onModeChange(false); }
  }, [workspace, docMode, path, onApply, onModeChange]);
  const rememberChat = useCallback((chat: ReportChatState) => update(w => ({ ...w, chat })), [update]);
  const beforeSave = useCallback(async () => { await flush(); }, [flush]);
  const saved = useCallback((doc: ReportDoc) => {
    update(w => ({ ...w, savedDoc: stableJson(doc), proposals: [], selected: 0, sourceDoc: undefined }));
    onApply(doc);
  }, [update, onApply]);

  function close() {
    update(w => ({ ...w, proposals: [], selected: 0 }));
    say("제안 비교를 마치고 편집하던 양식으로 돌아왔습니다.");
  }
  async function propose() {
    if (blocked) return;
    setBusy(true);
    const sourceDoc = workingDoc.current.blocks.length ? workingDoc.current : undefined;
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/report-doc/propose", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: withWorkingDoc(schema, path.id, sourceDoc), appId, pathId: path.id }), signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "양식 제안을 가져오지 못했습니다.");
      if (!data.proposals?.length) throw new Error("양식을 만들지 못했습니다. 다시 제안받아 주세요.");
      update(w => ({ ...w, calculation: fingerprint, guide: data.guide, proposals: data.proposals, selected: 0, sourceDoc, docMode: true }));
      say(`양식 ${data.proposals.length}개를 준비했습니다. 바꾸고 싶은 내용을 말씀해 주세요.`);
    } catch (e) { if (!controller.signal.aborted) say(e instanceof Error ? e.message : "다시 시도해 주세요."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function apply() {
    if (!proposal || blocked) return;
    if (fingerprint !== workspace?.calculation) { say("제안 이후 앱 구성이 바뀌었습니다. 다시 제안받아 주세요."); return; }
    const checked = validateDoc(schema, path.id, proposal.doc, { guide, previous: workspace?.sourceDoc, proposal: true });
    if (!checked.ok) { say(checked.errors[0].message); return; }
    onApply(proposal.doc); update(w => ({ ...w, proposals: [], selected: 0, chat: w.chat && { ...w.chat, draft: proposal.doc } }));
    say(`${proposal.name}을 선택했습니다. ‘저장’을 누르면 이용자 리포트에 반영됩니다.`);
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="리포트 방식">
        <button type="button" disabled={blocked} aria-pressed={!docMode} className={`rounded-md px-4 py-2 text-sm ${!docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => hasDoc(path) ? setConfirmGrid(true) : (update(w => ({ ...w, docMode: false })), onModeChange(false))}>그리드</button>
        <button type="button" disabled={blocked} aria-pressed={docMode} className={`rounded-md px-4 py-2 text-sm ${docMode ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
          onClick={() => { update(w => ({ ...w, docMode: true })); onModeChange(true); }}>문서형</button>
      </div>
      <Link href="/admin/report-guide" target="_blank" className="text-sm text-slate-500 hover:text-blue-700">공통 가이드 ↗</Link>
    </div>
    {confirmGrid && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p>현재 경로의 문서형 양식을 제거하고 기존 그리드로 돌아갈까요? 저장 전까지 앱에는 반영되지 않습니다.</p>
      <div className="mt-3 flex gap-2"><button disabled={blocked} className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => { onApply(undefined); onModeChange(false); update(w => ({ ...w, proposals: [], selected: 0, docMode: false, chat: undefined })); setConfirmGrid(false); }}>양식 제거 후 전환</button>
        <button className="rounded border px-3 py-2" onClick={() => setConfirmGrid(false)}>취소</button></div>
    </div>}
    {!workspace && <div className="p-4 text-sm text-slate-500">{session.error || "작업 기록을 불러오는 중…"}{session.error && <button onClick={session.retry} className="ml-3 underline">다시 불러오기</button>}</div>}
    {docMode && workspace && <DocChatEditor key={`${appId}:${path.id}`} schema={schema} path={{ ...path, doc: path.doc || emptyDoc }} appId={appId} accent={guide.accent} onConfirm={saved}
      initialState={workspace.chat} onStateChange={rememberChat} onBeforeSave={beforeSave} savedDocKey={workspace.savedDoc}
      previewDoc={proposal?.doc} previewKey={proposal?.id} previewDescription={proposal?.reason}
      onPreviewChange={doc => update(w => ({ ...w, proposals: w.proposals.map((item, i) => i === selected ? { ...item, doc } : item) }))}
      onWorkingDocChange={doc => { workingDoc.current = doc; }} onBusyChange={setEditing}
      activity={activity} externalBusy={busy ? "새 양식을 만드는 중" : ""} externalError={session.error || loaded.error || ""}
      tabs={proposal ? <div className="flex flex-wrap gap-1" aria-label="제안 양식">{proposals.map((p, i) => <button key={p.id} disabled={blocked} aria-pressed={selected === i} onClick={() => update(w => ({ ...w, selected: i }))} className={`rounded-lg px-3 py-2 text-sm ${selected === i ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"}`}>{p.name}</button>)}<button disabled={blocked} onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 disabled:opacity-40">{hasDoc(path) ? "기존 양식" : "취소"}</button></div> : undefined}
      toolbar={<>
        <button disabled={blocked || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">{busy ? "양식 만드는 중…" : "새 양식 제안"}</button>
        {busy && <button className="text-sm underline" onClick={() => { abort.current?.abort(); setBusy(false); say("양식 생성을 취소했습니다."); }}>생성 취소</button>}
        {proposal && <button disabled={blocked} onClick={apply} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">이 안으로 선택</button>}
      </>} />}
  </section>;
}
