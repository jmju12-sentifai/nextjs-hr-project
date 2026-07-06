"use client";
import { useState } from "react";
import type { Token } from "app-renderer";
import { evtok, fmt } from "app-renderer";

interface Props {
  tokens: Token[];
  onChange: (t: Token[]) => void;
  varNames: string[];
  sc: Record<string, any>;
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
}

const OPSYM: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "%": "%", "//": "몫" };
const FN_LABEL: Record<string, string> = { floor: "floor 내림", ceil: "ceil 올림", round: "round 반올림" };

// 변수 이름을 group > subGroup 계층으로 묶어 정렬된 optgroup 옵션을 렌더링.
// 메타 정보 없거나 모두 _기타 면 평탄 옵션으로 fallback.
function renderGroupedOptions(
  names: string[],
  varsMeta?: Record<string, { group?: string; subGroup?: string }>
) {
  if (!varsMeta) {
    return names.map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ));
  }
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
  const hasReal = Object.keys(groups).some((g) => g !== "_기타");
  if (!hasReal) {
    return names.map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ));
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
    a === "_기타" ? 1 : b === "_기타" ? -1 : a.localeCompare(b)
  );
  // 각 (group, subGroup) 조합을 별도 optgroup 으로 — 묶음 정보는 label 에만, option text 는 변수명만.
  const out: JSX.Element[] = [];
  for (const [g, subs] of sortedGroups) {
    const sortedSubs = Object.entries(subs).sort(([a], [b]) =>
      a === "_기본" ? -1 : b === "_기본" ? 1 : a.localeCompare(b)
    );
    for (const [sg, items] of sortedSubs) {
      const label =
        g === "_기타"
          ? sg === "_기본"
            ? "기타"
            : sg
          : sg === "_기본"
          ? g
          : `${g} > ${sg}`;
      out.push(
        <optgroup key={`${g}|${sg}`} label={label}>
          {items
            .sort((a, b) => a.localeCompare(b))
            .map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
        </optgroup>
      );
    }
  }
  return out;
}

