"use client";
import { useState } from "react";
import type { Token } from "app-renderer";
import { evstr, fmt, tk2str } from "app-renderer";

interface Props {
  tokens: Token[];
  onChange: (t: Token[]) => void;
  varNames: string[];
  sc: Record<string, any>;
}

const OPSYM: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export default function TokenBuilder({ tokens, onChange, varNames, sc }: Props) {
  const [picked, setPicked] = useState(varNames[0] || "");
  const [num, setNum] = useState("");

  const push = (t: Token) => onChange([...tokens, t]);
  const pop = () => onChange(tokens.slice(0, -1));
  const clear = () => onChange([]);
  const del = (i: number) => onChange(tokens.filter((_, idx) => idx !== i));

  let liveText = "—";
  let liveBad = false;
  try {
    if (tokens.length) liveText = fmt(evstr(tk2str(tokens), sc));
  } catch (e: any) {
    liveText = String(e?.message || e);
    liveBad = true;
  }

  const chipCls = (t: Token) =>
    t.t === "var"
      ? "bg-emerald-100 text-emerald-700"
      : t.t === "num"
      ? "bg-blue-100 text-blue-700"
      : t.t === "op"
      ? "bg-gray-200 text-gray-700"
      : "bg-blue-100 text-blue-700";

  const chipLabel = (t: Token) =>
    t.t === "var"
      ? t.name
      : t.t === "num"
      ? String(t.v)
      : t.t === "op"
      ? OPSYM[t.op]
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
            {varNames.length === 0 ? (
              <option disabled>없음</option>
            ) : (
              varNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))
            )}
          </select>
          <button
            onClick={() => picked && push({ t: "var", name: picked })}
            className="rounded border px-2 py-0.5 hover:bg-gray-100"
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
          {(["+", "-", "*", "/"] as const).map((o) => (
            <button
              key={o}
              onClick={() => push({ t: "op", op: o })}
              className="rounded border px-2 py-0.5 font-bold hover:bg-gray-100"
            >
              {OPSYM[o]}
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
    </div>
  );
}
