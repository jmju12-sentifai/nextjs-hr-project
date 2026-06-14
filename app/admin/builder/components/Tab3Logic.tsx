"use client";
import React, { useEffect, useState } from "react";
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
  switch: "다중분기",
  classify: "분류",
  table: "구간표",
  formula: "계산식",
  clamp: "보정",
  date: "날짜",
  llm: "LLM 요약",
};

const STEP_HINT: Record<StepType, string> = {
  branch: "조건에 따라 값을 가릅니다. 참/거짓에 텍스트 또는 계산식.",
  switch: "한 변수의 값에 따라 N개 케이스로 분기 (예: 분류별 정책값 선택).",
  classify: "항목 골라 집계 (합계·개수·평균·최대·최소).",
  table: "구간별 단계값.",
  formula: "변수 콤보 + 연산자 버튼으로 식을 쌓습니다.",
  clamp: "결과를 상·하한으로 보정.",
  date: "두 날짜 차이 또는 연·월·일 추출.",
  llm: "앱 개요 + 선택한 산출 값으로 한 줄 요약 (Gemini).",
};

const STEP_BADGE: Record<StepType, string> = {
  branch: "bg-gray-200 text-gray-700",
  switch: "bg-fuchsia-100 text-fuchsia-700",
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
  if (t === "switch")
    return {
      ...base,
      type: "switch",
      ref: "",
      cases: [],
      defaultT: "calc",
      defaultText: "",
      defaultTokens: [],
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

  // (A) 편집 시뮬레이션 — 편집 중인 경로를 강제로 활성화. 산식 라이브 검증 시 "미정의" 오작동 방지용.
  //     우측 편집 패널의 값(res, sc) 은 이걸로.
  const forcedPathId = slot === "shared" ? undefined : slot;
  const result = run(schema, [], [], forcedPathId);
  const { sc, res } = result;
  // (B) 자연 시뮬레이션 — 강제 없이 실제 조건 매칭 결과. "현재 활성" 표시 / 좌측 패널 매칭 표시용.
  const naturalResult = run(schema, [], []);
  const naturalActiveId = naturalResult.activePathId;
  const naturalActiveLabel = naturalResult.activePathLabel;

  // 변수 풀
  const allVarNames = () => {
    const n = schema.vars.map((v) => v.name);
    n.push("적용여부");
    for (const s of shared.steps) if (s.name) n.push(s.name);
    return n;
  };
  // 변수 메타 맵 — 이름 → {group, subGroup}. 에디터들이 그룹 정렬 옵션 만들 때 사용.
  const varsMeta: Record<string, { group?: string; subGroup?: string }> = {};
  for (const v of schema.vars) varsMeta[v.name] = { group: v.group, subGroup: v.subGroup };
  // 이름들을 group > subGroup 계층으로 묶어 정렬한 옵션 그룹 구조 반환
  // (schema 의 변수 메타에서 group/subGroup 을 조회. step 이름 등 메타 없는 건 "기타" 로)
  const buildGroupedOptions = (names: string[]) => {
    const groups: Record<string, Record<string, string[]>> = {};
    const seen = new Set<string>();
    for (const nm of names) {
      if (seen.has(nm)) continue;
      seen.add(nm);
      const v = schema.vars.find((x) => x.name === nm);
      const g = (v?.group || "").trim() || "_기타";
      const sg = (v?.subGroup || "").trim() || "_기본";
      if (!groups[g]) groups[g] = {};
      if (!groups[g][sg]) groups[g][sg] = [];
      groups[g][sg].push(nm);
    }
    // 그룹/하위 정렬 — _기타 는 맨 뒤
    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "_기타") return 1;
        if (b === "_기타") return -1;
        return a.localeCompare(b);
      })
      .map(([g, subs]) => ({
        group: g,
        groupLabel: g === "_기타" ? "기타" : g,
        subs: Object.entries(subs)
          .sort(([a], [b]) => {
            if (a === "_기본") return -1;
            if (b === "_기본") return 1;
            return a.localeCompare(b);
          })
          .map(([sg, items]) => ({
            sub: sg,
            subLabel: sg === "_기본" ? "" : sg,
            items: [...items].sort((a, b) => a.localeCompare(b)),
          })),
      }));
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
          로직 · 판정과 산출 정의
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">분석 로직</h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          공통 사전 계산을 거쳐 조건에 맞는 경로를 고르고, 그 경로의 산식을 실행해 결과를 만듭니다.
        </p>
      </div>

      {/* 마스터-디테일: 좌측 슬롯 리스트 + 우측 편집 */}
      <div className="grid grid-cols-1 md:grid-cols-[240px,1fr] gap-4 items-start">
        {/* 좌측 사이드바 — 경로 슬롯 */}
        <aside className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3 md:sticky md:top-4 self-start shadow-sm">
          <div className="px-1.5 pt-1 pb-3 border-b border-gray-200/70">
            <div className="text-xs font-bold text-gray-900">경로 슬롯</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-snug">
              조건에 따라 다른 산식·리포트를 적용하는 분기를 정의합니다.
              위에서 아래 순서대로 검사하며 <b className="text-gray-700">처음 만족하는 경로</b>가 활성화됩니다.
            </div>
          </div>

          <div className="space-y-1 mt-2">
            <SlotItem
              label="공통 사전 계산"
              hint="모든 경로에서 공유"
              detail="조건 분기 전에 미리 계산되는 항목 (만나이 등)"
              on={slot === "shared"}
              onClick={() => setSlot("shared")}
              kind="shared"
              prefixIcon="▤"
            />

            <div className="px-1 my-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <span className="h-px flex-1 bg-gray-200" />
              경로 (위→아래 검사)
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            {paths.map((p, idx) => {
              // 매칭 여부는 자연 시뮬 기준 — 실제 조건 매칭이 일어난 경로만 활성
              const matched = naturalActiveId === p.id;
              const trace = naturalResult.pathMatches[idx];
              const condTip =
                p.conditions.length === 0
                  ? "조건 없음 — 항상 통과"
                  : p.conditions
                      .map((c) => `${c.a} ${c.op} ${c.b}`)
                      .join("  ·  ");
              return (
                <SlotItem
                  key={p.id}
                  label={`${idx + 1}. ${p.label}`}
                  on={slot === p.id}
                  matched={matched}
                  conditionOk={trace?.ok ?? null}
                  detail={`조건 ${p.conditions.length}개 · 단계 ${p.steps.length}개`}
                  tooltip={condTip}
                  onClick={() => setSlot(p.id)}
                  kind="path"
                  prefixIcon={`${idx + 1}`}
                  onUp={idx > 0 ? () => movePath(p.id, -1) : undefined}
                  onDown={idx < paths.length - 1 ? () => movePath(p.id, 1) : undefined}
                />
              );
            })}

            <button
              onClick={addPath}
              className="mt-1.5 w-full rounded-md border border-dashed border-blue-300 bg-white px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
            >
              + 경로 추가
            </button>

            <div className="px-1 my-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <span className="h-px flex-1 bg-gray-200" />
              미적용 시
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <SlotItem
              label={fallback.label}
              hint="모든 경로 미충족 시"
              detail="기본 안내 — 조건 없이 항상 적용"
              on={slot === "fallback"}
              matched={naturalActiveId === fallback.id}
              onClick={() => setSlot("fallback")}
              kind="fallback"
              prefixIcon="▣"
            />
          </div>

          <div className="px-2 pt-3 mt-3 border-t border-gray-200/70">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
              현재 활성
            </div>
            <div className="text-xs font-semibold text-blue-700 truncate" title="실제 조건 매칭 결과 (편집 중인 경로가 아니라 first-match 로 결정됨)">
              {naturalActiveLabel}
            </div>
            {slot !== "shared" && slot !== naturalActiveId && (
              <div className="mt-1 text-[10px] text-amber-700 leading-relaxed">
                ⚠ 편집 중인 경로는 실제로는 비활성 — 산식 라이브 검증을 위해 임시로 활성화한 상태입니다.
              </div>
            )}
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
                          groupedOpts={buildGroupedOptions(allVarNames())}
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
                          groupedOpts={buildGroupedOptions(allVarNames())}
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
                        <BranchEditor step={s} update={(p: any) => updS(s.id, p)} av={av} numAv={numAv} sc={sc} varsMeta={varsMeta} />
                      )}
                      {s.type === "switch" && (
                        <SwitchEditor step={s} update={(p: any) => updS(s.id, p)} av={av} numAv={numAv} sc={sc} varsMeta={varsMeta} />
                      )}
                      {s.type === "classify" && (
                        <ClassifyEditor step={s} update={(p: any) => updS(s.id, p)} av={av} varsMeta={varsMeta} />
                      )}
                      {s.type === "table" && (
                        <TableEditor step={s} update={(p: any) => updS(s.id, p)} av={av} varsMeta={varsMeta} />
                      )}
                      {s.type === "formula" && (
                        <TokenBuilder
                          tokens={s.tokens || []}
                          onChange={(tokens) => updS(s.id, { tokens })}
                          varNames={numAv}
                          sc={sc}
                          varsMeta={varsMeta}
                        />
                      )}
                      {s.type === "clamp" && (
                        <ClampEditor step={s} update={(p: any) => updS(s.id, p)} av={av} varsMeta={varsMeta} />
                      )}
                      {s.type === "date" && (
                        <DateEditor step={s} update={(p: any) => updS(s.id, p)} dn={dn} />
                      )}
                      {s.type === "llm" && (
                        <LlmEditor
                          step={s}
                          update={(p: any) => updS(s.id, p)}
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
              {(["formula", "table", "classify", "branch", "switch", "clamp", "date", "llm"] as StepType[]).map((t) => (
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
  detail,
  tooltip,
  prefixIcon,
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
  detail?: string;
  tooltip?: string;
  prefixIcon?: string;
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

  const iconBg =
    kind === "shared"
      ? on
        ? "bg-white/15 text-white"
        : "bg-gray-100 text-gray-600"
      : kind === "fallback"
      ? on
        ? "bg-white/15 text-white"
        : "bg-rose-100 text-rose-700"
      : on
      ? "bg-white/15 text-white"
      : "bg-blue-100 text-blue-700";

  const dotColor = on ? "bg-white/80" : "bg-emerald-500";

  return (
    <div
      className={
        "group relative flex items-stretch rounded-lg border overflow-visible transition " +
        accent +
        (matched ? " ring-2 ring-emerald-400 ring-offset-1" : "")
      }
    >
      <button
        onClick={onClick}
        className="flex-1 text-left px-2 py-2 min-w-0 flex items-start gap-2"
      >
        {prefixIcon && (
          <span
            className={
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold font-mono mt-0.5 " +
              iconBg
            }
          >
            {prefixIcon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold truncate">{label}</span>
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
          {(detail || hint) && (
            <div
              className={
                "text-[10px] mt-0.5 leading-snug break-keep " +
                (on ? "text-white/70" : "text-gray-500")
              }
            >
              {detail || hint}
            </div>
          )}
        </div>
      </button>
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-30 hidden group-hover:block w-[260px] rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 px-3 py-2 text-[11px] text-white shadow-xl ring-1 ring-blue-400/30"
        >
          <div className="text-[9px] uppercase tracking-wider text-white/70 mb-1 font-bold">
            적용 조건
          </div>
          <div className="leading-relaxed font-medium">{tooltip}</div>
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-blue-600" />
        </div>
      )}
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

type GroupedOpts = ReturnType<ReturnType<typeof makeGroupedBuilder>>;

function makeGroupedBuilder() {
  return (names: string[], varsMeta: Record<string, { group?: string; subGroup?: string }>) => {
    const groups: Record<string, Record<string, string[]>> = {};
    const seen = new Set<string>();
    for (const nm of names) {
      if (seen.has(nm)) continue;
      seen.add(nm);
      const m = varsMeta[nm] || {};
      const g = (m.group || "").trim() || "_기타";
      const sg = (m.subGroup || "").trim() || "_기본";
      if (!groups[g]) groups[g] = {};
      if (!groups[g][sg]) groups[g][sg] = [];
      groups[g][sg].push(nm);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (a === "_기타" ? 1 : b === "_기타" ? -1 : a.localeCompare(b)))
      .map(([g, subs]) => ({
        group: g,
        groupLabel: g === "_기타" ? "기타" : g,
        subs: Object.entries(subs)
          .sort(([a], [b]) => (a === "_기본" ? -1 : b === "_기본" ? 1 : a.localeCompare(b)))
          .map(([sg, items]) => ({
            sub: sg,
            subLabel: sg === "_기본" ? "" : sg,
            items: [...items].sort((a, b) => a.localeCompare(b)),
          })),
      }));
  };
}

// 이름 배열을 group > subGroup 으로 묶어 정렬된 옵션 그룹 트리로 변환
function groupNames(
  names: string[],
  varsMeta: Record<string, { group?: string; subGroup?: string }> | undefined
): GroupedOpts {
  const groups: Record<string, Record<string, string[]>> = {};
  const seen = new Set<string>();
  for (const nm of names) {
    if (seen.has(nm)) continue;
    seen.add(nm);
    const m = (varsMeta && varsMeta[nm]) || {};
    const g = (m.group || "").trim() || "_기타";
    const sg = (m.subGroup || "").trim() || "_기본";
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(nm);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => (a === "_기타" ? 1 : b === "_기타" ? -1 : a.localeCompare(b)))
    .map(([g, subs]) => ({
      group: g,
      groupLabel: g === "_기타" ? "기타" : g,
      subs: Object.entries(subs)
        .sort(([a], [b]) => (a === "_기본" ? -1 : b === "_기본" ? 1 : a.localeCompare(b)))
        .map(([sg, items]) => ({
          sub: sg,
          subLabel: sg === "_기본" ? "" : sg,
          items: [...items].sort((a, b) => a.localeCompare(b)),
        })),
    }));
}

// 편의 helper — av(이름 배열) + varsMeta → optgroup JSX. 그룹 메타가 없으면 평탄 옵션.
function VarOpts({
  names,
  varsMeta,
  includeValue,
}: {
  names: string[];
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
  includeValue?: string;
}) {
  const grouped = groupNames(names, varsMeta);
  const hasRealGroup = grouped.some((g) => g.group !== "_기타");
  if (!hasRealGroup) {
    // 그룹 정보 없음 → 평탄 옵션
    return (
      <>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {includeValue && !names.includes(includeValue) && (
          <option value={includeValue}>⚠ {includeValue} (정의 안됨)</option>
        )}
      </>
    );
  }
  return <GroupedOptions grouped={grouped} includeValue={includeValue} />;
}

// 그룹 정렬된 옵션 렌더링 — optgroup 으로 묶음 표시
function GroupedOptions({ grouped, includeValue }: { grouped: GroupedOpts; includeValue?: string }) {
  // 각 (group, subGroup) 조합을 별도 optgroup 으로. optgroup label 에 묶음 정보 표시.
  // option text 는 변수명만 — 선택 후 닫힌 select 에는 변수명만 표시됨.
  const allNames = new Set<string>();
  for (const g of grouped) for (const s of g.subs) for (const it of s.items) allNames.add(it);
  const flatGroups: { label: string; items: string[] }[] = [];
  for (const g of grouped) {
    for (const s of g.subs) {
      const label =
        g.group === "_기타"
          ? s.subLabel || "기타"
          : s.subLabel
          ? `${g.groupLabel} > ${s.subLabel}`
          : g.groupLabel;
      flatGroups.push({ label, items: s.items });
    }
  }
  return (
    <>
      {flatGroups.map((fg, i) => (
        <optgroup key={i} label={fg.label}>
          {fg.items.map((it) => (
            <option key={it} value={it}>
              {it}
            </option>
          ))}
        </optgroup>
      ))}
      {includeValue && !allNames.has(includeValue) && (
        <option value={includeValue}>⚠ {includeValue} (정의 안됨)</option>
      )}
    </>
  );
}

function OperandPicker({
  value,
  mode,
  onChange,
  varNames,
  groupedOpts,
}: {
  value: string;
  mode: "var" | "val";
  onChange: (v: string, m: "var" | "val") => void;
  varNames: string[];
  groupedOpts?: GroupedOpts;
}) {
  // AI 파서가 숫자 리터럴을 number 로 넣어버리는 경우가 있어 방어적 String() 변환
  const v = String(value ?? "");
  const isNumLit = mode === "val" && /^-?\d+(\.\d+)?$/.test(v.trim());
  return (
    <span className="inline-flex items-center rounded border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(v, mode === "var" ? "val" : "var")}
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
          value={v}
          onChange={(e) => onChange(e.target.value, "var")}
          className="px-2 py-1 text-xs min-w-[110px] border-0 focus:outline-none"
        >
          {varNames.length === 0 ? (
            <option value="">(없음)</option>
          ) : groupedOpts && groupedOpts.length > 0 ? (
            <GroupedOptions grouped={groupedOpts} includeValue={v} />
          ) : (
            <>
              {varNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              {v && !varNames.includes(v) && <option value={v}>⚠ {v} (정의 안됨)</option>}
            </>
          )}
        </select>
      ) : (
        <span className="inline-flex items-center">
          <input
            value={v}
            onChange={(e) => onChange(e.target.value, "val")}
            placeholder='숫자 또는 "텍스트"'
            className="px-2 py-1 text-xs min-w-[110px] border-0 focus:outline-none font-mono"
          />
          <span className="text-[10px] text-gray-400 pr-2 font-mono">
            {v === ""
              ? "—"
              : isNumLit
              ? `(숫자 ${v})`
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

// 사용자(임직원) 친화 톤으로 통일 — describeStep 과 동일한 문장 구조 + 강조용 <b>.
function sayStep(s: Step): React.ReactNode {
  if (s.type === "branch") {
    return <>조건에 따라 적용되는 값이 달라집니다.</>;
  }
  if (s.type === "switch") {
    return (
      <>
        <b>{s.ref || "분류"}</b> 값에 따라 적용되는 값이 달라집니다.
      </>
    );
  }
  if (s.type === "classify") {
    const items = s.items.filter((x) => x.inc).map((x) => x.ref);
    const aggLabel: Record<string, string> = {
      sum: "합산",
      count: "건수 집계",
      avg: "평균",
      max: "최대값",
      min: "최소값",
    };
    const verb = aggLabel[s.agg || "sum"] || "합산";
    if (items.length === 0) return <><b>{verb}</b>한 결과입니다.</>;
    if (items.length <= 3)
      return (
        <>
          <b>{items.join(", ")}</b> 항목을 <b>{verb}</b>한 결과입니다.
        </>
      );
    return (
      <>
        <b>{items.slice(0, 2).join(", ")}</b> 등 {items.length}개 항목을 <b>{verb}</b>한 결과입니다.
      </>
    );
  }
  if (s.type === "table") {
    return (
      <>
        <b>{s.ref || "기준값"}</b> 이 속한 구간에 따라 회사 규정에서 적용된 값입니다.
      </>
    );
  }
  if (s.type === "formula") {
    const vars = (s.tokens || [])
      .filter((t: any) => t.t === "var" && t.name)
      .map((t: any) => t.name as string);
    if (vars.length === 0) return <>산식으로 계산된 값입니다.</>;
    if (vars.length === 1)
      return (
        <>
          <b>{vars[0]}</b> 을(를) 기반으로 계산된 값입니다.
        </>
      );
    if (vars.length <= 3)
      return (
        <>
          <b>{vars.join(", ")}</b> 을(를) 조합해 계산된 값입니다.
        </>
      );
    return (
      <>
        <b>{vars.slice(0, 2).join(", ")}</b> 등 여러 항목을 조합해 계산된 값입니다.
      </>
    );
  }
  if (s.type === "clamp") {
    const parts: React.ReactNode[] = [];
    if (s.min) parts.push(<><b>{s.min}</b> 이상</>);
    if (s.max) parts.push(<><b>{s.max}</b> 이하</>);
    if (parts.length === 0) return <><b>{s.ref || "값"}</b> 그대로입니다.</>;
    return (
      <>
        <b>{s.ref || "값"}</b> 을 {parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && ", "}
            {p}
          </React.Fragment>
        ))} 범위로 조정한 값입니다.
      </>
    );
  }
  if (s.type === "llm") {
    return (
      <>위 산출 결과를 종합해 작성된 안내입니다. {s.lastResult ? <span className="text-emerald-600">· 분석됨</span> : <span className="text-gray-400">· 미실행</span>}</>
    );
  }
  if (s.type === "date") {
    const u = { year: "년", month: "월", day: "일" }[s.out];
    if (s.mode === "diff") {
      const isToday = s.b === "오늘";
      if (u === "년" && isToday)
        return (
          <>
            <b>{s.a || "기준일"}</b> 기준으로 산정된 만 나이입니다.
          </>
        );
      if (isToday)
        return (
          <>
            <b>{s.a || "기준일"}</b> 부터 오늘까지의 경과 {u}수입니다.
          </>
        );
      return (
        <>
          <b>{s.a || "시작일"}</b> 부터 <b>{s.b || "종료일"}</b> 까지의 {u}수입니다.
        </>
      );
    }
    return (
      <>
        <b>{s.a || "?"}</b> 의 {u === "년" ? "연도" : u}을(를) 추출한 값입니다.
      </>
    );
  }
  return null;
}

function BranchEditor({ step, update, av, numAv, sc, varsMeta }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className={inp + " min-w-[120px]"}>
          <VarOpts names={av} varsMeta={varsMeta} />
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
      <BranchSide label="참 →" textKey="then" tokKey="thenTok" typeKey="thenT" step={step} update={update} numAv={numAv} sc={sc} varsMeta={varsMeta} />
      <BranchSide label="거짓 →" textKey="els" tokKey="elsTok" typeKey="elsT" step={step} update={update} numAv={numAv} sc={sc} varsMeta={varsMeta} />
    </div>
  );
}

function BranchSide({ label, textKey, tokKey, typeKey, step, update, numAv, sc, varsMeta }: any) {
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
          varsMeta={varsMeta}
        />
      )}
    </div>
  );
}

function SwitchEditor({ step, update, av, numAv, sc, varsMeta }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  const cases = step.cases || [];
  const updateCase = (i: number, patch: any) => {
    const next = [...cases];
    next[i] = { ...next[i], ...patch };
    update({ cases: next });
  };
  const addCase = () =>
    update({ cases: [...cases, { match: "", t: "calc", text: "", tokens: [] }] });
  const removeCase = (i: number) =>
    update({ cases: cases.filter((_: any, j: number) => j !== i) });
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600 shrink-0">분기 대상</span>
        <select
          value={step.ref || ""}
          onChange={(e) => update({ ref: e.target.value })}
          className={inp + " min-w-[140px]"}
        >
          <option value="">선택</option>
          <VarOpts names={av} varsMeta={varsMeta} />
        </select>
        <span className="text-[10px] text-gray-500">의 값이...</span>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-2 space-y-1.5">
        {cases.length === 0 && (
          <div className="text-[11px] text-gray-500 text-center py-2">
            아직 케이스 없음 — "+ 케이스" 로 추가
          </div>
        )}
        {cases.map((c: any, i: number) => (
          <div key={i} className="rounded bg-white border border-gray-100 p-2 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-gray-500">case {i + 1}</span>
              <input
                value={c.match || ""}
                onChange={(e) => updateCase(i, { match: e.target.value })}
                placeholder="값 (예: 본인)"
                className={inp + " w-32 font-mono"}
              />
              <span className="text-[10px] text-gray-400">→</span>
              <select
                value={c.t || "calc"}
                onChange={(e) => {
                  const v = e.target.value;
                  const patch: any = { t: v };
                  if (v === "calc" && !c.tokens) patch.tokens = [];
                  updateCase(i, patch);
                }}
                className={inp}
              >
                <option value="calc">계산식</option>
                <option value="text">텍스트</option>
              </select>
              {c.t !== "calc" && (
                <input
                  value={c.text || ""}
                  onChange={(e) => updateCase(i, { text: e.target.value })}
                  placeholder="출력 텍스트"
                  className={inp + " flex-1 min-w-[160px]"}
                />
              )}
              <button
                onClick={() => removeCase(i)}
                className="text-[10px] rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-rose-700 ml-auto"
              >
                삭제
              </button>
            </div>
            {c.t === "calc" && (
              <TokenBuilder
                tokens={c.tokens || []}
                onChange={(tokens) => updateCase(i, { tokens })}
                varNames={numAv}
                sc={sc}
                varsMeta={varsMeta}
              />
            )}
          </div>
        ))}
        <button
          onClick={addCase}
          className="w-full text-[11px] rounded border border-dashed border-violet-300 bg-violet-50/40 px-2 py-1.5 text-violet-700 hover:bg-violet-50"
        >
          + 케이스 추가
        </button>
      </div>
      <div className="rounded border border-amber-100 bg-amber-50/40 p-2 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-amber-700">기본값 (매칭 없을 때)</span>
          <select
            value={step.defaultT || "calc"}
            onChange={(e) => {
              const v = e.target.value;
              const patch: any = { defaultT: v };
              if (v === "calc" && !step.defaultTokens) patch.defaultTokens = [];
              update(patch);
            }}
            className={inp}
          >
            <option value="calc">계산식</option>
            <option value="text">텍스트</option>
          </select>
          {step.defaultT !== "calc" && (
            <input
              value={step.defaultText || ""}
              onChange={(e) => update({ defaultText: e.target.value })}
              placeholder="기본 출력"
              className={inp + " flex-1 min-w-[160px]"}
            />
          )}
        </div>
        {step.defaultT === "calc" && (
          <TokenBuilder
            tokens={step.defaultTokens || []}
            onChange={(defaultTokens) => update({ defaultTokens })}
            varNames={numAv}
            sc={sc}
            varsMeta={varsMeta}
          />
        )}
      </div>
    </div>
  );
}

function ClassifyEditor({ step, update, av, varsMeta }: any) {
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
            <VarOpts names={av} varsMeta={varsMeta} />
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

function TableEditor({ step, update, av, varsMeta }: any) {
  const inp = "rounded border px-1 py-0.5 text-xs font-mono w-14 text-right";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className="rounded border px-2 py-1 text-xs">
        <VarOpts names={av} varsMeta={varsMeta} />
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

function ClampEditor({ step, update, av, varsMeta }: any) {
  const inp = "rounded border px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select value={step.ref} onChange={(e) => update({ ref: e.target.value })} className={inp + " min-w-[120px]"}>
        <VarOpts names={av} varsMeta={varsMeta} />
      </select>
      <span className="text-gray-600">를</span>
      <span>하한</span>
      <select value={step.min} onChange={(e) => update({ min: e.target.value })} className={inp + " min-w-[120px]"}>
        <option value="">(없음)</option>
        <VarOpts names={av} varsMeta={varsMeta} />
      </select>
      <span>상한</span>
      <select value={step.max} onChange={(e) => update({ max: e.target.value })} className={inp + " min-w-[120px]"}>
        <option value="">(없음)</option>
        <VarOpts names={av} varsMeta={varsMeta} />
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
