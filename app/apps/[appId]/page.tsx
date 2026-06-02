"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { AppSchema, Grp, Variable } from "app-renderer";
import { activePathOf, fmtU, run, todayStr } from "app-renderer";
import ElementRenderer from "@/app/admin/builder/components/ElementRenderer";

type Step = 1 | 2 | 3 | 4 | 5;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function coerceValue(raw: any, type: string): any {
  if (raw === null || raw === undefined) return null;
  if (type === "number") {
    if (typeof raw === "number") return raw;
    const cleaned = String(raw).replace(/[^\d.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  if (type === "date") {
    const s = String(raw);
    const m = s.match(/(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return s;
  }
  return String(raw);
}

export default function AppPage() {
  const params = useParams<{ appId: string }>();
  const [app, setApp] = useState<{
    id: string;
    name: string;
    version: number;
    app_schema: AppSchema;
  } | null>(null);
  const [step, setStep] = useState<Step>(1);
  // 사용자가 채운 변수값을 schema.vars 의 test 필드에 머지해 둠 (런타임에서 사용)
  const [filled, setFilled] = useState<Record<string, any>>({});
  const [ready, setReady] = useState({ reg: false, person: false });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("apps")
          .select("id, name, version, app_schema")
          .eq("id", params.appId)
          .single();
        if (error) throw error;
        setApp(data as any);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.appId]);

  if (loading) return <main className="p-8">로딩 중...</main>;
  if (err) return <main className="p-8 text-rose-600">에러: {err}</main>;
  if (!app) return <main className="p-8">앱을 찾을 수 없습니다.</main>;

  const schema = app.app_schema;
  // 사용자가 채운 값으로 schema.vars.test 를 머지한 런타임용 스키마
  const liveSchema: AppSchema = {
    ...schema,
    vars: schema.vars.map((v) =>
      v.name in filled ? { ...v, test: String(filled[v.name] ?? "") } : v
    ),
  };
  const result = run(liveSchema);

  const restart = () => {
    setFilled({});
    setReady({ reg: false, person: false });
    setStep(1);
    setErr("");
  };

  const m = schema.meta;

  return (
    <main className="mx-auto max-w-4xl p-5">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold">
            {m.appName || app.name}
          </h1>
          <div className="mt-1 flex gap-2 text-xs font-mono">
            {([1, 2, 3, 4, 5] as Step[]).map((s) => {
              const reachable = s <= step;
              return (
                <button
                  key={s}
                  disabled={!reachable}
                  onClick={() => reachable && setStep(s)}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (s === step
                      ? "bg-blue-600 text-white"
                      : reachable
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed")
                  }
                >
                  Step {s}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={restart}
          className="shrink-0 rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
        >
          ↺ 처음부터
        </button>
      </header>

      <div className="rounded border bg-white p-5 shadow-sm">
        {step === 1 && (
          <Intro
            meta={m}
            schema={schema}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <UploadStep
            grp="규정"
            title="규정 문서 업로드"
            schema={schema}
            filled={filled}
            setFilled={setFilled}
            onBack={() => setStep(1)}
            onNext={() => {
              setReady((r) => ({ ...r, reg: true }));
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <UploadStep
            grp="개인"
            title="개인 문서 업로드"
            schema={schema}
            filled={filled}
            setFilled={setFilled}
            onBack={() => setStep(2)}
            onNext={() => {
              setReady((r) => ({ ...r, person: true }));
              setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <Analyze
            schema={liveSchema}
            result={result}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <ReportStep schema={liveSchema} result={result} />
        )}
      </div>
    </main>
  );
}

function Intro({ meta, schema, onNext }: any) {
  const regCnt = schema.vars.filter((v: Variable) => v.grp === "규정").length;
  const perCnt = schema.vars.filter((v: Variable) => v.grp === "개인").length;
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">앱 소개</h2>
      {meta.tagline && <p className="text-sm">{meta.tagline}</p>}
      {meta.purpose && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">목적</h3>
          <p className="text-sm text-gray-700">{meta.purpose}</p>
        </div>
      )}
      {meta.users && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">대상</h3>
          <p className="text-sm text-gray-700">{meta.users}</p>
        </div>
      )}
      {meta.security && (
        <div className="rounded bg-blue-50 p-3 text-sm text-amber-900">
          <strong>🔒 보안:</strong> {meta.security}
        </div>
      )}
      <div className="rounded border bg-gray-50 p-3 text-sm">
        <strong>업로드할 문서</strong>
        <ul className="mt-1 list-disc pl-5 text-gray-600">
          <li>Step 2: 규정 문서 ({regCnt}개 변수)</li>
          <li>Step 3: 개인 문서 ({perCnt}개 변수)</li>
        </ul>
      </div>
      <button
        onClick={onNext}
        className="rounded bg-emerald-700 px-4 py-2 text-sm text-white"
      >
        시작하기
      </button>
    </div>
  );
}

function UploadStep({
  grp,
  title,
  schema,
  filled,
  setFilled,
  onBack,
  onNext,
}: {
  grp: Grp;
  title: string;
  schema: AppSchema;
  filled: Record<string, any>;
  setFilled: (f: Record<string, any>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const slots = schema.vars.filter((v) => v.grp === grp);
  const requiredMissing = slots.some(
    (s) =>
      s.req &&
      (filled[s.name] === undefined ||
        filled[s.name] === null ||
        filled[s.name] === "")
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    setMsg("문서 분석 중...");
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type,
          slots: slots.map((s) => ({
            name: s.name,
            type: s.type,
            unit: s.unit,
          })),
        }),
      });
      const data = await res.json();
      const merged = { ...filled };
      for (const s of slots) {
        const raw = data[s.name];
        if (raw === null || raw === undefined || raw === "") continue;
        merged[s.name] = coerceValue(raw, s.type);
      }
      setFilled(merged);
      setMsg("문서 분석 완료");
    } catch (e: any) {
      setMsg("실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <label className="block cursor-pointer rounded border-2 border-dashed bg-gray-50 p-6 text-center hover:bg-gray-100">
        <input
          type="file"
          hidden
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <span className="text-sm text-gray-600">
          {busy ? "처리 중..." : "클릭하여 파일 업로드"}
        </span>
      </label>
      {msg && <p className="text-xs text-gray-500 font-mono">{msg}</p>}

      <div className="overflow-hidden rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-mono">
            <tr>
              <th className="px-3 py-2 text-left">변수</th>
              <th className="px-3 py-2 text-left">값</th>
              <th className="px-3 py-2 w-20 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-xs text-gray-500">
                  정의된 변수가 없습니다.
                </td>
              </tr>
            ) : (
              slots.map((s) => {
                const has =
                  filled[s.name] !== undefined &&
                  filled[s.name] !== null &&
                  filled[s.name] !== "";
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">
                      {s.name}
                      {s.req && (
                        <span className="ml-1 text-rose-500">*</span>
                      )}
                      <span className="ml-1 text-[10px] text-gray-400 font-mono">
                        {s.type}
                        {s.unit ? "·" + s.unit : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type={
                          s.type === "number"
                            ? "number"
                            : s.type === "date"
                            ? "date"
                            : "text"
                        }
                        value={filled[s.name] ?? ""}
                        onChange={(e) =>
                          setFilled({
                            ...filled,
                            [s.name]:
                              s.type === "number"
                                ? e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-block rounded px-2 py-0.5 text-[10px] font-mono " +
                          (has
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500")
                        }
                      >
                        {has ? "OK" : "미입력"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded border px-4 py-2 text-sm">
          이전
        </button>
        <button
          onClick={onNext}
          disabled={requiredMissing}
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}

function Analyze({
  schema,
  result,
  onBack,
  onNext,
}: {
  schema: AppSchema;
  result: any;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">분석 결과</h2>
      <div
        className={
          "rounded border px-3 py-2 font-semibold " +
          (result.applied
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700")
        }
      >
        판정: {result.activePathLabel}
      </div>
      {result.pathMatches && result.pathMatches.length > 1 && (
        <div className="rounded border bg-gray-50 p-3 text-xs">
          <div className="font-semibold text-gray-700 mb-1.5">경로 매칭 (first-match)</div>
          <div className="space-y-1">
            {result.pathMatches.map((pm: any) => (
              <div
                key={pm.id}
                className={
                  "flex items-center gap-2 " +
                  (pm.id === result.activePathId ? "font-semibold text-emerald-700" : "text-gray-500")
                }
              >
                <span className="w-4">{pm.id === result.activePathId ? "✓" : pm.ok ? "✓" : "·"}</span>
                <span>{pm.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 font-mono text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">변수</th>
              <th className="px-3 py-2 text-left">값</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.disp).map(([k, v]) => (
              <tr key={k} className="border-t">
                <td className="px-3 py-2 text-gray-600">{k}</td>
                <td className="px-3 py-2 font-mono font-medium">
                  {String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="rounded border px-4 py-2 text-sm">
          이전
        </button>
        <button
          onClick={onNext}
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          다음 단계 (리포트 보기)
        </button>
      </div>
    </div>
  );
}

const wClass: Record<string, string> = {
  full: "col-span-6",
  half: "col-span-3",
  third: "col-span-2",
};

function ReportStep({
  schema,
  result,
}: {
  schema: AppSchema;
  result: any;
}) {
  const download = async (kind: "pdf" | "docx") => {
    const res = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema, result }),
    });
    if (!res.ok) {
      alert("내보내기 실패");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-xl font-semibold">분석 리포트</h2>
        <div className="flex gap-2">
          <button
            onClick={() => download("pdf")}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            PDF
          </button>
          <button
            onClick={() => download("docx")}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            DOCX
          </button>
          <button
            onClick={downloadJson}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            JSON
          </button>
        </div>
      </div>
      <div className="rounded border">
        <div className="bg-blue-600 text-white px-4 py-3 font-semibold flex justify-between items-center rounded-t">
          <span>
            {(schema.meta.appName || "적용 결과").replace(/ ?앱$/, "")} 안내서
            {" — "}
            <span className="text-white/80 text-sm">{result.activePathLabel}</span>
          </span>
          <span className="font-mono text-[10px] opacity-65">
            AUTO · {todayStr()}
          </span>
        </div>
        <div className="p-5 grid grid-cols-6 grid-flow-row-dense auto-rows-[96px] gap-4 bg-slate-50/40">
          {(() => {
            const ap = activePathOf(schema, result.activePathId);
            const list = ap?.report || [];
            if (list.length === 0) {
              return (
                <div className="col-span-6 text-center text-xs text-gray-500 py-6">
                  이 경로의 리포트가 비어 있습니다.
                </div>
              );
            }
            return list.map((e) => {
              const wSp = Math.max(1, Math.min(6, (e as any).wSpan ?? ({ full: 6, half: 3, third: 2 }[e.w || "full"] || 6)));
              const hSp = Math.max(1, Math.min(6, (e as any).hSpan ?? (e.h || 1)));
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
                    sc={result.sc}
                    disp={result.disp}
                    jres={result.jres}
                    pathLabel={result.activePathLabel}
                    pathConditions={ap?.conditions || []}
                  />
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
