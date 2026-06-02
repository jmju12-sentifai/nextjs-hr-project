"use client";
import { useState } from "react";
import type { Grp, Unit, VarType, Variable } from "app-renderer";
import { UNITS } from "app-renderer";

const uid = () => Math.random().toString(36).slice(2, 7);

interface Props {
  grp: Grp;
  vars: Variable[];
  onChange: (vars: Variable[]) => void;
}

const TYPES: VarType[] = ["number", "text", "date"];

export default function TabVars({ grp, vars, onChange }: Props) {
  const list = vars.filter((v) => v.grp === grp);
  const others = vars.filter((v) => v.grp !== grp);

  const [nm, setNm] = useState("");
  const [ty, setTy] = useState<VarType>("number");
  const [un, setUn] = useState<Unit>("");
  const [req, setReq] = useState(false);

  const update = (id: string, patch: Partial<Variable>) => {
    onChange(vars.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };
  const remove = (id: string) => onChange(vars.filter((v) => v.id !== id));
  const add = () => {
    if (!nm.trim() || /\s/.test(nm)) {
      alert("공백 없는 변수명");
      return;
    }
    onChange([
      ...vars,
      {
        id: uid(),
        grp,
        name: nm.trim(),
        type: ty,
        unit: ty === "number" ? un : "",
        req: grp === "개인" ? req : false,
        test: "",
      },
    ]);
    setNm("");
    setReq(false);
  };

  const inpCls = "rounded border px-2 py-1 text-sm font-mono";
  const selCls = "rounded border px-2 py-1 text-sm";

  return (
    <div className="space-y-5">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          {grp === "규정" ? "1차 · 규정 파싱" : "2차 · 개인 파싱"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {grp === "규정" ? "규정에서 뽑을 항목" : "개인 정보에서 뽑을 항목"}
        </h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          {grp === "규정"
            ? "규정 문서에서 파싱할 기준값·정책 상수를 선언합니다."
            : "개인 1명 문서에서 파싱할 항목 — 필수는 누락 시 수기 보완 대상."}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded border border-dashed p-6 text-center text-sm text-gray-500 font-mono">
          {grp} 변수가 없습니다.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-gray-700 border-b">
              <th className="py-2 px-2">변수명</th>
              <th className="py-2 px-2 w-28">타입</th>
              <th className="py-2 px-2 w-32">단위</th>
              <th className="py-2 px-2 w-44">테스트값</th>
              {grp === "개인" && <th className="py-2 px-2 w-14">필수</th>}
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-1.5 px-2">
                  <input
                    value={v.name}
                    onChange={(e) => update(v.id, { name: e.target.value })}
                    className={inpCls + " w-full"}
                  />
                </td>
                <td className="py-1.5 px-2">
                  <select
                    value={v.type}
                    onChange={(e) =>
                      update(v.id, { type: e.target.value as VarType })
                    }
                    className={selCls + " w-full"}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <select
                    value={v.unit || ""}
                    disabled={v.type !== "number"}
                    onChange={(e) =>
                      update(v.id, { unit: e.target.value as Unit })
                    }
                    className={selCls + " w-full"}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u || "(단위없음)"}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <input
                    value={v.test || ""}
                    onChange={(e) => update(v.id, { test: e.target.value })}
                    className={inpCls + " w-full"}
                    placeholder={v.type === "date" ? "YYYY-MM-DD" : ""}
                  />
                </td>
                {grp === "개인" && (
                  <td className="py-1.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!v.req}
                      onChange={(e) => update(v.id, { req: e.target.checked })}
                    />
                  </td>
                )}
                <td className="py-1.5 px-2 whitespace-nowrap w-px">
                  <button
                    onClick={() => remove(v.id)}
                    className="text-[11px] leading-none rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-rose-700 whitespace-nowrap"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
        <span className="text-xs font-mono text-gray-500">+ {grp} 변수</span>
        <input
          value={nm}
          onChange={(e) => setNm(e.target.value)}
          placeholder="변수명 (공백 없이)"
          className={inpCls + " w-40"}
        />
        <select
          value={ty}
          onChange={(e) => setTy(e.target.value as VarType)}
          className={selCls}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={un}
          disabled={ty !== "number"}
          onChange={(e) => setUn(e.target.value as Unit)}
          className={selCls}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u || "(단위없음)"}
            </option>
          ))}
        </select>
        {grp === "개인" && (
          <label className="text-xs flex items-center gap-1 font-mono text-gray-600">
            <input
              type="checkbox"
              checked={req}
              onChange={(e) => setReq(e.target.checked)}
            />
            필수
          </label>
        )}
        <button
          onClick={add}
          className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
