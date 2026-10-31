"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DOC_BLOCK_LABELS, docPages, run, stableJson, validateDoc } from "app-renderer";
import type { AppSchema, Path, ReportDoc } from "app-renderer";
import type { ChatMessage, DocChange, DocSuggestion, DocVersion } from "@/lib/report-edit";
import DocReport from "./DocReport";
import { withWorkingDoc, type ReportChatState } from "@/lib/report-workspace";

const welcome: ChatMessage = { role: "assistant", content: "궁금한 점이나 바꾸고 싶은 내용을 말씀해 주세요. 추천을 요청하면 먼저 선택지를 보여드립니다." };
const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

export default function DocChatEditor({ schema, path, appId, accent, onConfirm,
  previewDoc, previewKey, previewDescription, onPreviewChange, onWorkingDocChange, onBusyChange,
  toolbar, activity, externalBusy = "", externalError = "",
  initialState, onStateChange, onBeforeSave, savedDocKey,
}: {
  schema: AppSchema; path: Path & { doc: ReportDoc }; appId?: string | null; accent: string;
  onConfirm: (doc: ReportDoc) => void;
  previewDoc?: ReportDoc; previewKey?: string; previewDescription?: string;
  onPreviewChange?: (doc: ReportDoc) => void;
  onWorkingDocChange?: (doc: ReportDoc) => void;
  onBusyChange?: (busy: boolean) => void;
  toolbar?: ReactNode;
  activity?: { id: number; content: string };
  externalBusy?: string; externalError?: string;
  initialState?: ReportChatState; onStateChange?: (state: ReportChatState) => void; onBeforeSave?: () => Promise<void>;
  savedDocKey?: string;
}) {
  const [draft, setDraft] = useState<ReportDoc>(initialState?.draft || path.doc);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState?.messages || [{ role: "assistant", content: path.doc.blocks.length ? welcome.content : "‘새 양식 제안’을 누르면 왼쪽에 양식을 준비합니다. 양식이 나오면 여기에서 바로 수정할 수 있습니다." }]);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [savedSchema, setSavedSchema] = useState<AppSchema | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialState?.selectedId || null);
  const [changes, setChanges] = useState<DocChange[]>(initialState?.changes || []);
  const [input, setInput] = useState(initialState?.input || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storage, setStorage] = useState("loading");
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"preview" | "chat">(initialState?.panel || "preview");
  const [lockRequest, setLockRequest] = useState<{ id: string; locked: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [restoring, setRestoring] = useState<string>("");
  const controller = useRef<AbortController>();
  const chatScroll = useRef<HTMLDivElement>(null);
  const documentScroll = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(JSON.stringify(path.doc));
  const cacheKey = `hrcoach:report-draft:${appId}:${path.id}`;
  const result = useMemo(() => run(schema, [], [], path.id), [schema, path.id]);
  const activeDoc = previewDoc || draft;
  const available = activeDoc.blocks.length > 0;
  const blocked = !!busy || !!externalBusy;
  const selected = activeDoc.blocks.find(b => b.id === selectedId);
  const dirty = savedDocKey ? stableJson(activeDoc) !== savedDocKey : !equal(activeDoc, path.doc);
  const localVersion = (doc: ReportDoc, note: string): DocVersion => ({ id: `local-${Date.now()}`, version: 0, doc, note, status: "draft", created_at: new Date().toISOString() });

  useEffect(() => {
    const abort = new AbortController();
    const initial: DocVersion = { id: "original", version: 0, doc: path.doc, note: "편집 시작 양식", status: "confirmed", created_at: new Date().toISOString() };
    setVersions(path.doc.blocks.length ? [initial] : []);
    if (!appId) { setStorage("unsaved"); setReady(true); return; }
    fetch(`/api/report-doc/versions?appId=${encodeURIComponent(appId)}&pathId=${encodeURIComponent(path.id)}`, { signal: abort.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; })
      .then(data => {
        setSavedSchema(data.savedSchema); setStorage(data.storage);
        const history = [...(path.doc.blocks.length ? [initial] : []), ...data.versions.slice().reverse()];
        setVersions(history);
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
          if (!initialState && cached && cached.source === JSON.stringify(path.doc) && validateDoc(schema, path.id, cached.draft, { previous: cached.draft }).ok) {
            setDraft(cached.draft); setMessages(current => current.length > 1 ? current : cached.messages || [welcome]);
            setVersions(cached.versions?.length ? cached.versions : history);
            sessionStorage.removeItem(cacheKey);
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
      setDraft(path.doc); setChanges([]); setSelectedId(null);
      setVersions(v => [...v, localVersion(path.doc, "새 양식 적용")]);
    }
  }, [path.doc, draft]);
  useEffect(() => {
    if (ready) onStateChange?.({ draft, messages: messages.slice(-40), input, selectedId, changes, panel, previewKey });
  }, [ready, draft, messages, input, selectedId, changes, panel, previewKey, onStateChange]);
  const seenActivity = useRef<number>();
  useEffect(() => {
    if (activity && seenActivity.current !== activity.id) {
      seenActivity.current = activity.id;
      setMessages(m => [...m, { role: "assistant", content: activity.content }]);
    }
  }, [activity]);
  const seenPreview = useRef(initialState?.previewKey);
  useEffect(() => {
    if (seenPreview.current === previewKey) return;
    seenPreview.current = previewKey;
    if (previewDescription) setMessages(m => [...m, { role: "assistant", content: previewDescription }]);
    setSelectedId(null); setChanges([]); setLockRequest(null); setError("");
    if (previewKey) setNotice("");
  }, [previewKey, previewDescription]);
  useEffect(() => { onWorkingDocChange?.(activeDoc); }, [activeDoc, onWorkingDocChange]);
  useEffect(() => { onBusyChange?.(!!busy); }, [busy, onBusyChange]);
  useEffect(() => { chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: "smooth" }); }, [messages, busy, externalBusy, previewDescription, error, notice, panel]);

  async function request(url: string, payload: unknown) {
    controller.current = new AbortController();
    let r: Response;
    try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.current.signal }); }
    catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw e;
      throw new Error("서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    }
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || (r.status === 504 ? "서버 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요." : "서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    if (!data) throw new Error("서버 응답을 읽지 못했습니다. 다시 시도해 주세요.");
    return data;
  }
  function record(doc: ReportDoc, note: string, version?: DocVersion | null) {
    if (previewDoc) onPreviewChange?.(doc);
    else setDraft(doc);
    setVersions(v => [...v, version || localVersion(doc, note)].slice(-40)); setRestoring("");
  }
  async function send(message = input, suggestion?: DocSuggestion, sourceDoc?: ReportDoc) {
    if (!message.trim() || blocked || !appId || !ready || !available) return;
    if (suggestion && !equal(sourceDoc, activeDoc)) { setError("제안 후 문서가 바뀌었습니다. 다시 추천받아 주세요."); return; }
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content + (m.suggestions?.length
      ? "\n선택지: " + m.suggestions.map((s, i) => `${i + 1}. ${s.label}: ${s.description}`).join("\n") : "") }));
    setMessages(m => [...m, { role: "user", content: message.trim() }]); setInput(""); setBusy(suggestion ? "선택한 표현을 적용하는 중" : "요청을 처리하는 중"); setError(""); setNotice(""); setChanges([]);
    try {
      const data = await request("/api/report-doc/edit", { appId, schema: withWorkingDoc(schema, path.id, activeDoc), pathId: path.id, doc: activeDoc,
        selectedBlockId: suggestion?.blockId || selectedId || undefined, message, history,
        ...(suggestion ? { suggestion, suggestionSourceBlock: sourceDoc?.blocks.find(b => b.id === suggestion.blockId) } : {}) });
      setMessages(m => [...m, { role: "assistant", content: data.reply,
        ...(data.kind === "advice" ? { suggestions: data.suggestions, sourceDoc: activeDoc } : {}) }]);
      if (data.kind === "edit") {
        record(data.doc, message, data.version); setChanges(data.changes); setStorage(data.storage);
        const changedId = data.changes.find((c: DocChange) => c.op !== "remove" && c.blockId !== "$document")?.blockId;
        setSelectedId(changedId || null);
        setPanel("preview");
        // 실제 변경 위치를 보여 주되 페이지 전체나 대화 입력의 스크롤은 움직이지 않는다.
        requestAnimationFrame(() => {
          const pane = documentScroll.current;
          const target = pane && Array.from(pane.querySelectorAll<HTMLElement>("[data-doc-block]")).find(el => el.dataset.docBlock === changedId);
          if (pane && target) pane.scrollTo({ top: target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 20, behavior: "smooth" });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정하지 못했습니다.");
      // 실패한 요청을 다시 작성하지 않아도 되도록 입력란에 돌려놓는다.
      setInput(message);
    }
    finally { setBusy(""); }
  }
  async function restore(version: DocVersion) {
    if (blocked || !appId || previewDoc) return;
    setBusy("이전 버전으로 되돌리는 중"); setError("");
    try {
      const data = await request("/api/report-doc/versions", { appId, schema, pathId: path.id, doc: draft, action: "restore", targetDoc: version.doc });
      record(data.doc, `되돌리기: ${version.note}`, data.version); setChanges([]); setSelectedId(null); setStorage(data.storage);
      setMessages(m => [...m, { role: "assistant", content: `‘${version.note}’ 버전으로 되돌렸습니다. 아직 확정하지 않은 초안입니다.` }]);
    } catch (e) { setError(e instanceof Error ? e.message : "되돌리지 못했습니다."); }
    finally { setBusy(""); }
  }
  async function toggleLock(id: string, locked: boolean) {
    if (!appId || blocked || previewDoc) return;
    setBusy("블록 보호 설정을 저장하는 중"); setError(""); setLockRequest(null);
    try {
      const data = await request("/api/report-doc/versions", { appId, schema, pathId: path.id, doc: draft, action: "lock", blockId: id, locked });
      record(data.doc, locked ? "블록 잠금" : "블록 잠금 해제", data.version); setStorage(data.storage);
      setNotice(locked ? "이 블록은 대화 편집에서 보호됩니다." : "이 블록의 잠금을 해제했습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "보호 설정을 저장하지 못했습니다."); }
    finally { setBusy(""); }
  }
  async function confirm() {
    if (blocked || !appId || !savedSchema || !available) return;
    setBusy("양식을 저장하는 중"); setError("");
    try {
      await onBeforeSave?.();
      const data = await request("/api/report-doc/confirm", { appId, schema, pathId: path.id, doc: activeDoc, savedSchema });
      setSavedSchema(data.schema); setDraft(activeDoc);
      setVersions(v => [...v, data.version || localVersion(activeDoc, "양식 저장")].slice(-40));
      onConfirm(activeDoc); setChanges([]);
      setNotice("저장했습니다. 이용자 리포트에 이 양식이 반영됩니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(""); }
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(activeDoc, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "리포트_편집초안.json"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" aria-label="대화형 리포트 편집">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-3 sm:px-4">
      <span className="text-sm font-semibold text-slate-700">{available ? `${docPages(activeDoc).length}쪽 · ${dirty ? "수정 중인 초안" : "현재 양식"}` : "새 양식"}</span>
      <div className="flex flex-wrap items-center gap-2">
        {!previewDoc && available && <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-sm text-slate-500">이전 버전</summary>
          <div className="absolute left-0 top-full z-30 mt-2 flex w-56 flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-lg sm:left-auto sm:right-0">
            <select aria-label="이전 버전" value={restoring} disabled={blocked} onChange={e => setRestoring(e.target.value)} className="w-full rounded-lg border bg-white p-2 text-xs">
              <option value="">버전 선택</option>{versions.map((v, i) => <option key={`${v.id}-${i}`} value={String(i)}>{v.version ? `v${v.version}` : `기록 ${i + 1}`} · {v.note.slice(0, 30)}</option>)}
            </select>
            <button disabled={restoring === "" || blocked} onClick={() => restore(versions[Number(restoring)])} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">되돌리기</button>
          </div>
        </details>}
        {(storage === "unavailable" || error) && available && <button onClick={downloadDraft} className="rounded-lg border px-3 py-2 text-xs">초안 백업</button>}
        {toolbar}
        {available && <button title="저장하면 이용자 리포트에 반영됩니다" disabled={blocked || !appId || !ready || !savedSchema} onClick={confirm} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">저장</button>}
      </div>
    </header>
    {lockRequest && <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 p-4 text-sm"><p>잠금을 해제하면 이 블록을 AI로 수정할 수 있습니다. 해제할까요?</p><div className="flex gap-2"><button onClick={() => setLockRequest(null)} className="rounded border bg-white px-3 py-2">취소</button><button onClick={() => toggleLock(lockRequest.id, false)} className="rounded bg-slate-900 px-3 py-2 text-white">잠금 해제</button></div></div>}
    <div className="flex border-b bg-white p-2 lg:hidden">{([['preview','문서'],['chat','대화']] as const).map(([key,label]) => <button key={key} onClick={() => setPanel(key)} className={`flex-1 rounded-lg py-2 text-sm ${panel === key ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{label}</button>)}</div>
    <div className="grid lg:h-[700px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div ref={documentScroll} className={`${panel === "preview" ? "block" : "hidden"} relative z-0 h-[600px] min-w-0 overflow-y-auto bg-slate-100 p-3 sm:p-5 lg:block lg:h-auto`}>
        {available ? <DocReport schema={schema} path={{ ...path, doc: activeDoc }} result={result} accent={accent} selectedId={selectedId}
          onSelect={id => { if (!blocked) { setSelectedId(current => current === id ? null : id); setPanel("chat"); } }}
          onToggleLock={blocked || previewDoc ? undefined : (id, locked) => locked ? toggleLock(id, true) : setLockRequest({ id, locked })}
          changedIds={changes.filter(c => c.op !== "remove").map(c => c.blockId)} />
          : <div className="flex min-h-72 h-full items-center justify-center text-sm text-slate-500">새 양식을 제안받아 시작하세요.</div>}
      </div>
      <aside className={`${panel === "chat" ? "flex" : "hidden"} h-[600px] min-w-0 flex-col border-l bg-white lg:flex lg:h-auto lg:min-h-0`}>
        <div className="border-b px-4 py-3"><p className="text-sm font-semibold text-slate-900">대화</p></div>
        <div ref={chatScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-7 rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm leading-6 text-white" : "mr-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700"}><p className="whitespace-pre-wrap">{m.content}</p>
            {!!m.suggestions?.length && <>
              <ul className="mt-3 space-y-2">{m.suggestions.map((s, j) => <li key={j}><span className="font-semibold">{s.label}</span> · {s.description}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-2">{m.suggestions.map((s, j) => <button key={j} type="button" disabled={blocked || !equal(m.sourceDoc, activeDoc)} onClick={() => send(`${s.label}로 바꿔줘`, s, m.sourceDoc)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700 disabled:opacity-40">{s.label}</button>)}</div>
            </>}
          </div>)}
          {changes.length > 0 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-900">이번 변경</p><ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-900">{changes.map((c, i) => <li key={i}>{c.summary}</li>)}</ul></div>}
          {!appId && <p className="text-sm text-amber-800">앱을 먼저 임시저장하면 대화 편집을 시작할 수 있습니다.</p>}
          {storage === "unavailable" && <p className="text-sm text-amber-800">현재 서버에 버전을 저장할 수 없습니다. 초안은 이 브라우저에 보관됩니다.</p>}
          {(error || externalError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error || externalError}</p>}
          {notice && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
          {blocked && <p role="status" className="animate-pulse text-sm text-blue-700">{busy || externalBusy}…</p>}
        </div>
        <div className="border-t p-3">
          {selected && <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900"><span>{selected.locked ? "잠긴 항목" : "선택한 항목"}: {selected.title || DOC_BLOCK_LABELS[selected.type]}</span><button disabled={blocked} onClick={() => setSelectedId(null)} className="shrink-0 underline">전체 편집</button></div>}
          <form onSubmit={e => { e.preventDefault(); send(); }}><label htmlFor={`chat-${path.id}`} className="sr-only">리포트 수정 요청</label><textarea id={`chat-${path.id}`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
            // 한글 조합을 확정하는 Enter는 전송으로 처리하지 않는다.
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            if (!e.repeat) e.currentTarget.form?.requestSubmit();
          }} maxLength={2000} rows={3} readOnly={blocked} aria-busy={blocked} disabled={!appId || !ready || !available} placeholder={available ? "예: 결론을 짧게 쓰고 핵심 금액을 먼저 보여줘" : "양식이 준비되면 여기에서 수정할 수 있습니다"} className="block w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-blue-600 disabled:bg-slate-50" />
            <div className="mt-2 flex justify-end"><button disabled={blocked || !input.trim() || !appId || !ready || !available} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">보내기</button></div></form>
        </div>
      </aside>
    </div>
  </section>;
}
