"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { stableJson, validateDoc } from "app-renderer";
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
  const proposals = workspace?.proposals || [];
  const selected = workspace?.selected || 0;
  const workingDoc = useRef<ReportDoc>(path.doc || emptyDoc);
  const guide = workspace?.guide || loaded.guide;
  const fingerprint = reportCalculationKey(schema);
  const proposal = proposals[selected];
  const blocked = busy || generation.checking || editing || !workspace;
  const rememberChat = useCallback((chat: ReportChatState) => update(w => ({ ...w, chat })), [update]);
  const beforeSave = useCallback(async () => {
    if (proposal) {
      if (fingerprint !== workspace?.calculation) throw new Error("앱 구성이 바뀌었습니다. 새 양식을 다시 만들어 주세요.");
      const checked = validateDoc(schema, path.id, proposal.doc, { guide, previous: workspace?.sourceDoc, proposal: true });
      if (!checked.ok) throw new Error(checked.errors[0].message);
    }
    await flush();
  }, [proposal, fingerprint, workspace, schema, path.id, guide, flush]);
  const saved = useCallback((doc: ReportDoc) => {
    update(w => ({ ...w, savedDoc: stableJson(doc), proposals: [], selected: 0, sourceDoc: undefined, chat: w.chat && { ...w.chat, draft: doc } }));
    onApply(doc);
  }, [update, onApply]);

  async function propose() {
    if (blocked) return;
    const sourceDoc = workingDoc.current.blocks.length ? workingDoc.current : undefined;
    await generation.start(withWorkingDoc(schema, path.id, sourceDoc));
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
      externalBusy={busy ? "새 양식을 만드는 중 · 다른 화면에 다녀와도 계속됩니다" : generation.checking ? "생성 상태를 확인하는 중" : ""} externalError={generation.error || session.error || loaded.error || ""}
      toolbar={<>
        <button disabled={blocked || loaded.loading || !!loaded.error} onClick={propose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">{busy ? "양식 만드는 중…" : "새 양식 제안"}</button>
        {busy && <button className="text-sm underline" onClick={generation.cancel}>생성 취소</button>}
      </>} />}
  </section>;
}
