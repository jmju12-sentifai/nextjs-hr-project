"use client";
import { stableJson } from "app-renderer";
import type { AppSchema } from "app-renderer";
import { validWorkspace, type ReportWorkspace } from "./report-workspace";

type Entry = { appId: string; pathId: string; userId: string; revision: number; workspace: ReportWorkspace | null;
  pending: boolean; running?: Promise<void>; timer?: ReturnType<typeof setTimeout>; error: string; listeners: Set<(error: string) => void> };
const entries = new Map<string, Entry>();
const keyOf = (appId: string, pathId: string) => `hrcoach:report-workspace:${appId}:${pathId}`;
const backup = (e: Entry) => {
  try { sessionStorage.setItem(keyOf(e.appId, e.pathId), JSON.stringify({ userId: e.userId, revision: e.revision, workspace: e.workspace, pending: e.pending })); }
  catch { /* 서버 저장은 브라우저의 용량 제한에 의존하지 않는다. */ }
};
const announce = (e: Entry, error: string) => { e.error = error; e.listeners.forEach(fn => fn(error)); };

/** 화면을 떠나도 저장을 이어 가며 요청 순서가 뒤바뀌지 않게 직렬화한다. */
export async function flushReportWorkspace(appId: string, pathId: string): Promise<void> {
  const e = entries.get(keyOf(appId, pathId));
  if (!e) return;
  if (e.timer) clearTimeout(e.timer);
  if (e.running) return e.running;
  e.running = (async () => {
    while (e.pending && e.workspace) {
      const sending = e.workspace;
      e.pending = false;
      try {
        const r = await fetch("/api/report-doc/workspace", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, pathId, workspace: sending, revision: e.revision }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "작업 기록을 보관하지 못했습니다.");
        e.revision = data.revision; announce(e, ""); backup(e);
      } catch (error) {
        e.pending = true; backup(e); announce(e, error instanceof Error ? error.message : "작업 기록을 보관하지 못했습니다.");
        throw error;
      }
    }
  })().finally(() => { e.running = undefined; });
  return e.running;
}
export function queueReportWorkspace(appId: string, pathId: string, workspace: ReportWorkspace) {
  const e = entries.get(keyOf(appId, pathId));
  if (!e || stableJson(e.workspace) === stableJson(workspace)) return;
  e.workspace = workspace; e.pending = true; backup(e);
  if (e.timer) clearTimeout(e.timer);
  e.timer = setTimeout(() => { void flushReportWorkspace(appId, pathId).catch(() => {}); }, 300);
}
export function watchReportWorkspace(appId: string, pathId: string, listener: (error: string) => void) {
  const e = entries.get(keyOf(appId, pathId));
  if (!e) return () => {};
  e.listeners.add(listener); listener(e.error);
  return () => { e.listeners.delete(listener); };
}
const loads = new Map<string, ReturnType<typeof readReportWorkspace>>();
export function loadReportWorkspace(appId: string, pathId: string, schema: AppSchema) {
  const key = keyOf(appId, pathId);
  const existing = loads.get(key);
  if (existing) return existing;
  const loading = readReportWorkspace(appId, pathId, schema).finally(() => { loads.delete(key); });
  loads.set(key, loading);
  return loading;
}
async function readReportWorkspace(appId: string, pathId: string, schema: AppSchema) {
  const key = keyOf(appId, pathId);
  // 같은 탭 안의 이동에서는 앞 화면의 마지막 변경까지 저장한 뒤 읽는다.
  await flushReportWorkspace(appId, pathId).catch(() => {});
  const r = await fetch(`/api/report-doc/workspace?appId=${encodeURIComponent(appId)}&pathId=${encodeURIComponent(pathId)}`, { cache: "no-store" });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "작업 기록을 불러오지 못했습니다.");
  let workspace = data.workspace as ReportWorkspace | null;
  let pending = false;
  try {
    const local = JSON.parse(sessionStorage.getItem(key) || "null");
    // 새로고침 직전 아직 전송하지 못한 같은 사용자의 작업만 이어 보낸다.
    if (local?.userId === data.userId && local.pending && local.revision === data.revision
      && local.workspace?.savedDoc === data.savedDoc && validWorkspace(local.workspace, schema, pathId)) {
      workspace = local.workspace; pending = true;
    }
  } catch { /* 복원할 로컬 기록이 없으면 서버 기록을 사용한다. */ }
  let warning = "";
  if (workspace && (workspace.savedDoc !== data.savedDoc || !validWorkspace(workspace, schema, pathId))) {
    warning = "앱 구성이나 저장된 양식이 변경되어 최신 양식으로 열었습니다."; workspace = null; pending = false;
  }
  const e: Entry = { appId, pathId, userId: data.userId, revision: data.revision, workspace, pending, error: "", listeners: new Set() };
  entries.set(key, e); backup(e);
  if (pending) void flushReportWorkspace(appId, pathId).catch(() => {});
  return { workspace, savedDoc: data.savedDoc as string, warning };
}
