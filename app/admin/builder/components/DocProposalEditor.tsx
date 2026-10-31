"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { hasDoc, stableJson, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc } from "app-renderer";
import { reportCalculationKey, withWorkingDoc, type ReportChatState } from "@/lib/report-workspace";
import DocChatEditor from "./DocChatEditor";
import { useReportGuide } from "./useReportGuide";
import { useReportWorkspace } from "./useReportWorkspace";
import { useReportProposalJob } from "./useReportProposalJob";

const emptyDoc: ReportDoc = { blocks: [] };
export default function DocProposalEditor({ schema, path, onApply, appId }: {
  appId?: string | null; schema: AppSchema; path: Path;
  onApply: (doc: ReportDoc) => void;
}) {
  const loaded = useReportGuide();
  const session = useReportWorkspace(appId, path.id, schema);
  const { workspace, update, flush } = session;
  const generation = useReportProposalJob(appId, path.id, schema, workspace, update);
  const busy = generation.busy;
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<{ id: number; content: string }>();
  const activityId = useRef(0);
  const say = (content: string) => setActivity({ id: ++activityId.current, content });
  const proposals = workspace?.proposals || [];
  const selected = workspace?.selected || 0;
  const workingDoc = useRef<ReportDoc>(path.doc || emptyDoc);
  const guide = workspace?.guide || loaded.guide;
  const fingerprint = reportCalculationKey(schema);
  const proposal = proposals[selected];
  const blocked = busy || generation.checking || editing || !workspace;
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
    const sourceDoc = workingDoc.current.blocks.length ? workingDoc.current : undefined;
    await generation.start(withWorkingDoc(schema, path.id, sourceDoc));
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
    <div className="flex justify-end">
      <Link href="/admin/report-guide" target="_blank" className="text-sm text-slate-500 hover:text-blue-700" title="모든 리포트의 강조색·필수 항목·금지 표현·문체를 관리합니다">리포트 공통 설정 ↗</Link>
    </div>
    {!workspace && <div className="p-4 text-sm text-slate-500">{session.error || "작업 기록을 불러오는 중…"}{session.error && <button onClick={session.retry} className="ml-3 underline">다시 불러오기</button>}</div>}
    {workspace && <DocChatEditor key={`${appId}:${path.id}`} schema={schema} path={{ ...path, doc: path.doc || emptyDoc }} appId={appId} accent={guide.accent} onConfirm={saved}
      initialState={workspace.chat} onStateChange={rememberChat} onBeforeSave={beforeSave} savedDocKey={workspace.savedDoc}
      previewDoc={proposal?.doc} previewKey={proposal ? `${workspace.proposalJobId || "legacy"}:${proposal.id}` : undefined} previewDescription={proposal?.reason}
      onPreviewChange={doc => update(w => ({ ...w, proposals: w.proposals.map((item, i) => i === selected ? { ...item, doc } : item) }))}
      onWorkingDocChange={doc => { workingDoc.current = doc; }} onBusyChange={setEditing}
      activity={activity} externalBusy={busy ? "새 양식을 만드는 중 · 다른 화면에 다녀와도 계속됩니다" : generation.checking ? "생성 상태를 확인하는 중" : ""} externalError={generation.error || session.error || loaded.error || ""}
      tabs={proposal ? <div className="flex flex-wrap gap-1" aria-label="제안 양식">{proposals.map((p, i) => <button key={p.id} disabled={blocked} aria-pressed={selected === i} onClick={() => update(w => ({ ...w, selected: i }))} className={`rounded-lg px-3 py-2 text-sm ${selected === i ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"}`}>{p.name}</button>)}<button disabled={blocked} onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 disabled:opacity-40">{hasDoc(path) ? "기존 양식" : "취소"}</button></div> : undefined}
      toolbar={<>
        <button disabled={blocked || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">{busy ? "양식 만드는 중…" : "새 양식 제안"}</button>
        {busy && <button className="text-sm underline" onClick={generation.cancel}>생성 취소</button>}
        {proposal && <button disabled={blocked} onClick={apply} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">이 안으로 선택</button>}
      </>} />}
  </section>;
}