export default function TokenBuilder({ tokens, onChange, varNames, sc, varsMeta }: Props) {
  const [picked, setPicked] = useState("");
  const [num, setNum] = useState("");

  const push = (t: Token) => onChange([...tokens, t]);
  const pop = () => onChange(tokens.slice(0, -1));
  const clear = () => onChange([]);
  const del = (i: number) => onChange(tokens.filter((_, idx) => idx !== i));

  let liveText = "—";
  let liveBad = false;
  try {
    if (tokens.length) liveText = fmt(evtok(tokens, sc));
  } catch (e: any) {
    liveText = String(e?.message || e);
    liveBad = true;
  }

  // 계산식에 쓰인 변수 중 값이 숫자가 아닌 것 — 두 부류를 구분해 안내:
  //   (1) 텍스트 값 → 진짜 식 오류 (텍스트 변수를 산식에 넣은 설계 문제, 빨강)
  //   (2) 값 없음(NaN·빈값 — 조회 미매칭·미입력) → 설계는 정상, 데이터가 아직 없을 뿐 (노랑 안내)
  const isNumeric = (v: any) =>
    typeof v === "number"
      ? !isNaN(v)
      : typeof v === "string"
      ? v.trim() !== "" && !isNaN(Number(v.replace(/,/g, "")))
      : false;
  const isEmptyVal = (v: any) =>
    v === undefined ||
    v === null ||
    (typeof v === "number" && isNaN(v)) ||
    (typeof v === "string" && v.trim() === "");
  const usedVars = Array.from(
    new Set(
      tokens.filter((t: any) => t.t === "var" && t.name).map((t: any) => t.name as string)
    )
  ).filter((name) => name in sc && !isNumeric((sc as any)[name]));
  const emptyVars = usedVars.filter((name) => isEmptyVal((sc as any)[name]));
  const nonNumericVars = usedVars
    .filter((name) => !isEmptyVal((sc as any)[name]))
    .map((name) => ({ name, value: (sc as any)[name] }));

  const chipCls = (t: Token) =>
    t.t === "var"
      ? "bg-emerald-100 text-emerald-700"
      : t.t === "num"
      ? "bg-blue-100 text-blue-700"
      : t.t === "op"
      ? "bg-gray-200 text-gray-700"
      : t.t === "fn"
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";

  const chipLabel = (t: Token) =>
    t.t === "var"
      ? t.name
      : t.t === "num"
      ? String(t.v)
      : t.t === "op"
      ? OPSYM[t.op]
      : t.t === "fn"
      ? t.fn
      : t.t === "lp"
      ? "("
      : ")";

  return (
    <div className="rounded border bg-gray-50 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] rounded border bg-white p-1.5">
        {tokens.length === 0 ? (
          <span className="text-xs text-gray-400 font-mono">
            비어 있음 — 아래에서 변수/숫자/연산자를 추가하세요
          </span>
        ) : (
          tokens.map((t, i) => (
            <span
              key={i}
              className={
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono " +
                chipCls(t)
              }
            >
              {chipLabel(t)}
              <button
                onClick={() => del(i)}
                className="opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 border-r pr-2">
          <span className="text-[10px] text-gray-500">변수</span>
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="rounded border px-1.5 py-0.5 text-xs"
          >
            <option value="">(변수 선택)</option>
            {varNames.length === 0 ? (
              <option disabled>없음</option>
            ) : (
              renderGroupedOptions(varNames, varsMeta)
            )}
          </select>
          <button
            onClick={() => picked && push({ t: "var", name: picked })}
            disabled={!picked}
            className="rounded border px-2 py-0.5 hover:bg-gray-100 disabled:opacity-40"
          >
            + 변수
          </button>
        </div>
        <div className="flex items-center gap-1 border-r pr-2">
          <span className="text-[10px] text-gray-500">숫자</span>
          <input
            type="number"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            className="w-16 rounded border px-1.5 py-0.5 text-xs text-right font-mono"
            placeholder="0"
          />
          <button
            onClick={() => {
              const v = parseFloat(num);
              if (!isNaN(v)) {
                push({ t: "num", v });
                setNum("");
              }
            }}
            className="rounded border px-2 py-0.5 hover:bg-gray-100"
          >
            + 숫자
          </button>
        </div>
        <div className="flex items-center gap-1 border-r pr-2">
          <span className="text-[10px] text-gray-500">연산</span>
          {(["+", "-", "*", "/", "%", "//"] as const).map((o) => (
            <button
              key={o}
              onClick={() => push({ t: "op", op: o })}
              title={o === "%" ? "나머지" : o === "//" ? "몫(내림나눗셈)" : undefined}
              className="rounded border px-2 py-0.5 font-bold hover:bg-gray-100"
            >
              {OPSYM[o]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-r pr-2">
          <span className="text-[10px] text-gray-500">함수</span>
          {(["floor", "ceil", "round"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onChange([...tokens, { t: "fn", fn: f }, { t: "lp" }])}
              title={FN_LABEL[f]}
              className="rounded border px-2 py-0.5 font-mono text-amber-700 hover:bg-amber-50"
            >
              {f}(
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-r pr-2">
          <span className="text-[10px] text-gray-500">괄호</span>
          <button
            onClick={() => push({ t: "lp" })}
            className="rounded border px-2 py-0.5 font-bold hover:bg-gray-100"
          >
            (
          </button>
          <button
            onClick={() => push({ t: "rp" })}
            className="rounded border px-2 py-0.5 font-bold hover:bg-gray-100"
          >
            )
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={pop}
            className="rounded border px-2 py-0.5 hover:bg-gray-100"
          >
            ⌫ 마지막
          </button>
          <button
            onClick={clear}
            className="rounded border px-2 py-0.5 hover:bg-gray-100"
          >
            비우기
          </button>
        </div>
        <span
          className={
            "ml-auto font-mono " + (liveBad ? "text-rose-600" : "text-emerald-700")
          }
        >
          {liveBad ? "▲ " : "= "}
          {liveText}
        </span>
      </div>
      {nonNumericVars.length > 0 && (
        <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 space-y-0.5">
          <div className="font-bold">▲ 식 오류 — 숫자가 아닌 변수를 계산식에 사용했습니다</div>
          {nonNumericVars.map((b) => (
            <div key={b.name} className="font-mono">
              “{b.name}” 값: <b>"{String(b.value)}"</b> — 텍스트라서 계산에 쓸 수 없습니다 (0 으로
              처리됨).
            </div>
          ))}
        </div>
      )}
      {emptyVars.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 space-y-0.5">
          <div className="font-bold">ⓘ 아직 값이 없는 항목이 있습니다 (지금은 0 으로 계산)</div>
          <div className="font-mono">{emptyVars.join(" · ")}</div>
          <div>
            조회가 매칭되지 않았거나 테스트 값이 비어 있습니다 — 상류 입력·테스트 행을 채우면
            자동으로 계산됩니다. 식 자체는 정상입니다.
          </div>
        </div>
      )}
    </div>
  );
}
