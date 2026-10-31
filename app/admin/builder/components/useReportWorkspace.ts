"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSchema } from "app-renderer";
import { stableJson } from "app-renderer";
import { reportCalculationKey, reportSavedDoc, type ReportWorkspace } from "@/lib/report-workspace";
import { flushReportWorkspace, loadReportWorkspace, queueReportWorkspace, watchReportWorkspace } from "@/lib/report-workspace-client";

export function useReportWorkspace(appId: string | null | undefined, pathId: string, schema: AppSchema, docMode: boolean) {
  const [workspace, setWorkspace] = useState<ReportWorkspace | null>(null);
  const ref = useRef<ReportWorkspace | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let stop = () => {};
    const initial: ReportWorkspace = { format: 1, calculation: reportCalculationKey(schema), savedDoc: reportSavedDoc(schema, pathId), docMode, proposals: [], selected: 0 };
    const load = async () => {
      try {
        const loaded = appId ? await loadReportWorkspace(appId, pathId, schema) : { workspace: null, savedDoc: initial.savedDoc, warning: "" };
        if (!active) return;
        ref.current = loaded.workspace || { ...initial, savedDoc: loaded.savedDoc };
        setWorkspace(ref.current); setError(loaded.warning);
        if (appId) stop = watchReportWorkspace(appId, pathId, setError);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "작업 기록을 불러오지 못했습니다."); }
    };
    void load();
    return () => { active = false; stop(); if (appId) void flushReportWorkspace(appId, pathId).catch(() => {}); };
    // 경로별 편집기는 key로 분리된다. 편집 중 schema 변경으로 복원을 다시 실행하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, pathId, retry]);
  const update = useCallback((change: (current: ReportWorkspace) => ReportWorkspace) => {
    if (!ref.current) return;
    const next = change(ref.current);
    if (stableJson(next) === stableJson(ref.current)) return;
    ref.current = next; setWorkspace(next);
    if (appId) queueReportWorkspace(appId, pathId, next);
  }, [appId, pathId]);
  const flush = useCallback(async () => { if (appId) await flushReportWorkspace(appId, pathId); }, [appId, pathId]);
  return { workspace, update, flush, error, retry: () => { setError(""); setRetry(v => v + 1); } };
}
