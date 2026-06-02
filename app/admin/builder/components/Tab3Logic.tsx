"use client";
import { useEffect, useState } from "react";
import type {
  AppSchema,
  CmpOp,
  Judge,
  Path,
  Step,
  StepType,
  Unit,
} from "app-renderer";
import { AGG, migrateSchema, run, tk2disp, UNITS } from "app-renderer";
import TokenBuilder from "./TokenBuilder";

const uid = () => Math.random().toString(36).slice(2, 7);

interface Props {
  schema: AppSchema;
  onChange: (s: AppSchema) => void;
}

const OPS: CmpOp[] = [">=", "<=", ">", "<", "==", "!="];

const STEP_LABEL: Record<StepType, string> = {
  branch: "분기",
  classify: "분류",
  table: "구간표",
  formula: "계산식",
  clamp: "보정",
  date: "날짜",
  llm: "LLM 요약",
};

const STEP_HINT: Record<StepType, string> = {
  branch: "조건에 따라 값을 가릅니다. 참/거짓에 텍스트 또는 계산식.",
  classify: "항목 골라 집계 (합계·개수·평균·최대·최소).",
  table: "구간별 단계값.",
  formula: "변수 콤보 + 연산자 버튼으로 식을 쌓습니다.",
  clamp: "결과를 상·하한으로 보정.",
  date: "두 날짜 차이 또는 연·월·일 추출.",
  llm: "앱 개요 + 선택한 산출 값으로 한 줄 요약 (Gemini).",
};

const STEP_BADGE: Record<StepType, string> = {
  branch: "bg-gray-200 text-gray-700",
  classify: "bg-blue-100 text-blue-700",
  table: "bg-purple-100 text-purple-700",
  formula: "bg-emerald-100 text-emerald-700",
  clamp: "bg-rose-100 text-rose-700",
  date: "bg-blue-100 text-blue-700",
  llm: "bg-violet-100 text-violet-700",
};

function newStep(t: StepType, firstVar: string): Step {
  const base = { id: uid(), name: "", unit: "" as Unit };
  if (t === "branch")
    return {
      ...base,
      type: "branch",
      ref: "",
      op: "<=",
      rhs: 0,
      then: "A",
      thenT: "text",
      thenTok: [],
      els: "B",
      elsT: "text",
      elsTok: [],
    };
  if (t === "classify")
    return { ...base, type: "classify", agg: "sum", items: [{ ref: firstVar, inc: true }] };
  if (t === "table")
    return { ...base, type: "table", ref: "", bands: [{ from: 0, to: 0, v: 0 }] };
  if (t === "formula") return { ...base, type: "formula", tokens: [] };
  if (t === "clamp") return { ...base, type: "clamp", ref: "", min: "", max: "" };
  if (t === "llm") return { ...base, type: "llm", items: [], prompt: "" };
  return { ...base, type: "date", mode: "diff", a: "", b: "오늘", out: "year" };
}

function newPath(): Path {
  return {
    id: uid(),
    label: "새 경로",
    conditions: [],
    steps: [],
    report: [],
  };
}

