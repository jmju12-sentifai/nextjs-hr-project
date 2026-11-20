"use client";
// 직무 성과책임 18레벨 표 (관리자 전용)
//
// 흐름: ① 직무명·KRA 입력 → ② AI가 제안한 성과영역·상한을 확인·수정 → ③ 영역별로 문장 생성 → 표 확인·수정 → 엑셀.
// 문장은 영역마다 별도 요청으로 받아 완성되는 대로 표에 채운다(요청당 60초 제한 회피, 실패한 영역만 다시 만들기).
// 점수는 서버가 아니라 lib/job-levels/score.ts 의 고정 계산으로 화면에서 붙인다.
// 작업 내용은 이 브라우저에만 임시 저장한다 — 보관은 엑셀 내려받기로 한다(1차 범위).

import { useEffect, useMemo, useState } from "react";
import { LEVELS, MAX_LEVEL, sentenceText, type JobArea, type LevelSentence } from "@/lib/job-levels/levels";
import { scoreLabel } from "@/lib/job-levels/score";
import { downloadLevelTable } from "./excel";

type AreaState = { status: "running" | "done" | "error"; error?: string; warnings?: string[] };
type Draft = {
  jobName: string;
  industry: string;
  kraText: string;
  areas: JobArea[];
  sentences: Record<string, LevelSentence[]>;
};
type Editing = { areaId: string; level: number; means: string; outcome: string };

const STORE_KEY = "hrcoach.jobLevels.draft.v1";
const CONCURRENCY = 3;

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error || (res.status === 504 ? "응답 시간이 초과됐습니다. 다시 시도해 주세요." : `서버 오류 (${res.status})`),
    );
  }
  return data;
}

