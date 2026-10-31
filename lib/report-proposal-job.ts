import { validateDoc } from "app-renderer";
import type { AppSchema, ReportDoc, ReportGuide } from "app-renderer";
import type { ReportProposal } from "./report-proposals";
import type { ReportWorkspace } from "./report-workspace";
export interface ReportProposalJob {
  id: string; status: "running" | "completed" | "failed" | "cancelled";
  calculation: string; saved_doc: string; source_doc?: ReportDoc;
  result?: { proposals: ReportProposal[]; guide: ReportGuide }; error?: string; started_at: string;
}
/** 이미 받은 결과나 오래된 계산의 결과가 현재 편집을 덮어쓰지 않는다. */
export function receiveProposalJob(w: ReportWorkspace, job: ReportProposalJob, schema: AppSchema, pathId: string): ReportWorkspace {
  if (w.proposalJobId === job.id || job.status !== "completed") return w;
  const acknowledged = { ...w, proposalJobId: job.id };
  if (w.calculation !== job.calculation || w.savedDoc !== job.saved_doc || !job.result?.proposals.length) return acknowledged;
  if (job.result.proposals.some(p => !validateDoc(schema, pathId, p.doc, { previous: job.source_doc, guide: job.result!.guide, proposal: true }).ok)) return acknowledged;
  return { ...acknowledged, proposals: job.result.proposals, selected: 0, sourceDoc: job.source_doc,
    guide: job.result.guide, docMode: true };
}
