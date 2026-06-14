"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSchema, CmpOp, Grp, Unit } from "app-renderer";
import { UNITS, fmtU, migrateSchema, run, todayStr, activePathOf } from "app-renderer";
import ElementRenderer from "./ElementRenderer";

const uid = () => Math.random().toString(36).slice(2, 7);

interface ExtraVar {
  id: string;
  name: string;
  type: string;
  unit?: Unit;
  val?: string;
}
interface ExtraJudge {
  id: string;
  a: string;
  op: CmpOp;
  b: string;
}

const PVTABS = [
  ["msaas", "M SaaS 설명", ""],
  ["f1", "기준 지식화", "1"],
  ["f2", "개인 정보 파싱", "2"],
  ["f3", "적용 여부 판단·분석", "3"],
  ["f4", "산출 및 안내", "4"],
] as const;

interface Props {
  schema: AppSchema;
}

export default function Tab5Preview({ schema: rawSchema }: Props) {
  const [pvtab, setPvtab] = useState<string>("msaas");
  const [extraVars, setExtraVars] = useState<ExtraVar[]>([]);
  const [extraJudge, setExtraJudge] = useState<ExtraJudge[]>([]);
  // 미리보기에서 사용자 값(=test 값 + extra)으로 실행한 LLM 분석 결과
  const [llmRuns, setLlmRuns] = useState<Record<string, string>>({});
  const [llmBusy, setLlmBusy] = useState(false);
  const llmRunKeyRef = useRef<string>("");

  // 스키마에 LLM 실행 결과를 덧씌움
  const schema = useMemo<AppSchema>(() => {
    const overlay = (steps: any[] = []): any[] =>
      steps.map((s) => {
        if (s?.type !== "llm") return s;
        const hit = llmRuns[s.id];
        return { ...s, lastResult: hit || s.lastResult || "", lastAt: hit ? new Date().toISOString() : s.lastAt };
      });
    return {
      ...rawSchema,
      shared: rawSchema.shared
        ? { ...rawSchema.shared, steps: overlay(rawSchema.shared.steps as any[]) }
        : rawSchema.shared,
      paths: (rawSchema.paths || []).map((p: any) => ({ ...p, steps: overlay(p.steps as any[]) })),
      fallback: rawSchema.fallback
        ? { ...rawSchema.fallback, steps: overlay(rawSchema.fallback.steps as any[]) }
        : rawSchema.fallback,
    };
  }, [rawSchema, llmRuns]);

  const result = run(
    schema,
    extraVars.map((v) => ({ name: v.name, type: v.type, unit: v.unit, val: v.val })),
    extraJudge.map((j) => ({ a: j.a, op: j.op, b: j.b }))
  );
  const { sc, disp, jres, applied, res } = result;
  const activePath = activePathOf(schema, result.activePathId);

  const m = schema.meta;
  const mig = migrateSchema(schema);

  // 완제품 미리보기에서 f3/f4 진입 시 활성 경로의 LLM 분석을 자동 실행 (테스트 값 + extra 기준)
  useEffect(() => {
    if (pvtab !== "f3" && pvtab !== "f4") return;
    const llmSteps: any[] = [];
    const collect = (steps: any[] = []) => {
      for (const s of steps) if (s?.type === "llm") llmSteps.push(s);
    };
    collect((schema.shared?.steps as any[]) || []);
    collect((activePath?.steps as any[]) || []);
    if (llmSteps.length === 0) return;
    const valueSnapshot = llmSteps
      .map((s) => `${s.id}:${(s.items || []).map((n: string) => `${n}=${disp[n] ?? ""}`).join("|")}`)
      .join("#");
    const key = `${result.activePathId}::${valueSnapshot}`;
    if (llmRunKeyRef.current === key) return;
    llmRunKeyRef.current = key;
    setLlmBusy(true);
    void (async () => {
      try {
        const runs = await Promise.all(
          llmSteps.map(async (s) => {
            try {
              const context = (s.items || []).map((name: string) => ({
                name,
                value: disp?.[name] ?? "—",
              }));
              const r = await fetch("/api/llm-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meta: schema.meta, context, prompt: s.prompt || "" }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error || "요청 실패");
              return { id: s.id as string, summary: j.summary as string };
            } catch (e) {
              console.warn("preview LLM run failed:", s.id, e);
              return null;
            }
          })
        );
        const map: Record<string, string> = {};
        for (const r of runs) if (r && r.summary) map[r.id] = r.summary;
        if (Object.keys(map).length) {
          setLlmRuns((prev) => ({ ...prev, ...map }));
        }
      } finally {
        setLlmBusy(false);
      }
    })();
  }, [pvtab, schema, activePath, result.activePathId, disp]);

  return (
    <div className="space-y-5">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          검증 · 완제품 시뮬레이션
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          완제품 미리보기
        </h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          빌더 설정대로 실제 사용자에게 보일 완제품 화면입니다 — 조정부에 추가 항목·예외를 넣으면 즉시 재계산됩니다.
        </p>
      </div>

      <div className="border rounded overflow-hidden">
        <div className="bg-blue-600 text-white px-5 py-3.5">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            {m.appName || "(앱명 미설정)"}
            <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5 font-mono">
              개인 1명 단위 처리
            </span>
          </h3>
          <p className="text-xs opacity-75 mt-1">
            {m.tagline ||
              m.purpose ||
              "서비스 한줄 설명을 ⓪ 앱 개요에서 입력하세요."}
          </p>
        </div>
        <div className="flex bg-gray-50 border-b flex-wrap">
          {PVTABS.map(([k, name, num]) => (
            <button
              key={k}
              onClick={() => setPvtab(k)}
              className={
                "flex-1 min-w-[130px] text-center py-3 text-xs border-r " +
                (pvtab === k
                  ? "bg-white text-gray-900 font-semibold border-b-2 border-blue-600"
                  : "text-gray-500")
              }
            >
              {num ? (
                <span className="inline-flex w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[9px] items-center justify-center mr-1 font-mono">
                  {num}
                </span>
              ) : (
                "📖 "
              )}
              {name}
            </button>
          ))}
        </div>
        <div className="p-5 bg-white min-h-[380px]">
          {pvtab === "msaas" && <MSaaS meta={m} />}
          {pvtab === "f1" && (
            <ParseFrame
              schema={schema}
              grp="규정"
              upTitle="취업규칙 / 인사규정 업로드"
              fname="임금피크제 운영 세칙.docx"
              disp={disp}
              extraVars={extraVars}
              setExtraVars={setExtraVars}
              extraJudge={extraJudge}
              setExtraJudge={setExtraJudge}
            />
          )}
          {pvtab === "f2" && (
            <ParseFrame
              schema={schema}
              grp="개인"
              upTitle="1인 인사 데이터 업로드"
              fname="홍길동 부장 신상정보.docx"
              disp={disp}
              extraVars={extraVars}
              setExtraVars={setExtraVars}
              extraJudge={extraJudge}
              setExtraJudge={setExtraJudge}
            />
          )}
          {pvtab === "f3" && (
            <>
              {llmBusy && <LlmRunningBanner />}
              <Analyze
                schema={schema}
                result={result}
                activePath={activePath}
              />
            </>
          )}
          {pvtab === "f4" && (
            <>
              {llmBusy && <LlmRunningBanner />}
              <ReportView
                schema={schema}
                activePath={activePath}
                result={result}
                sc={sc}
                disp={disp}
                jres={jres}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LlmRunningBanner() {
  return (
    <div className="mb-4 relative overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-violet-50 px-4 py-3 shadow-sm">
      <div
        aria-hidden
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"
        style={{ animationName: "shimmer" }}
      />
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-violet-900">LLM 분석 실행 중</span>
            <span className="flex gap-0.5 ml-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-600" style={{ animation: "bounce-dot 1.2s ease-in-out infinite", animationDelay: "0s" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-violet-600" style={{ animation: "bounce-dot 1.2s ease-in-out infinite", animationDelay: "0.15s" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-violet-600" style={{ animation: "bounce-dot 1.2s ease-in-out infinite", animationDelay: "0.3s" }} />
            </span>
          </div>
          <p className="text-[11px] text-violet-700 mt-0.5">
            미리보기 값으로 분석 리포트를 생성하고 있습니다 — 잠시만 기다려 주세요.
          </p>
        </div>
        <span className="hidden sm:inline-block text-[10px] font-mono text-violet-500 bg-white/70 rounded-full px-2 py-1 ring-1 ring-violet-200">
          AI · Gemini
        </span>
      </div>
    </div>
  );
}

function Lab({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold tracking-wide text-gray-700 mb-1.5">
      {children}
    </div>
  );
}

function MSaaS({ meta }: { meta: any }) {
  const defaultFlow = [
    "기준 지식화",
    "개인 정보 파싱",
    "적용 여부 판단·분석",
    "산출 및 안내",
  ];
  const flow: string[] =
    Array.isArray(meta.flow) && meta.flow.length === 4
      ? meta.flow.map((s: string, i: number) => s || defaultFlow[i])
      : defaultFlow;
  const stepColors = [
    "bg-sky-500 ring-sky-100",
    "bg-blue-500 ring-blue-100",
    "bg-indigo-500 ring-indigo-100",
    "bg-violet-500 ring-violet-100",
  ];
  return (
    <div className="space-y-6">
      {/* 히어로 카드 — 그라데이션 + 제목 + 태그라인 */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-7 shadow-sm">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm ring-1 ring-blue-100">
            ⓪ Overview
          </div>
          <h4 className="font-serif text-2xl font-bold text-gray-900">
            {meta.appName || "(앱명 미설정)"}
          </h4>
          {meta.tagline && (
            <p className="mt-2 text-sm text-gray-700">{meta.tagline}</p>
          )}
          {meta.purpose ? (
            <p className="mt-4 text-sm leading-relaxed text-gray-700">
              {meta.purpose}
            </p>
          ) : (
            <p className="mt-4 text-xs italic text-gray-400">
              구축 목적이 비어 있습니다.
            </p>
          )}
          {meta.security && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200">
              🔒 {meta.security}
            </div>
          )}
        </div>
      </div>

      {/* 기대 효과 */}
      {meta.effects.filter(Boolean).length > 0 && (
        <div>
          <Lab>기대 효과</Lab>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {meta.effects.filter(Boolean).map((e: string, i: number) => (
              <div
                key={i}
                className="group rounded-xl border border-gray-100 bg-white p-4 text-xs shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-base text-amber-500">
                  ✦
                </div>
                <p className="text-gray-700 leading-relaxed">{e}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 전체 프로세스 — 세로 한 줄 한 줄 */}
      <div>
        <Lab>전체 프로세스</Lab>
        <ol className="relative rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          {/* 세로 연결선 — 동그라미 중앙(20+12=32 → 31)에 맞춤 */}
          <div className="absolute left-[31px] top-6 bottom-6 w-px bg-gradient-to-b from-sky-200 via-blue-200 via-indigo-200 to-violet-200" />
          {flow.map((s, i) => (
            <li key={i} className="relative flex items-center gap-3 py-2">
              <span
                className={
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-4 " +
                  stepColors[i % stepColors.length]
                }
              >
                {i + 1}
              </span>
              <div className="flex-1 text-sm font-semibold text-gray-900">
                {s}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* 핵심 특징 — 한 줄씩 */}
      {meta.features.filter(Boolean).length > 0 && (
        <div>
          <Lab>핵심 특징</Lab>
          <ul className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm divide-y divide-gray-100">
            {meta.features.filter(Boolean).map((f: string, i: number) => (
              <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm text-emerald-600">
                  ✓
                </span>
                <span className="text-sm text-gray-800 leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 문제·대상 사용자 */}
      {(meta.problem || meta.users) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meta.problem && (
            <div className="rounded-xl border-l-4 border-rose-300 bg-rose-50/40 p-4 text-xs">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                해결하려는 문제
              </div>
              <p className="text-gray-700 leading-relaxed">{meta.problem}</p>
            </div>
          )}
          {meta.users && (
            <div className="rounded-xl border-l-4 border-blue-300 bg-blue-50/40 p-4 text-xs">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                대상 사용자
              </div>
              <p className="text-gray-700 leading-relaxed">{meta.users}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pstep({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs">
      {children}
    </div>
  );
}

function ParseFrame({
  schema,
  grp,
  upTitle,
  fname,
  disp,
  extraVars,
  setExtraVars,
  extraJudge,
  setExtraJudge,
}: {
  schema: AppSchema;
  grp: Grp;
  upTitle: string;
  fname: string;
  disp: any;
  extraVars: ExtraVar[];
  setExtraVars: (v: ExtraVar[]) => void;
  extraJudge: ExtraJudge[];
  setExtraJudge: (v: ExtraJudge[]) => void;
}) {
  const vs = schema.vars.filter((v) => v.grp === grp);
  const miss = vs.filter((v) => v.req && !(v.test && String(v.test).trim()));
  const panelTitle =
    grp === "규정"
      ? `${schema.meta.appName || ""} 규정·기준 지식화`.trim()
      : `${schema.meta.appName || ""} 개인 정보 파싱`.trim();
  const panelDesc =
    grp === "규정"
      ? "회사 규정·기준 문서를 업로드하여 적용 기준값을 자동으로 추출합니다."
      : "임직원 1인의 인사·급여 데이터를 업로드하여 변수값을 자동으로 추출합니다.";
  const stepNum = grp === "규정" ? 1 : 2;
  const stepColor = grp === "규정"
    ? "bg-sky-500 ring-sky-100"
    : "bg-blue-500 ring-blue-100";
  return (
    <div className="space-y-5">
      {/* 패널 헤더 */}
      <div className="flex items-start gap-3">
        <span
          className={
            "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-4 " +
            stepColor
          }
        >
          {stepNum}
        </span>
        <div>
          <h4 className="text-base font-semibold text-gray-900">{panelTitle}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{panelDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        <div className="flex flex-col gap-3">
          {/* 업로드 카드 */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              📂 {upTitle}
            </h4>
            <div className="text-xs text-gray-500 mt-1 mb-3">
              PDF · Docx · Xlsx 업로드 → 자동 파싱
            </div>
            <div className="rounded-lg border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-4 text-center">
              <div className="mx-auto mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white text-base">
                ✓
              </div>
              <div className="text-xs font-semibold mt-1 text-gray-900 truncate">
                {fname}
              </div>
              <div className="text-[10px] text-emerald-700 mt-1 font-mono">
                파싱 완료 · 우측에서 확인
              </div>
            </div>
          </div>

          {/* 조정부 */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
              🛠 조정부
              <span className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
                운영 시 추가 반영
              </span>
            </h4>
            <div className="text-xs text-gray-500 mb-3">
              기본 산식에 단순 예외/추가 정보를 더합니다 (config 불변).
            </div>
            {grp === "개인" ? (
              <AdjustVars vars={extraVars} setVars={setExtraVars} />
            ) : (
              <AdjustJudge
                schema={schema}
                extra={extraJudge}
                setExtra={setExtraJudge}
                extraVars={extraVars}
              />
            )}
          </div>
        </div>

        {/* 파싱 결과 */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              🧾 파싱 결과
              <span className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
                {grp} 항목
              </span>
            </h4>
            <span
              className={
                "text-[11px] font-medium rounded-full px-2.5 py-1 " +
                (miss.length
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
              }
            >
              {miss.length ? `⚠ 필수 누락 ${miss.length}건` : "✓ 전 항목 확인됨"}
            </span>
          </div>
          {vs.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">변수 없음</div>
          ) : (
            <GroupedPreviewList vs={vs} grp={grp} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdjustVars({
  vars,
  setVars,
}: {
  vars: ExtraVar[];
  setVars: (v: ExtraVar[]) => void;
}) {
  const inp = "rounded border px-1.5 py-1 text-xs";
  return (
    <div className="space-y-1.5">
      {vars.map((v) => (
        <div key={v.id} className="flex items-center gap-1 flex-wrap">
          <input
            value={v.name}
            onChange={(e) =>
              setVars(vars.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)))
            }
            className={inp + " w-24"}
            placeholder="항목명"
          />
          <input
            value={v.val || ""}
            onChange={(e) =>
              setVars(vars.map((x) => (x.id === v.id ? { ...x, val: e.target.value } : x)))
            }
            className={inp + " w-20"}
            placeholder="값"
          />
          <select
            value={v.unit || ""}
            onChange={(e) =>
              setVars(
                vars.map((x) => (x.id === v.id ? { ...x, unit: e.target.value as Unit } : x))
              )
            }
            className={inp}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u || "(단위)"}
              </option>
            ))}
          </select>
          <button
            onClick={() => setVars(vars.filter((x) => x.id !== v.id))}
            className="text-rose-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          setVars([
            ...vars,
            { id: uid(), name: "추가항목", type: "number", unit: "", val: "0" },
          ])
        }
        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
      >
        + 추가 신상정보
      </button>
    </div>
  );
}

function AdjustJudge({
  schema,
  extra,
  setExtra,
  extraVars,
}: {
  schema: AppSchema;
  extra: ExtraJudge[];
  setExtra: (e: ExtraJudge[]) => void;
  extraVars: ExtraVar[];
}) {
  const mig = migrateSchema(schema);
  const all = [...schema.vars.map((v) => v.name), ...extraVars.map((v) => v.name)];
  for (const s of mig.shared?.steps || []) if (s.name) all.push(s.name);
  for (const p of mig.paths || []) for (const s of p.steps) if (s.name) all.push(s.name);
  return (
    <div className="space-y-1.5">
      {extra.map((j) => (
        <div key={j.id} className="flex items-center gap-1">
          <select
            value={j.a}
            onChange={(e) =>
              setExtra(extra.map((x) => (x.id === j.id ? { ...x, a: e.target.value } : x)))
            }
            className="rounded border px-1.5 py-1 text-xs w-24"
          >
            {all.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            value={j.op}
            onChange={(e) =>
              setExtra(extra.map((x) => (x.id === j.id ? { ...x, op: e.target.value as CmpOp } : x)))
            }
            className="rounded border px-1.5 py-1 text-xs"
          >
            {([">=", "<=", ">", "<", "==", "!="] as CmpOp[]).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select
            value={j.b}
            onChange={(e) =>
              setExtra(extra.map((x) => (x.id === j.id ? { ...x, b: e.target.value } : x)))
            }
            className="rounded border px-1.5 py-1 text-xs w-24"
          >
            {all.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={() => setExtra(extra.filter((x) => x.id !== j.id))}
            className="text-rose-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          const n = all[0] || "";
          setExtra([...extra, { id: uid(), a: n, op: ">=", b: n }]);
        }}
        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
      >
        + 예외 비교 기준
      </button>
    </div>
  );
}

function Analyze({ schema, result, activePath }: any) {
  const mig = migrateSchema(schema);
  const allSteps = [
    ...(mig.shared?.steps || []),
    ...((activePath?.steps as any[]) || []),
  ];
  const cards = (activePath?.report || []).filter((e: any) => e.kind === "card").slice(0, 4);
  const { sc, disp, jres, res, applied, pathMatches } = result;
  return (
    <div className="space-y-5">
      {/* 패널 헤더 */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-4 bg-indigo-500 ring-indigo-100">
          3
        </span>
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            {schema.meta.appName || ""} 적용 여부 판단 결과
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            규정 기준과 대상자 정보를 비교하여 적용 여부·수준을 분석합니다.
          </p>
        </div>
      </div>

      {/* 경로 매칭 trace */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-gray-900">
            경로 매칭 결과
          </h5>
          <span className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
            first-match
          </span>
        </div>
        <ul className="space-y-1.5">
          {pathMatches.map((pm: any) => {
            const active = pm.id === result.activePathId;
            return (
              <li
                key={pm.id}
                className={
                  "flex items-center gap-3 text-xs px-3 py-2 rounded-lg transition " +
                  (active
                    ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800"
                    : "bg-gray-50/60 text-gray-600")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                    (active
                      ? "bg-emerald-500 text-white"
                      : pm.ok
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-200 text-gray-500")
                  }
                >
                  {active || pm.ok ? "✓" : "·"}
                </span>
                <span className={"flex-1 " + (active ? "font-semibold" : "")}>
                  {pm.label}
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  {pm.conditionResults.length === 0
                    ? "(조건 없음)"
                    : pm.conditionResults
                        .map(
                          (c: any) =>
                            `${c.a}${c.op}${c.b}${c.ok ? "✓" : "✗"}`
                        )
                        .join(" · ")}
                </span>
                {active && (
                  <span className="text-[10px] font-medium rounded-full bg-emerald-500 text-white px-2 py-0.5">
                    활성
                  </span>
                )}
              </li>
            );
          })}
          {result.activePathId === mig.fallback?.id && (
            <li className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white text-[10px]">
                ▣
              </span>
              <span className="flex-1 font-semibold">{mig.fallback?.label}</span>
              <span className="text-[10px] font-medium rounded-full bg-rose-500 text-white px-2 py-0.5">
                활성 · fallback
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-5 text-center text-xs text-gray-500">
            ④에서 요약 카드를 배치하면 표시됩니다.
          </div>
        ) : (
          cards.map((e: any) => (
            <div
              key={e.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                {e.label}
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1.5">
                {disp[e.bind] ?? "—"}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 비교표 + 산출 로직 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-900 mb-3">
            판단 근거 비교표
          </h5>
          {jres.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">
              판정부 비교 없음
            </div>
          ) : (
            <ElementRenderer
              schema={schema}
              el={{ id: "x", kind: "compare", label: "", bind: "", w: "full", h: 1 }}
              sc={sc}
              disp={disp}
              jres={jres}
            />
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-900 mb-3">
            산출 로직 <span className="text-xs font-normal text-gray-500">(활성 경로)</span>
          </h5>
          {allSteps.filter((s: any) => s.name).length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">
              산출 단계 없음
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {allSteps
                .filter((s: any) => s.name)
                .map((s: any) => {
                  const r = res[s.id];
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1 items-baseline py-2 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="text-gray-600 whitespace-nowrap">
                        {s.name}
                      </span>
                      <span
                        className={
                          "font-mono font-semibold text-right break-words min-w-0 " +
                          (r && r.bad ? "text-rose-600" : "text-gray-900")
                        }
                      >
                        {r ? r.d : "—"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
          <div
            className={
              "mt-4 rounded-lg p-3 text-xs font-semibold flex items-center gap-2 " +
              (applied
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200")
            }
          >
            <span className="text-base">{applied ? "✓" : "✗"}</span>
            <span className="text-[11px] uppercase tracking-wider opacity-70">판정</span>
            <span className="font-bold">{result.activePathLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const wClass: Record<string, string> = {
  full: "col-span-6",
  half: "col-span-3",
  third: "col-span-2",
};

function ReportView({ schema, activePath, result, sc, disp, jres }: any) {
  const list = (activePath?.report || []) as any[];
  // 페이지 추정 — wSpan/hSpan 우선, 없으면 옛 w/h
  // A4 1페이지 용량: 6열 × 약 8행 = 48 unit
  // (Tab5/사용자 앱은 auto-rows-[96px]로 약 7~8행, PDF는 minHeight 기반 약 12행)
  // PDF·DOCX의 안전 평균치로 48 채택. grid-flow-row-dense 가 빈자리를 채워 실제로 약간 적게 나올 수도 있음.
  const PAGE_CAPACITY = 48;
  const W_MAP: Record<string, number> = { full: 6, half: 3, third: 2 };
  const u = list.reduce((a: number, e: any) => {
    const wSp = Math.max(
      1,
      Math.min(6, e.wSpan ?? (W_MAP[e.w || "full"] || 6))
    );
    const hSp = Math.max(1, Math.min(6, e.hSpan ?? (e.h || 1)));
    return a + wSp * hSp;
  }, 0);
  const pages = Math.max(1, Math.ceil(u / PAGE_CAPACITY));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const download = async (kind: "pdf" | "docx") => {
    setBusy(true);
    setMsg(`${kind.toUpperCase()} 생성 중...`);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, result }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `${kind} 실패`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(schema.meta?.appName || "report").replace(/\s+/g, "_")}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`${kind.toUpperCase()} 다운로드 완료`);
    } catch (e: any) {
      setMsg("실패: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    try {
      const payload = {
        appName: schema.meta?.appName || "",
        activePathId: result?.activePathId,
        activePathLabel: result?.activePathLabel,
        applied: result?.applied,
        vars: result?.disp,
        pathMatches: result?.pathMatches,
        generatedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(schema.meta?.appName || "report").replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("JSON 다운로드 완료");
    } catch (e: any) {
      setMsg("실패: " + (e?.message || e));
    }
  };

  const DownloadBar = (
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <span className="text-xs text-gray-500 mr-auto">
        {msg && <span>{msg}</span>}
      </span>
      <button
        disabled={busy || list.length === 0}
        onClick={() => download("pdf")}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        📄 PDF
      </button>
      <button
        disabled={busy || list.length === 0}
        onClick={() => download("docx")}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        📝 DOCX
      </button>
      <button
        disabled={busy}
        onClick={downloadJson}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        JSON
      </button>
    </div>
  );

  if (list.length === 0) {
    return (
      <div>
        <div className="border rounded">
          <ReportHead title={schema.meta.appName} />
          <div className="p-8 text-center text-xs text-gray-500">
            ④에서 이 경로의 리포트를 구성하면 안내서가 자동 생성됩니다.
          </div>
        </div>
        <div className="mt-3">{DownloadBar}</div>
      </div>
    );
  }
  return (
    <>
      <div className="border rounded">
        <ReportHead title={schema.meta.appName} />
        <div className="p-5 grid grid-cols-6 grid-flow-row-dense auto-rows-[96px] gap-4 bg-slate-50/40">
          {list.map((e: any) => {
            const wSp = Math.max(1, Math.min(6, e.wSpan ?? (({ full: 6, half: 3, third: 2 } as any)[e.w || "full"] || 6)));
            const hSp = Math.max(1, Math.min(6, e.hSpan ?? (e.h || 1)));
            return (
            <div
              key={e.id}
              style={{ gridColumn: `span ${wSp} / span ${wSp}`, gridRow: `span ${hSp} / span ${hSp}` }}
              className={
                "overflow-hidden flex flex-col min-h-0 " +
                (e.kind === "fields"
                  ? "pt-0 pb-2"
                  : e.kind === "note"
                  ? "rounded-xl bg-amber-50 border-l-4 border-amber-300 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
                  : "rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]")
              }
            >
              <ElementRenderer
                schema={schema}
                el={e}
                sc={sc}
                disp={disp}
                jres={jres}
                pathLabel={result.activePathLabel}
                pathConditions={activePath?.conditions || []}
              />
            </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 justify-between">
        <span
          className={
            "text-xs font-mono " + (pages > 2 ? "text-rose-600" : "text-gray-500")
          }
        >
          요소 {list.length}개 · 폭×높이 단위합 {u} · 추정 {pages}페이지
        </span>
        {DownloadBar}
      </div>
    </>
  );
}

function ReportHead({ title }: { title: string }) {
  return (
    <div className="bg-blue-600 text-white px-4 py-3 font-serif text-base font-semibold flex justify-between items-center rounded-t">
      <span>{title ? title.replace(/ ?앱$/, "") : "적용 결과"} 안내서</span>
      <span className="font-mono text-[10px] opacity-65">AUTO · {todayStr()}</span>
    </div>
  );
}

// 변수를 group > subGroup 계층으로 묶어 표시 (Tab5Preview 의 ParseFrame 내부에서 사용).
// 빌더 TabVars 와 라이브 앱 ParseFrame 과 동일한 형태로 일관성 유지.
function GroupedPreviewList({ vs, grp }: { vs: any[]; grp: Grp }) {
  const groups: Record<string, Record<string, any[]>> = {};
  for (const v of vs) {
    const g = v.group?.trim() || "_미분류";
    const sg = v.subGroup?.trim() || "_기본";
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(v);
  }
  const hasHierarchy = vs.some((v) => v.group?.trim());

  const renderRow = (v: any) => {
    const empty = !(v.test && String(v.test).trim());
    return (
      <li
        key={v.id}
        className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
      >
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-800 truncate">{v.name}</span>
          {v.req && (
            <span
              className={
                "text-[9px] rounded px-1.5 py-0.5 font-mono shrink-0 ring-1 " +
                (grp === "개인"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-gray-100 text-gray-600 ring-gray-200")
              }
            >
              필수
            </span>
          )}
          <span className="text-[10px] font-mono text-gray-400 shrink-0">
            {v.type}
            {v.unit ? " · " + v.unit : ""}
          </span>
        </div>
        <span
          className={
            "font-mono font-semibold text-right whitespace-nowrap shrink-0 " +
            (empty && v.req
              ? "text-rose-600"
              : empty
              ? "text-gray-400"
              : "text-gray-900")
          }
        >
          {empty
            ? v.req
              ? "누락"
              : "—"
            : v.type === "number"
            ? fmtU(Number(v.test), v.unit)
            : v.test}
        </span>
      </li>
    );
  };

  if (!hasHierarchy) {
    return <ul className="divide-y divide-gray-100">{vs.map(renderRow)}</ul>;
  }

  const cardTone =
    grp === "개인"
      ? "border-emerald-100 from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-900"
      : "border-blue-100 from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100 text-blue-900";
  const dotTone = grp === "개인" ? "bg-emerald-500" : "bg-blue-500";
  const badgeTone = grp === "개인" ? "bg-emerald-600" : "bg-blue-600";
  const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
    if (a === "기본정보") return -1;
    if (b === "기본정보") return 1;
    if (a === "_미분류") return 1;
    if (b === "_미분류") return -1;
    return 0;
  });
  return (
    <div className="space-y-4">
      {sortedEntries.map(([g, subs]) => (
        <details
          key={g}
          open
          className={"rounded-xl border bg-white shadow-sm overflow-hidden " + cardTone.split(" ")[0]}
        >
          <summary
            className={
              "cursor-pointer select-none px-4 py-2.5 text-sm font-bold flex items-center gap-2 bg-gradient-to-r " +
              cardTone
            }
          >
            <span
              className={
                "inline-flex items-center justify-center h-5 px-1.5 rounded text-white text-[10px] font-bold " +
                badgeTone
              }
            >
              {Object.values(subs).reduce((a, x) => a + x.length, 0)}개
            </span>
            <span>{g === "_미분류" ? "기타" : g}</span>
            <span className="ml-auto text-[10px] font-mono opacity-70">
              하위 {Object.keys(subs).filter((s) => s !== "_기본").length}개
            </span>
          </summary>
          <div className="p-3 space-y-3">
            {Object.entries(subs).map(([sg, items]) => (
              <div
                key={sg}
                className="rounded-lg border border-gray-100 bg-gray-50/40 overflow-hidden"
              >
                {sg !== "_기본" && (
                  <div className="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                    <span className={"inline-block h-1.5 w-1.5 rounded-full " + dotTone} />
                    {sg}
                    <span className="ml-auto text-[10px] font-mono text-gray-500">
                      {items.length}개
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-gray-100 px-3">{items.map(renderRow)}</ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
