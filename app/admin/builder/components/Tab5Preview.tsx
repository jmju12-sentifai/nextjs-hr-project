"use client";
import { useState } from "react";
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

export default function Tab5Preview({ schema }: Props) {
  const [pvtab, setPvtab] = useState<string>("msaas");
  const [extraVars, setExtraVars] = useState<ExtraVar[]>([]);
  const [extraJudge, setExtraJudge] = useState<ExtraJudge[]>([]);

  const result = run(
    schema,
    extraVars.map((v) => ({ name: v.name, type: v.type, unit: v.unit, val: v.val })),
    extraJudge.map((j) => ({ a: j.a, op: j.op, b: j.b }))
  );
  const { sc, disp, jres, applied, res } = result;
  const activePath = activePathOf(schema, result.activePathId);

  const m = schema.meta;
  const mig = migrateSchema(schema);

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
          config가 실제로 찍어내는 완제품입니다 — 조정부에 추가 항목·예외를 넣으면 즉시 재계산됩니다.
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
            <Analyze
              schema={schema}
              result={result}
              activePath={activePath}
            />
          )}
          {pvtab === "f4" && (
            <ReportView
              schema={schema}
              activePath={activePath}
              result={result}
              sc={sc}
              disp={disp}
              jres={jres}
            />
          )}
        </div>
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
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-gray-50 p-5">
        <h4 className="font-serif text-xl font-semibold">
          {meta.appName || "(앱명 미설정)"}
        </h4>
        <div className="text-sm text-gray-600 mt-1.5">{meta.tagline}</div>
        <p className="mt-3 text-sm">
          {meta.purpose || (
            <span className="text-gray-400">구축 목적이 비어 있습니다.</span>
          )}
        </p>
        {meta.security && (
          <p className="mt-2 text-xs text-gray-500">🔒 {meta.security}</p>
        )}
      </div>
      {meta.effects.filter(Boolean).length > 0 && (
        <div>
          <Lab>기대 효과</Lab>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {meta.effects.filter(Boolean).map((e: string, i: number) => (
              <div key={i} className="rounded-md border p-3 text-xs">
                <b className="text-gray-900 block mb-1">✦</b>
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <Lab>전체 프로세스</Lab>
        <div className="flex gap-2 flex-wrap items-center">
          <Pstep>1. 기준 지식화</Pstep>
          <span className="text-gray-400">→</span>
          <Pstep>2. 개인 정보 파싱</Pstep>
          <span className="text-gray-400">→</span>
          <Pstep>3. 적용 여부 판단·분석</Pstep>
          <span className="text-gray-400">→</span>
          <Pstep>4. 산출 및 안내</Pstep>
        </div>
      </div>
      {meta.features.filter(Boolean).length > 0 && (
        <div>
          <Lab>핵심 특징</Lab>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {meta.features.filter(Boolean).map((f: string, i: number) => (
              <div key={i} className="rounded-md border p-3 text-xs">
                <b className="text-gray-900 block mb-1">✓</b>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}
      {(meta.problem || meta.users) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {meta.problem && (
            <div className="rounded-md border p-3 text-xs">
              <b className="block text-gray-900 mb-1">해결하려는 문제</b>
              {meta.problem}
            </div>
          )}
          {meta.users && (
            <div className="rounded-md border p-3 text-xs">
              <b className="block text-gray-900 mb-1">대상 사용자</b>
              {meta.users}
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
      <div className="flex flex-col gap-3">
        <div className="rounded-md border p-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            📂 {upTitle}
          </h4>
          <div className="text-xs text-gray-500 mt-1 mb-2.5">
            PDF·Docx·Xlsx 업로드 → 자동 파싱
          </div>
          <div className="rounded border-2 border-dashed border-emerald-600 bg-emerald-50 p-4 text-center">
            <div className="text-xl">✓</div>
            <div className="text-xs font-semibold mt-1">{fname}</div>
            <div className="text-[10px] text-emerald-700 mt-1 font-mono">
              파싱 완료 · 우측에서 확인
            </div>
          </div>
        </div>
        <div className="rounded-md border p-3">
          <h4 className="text-sm font-semibold mb-1">
            🛠 조정부{" "}
            <span className="text-[10px] font-mono text-gray-500 border rounded px-1">
              운영 시 추가 반영
            </span>
          </h4>
          <div className="text-xs text-gray-500 mb-2">
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
      <div>
        <div className="rounded-md border p-3">
          <h4 className="text-sm font-semibold mb-1">
            🧾 파싱 결과 — {grp} 항목
          </h4>
          <div
            className={
              "text-xs mb-2.5 " +
              (miss.length ? "text-rose-600" : "text-gray-500")
            }
          >
            {miss.length
              ? `⚠ 필수 누락 ${miss.length}건 — 수기 보완 필요`
              : "전 항목 확인됨"}
          </div>
          {vs.length === 0 ? (
            <div className="text-xs text-gray-500">변수 없음</div>
          ) : (
            vs.map((v) => {
              const empty = !(v.test && String(v.test).trim());
              return (
                <div
                  key={v.id}
                  className="flex justify-between items-center gap-2 py-2 border-b border-gray-100 last:border-b-0 text-sm"
                >
                  <span className="text-gray-600">
                    {v.name}{" "}
                    {v.req && (
                      <span className="text-[9px] border rounded px-1 font-mono text-gray-500">
                        필수
                      </span>
                    )}{" "}
                    <span className="text-[9px] font-mono text-gray-400">
                      {v.type}
                      {v.unit ? "·" + v.unit : ""}
                    </span>
                  </span>
                  <span
                    className={
                      "font-mono font-semibold " +
                      (empty && v.req ? "text-rose-600" : "")
                    }
                  >
                    {empty
                      ? v.req
                        ? "누락 — 보완 필요"
                        : "—"
                      : v.type === "number"
                      ? fmtU(Number(v.test), v.unit)
                      : v.test}
                  </span>
                </div>
              );
            })
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
    <div>
      <h4 className="text-base font-semibold mb-1">
        {schema.meta.appName || ""} 적용 여부 판단 결과
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        규정 기준과 대상자 정보를 비교하여 적용 여부·수준을 분석합니다.
      </p>

      {/* 경로 매칭 trace */}
      <div className="rounded-md border bg-gray-50 p-3 mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">
          경로 매칭 결과 (first-match)
        </div>
        <div className="space-y-1">
          {pathMatches.map((pm: any) => {
            const active = pm.id === result.activePathId;
            return (
              <div
                key={pm.id}
                className={
                  "flex items-center gap-2 text-xs px-2 py-1 rounded " +
                  (active ? "bg-emerald-100 text-emerald-800 font-semibold" : "")
                }
              >
                <span className="w-4">{active ? "✓" : pm.ok ? "✓" : "·"}</span>
                <span className="flex-1">{pm.label}</span>
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
                {active && <span className="text-[10px]">활성</span>}
              </div>
            );
          })}
          {/* fallback */}
          {result.activePathId === mig.fallback?.id && (
            <div className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 font-semibold">
              <span className="w-4">▣</span>
              <span className="flex-1">{mig.fallback.label}</span>
              <span className="text-[10px]">활성 (fallback)</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {cards.length === 0 ? (
          <div className="col-span-full rounded border border-dashed p-4 text-center text-xs text-gray-500">
            ④에서 요약 카드를 배치하면 표시됩니다.
          </div>
        ) : (
          cards.map((e: any) => (
            <div key={e.id} className="rounded-md border p-3">
              <div className="text-[10px] text-gray-500">{e.label}</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {disp[e.bind] ?? "—"}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-3">
          <h4 className="text-sm font-semibold mb-2">판단 근거 비교표</h4>
          {jres.length === 0 ? (
            <div className="text-xs text-gray-500">판정부 비교 없음</div>
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
        <div className="rounded-md border p-3">
          <h4 className="text-sm font-semibold mb-2">산출 로직 (활성 경로)</h4>
          {allSteps
            .filter((s: any) => s.name)
            .map((s: any) => {
              const r = res[s.id];
              return (
                <div
                  key={s.id}
                  className="flex justify-between items-center py-1.5 border-b border-gray-100 text-sm last:border-b-0"
                >
                  <span className="text-gray-600">{s.name}</span>
                  <span
                    className={
                      "font-mono font-semibold " +
                      (r && r.bad ? "text-rose-600" : "")
                    }
                  >
                    {r ? r.d : "—"}
                  </span>
                </div>
              );
            })}
          {allSteps.filter((s: any) => s.name).length === 0 && (
            <div className="text-xs text-gray-500">산출 단계 없음</div>
          )}
          <div
            className={
              "mt-3 rounded p-2.5 font-mono text-xs " +
              (applied
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700")
            }
          >
            판정: {result.activePathLabel}
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
  const u = list.reduce(
    (a: number, e: any) =>
      a +
      ({ full: 6, half: 3, third: 2 }[e.w || "full"] as number) *
        (e.h || 1),
    0
  );
  const pages = Math.max(1, Math.ceil(u / 12));

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
            const wSp = Math.max(1, Math.min(6, e.wSpan ?? ({ full: 6, half: 3, third: 2 }[e.w || "full"] || 6)));
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