// 동시에 CONCURRENCY 개씩만 요청한다 — 모델 호출 한도와 화면 진행 표시를 위해.
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function JobLevelsPage() {
  const [jobName, setJobName] = useState("");
  const [industry, setIndustry] = useState("");
  const [kraText, setKraText] = useState("");
  const [areas, setAreas] = useState<JobArea[]>([]);
  const [sentences, setSentences] = useState<Record<string, LevelSentence[]>>({});
  const [areaState, setAreaState] = useState<Record<string, AreaState>>({});
  const [proposing, setProposing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  // 불러오기가 화면에 반영된 뒤에만 저장한다. ref 로 두면 같은 렌더의 저장 효과가
  // 아직 빈 값으로 먼저 실행돼 저장본을 지워 버린다(개발 모드 이중 실행에서 재현).
  const [hydrated, setHydrated] = useState(false);

  // ── 임시 저장 (이 브라우저에만) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setJobName(d.jobName || "");
        setIndustry(d.industry || "");
        setKraText(d.kraText || "");
        setAreas(Array.isArray(d.areas) ? d.areas : []);
        setSentences(d.sentences || {});
      }
    } catch {
      // 저장소를 쓸 수 없는 환경이면 빈 화면으로 시작한다.
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      const d: Draft = { jobName, industry, kraText, areas, sentences };
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
    } catch {
      // 저장 실패는 화면 동작에 영향을 주지 않는다.
    }
  }, [hydrated, jobName, industry, kraText, areas, sentences]);

  const doneCount = areas.filter((a) => (sentences[a.id] || []).length > 0).length;
  const runningCount = Object.values(areaState).filter((s) => s.status === "running").length;
  const sentenceCount = useMemo(
    () => areas.reduce((n, a) => n + (sentences[a.id] || []).filter((s) => s.level <= a.ceiling).length, 0),
    [areas, sentences],
  );
  const topLevel = areas.length ? Math.max(...areas.map((a) => a.ceiling)) : 0;

  // ── ② 성과영역 제안 ──
  async function propose() {
    setError("");
    if (!jobName.trim()) {
      setError("직무명을 입력해 주세요.");
      return;
    }
    if (areas.length && !confirm("성과영역을 새로 제안받으면 지금 표의 문장이 모두 지워집니다. 계속할까요?")) return;
    setProposing(true);
    try {
      const data = await postJson("/api/job-levels/areas", { jobName, industry, kraText });
      setAreas(data.areas || []);
      setSentences({});
      setAreaState({});
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "성과영역을 만들지 못했습니다.");
    } finally {
      setProposing(false);
    }
  }

  function patchArea(id: string, patch: Partial<JobArea>) {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function addArea() {
    setAreas((prev) => [
      ...prev,
      { id: `a${Date.now()}`, name: "", target: "", ceiling: 12, ceilingReason: "", onet: null },
    ]);
  }
  function removeArea(id: string) {
    setAreas((prev) => prev.filter((a) => a.id !== id));
    setSentences((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }

  // ── ③ 영역별 문장 생성 ──
  async function runArea(area: JobArea, all: JobArea[]) {
    setAreaState((s) => ({ ...s, [area.id]: { status: "running" } }));
    try {
      const data = await postJson("/api/job-levels/levels", {
        jobName,
        industry,
        area: { name: area.name, target: area.target, ceiling: area.ceiling },
        otherAreas: all.filter((a) => a.id !== area.id).map((a) => a.name),
      });
      setSentences((prev) => ({ ...prev, [area.id]: data.sentences || [] }));
      setAreaState((s) => ({ ...s, [area.id]: { status: "done", warnings: data.warnings || [] } }));
    } catch (e) {
      setAreaState((s) => ({
        ...s,
        [area.id]: { status: "error", error: e instanceof Error ? e.message : "문장을 만들지 못했습니다." },
      }));
    }
  }

  async function generate(onlyMissing: boolean) {
    setError("");
    const valid = areas.filter((a) => a.name.trim());
    if (!jobName.trim() || !valid.length) {
      setError("직무명과 성과영역을 1개 이상 입력해 주세요.");
      return;
    }
    const targets = onlyMissing ? valid.filter((a) => !(sentences[a.id] || []).length) : valid;
    if (!targets.length) return;
    setGenerating(true);
    setEditing(null);
    try {
      await runPool(targets, CONCURRENCY, (a) => runArea(a, valid));
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(area: JobArea) {
    setEditing(null);
    await runArea(area, areas.filter((a) => a.name.trim()));
  }

  function saveEdit() {
    if (!editing) return;
    const { areaId, level, means, outcome } = editing;
    setSentences((prev) => {
      const list = (prev[areaId] || []).filter((s) => s.level !== level);
      list.push({ level, means: means.trim().replace(/^\(|\)$/g, ""), outcome: outcome.trim() });
      list.sort((a, b) => a.level - b.level);
      return { ...prev, [areaId]: list };
    });
    setEditing(null);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadLevelTable({ jobName, industry, kraText, areas: areas.filter((a) => a.name.trim()), sentences });
    } catch (e) {
      setError(e instanceof Error ? e.message : "엑셀 파일을 만들지 못했습니다.");
    } finally {
      setExporting(false);
    }
  }

  function resetAll() {
    if (!confirm("입력한 내용과 표를 모두 지우고 새로 시작할까요?")) return;
    setJobName("");
    setIndustry("");
    setKraText("");
    setAreas([]);
    setSentences({});
    setAreaState({});
    setEditing(null);
    setError("");
  }

  const busy = proposing || generating;
  // 폭은 따로 붙인다 — 같은 요소에 w-full 과 w-28 이 함께 있으면 w-full 이 이겨 모바일에서 가로로 넘친다.
  const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
  const inp = `w-full ${field}`;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">직무 성과책임 18레벨 표</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              직무명과 주요 성과영역(KRA)을 입력하면, 성과영역마다 L1부터 상한 레벨까지 성과책임 문장을 만들고 엑셀로 내려받을 수 있습니다.
              점수는 레벨별 기준값을 적용한 모의 점수이며, 문장을 고쳐도 바뀌지 않습니다.
            </p>
          </div>
          <button type="button" onClick={resetAll} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            새로 시작
          </button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {/* ① 직무 입력 */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900">1. 직무 입력</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="jl-job" className="block text-sm font-semibold text-slate-800">직무명 <span className="text-red-600">*</span></label>
              <input id="jl-job" value={jobName} onChange={(e) => setJobName(e.target.value)} maxLength={80} placeholder="예: 국내 컬러렌즈 인허가 담당" className={`${inp} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="jl-ind" className="block text-sm font-semibold text-slate-800">산업·회사 특성 <span className="font-normal text-slate-500">(선택)</span></label>
              <input id="jl-ind" value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={200} placeholder="예: 소프트 콘택트렌즈 제조·판매, 직원 80명" className={`${inp} mt-1.5`} />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="jl-kra" className="block text-sm font-semibold text-slate-800">주요 성과영역(KRA)·업무 <span className="font-normal text-slate-500">(한 줄에 하나, 대략적으로 적어도 됩니다)</span></label>
            <textarea id="jl-kra" value={kraText} onChange={(e) => setKraText(e.target.value)} rows={5} maxLength={4000} placeholder={"예:\n품목허가 신청과 심사보완 대응\n제품 변경 시 변경허가 필요 여부 판단\n표시·광고 문구 적법성 검토"} className={`${inp} mt-1.5 leading-6`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={propose} disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {proposing ? "성과영역 제안 중…" : areas.length ? "성과영역 다시 제안받기" : "성과영역 제안받기"}
            </button>
            <span className="text-xs text-slate-500">AI가 성과영역 목록, 영역별 상한 레벨, O*NET 참고 직업을 제안합니다.</span>
          </div>
        </section>

        {/* ② 성과영역 확인 */}
        {areas.length > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">2. 성과영역 확인 <span className="ml-1 text-sm font-medium text-slate-500">{areas.length}개</span></h2>
              <p className="text-xs text-slate-500">이름·성과대상·상한을 고친 뒤 문장을 만드세요. 상한을 넘는 레벨은 표에서 공란이 됩니다.</p>
            </div>
            <div className="mt-4 space-y-3">
              {areas.map((a, i) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-sm font-semibold text-slate-400">{i + 1}</span>
                    <label className="sr-only" htmlFor={`jl-name-${a.id}`}>성과영역 이름</label>
                    <input id={`jl-name-${a.id}`} value={a.name} onChange={(e) => patchArea(a.id, { name: e.target.value })} maxLength={40} placeholder="성과영역 이름" className={`${field} min-w-0 flex-1 font-semibold`} />
                    <label className="sr-only" htmlFor={`jl-ceil-${a.id}`}>상한 레벨</label>
                    <select id={`jl-ceil-${a.id}`} value={a.ceiling} onChange={(e) => patchArea(a.id, { ceiling: Number(e.target.value) })} className={`${field} w-28 shrink-0`}>
                      {Array.from({ length: MAX_LEVEL }, (_, k) => k + 1).map((n) => (
                        <option key={n} value={n}>상한 L{n}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeArea(a.id)} disabled={busy} className="shrink-0 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                      삭제
                    </button>
                  </div>
                  <div className="mt-2 sm:pl-8">
                    <label className="sr-only" htmlFor={`jl-target-${a.id}`}>핵심 성과대상</label>
                    <input id={`jl-target-${a.id}`} value={a.target} onChange={(e) => patchArea(a.id, { target: e.target.value })} maxLength={160} placeholder="핵심 성과대상·최종 결과" className={inp} />
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      {a.ceilingReason && <>상한 근거: {a.ceilingReason}<br /></>}
                      {a.onet ? `O*NET 참고 직업: ${a.onet.code} ${a.onet.title}` : "O*NET 참고 직업 없음"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={addArea} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                + 영역 추가
              </button>
              <button type="button" onClick={() => generate(false)} disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {generating ? `문장 만드는 중… (${doneCount}/${areas.length})` : doneCount ? "전체 문장 다시 만들기" : "18레벨 문장 만들기"}
              </button>
              {doneCount > 0 && doneCount < areas.length && !generating && (
                <button type="button" onClick={() => generate(true)} className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  빠진 영역만 만들기
                </button>
              )}
            </div>
          </section>
        )}

        {/* ③ 18레벨 표 */}
        {areas.length > 0 && (doneCount > 0 || runningCount > 0) && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">3. 18레벨 성과책임 표</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {areas.length}개 성과영역 · 문장 {sentenceCount}개 · 문장을 누르면 고칠 수 있습니다. (수단) 성과상태 (모의 점수)
                </p>
              </div>
              <button type="button" onClick={exportExcel} disabled={exporting || generating || sentenceCount === 0} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {exporting ? "엑셀 만드는 중…" : "엑셀로 내려받기"}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="border-collapse text-left text-xs" style={{ minWidth: 140 + areas.length * 240 }}>
                <thead>
                  <tr className="bg-slate-100 align-top">
                    <th scope="col" className="sticky left-0 z-10 w-[140px] min-w-[140px] border-b border-r border-slate-200 bg-slate-100 p-2 font-semibold text-slate-700">레벨</th>
                    {areas.map((a) => {
                      const st = areaState[a.id];
                      return (
                        <th key={a.id} scope="col" className="w-[240px] min-w-[240px] border-b border-r border-slate-200 p-2 font-semibold text-slate-800">
                          <div className="text-[13px] leading-5">{a.name || "(이름 없음)"}</div>
                          <div className="mt-0.5 font-normal text-slate-500">상한 L{a.ceiling}{a.onet ? ` · O*NET ${a.onet.code}` : ""}</div>
                          {st?.status === "error" && <div className="mt-1 font-normal text-red-700">{st.error}</div>}
                          {st?.status === "done" && (st.warnings?.length ?? 0) > 0 && (
                            <div className="mt-1 font-normal text-amber-800" title={st.warnings!.join("\n")}>확인 필요 {st.warnings!.length}건</div>
                          )}
                          {st?.status !== "running" && !generating && (
                            <button type="button" onClick={() => regenerate(a)} className="mt-1 font-normal text-blue-700 hover:underline">
                              {(sentences[a.id] || []).length ? "이 영역 다시 만들기" : "이 영역 만들기"}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[...LEVELS].reverse().filter((lv) => lv.level <= Math.max(topLevel, 1)).map((lv) => (
                    <tr key={lv.level} className="align-top">
                      <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 p-2 font-normal text-slate-600">
                        <div className="text-sm font-bold text-slate-900">L{lv.level}</div>
                        <div className="mt-0.5 leading-4">{lv.group}</div>
                        <div className="mt-0.5 leading-4 text-slate-500">{lv.judgment}</div>
                      </th>
                      {areas.map((a) => {
                        const over = lv.level > a.ceiling;
                        const s = (sentences[a.id] || []).find((x) => x.level === lv.level);
                        const running = areaState[a.id]?.status === "running";
                        const isEditing = editing && editing.areaId === a.id && editing.level === lv.level;
                        if (over) return <td key={a.id} className="border-b border-r border-slate-200 bg-slate-50" aria-label="상한 초과 공란" />;
                        if (isEditing) {
                          return (
                            <td key={a.id} className="border-b border-r border-slate-200 bg-blue-50 p-2">
                              <label className="block text-[11px] font-semibold text-slate-600" htmlFor="jl-edit-means">수단(괄호 안)</label>
                              <textarea id="jl-edit-means" value={editing.means} onChange={(e) => setEditing({ ...editing, means: e.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs leading-5" />
                              <label className="mt-1.5 block text-[11px] font-semibold text-slate-600" htmlFor="jl-edit-outcome">성과상태</label>
                              <textarea id="jl-edit-outcome" value={editing.outcome} onChange={(e) => setEditing({ ...editing, outcome: e.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs leading-5" />
                              <div className="mt-1.5 flex gap-2">
                                <button type="button" onClick={saveEdit} className="rounded bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white">저장</button>
                                <button type="button" onClick={() => setEditing(null)} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs">취소</button>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={a.id} className="border-b border-r border-slate-200 p-0">
                            {s ? (
                              <button
                                type="button"
                                disabled={generating}
                                onClick={() => setEditing({ areaId: a.id, level: lv.level, means: s.means, outcome: s.outcome })}
                                className="block w-full p-2 text-left leading-5 text-slate-800 hover:bg-blue-50 disabled:hover:bg-transparent"
                              >
                                {sentenceText(s.means, s.outcome)} <span className="whitespace-nowrap text-slate-500">{scoreLabel(lv.level)}</span>
                              </button>
                            ) : (
                              <div className="p-2 text-slate-400">{running ? <span className="animate-pulse">작성 중…</span> : "—"}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              회색 칸은 상한을 넘는 레벨이라 비워 둡니다. 점수는 O*NET 실측값이 아닌 레벨별 기준값을 적용한 모의평가입니다.
              작업 내용은 이 브라우저에만 임시로 저장되니, 보관이 필요하면 엑셀로 내려받아 주세요.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
