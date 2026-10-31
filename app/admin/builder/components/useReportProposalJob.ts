"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSchema } from "app-renderer";
import { receiveProposalJob, type ReportProposalJob } from "@/lib/report-proposal-job";
import type { ReportWorkspace } from "@/lib/report-workspace";

type Update = (fn: (w: ReportWorkspace) => ReportWorkspace) => void;
export function useReportProposalJob(appId: string | null | undefined, pathId: string, schema: AppSchema,
  workspace: ReportWorkspace | null, update: Update) {
  const [job, setJob] = useState<ReportProposalJob | null>(null);
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef({ schema, update });
  latest.current = { schema, update };
  const mounted = useRef(false);
  const requestEpoch = useRef(0);
  const ready = !!workspace;
  const accept = useCallback((next: ReportProposalJob | null) => {
    if (!mounted.current) return;
    setJob(next); setChecking(false); setError("");
    if (next?.status === "completed") {
      latest.current.update(w => receiveProposalJob(w, next, latest.current.schema, pathId));
    }
  }, [pathId]);
  useEffect(() => {
    mounted.current = true;
    if (!appId || !ready) { setChecking(false); return () => { mounted.current = false; }; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    setChecking(true);
    const poll = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      const epoch = requestEpoch.current;
      let delay = 2500;
      try {
        const r = await fetch(`/api/report-doc/proposal-job?appId=${encodeURIComponent(appId)}&pathId=${encodeURIComponent(pathId)}`, { cache: "no-store" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        delay = data.job?.status === "running" ? 2500 : 10000;
        if (!stopped && epoch === requestEpoch.current) accept(data.job);
      } catch (e) { if (!stopped && epoch === requestEpoch.current) setError(e instanceof Error ? e.message : "양식 생성 상태를 확인하지 못했습니다. 다시 확인하고 있습니다."); }
      finally { inFlight = false; if (!stopped) timer = setTimeout(poll, delay); }
    };
    void poll();
    const focus = () => { clearTimeout(timer); void poll(); };
    window.addEventListener("focus", focus);
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [appId, pathId, ready, accept, job?.id, job?.status]);
  const start = async (workingSchema: AppSchema) => {
    if (!appId) { setError("앱을 먼저 저장한 뒤 양식을 제안받아 주세요."); return; }
    requestEpoch.current++;
    setStarting(true); setError("");
    try {
      // 화면의 생명주기에 요청을 묶지 않는다. 접수 후에는 서버가 생성과 보관을 책임진다.
      const r = await fetch("/api/report-doc/proposal-job", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, pathId, schema: workingSchema }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      accept(data.job);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "양식 생성을 시작하지 못했습니다."); }
    finally { if (mounted.current) setStarting(false); }
  };
  const cancel = async () => {
    if (!job || job.status !== "running") return;
    requestEpoch.current++;
    try {
      const r = await fetch(`/api/report-doc/proposal-job?id=${encodeURIComponent(job.id)}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (mounted.current) setJob({ ...job, status: "cancelled" });
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "생성을 취소하지 못했습니다."); }
  };
  return { start, cancel, busy: starting || job?.status === "running", checking,
    error: error || (job?.status === "failed" ? job.error || "양식 생성에 실패했습니다. 다시 제안받아 주세요." : "") };
}