export default function Tab3Logic({ schema, onChange }: Props) {
  // 다중 경로 모델로 보장
  const m = migrateSchema(schema);
  const paths = m.paths || [];
  const shared = m.shared || { steps: [] };
  const fallback = m.fallback!;

  // 편집 중인 슬롯: 'shared' | path.id | 'fallback'
  const [slot, setSlot] = useState<string>(() =>
    paths[0]?.id || "shared"
  );

  // 슬롯이 사라지면 보정
  useEffect(() => {
    const valid = ["shared", "fallback", ...paths.map((p) => p.id)];
    if (!valid.includes(slot)) setSlot(paths[0]?.id || "shared");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.length, slot]);

  const result = run(schema);
  const { sc, res } = result;

  // 변수 풀
  const allVarNames = () => {
    const n = schema.vars.map((v) => v.name);
    n.push("적용여부");
    for (const s of shared.steps) if (s.name) n.push(s.name);
    return n;
  };
  const dateNames = () => {
    const n = schema.vars.filter((v) => v.type === "date").map((v) => v.name);
    n.unshift("오늘");
    return n;
  };

  // 슬롯별 step 컨텍스트
  const currentSteps = (): Step[] => {
    if (slot === "shared") return shared.steps;
    if (slot === "fallback") return fallback.steps;
    return paths.find((p) => p.id === slot)?.steps || [];
  };
  const currentLabel = () => {
    if (slot === "shared") return "공통 사전 계산";
    if (slot === "fallback") return fallback.label;
    return paths.find((p) => p.id === slot)?.label || "?";
  };

  // names visible at given step (before-step name pool)
  const namesBefore = (stepId: string): string[] => {
    const n = schema.vars.map((v) => v.name);
    n.push("적용여부");
    // shared 먼저
    for (const s of shared.steps) {
      if (s.id === stepId) return n;
      if (s.name) n.push(s.name);
    }
    if (slot !== "shared") {
      const ownSteps = currentSteps();
      for (const s of ownSteps) {
        if (s.id === stepId) return n;
        if (s.name) n.push(s.name);
      }
    }
    return n;
  };
  const numNamesBefore = (stepId: string) =>
    namesBefore(stepId).filter((nm) => {
      const v = schema.vars.find((x) => x.name === nm);
      if (v) return v.type === "number";
      return nm !== "적용여부";
    });

  // ───── mutators ─────

  const setShared = (patch: Partial<typeof shared>) =>
    onChange({ ...m, shared: { ...shared, ...patch } });

  const setPaths = (ps: Path[]) => onChange({ ...m, paths: ps });
  const setFallback = (patch: Partial<Path>) =>
    onChange({ ...m, fallback: { ...fallback, ...patch } });

  const updatePathById = (id: string, patch: Partial<Path>) =>
    setPaths(paths.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPath = () => {
    const np = newPath();
    setPaths([...paths, np]);
    setSlot(np.id);
  };
  const removePath = (id: string) => {
    if (!confirm("이 경로를 삭제합니다.")) return;
    setPaths(paths.filter((p) => p.id !== id));
  };
  const movePath = (id: string, dir: -1 | 1) => {
    const i = paths.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= paths.length) return;
    const next = [...paths];
    [next[i], next[j]] = [next[j], next[i]];
    setPaths(next);
  };

  // step ops on current slot
  const [stepT, setStepT] = useState<StepType>("formula");

  const setCurrentSteps = (next: Step[]) => {
    if (slot === "shared") setShared({ steps: next });
    else if (slot === "fallback") setFallback({ steps: next });
    else updatePathById(slot, { steps: next });
  };
  const updS = (id: string, patch: Partial<Step>) => {
    setCurrentSteps(currentSteps().map((s) => (s.id === id ? ({ ...s, ...patch } as Step) : s)));
  };
  const delS = (id: string) => setCurrentSteps(currentSteps().filter((s) => s.id !== id));
  const addS = () =>
    setCurrentSteps([...currentSteps(), newStep(stepT, schema.vars[0]?.name || "")]);

  // conditions ops on current path (slot != shared)
  const currentConds = (): Judge[] => {
    if (slot === "shared") return [];
    if (slot === "fallback") return [];
    return paths.find((p) => p.id === slot)?.conditions || [];
  };
  const setCurrentConds = (conds: Judge[]) => {
    if (slot === "fallback" || slot === "shared") return;
    updatePathById(slot, { conditions: conds });
  };

  const inpCls = "rounded border px-2 py-1 text-xs font-mono";
  const selCls = "rounded border px-2 py-1 text-xs";

  return (
    <div className="space-y-5">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          Layer 3 · 판단 흐름
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">분석 로직 (판정 → 산출)</h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          공통 사전 계산 → 경로별 진입 조건 매칭(first-match) → 매칭 경로의 산출 블록 실행.
        </p>
      </div>

      {/* 마스터-디테일: 좌측 슬롯 리스트 + 우측 편집 */}
      <div className="grid grid-cols-1 md:grid-cols-[240px,1fr] gap-4 items-start">
        {/* 좌측 사이드바 */}
        <aside className="rounded-lg border bg-gray-50 p-2 md:sticky md:top-4 self-start">
          <div className="px-1.5 pt-1 pb-2 text-[11px] font-semibold text-gray-600">
            경로 슬롯
            <div className="font-normal text-gray-400 mt-0.5">
              위→아래 우선순위 (first-match)
            </div>
          </div>
          <div className="space-y-1">
            <SlotItem
              label="▤ 공통 사전 계산"
              hint="모든 경로 진입 전"
              on={slot === "shared"}
              onClick={() => setSlot("shared")}
              kind="shared"
            />

            <div className="h-px bg-gray-200 my-1" />

            {paths.map((p, idx) => {
              const matched = result.activePathId === p.id;
              const trace = result.pathMatches[idx];
              return (
                <SlotItem
                  key={p.id}
                  label={`${idx + 1}. ${p.label}`}
                  on={slot === p.id}
                  matched={matched}
                  conditionOk={trace?.ok ?? null}
                  onClick={() => setSlot(p.id)}
                  kind="path"
                  onUp={idx > 0 ? () => movePath(p.id, -1) : undefined}
                  onDown={idx < paths.length - 1 ? () => movePath(p.id, 1) : undefined}
                />
              );
            })}

            <button
              onClick={addPath}
              className="w-full rounded-md border border-dashed border-blue-300 bg-white px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              + 경로 추가
            </button>

            <div className="h-px bg-gray-200 my-1" />

            <SlotItem
              label={`▣ ${fallback.label}`}
              hint="fallback (조건 없음)"
              on={slot === "fallback"}
              matched={result.activePathId === fallback.id}
              onClick={() => setSlot("fallback")}
              kind="fallback"
            />
          </div>
          <div className="px-1.5 pt-2 mt-2 border-t border-gray-200 text-[11px] text-gray-500">
            활성:{" "}
            <b className="text-blue-700 block truncate">
              {result.activePathLabel}
            </b>
          </div>
        </aside>

        {/* 우측 편집 패널 */}
        <div className="rounded-lg border bg-white p-4 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">편집 중:</span>
          {slot === "shared" ? (
            <>
              <span className="rounded-full bg-gray-200 text-gray-700 px-2.5 py-0.5 text-xs font-mono">
                ▤ 공통 사전 계산
              </span>
              <span className="text-xs text-gray-500">
                — 모든 경로 진입 전에 실행됨 (만나이, 출생월 등)
              </span>
            </>
          ) : slot === "fallback" ? (
            <>
              <span className="rounded-full bg-rose-100 text-rose-700 px-2.5 py-0.5 text-xs font-mono">
                ▣ Fallback
              </span>
              <input
                value={fallback.label}
                onChange={(e) => setFallback({ label: e.target.value })}
                className="rounded border px-2 py-0.5 text-sm font-medium"
              />
              <span className="text-xs text-gray-500">
                — 위 경로 중 어느 것도 매칭 안 됐을 때 마지막 안전망 (조건 없음).
                보통 산출 없이 안내문만 두는 게 일반적이에요.
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-mono">
                경로 {paths.findIndex((p) => p.id === slot) + 1}
              </span>
              <input
                value={paths.find((p) => p.id === slot)?.label || ""}
                onChange={(e) => updatePathById(slot, { label: e.target.value })}
                className="rounded border px-2 py-0.5 text-sm font-medium min-w-[200px]"
                placeholder="경로 이름"
              />
              <button
                onClick={() => removePath(slot)}
                className="ml-auto text-xs rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700"
              >
                경로 삭제
              </button>
            </>
          )}
        </div>

        {/* 조건 (path 전용) */}
        {slot !== "shared" && slot !== "fallback" && (
          <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
            <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <span className="rounded bg-amber-200/70 text-amber-900 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                1 · 진입 조건
              </span>
              모두 충족 시 이 경로
              <span className="font-normal text-amber-700/70">
                · 변수끼리 또는 변수 vs 값(숫자/문자) 비교 가능
              </span>
            </div>
            {currentConds().length === 0 ? (
              <div className="rounded border border-dashed p-3 text-center text-xs text-gray-500">
                <b>조건이 없습니다.</b> 이 경로가 위에서부터 매칭될 때 항상 채택돼요 —
                일반적인 catch 경로로 사용 가능 (fallback과 달리 여기에 산출 블록을 둘 수 있음).
              </div>
            ) : (
              <div className="space-y-2">
                {currentConds().map((j) => {
                  const aMode = j.aMode || (allVarNames().includes(j.a) ? "var" : "val");
                  const bMode = j.bMode || (allVarNames().includes(j.b) ? "var" : "val");
                  const updJ = (patch: Partial<Judge>) =>
                    setCurrentConds(
                      currentConds().map((c) => (c.id === j.id ? { ...c, ...patch } : c))
                    );
                  // 라이브 평가
                  const matchEntry = result.pathMatches.find((pm) => pm.id === slot);
                  const cr = matchEntry?.conditionResults.find(
                    (r) => r.a === j.a && r.op === j.op && r.b === j.b
                  );
                  return (
                    <div key={j.id} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <OperandPicker
                          value={j.a}
                          mode={aMode}
                          onChange={(v, m) => updJ({ a: v, aMode: m })}
                          varNames={allVarNames()}
                        />
                        <select
                          value={j.op}
                          onChange={(e) => updJ({ op: e.target.value as CmpOp })}
                          className={selCls}
                        >
                          {OPS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                        <OperandPicker
                          value={j.b}
                          mode={bMode}
                          onChange={(v, m) => updJ({ b: v, bMode: m })}
                          varNames={allVarNames()}
                        />
                        {cr && (
                          <span
                            className={
                              "ml-1 rounded px-2 py-0.5 text-[11px] font-mono " +
                              (cr.ok
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-500")
                            }
                            title="현재 테스트값 기준 평가"
                          >
                            {String(cr.av)} {j.op} {String(cr.bv)} → {cr.ok ? "충족" : "미충족"}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setCurrentConds(currentConds().filter((c) => c.id !== j.id))
                          }
                          className="ml-auto text-rose-600 text-sm"
                          title="조건 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => {
                const n = schema.vars[0]?.name || "";
                setCurrentConds([
                  ...currentConds(),
                  { id: uid(), a: n, op: ">=", b: n },
                ]);
              }}
              className="mt-2 rounded border bg-white px-3 py-1 text-xs hover:bg-gray-50"
            >
              + 조건 추가
            </button>
          </section>
        )}

        {/* 산출 블록 */}
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <span className="rounded bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider">
              2 · 산출 블록
            </span>
            {currentLabel()}
          </div>
          {currentSteps().length === 0 ? (
            <div className="rounded border border-dashed p-3 text-center text-xs text-gray-500">
              산출 블록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentSteps().map((s, idx) => {
                const rs = res[s.id];
                const av = namesBefore(s.id);
                const numAv = numNamesBefore(s.id);
                const dn = dateNames();
                return (
                  <div
                    key={s.id}
                    className={
                      "rounded border overflow-hidden " +
                      (rs && rs.skip ? "opacity-40" : "")
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                      <span
                        className={
                          "rounded px-2 py-0.5 text-[10px] font-mono uppercase " +
                          STEP_BADGE[s.type]
                        }
                      >
                        {idx + 1}·{STEP_LABEL[s.type]}
                      </span>
                      <input
                        value={s.name}
                        onChange={(e) => updS(s.id, { name: e.target.value })}
                        placeholder="결과 이름"
                        className={inpCls + " w-36 font-medium"}
                      />
                      <select
                        value={s.unit || ""}
                        onChange={(e) => updS(s.id, { unit: e.target.value as Unit })}
                        className={selCls}
                        title="결과 단위"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u || "(단위없음)"}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-gray-600 flex-1 min-w-[160px]">
                        {sayStep(s)}
                      </span>
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs font-mono " +
                          (rs?.bad
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700")
                        }
                      >
                        {rs ? rs.d : "—"}
                      </span>
                      <button
                        onClick={() => delS(s.id)}
                        className="text-xs rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="px-3 py-2.5 space-y-2">
                      {s.type === "branch" && (
                        <BranchEditor step={s} update={(p) => updS(s.id, p)} av={av} numAv={numAv} sc={sc} />
                      )}
                      {s.type === "classify" && (
                        <ClassifyEditor step={s} update={(p) => updS(s.id, p)} av={av} />
                      )}
                      {s.type === "table" && (
                        <TableEditor step={s} update={(p) => updS(s.id, p)} av={av} />
                      )}
                      {s.type === "formula" && (
                        <TokenBuilder
                          tokens={s.tokens || []}
                          onChange={(tokens) => updS(s.id, { tokens })}
                          varNames={numAv}
                          sc={sc}
                        />
                      )}
                      {s.type === "clamp" && (
                        <ClampEditor step={s} update={(p) => updS(s.id, p)} av={av} />
                      )}
                      {s.type === "date" && (
                        <DateEditor step={s} update={(p) => updS(s.id, p)} dn={dn} />
                      )}
                      {s.type === "llm" && (
                        <LlmEditor
                          step={s}
                          update={(p) => updS(s.id, p)}
                          av={av}
                          disp={result.disp}
                          meta={schema.meta}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">+ 산출 블록</span>
            <select
              value={stepT}
              onChange={(e) => setStepT(e.target.value as StepType)}
              className={selCls + " min-w-[180px]"}
            >
              {(["formula", "table", "classify", "branch", "clamp", "date", "llm"] as StepType[]).map((t) => (
                <option key={t} value={t}>
                  {STEP_LABEL[t]}
                </option>
              ))}
            </select>
            <button
              onClick={addS}
              className="rounded border bg-white px-3 py-1 text-xs hover:bg-gray-50"
            >
              추가
            </button>
            <span className="text-xs text-gray-500">{STEP_HINT[stepT]}</span>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

// ────────────── slot item (sidebar) ──────────────

function SlotItem({
  label,
  hint,
  on,
  matched,
  conditionOk,
  onClick,
  onUp,
  onDown,
  kind,
}: {
  label: string;
  hint?: string;
  on: boolean;
  matched?: boolean;
  conditionOk?: boolean | null;
  onClick: () => void;
  onUp?: () => void;
  onDown?: () => void;
  kind: "shared" | "path" | "fallback";
}) {
  const accent =
    kind === "shared"
      ? on
        ? "bg-gray-700 text-white border-gray-700"
        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
      : kind === "fallback"
      ? on
        ? "bg-rose-600 text-white border-rose-600"
        : "bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
      : on
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white border-blue-200 text-blue-700 hover:bg-blue-50";

  const dotColor = on ? "bg-white/80" : "bg-emerald-500";

  return (
    <div
      className={
        "group flex items-stretch rounded-md border overflow-hidden transition " +
        accent +
        (matched ? " ring-2 ring-emerald-400 ring-offset-1" : "")
      }
    >
      <button
        onClick={onClick}
        className="flex-1 text-left px-2.5 py-1.5 min-w-0"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{label}</span>
          {kind === "path" && conditionOk != null && (
            <span
              className={
                "inline-block w-1.5 h-1.5 rounded-full shrink-0 " +
                (conditionOk ? dotColor : "bg-gray-300")
              }
              title={conditionOk ? "조건 충족" : "조건 미충족"}
            />
          )}
        </div>
        {hint && (
          <div
            className={
              "text-[10px] mt-0.5 truncate " +
              (on ? "text-white/70" : "text-gray-400")
            }
          >
            {hint}
          </div>
        )}
      </button>
      {(onUp || onDown) && (
        <div
          className={
            "flex flex-col border-l " +
            (on ? "border-white/20" : "border-black/5")
          }
        >
          <button
            onClick={onUp}
            disabled={!onUp}
            title="위로"
            className={
              "px-1.5 text-[10px] leading-none flex-1 " +
              (on
                ? "text-white/70 hover:bg-white/10 disabled:opacity-30"
                : "text-gray-400 hover:bg-black/5 disabled:opacity-30")
            }
          >
            ↑
          </button>
          <button
            onClick={onDown}
            disabled={!onDown}
            title="아래로"
            className={
              "px-1.5 text-[10px] leading-none flex-1 border-t " +
              (on
                ? "border-white/20 text-white/70 hover:bg-white/10 disabled:opacity-30"
                : "border-black/5 text-gray-400 hover:bg-black/5 disabled:opacity-30")
            }
          >
            ↓
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────── operand picker ──────────────

function OperandPicker({
  value,
  mode,
  onChange,
  varNames,
}: {
  value: string;
  mode: "var" | "val";
  onChange: (v: string, m: "var" | "val") => void;
  varNames: string[];
}) {
  const isNumLit = mode === "val" && /^-?\d+(\.\d+)?$/.test(value.trim());
  return (
    <span className="inline-flex items-center rounded border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(value, mode === "var" ? "val" : "var")}
        className={
          "text-[10px] px-1.5 py-1 font-mono uppercase tracking-wider border-r " +
          (mode === "var"
            ? "bg-gray-100 text-gray-700"
            : "bg-amber-50 text-amber-700")
        }
        title={mode === "var" ? "변수 모드 — 클릭하여 값 모드로" : "값 모드 — 클릭하여 변수 모드로"}
      >
        {mode === "var" ? "변수" : "값"}
      </button>
      {mode === "var" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value, "var")}
          className="px-2 py-1 text-xs min-w-[110px] border-0 focus:outline-none"
        >
          {varNames.length === 0 ? (
            <option value="">(없음)</option>
          ) : (
            varNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))
          )}
          {value && !varNames.includes(value) && (
            <option value={value}>⚠ {value} (정의 안됨)</option>
          )}
        </select>
      ) : (
        <span className="inline-flex items-center">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value, "val")}
            placeholder='숫자 또는 "텍스트"'
            className="px-2 py-1 text-xs min-w-[110px] border-0 focus:outline-none font-mono"
          />
          <span className="text-[10px] text-gray-400 pr-2 font-mono">
            {value === ""
              ? "—"
              : isNumLit
              ? `(숫자 ${value})`
              : "(텍스트)"}
          </span>
        </span>
      )}
    </span>
  );
}

// ────────────── slot pill ──────────────

function SlotPill({
  label,
  on,
  matched,
  conditionOk,
  onClick,
  kind,
}: {
  label: string;
  on: boolean;
  matched?: boolean;
  conditionOk?: boolean | null;
  onClick: () => void;
  kind: "shared" | "path" | "fallback";
}) {
  const ringMatched = matched ? " ring-2 ring-emerald-400 ring-offset-1" : "";
  const colorBase =
    kind === "shared"
      ? on
        ? "bg-gray-700 text-white"
        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
      : kind === "fallback"
      ? on
        ? "bg-rose-600 text-white"
        : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
      : on
      ? "bg-blue-600 text-white"
      : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50";

  const condMark =
    kind === "path" && conditionOk != null ? (
      <span
        className={
          "ml-1.5 inline-block w-1.5 h-1.5 rounded-full " +
          (conditionOk ? "bg-emerald-500" : "bg-gray-300")
        }
      />
    ) : null;

  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition " +
        colorBase +
        ringMatched
      }
    >
      {label}
      {condMark}
    </button>
  );
}

// ────────────── sub editors ──────────────

function sayStep(s: Step): React.ReactNode {
  const KOP: Record<string, string> = {
    ">=": "이상",
    "<=": "이하",
    ">": "초과",
    "<": "미만",
    "==": "같음",
    "!=": "다름",
  };
  if (s.type === "branch") {
    const side = (txt: string, tks: any, t: any) =>
      t === "calc" ? `계산식[${tk2disp(tks) || "…"}]` : `"${txt}"`;
    return (
      <>
        <b>{s.ref || "?"}</b> {KOP[s.op] || s.op} <b>{s.rhs}</b> → 참:{" "}
        {side(s.then, s.thenTok, s.thenT)}, 거짓: {side(s.els, s.elsTok, s.elsT)}
      </>
    );
  }
  if (s.type === "classify") {
    const i = s.items.filter((x) => x.inc).map((x) => x.ref).join(", ") || "?";
    return (
      <>
        <b>{AGG[s.agg || "sum"]}</b>( {i} )
      </>
    );
  }
  if (s.type === "table") return (<><b>{s.ref || "?"}</b> 가 속한 구간의 단계값</>);
  if (s.type === "formula") return (<>계산식: <b>{tk2disp(s.tokens) || "(비어 있음)"}</b></>);
  if (s.type === "clamp")
    return (
      <>
        <b>{s.ref || "?"}</b> 을 {s.min && (<><b>{s.min}</b> 이상</>)}
        {s.min && s.max && ", "}
        {s.max && (<><b>{s.max}</b> 이하</>)}
        {!s.min && !s.max ? "(미설정)" : "로 보정"}
      </>
    );
  if (s.type === "llm") {
    return (<>LLM 3줄 분석 {s.lastResult ? "· 분석됨" : "· 미실행"}</>);
  }
  if (s.type === "date")
    return s.mode === "diff" ? (
      <>
        <b>{s.a || "?"}</b> ↔ <b>{s.b || "?"}</b> 차이({{ year: "년", month: "월", day: "일" }[s.out]})
      </>
    ) : (
      <>
        <b>{s.a || "?"}</b> 의 {{ year: "연도", month: "월", day: "일" }[s.out]} 추출
      </>
    );
  return null;
}

function BranchEditor({ step, update, av, numAv, sc }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className={inp + " min-w-[120px]"}>
          {av.map((n: string) => (<option key={n}>{n}</option>))}
        </select>
        <select value={step.op} onChange={(e) => update({ op: e.target.value })} className={inp}>
          {OPS.map((o) => (<option key={o}>{o}</option>))}
        </select>
        <input
          value={step.rhs}
          onChange={(e) =>
            update({ rhs: isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value) })
          }
          className={inp + " w-20 text-right font-mono"}
        />
      </div>
      <BranchSide label="참 →" textKey="then" tokKey="thenTok" typeKey="thenT" step={step} update={update} numAv={numAv} sc={sc} />
      <BranchSide label="거짓 →" textKey="els" tokKey="elsTok" typeKey="elsT" step={step} update={update} numAv={numAv} sc={sc} />
    </div>
  );
}

function BranchSide({ label, textKey, tokKey, typeKey, step, update, numAv, sc }: any) {
  const isCalc = step[typeKey] === "calc";
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-12">{label}</span>
        <select
          value={step[typeKey] || "text"}
          onChange={(e) => {
            const v = e.target.value;
            const patch: any = { [typeKey]: v };
            if (v === "calc" && !step[tokKey]) patch[tokKey] = [];
            update(patch);
          }}
          className={inp}
        >
          <option value="text">텍스트</option>
          <option value="calc">계산식</option>
        </select>
        {!isCalc && (
          <input
            value={step[textKey] || ""}
            onChange={(e) => update({ [textKey]: e.target.value })}
            className={inp + " flex-1 min-w-[180px]"}
          />
        )}
      </div>
      {isCalc && (
        <TokenBuilder
          tokens={step[tokKey] || []}
          onChange={(t) => update({ [tokKey]: t })}
          varNames={numAv}
          sc={sc}
        />
      )}
    </div>
  );
}

function ClassifyEditor({ step, update, av }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-600">집계방식</span>
      <select value={step.agg || "sum"} onChange={(e) => update({ agg: e.target.value })} className={inp}>
        {Object.entries(AGG).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
      </select>
      <span className="text-xs text-gray-500">— 항목 (체크=포함):</span>
      {step.items.map((it: any, i: number) => (
        <label key={i} className="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={it.inc}
            onChange={(e) => {
              const next = [...step.items];
              next[i] = { ...it, inc: e.target.checked };
              update({ items: next });
            }}
          />
          <select
            value={it.ref}
            onChange={(e) => {
              const next = [...step.items];
              next[i] = { ...it, ref: e.target.value };
              update({ items: next });
            }}
            className={inp}
          >
            {av.map((n: string) => (<option key={n}>{n}</option>))}
          </select>
          <button
            onClick={() => update({ items: step.items.filter((_: any, x: number) => x !== i) })}
            className="text-rose-600 ml-1"
          >
            ✕
          </button>
        </label>
      ))}
      <button
        onClick={() => update({ items: [...step.items, { ref: av[0] || "", inc: true }] })}
        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
      >
        + 항목
      </button>
    </div>
  );
}

function TableEditor({ step, update, av }: any) {
  const inp = "rounded border px-1 py-0.5 text-xs font-mono w-14 text-right";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className="rounded border px-2 py-1 text-xs">
        {av.map((n: string) => (<option key={n}>{n}</option>))}
      </select>
      <span className="text-xs text-gray-500">구간 →</span>
      {step.bands.map((b: any, i: number) => (
        <span key={i} className="inline-flex items-center gap-1 rounded border bg-white px-1.5 py-0.5 text-xs font-mono">
          <input
            type="number"
            value={b.from}
            onChange={(e) => {
              const next = [...step.bands];
              next[i] = { ...b, from: parseFloat(e.target.value) || 0 };
              update({ bands: next });
            }}
            className={inp}
          />
          –
          <input
            type="number"
            value={b.to}
            onChange={(e) => {
              const next = [...step.bands];
              next[i] = { ...b, to: parseFloat(e.target.value) || 0 };
              update({ bands: next });
            }}
            className={inp}
          />
          :
          <input
            type="number"
            step="0.01"
            value={b.v}
            onChange={(e) => {
              const next = [...step.bands];
              next[i] = { ...b, v: parseFloat(e.target.value) || 0 };
              update({ bands: next });
            }}
            className={inp}
          />
          <button
            onClick={() => update({ bands: step.bands.filter((_: any, x: number) => x !== i) })}
            className="text-rose-600 ml-1"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        onClick={() => update({ bands: [...step.bands, { from: 0, to: 0, v: 0 }] })}
        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
      >
        + 구간
      </button>
    </div>
  );
}

function ClampEditor({ step, update, av }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className={inp + " min-w-[120px]"}>
        {av.map((n: string) => (<option key={n}>{n}</option>))}
      </select>
      <span className="text-gray-600">를</span>
      <span>하한</span>
      <select value={step.min} onChange={(e) => update({ min: e.target.value })} className={inp + " min-w-[120px]"}>
        <option value="">(없음)</option>
        {av.map((n: string) => (<option key={n}>{n}</option>))}
      </select>
      <span>상한</span>
      <select value={step.max} onChange={(e) => update({ max: e.target.value })} className={inp + " min-w-[120px]"}>
        <option value="">(없음)</option>
        {av.map((n: string) => (<option key={n}>{n}</option>))}
      </select>
    </div>
  );
}

function DateEditor({ step, update, dn }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-600">모드</span>
      <select value={step.mode} onChange={(e) => update({ mode: e.target.value })} className={inp}>
        <option value="diff">두 날짜 차이</option>
        <option value="part">연·월·일 추출</option>
      </select>
      <span className="text-gray-600">{step.mode === "diff" ? "시작" : "대상"}</span>
      <select value={step.a} onChange={(e) => update({ a: e.target.value })} className={inp + " min-w-[120px]"}>
        {dn.map((n: string) => (<option key={n}>{n}</option>))}
      </select>
      {step.mode === "diff" && (
        <>
          <span className="text-gray-600">끝</span>
          <select value={step.b} onChange={(e) => update({ b: e.target.value })} className={inp + " min-w-[120px]"}>
            {dn.map((n: string) => (<option key={n}>{n}</option>))}
          </select>
        </>
      )}
      <span className="text-gray-600">단위</span>
      <select value={step.out} onChange={(e) => update({ out: e.target.value })} className={inp}>
        <option value="year">{step.mode === "diff" ? "년(만나이)" : "연도"}</option>
        <option value="month">{step.mode === "diff" ? "개월" : "월"}</option>
        <option value="day">일</option>
      </select>
    </div>
  );
}

function LlmEditor({ step, update, av, disp, meta }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const run = async () => {
    setErr("");
    setBusy(true);
    try {
      const context = (av || []).map((name: string) => ({
        name,
        value: disp?.[name] ?? "—",
      }));
      const res = await fetch("/api/llm-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, context, prompt: step.prompt || "" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "요청 실패");
      update({ lastResult: j.summary, lastAt: new Date().toISOString() });
    } catch (e: any) {
      setErr(e?.message || "에러");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 text-xs">
      <div className="rounded border border-violet-200 bg-violet-50/50 px-2.5 py-2 text-[11px] text-violet-800">
        앞선 모든 변수·산출값({(av || []).length}개)과 앱 개요를 토대로 <b>3줄 분석 리포트</b>를 생성합니다.
      </div>

      <div>
        <div className="text-[11px] text-gray-500 mb-1">추가 지시문 (선택)</div>
        <textarea
          value={step.prompt || ""}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={2}
          placeholder="예) 위험도 평가에 초점을 맞춰 요약"
          className={inp + " w-full font-normal"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={busy}
          className={
            "rounded px-3 py-1 text-xs font-medium " +
            (busy
              ? "bg-gray-200 text-gray-500"
              : "bg-violet-600 text-white hover:bg-violet-700")
          }
        >
          {busy ? "분석 중…" : "분석 실행"}
        </button>
        {step.lastAt && (
          <span className="text-[11px] text-gray-400">
            최근 분석: {new Date(step.lastAt).toLocaleString("ko-KR")}
          </span>
        )}
        {err && <span className="text-[11px] text-rose-600">⚠ {err}</span>}
      </div>

      <div className="rounded border bg-white px-2.5 py-2">
        <div className="text-[11px] font-semibold text-gray-600 mb-1">결과</div>
        {step.lastResult ? (
          <div className="text-sm text-gray-900 whitespace-pre-wrap">{step.lastResult}</div>
        ) : (
          <div className="text-[11px] text-gray-400">아직 실행되지 않았습니다.</div>
        )}
      </div>
    </div>
  );
}
