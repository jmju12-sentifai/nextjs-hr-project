"use client";
import { useEffect, useState } from "react";
import { DEFAULT_REPORT_GUIDE, validateReportGuide } from "app-renderer";

export function useReportGuide() {
  const [state, setState] = useState({ guide: DEFAULT_REPORT_GUIDE, available: false, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/report-guide", { signal: controller.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok || !validateReportGuide(data.guide)) throw new Error(data.error || "가이드를 불러오지 못했습니다."); return data; })
      .then(data => setState({ guide: data.guide, available: data.available, loading: false, error: "" }))
      .catch(e => { if (!controller.signal.aborted) setState(s => ({ ...s, loading: false, error: e.message })); });
    return () => controller.abort();
  }, []);
  return state;
}
