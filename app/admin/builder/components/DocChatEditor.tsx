"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOC_BLOCK_LABELS, docPages, run, stableJson, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc } from "app-renderer";
import type { ChatMessage, DocChange, DocVersion } from "@/lib/report-edit";
import DocReport from "./DocReport";

const welcome: ChatMessage = { role: "assistant", content: "바꾸고 싶은 내용을 입력하세요. 문서에서 항목을 선택하면 그 부분만 수정합니다." };
const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

export default function DocChatEditor({ schema, path, appId, accent, onConfirm }: {
  schema: AppSchema; path: Path & { doc: ReportDoc }; appId?: string | null; accent: string;
  onConfirm: (doc: ReportDoc) => void;
}) {
  const [draft, setDraft] = useState<ReportDoc>(path.doc);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [savedSchema, setSavedSchema] = useState<AppSchema | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [changes, setChanges] = useState<DocChange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storage, setStorage] = useState("loading");
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"preview" | "chat">("preview");
  const [showConfirm, setShowConfirm] = useState(false);
  const [lockRequest, setLockRequest] = useState<{ id: string; locked: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [restoring, setRestoring] = useState<string>("");
  const controller = useRef<AbortController>();
  const chatScroll = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(JSON.stringify(path.doc));
  const cacheKey = `hrcoach:report-draft:${appId}:${path.id}`;
  const result = useMemo(() => run(schema, [], [], path.id), [schema, path.id]);
  const selected = draft.blocks.find(b => b.id === selectedId);
  const dirty = !equal(draft, path.doc);
  const localVersion = (doc: ReportDoc, note: string): DocVersion => ({ id: `local-${Date.now()}`, version: 0, doc, note, status: "draft", created_at: new Date().toISOString() });

  useEffect(() => {
    const abort = new AbortController();
    const initial: DocVersion = { id: "original", version: 0, doc: path.doc, note: "편집 시작 양식", status: "confirmed", created_at: new Date().toISOString() };
    setVersions([initial]);
    if (!appId) { setStorage("unsaved"); setReady(true); return; }
    fetch(`/api/report-doc/versions?appId=${encodeURIComponent(appId)}&pathId=${encodeURIComponent(path.id)}`, { signal: abort.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; })
      .then(data => {
        setSavedSchema(data.savedSchema); setStorage(data.storage);
        const history = [initial, ...data.versions.slice().reverse()];
        setVersions(history);
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
          if (cached && cached.source === JSON.stringify(path.doc) && validateDoc(schema, path.id, cached.draft, { previous: cached.draft }).ok) {
            setDraft(cached.draft); setMessages(cached.messages || [welcome]);
            setVersions(cached.versions?.length ? cached.versions : history);
          }
        } catch { /* 저장 공간을 쓸 수 없어도 대화 편집은 계속할 수 있다. */ }
        setReady(true);
      }).catch(e => { if (!abort.signal.aborted) { setError(e.message); setStorage("error"); setReady(true); } });
    return () => { abort.abort(); controller.current?.abort(); };
    // 앱·경로가 바뀌면 상위의 key로 새 편집 세션을 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, path.id]);
  useEffect(() => {
    const source = JSON.stringify(path.doc);
    if (source === sourceRef.current) return;
    sourceRef.current = source;
    if (!equal(path.doc, draft)) {
      setDraft(path.doc); setChanges([]); setSelectedId(null); setMessages([welcome]);
      setVersions(v => [...v, localVersion(path.doc, "새 양식 적용")]);
    }
  }, [path.doc, draft]);
  useEffect(() => {
    if (!ready || !appId) return;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ source: JSON.stringify(path.doc), draft, messages: messages.slice(-40), versions: versions.slice(-40) })); } catch { /* 용량이 부족해도 서버 저장에는 영향이 없다. */ }
  }, [ready, cacheKey, appId, path.doc, draft, messages, versions]);
  useEffect(() => { chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  async function request(url: string, payload: unknown) {
    controller.current = new AbortController();
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.current.signal });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
    return data;
  }
  function record(doc: ReportDoc, note: string, version?: DocVersion | null) {
    setDraft(doc); setVersions(v => [...v, version || localVersion(doc, note)].slice(-40)); setRestoring("");
  }
  async function send(message = input) {
    if (!message.trim() || busy || !appId) return;
    const history = messages.slice(-6);
    setMessages(m => [...m, { role: "user", content: message.trim() }]); setInput(""); setBusy("요청 범위를 확인하고 문서를 수정하는 중"); setError(""); setNotice("");
    try {
      const data = await request("/api/report-doc/edit", { appId, schema, pathId: path.id, doc: draft, selectedBlockId: selectedId || undefined, message, history });
      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
      if (data.kind === "edit") {
        record(data.doc, message, data.version); setChanges(data.changes); setStorage(data.storage);
        setSelectedId(id => data.doc.blocks.some((b: any) => b.id === id) ? id : null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "수정하지 못했습니다."); }
    finally { setBusy(""); }
  }
  async function restore(version: DocVersion) {
    if (busy || !appId) return;
    setBusy("이전 버전으로 되돌리는 중"); setError("");
    try {
      const data = await request("/api/report-doc/versions", { appId, schema, pathId: path.id, doc: draft, action: "restore", targetDoc: version.doc });
      record(data.doc, `되돌리기: ${version.note}`, data.version); setChanges([]); setSelectedId(null); setStorage(data.storage);
      setMessages(m => [...m, { role: "assistant", content: `‘${version.note}’ 버전으로 되돌렸습니다. 아직 확정하지 않은 초안입니다.` }]);
    } catch (e) { setError(e instanceof Error ? e.message : "되돌리지 못했습니다."); }
    finally { setBusy(""); }
  }
  async function toggleLock(id: string, locked: boolean) {
    if (!appId || busy) return;
    setBusy("블록 보호 설정을 저장하는 중"); setError(""); setLockRequest(null);
    try {
      const data = await request("/api/report-doc/versions", { appId, schema, pathId: path.id, doc: draft, action: "lock", blockId: id, locked });
      record(data.doc, locked ? "블록 잠금" : "블록 잠금 해제", data.version); setStorage(data.storage);
      setNotice(locked ? "이 블록은 대화 편집에서 보호됩니다." : "이 블록의 잠금을 해제했습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "보호 설정을 저장하지 못했습니다."); }
    finally { setBusy(""); }
  }
  async function confirm() {
    if (busy || !appId || !savedSchema) return;
    setBusy("확정 양식을 저장하는 중"); setError("");
    try {
      const data = await request("/api/report-doc/confirm", { appId, schema, pathId: path.id, doc: draft, savedSchema });
      setSavedSchema(data.schema); record(draft, "양식 확정", data.version); onConfirm(draft); setShowConfirm(false); setChanges([]);
      setNotice("양식을 확정하고 저장했습니다. 이용자에게 이 양식이 표시됩니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "확정하지 못했습니다."); }
    finally { setBusy(""); }
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "리포트_편집초안.json"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" aria-label="대화형 리포트 편집">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-4 sm:px-5">
      <div><h3 className="text-lg font-bold text-slate-900">리포트 편집</h3><p className="mt-1 text-xs text-slate-500">{docPages(draft).length}쪽 · {dirty ? "수정 중인 초안" : "현재 양식"}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="이전 버전" value={restoring} disabled={!!busy} onChange={e => setRestoring(e.target.value)} className="max-w-44 rounded-lg border bg-white px-2 py-2 text-xs">
          <option value="">이전 버전 보기</option>{versions.map((v, i) => <option key={`${v.id}-${i}`} value={String(i)}>{v.version ? `v${v.version}` : `기록 ${i + 1}`} · {v.note.slice(0, 30)}</option>)}
        </select>
        <button disabled={restoring === "" || !!busy} onClick={() => restore(versions[Number(restoring)])} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">되돌리기</button>
        {(storage === "unavailable" || error) && <button onClick={downloadDraft} className="rounded-lg border px-3 py-2 text-xs">초안 백업</button>}
        <button disabled={!!busy || !appId || !ready || !savedSchema} onClick={() => setShowConfirm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">양식 확정</button>
      </div>
    </header>
    {!appId && <p className="border-b bg-amber-50 px-5 py-3 text-sm text-amber-900">앱을 먼저 임시저장하면 대화 편집을 시작할 수 있습니다.</p>}
    {storage === "unavailable" && <p className="border-b bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">버전 저장소가 아직 준비되지 않았습니다. 편집 초안은 이 브라우저에 보관되며, 양식 확정은 운영 담당자의 저장소 설정 후 사용할 수 있습니다.</p>}
    {error && <p role="alert" className="border-b bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="border-b bg-blue-50 px-5 py-3 text-sm text-blue-900">{notice}</p>}
    {showConfirm && <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 p-4 text-sm"><p>이 초안을 확정하고 해당 경로의 이용자 리포트에 반영할까요?</p><div className="flex gap-2"><button disabled={!!busy} onClick={() => setShowConfirm(false)} className="rounded border bg-white px-3 py-2">취소</button><button disabled={!!busy} onClick={confirm} className="rounded bg-blue-700 px-3 py-2 font-semibold text-white">확정하여 저장</button></div></div>}
    {lockRequest && <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 p-4 text-sm"><p>잠금을 해제하면 이 블록을 AI로 수정할 수 있습니다. 해제할까요?</p><div className="flex gap-2"><button onClick={() => setLockRequest(null)} className="rounded border bg-white px-3 py-2">취소</button><button onClick={() => toggleLock(lockRequest.id, false)} className="rounded bg-slate-900 px-3 py-2 text-white">잠금 해제</button></div></div>}
    <div className="flex border-b bg-white p-2 lg:hidden">{([['preview','문서 미리보기'],['chat','대화로 수정']] as const).map(([key,label]) => <button key={key} onClick={() => setPanel(key)} className={`flex-1 rounded-lg py-2 text-sm ${panel === key ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{label}</button>)}</div>
    <div className="grid lg:h-[790px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className={`${panel === "preview" ? "block" : "hidden"} min-w-0 overflow-y-auto bg-slate-100 p-3 sm:p-5 lg:block`}>
        <DocReport schema={schema} path={{ ...path, doc: draft }} result={result} accent={accent} selectedId={selectedId}
          onSelect={id => { if (!busy) { setSelectedId(current => current === id ? null : id); setPanel("chat"); } }}
          onToggleLock={busy ? undefined : (id, locked) => locked ? toggleLock(id, true) : setLockRequest({ id, locked })}
          changedIds={changes.filter(c => c.op !== "remove").map(c => c.blockId)} />
      </div>
      <aside className={`${panel === "chat" ? "flex" : "hidden"} h-[640px] min-w-0 flex-col border-l bg-white lg:flex lg:h-auto lg:min-h-0`}>
        <div className="border-b px-4 py-3"><p className="text-sm font-semibold text-slate-900">대화</p></div>
        <div ref={chatScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-7 rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm leading-6 text-white" : "mr-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700"}><p className="whitespace-pre-wrap">{m.content}</p></div>)}
          {changes.length > 0 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-900">이번 변경</p><ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-900">{changes.map((c, i) => <li key={i}>{c.summary}</li>)}</ul></div>}
          {busy && <p role="status" className="animate-pulse text-xs text-blue-700">{busy}…</p>}
        </div>
        <div className="border-t p-4">
          {selected && <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900"><span>{selected.locked ? "잠긴 블록" : "선택한 블록"}: {selected.title || DOC_BLOCK_LABELS[selected.type]}</span><button disabled={!!busy} onClick={() => setSelectedId(null)} className="shrink-0 underline">전체 편집</button></div>}
          <form onSubmit={e => { e.preventDefault(); send(); }}><label htmlFor={`chat-${path.id}`} className="sr-only">리포트 수정 요청</label><textarea id={`chat-${path.id}`} value={input} onChange={e => setInput(e.target.value)} maxLength={2000} rows={3} disabled={!!busy || !appId || !ready} placeholder="예: 결론을 짧게 쓰고 핵심 금액을 먼저 보여줘" className="block w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-blue-600 disabled:bg-slate-50" />
            <div className="mt-2 flex justify-end"><button disabled={!!busy || !input.trim() || !appId || !ready} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">수정 요청</button></div></form>
        </div>
      </aside>
    </div>
  </section>;
}
