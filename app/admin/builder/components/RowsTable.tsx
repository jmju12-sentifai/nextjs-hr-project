"use client";
import type { RowCol } from "app-renderer";
import { parseRows } from "app-renderer";

// rows(목록) 변수 값 편집 표 — 사용자 앱·빌더 테스트값 편집 공용.
// value: 행 객체 배열 또는 JSON 문자열. onChange 는 행 배열로 콜백.
export default function RowsTable({
  cols,
  value,
  onChange,
  compact = false,
}: {
  cols: RowCol[];
  value: any;
  onChange: (rows: Record<string, any>[]) => void;
  compact?: boolean;
}) {
  const rows = parseRows(value);
  const safeCols = (cols || []).filter((c) => c && c.name);
  if (safeCols.length === 0) {
    return (
      <div className="text-[11px] text-gray-400">
        컬럼이 정의되지 않은 목록입니다 — 빌더에서 컬럼을 추가하세요.
      </div>
    );
  }
  const setCell = (ri: number, col: string, v: any) => {
    const next = rows.map((r, i) => (i === ri ? { ...r, [col]: v } : r));
    onChange(next);
  };
  const addRow = () => {
    const blank: Record<string, any> = {};
    for (const c of safeCols) blank[c.name] = c.type === "number" ? 0 : c.options?.[0] || "";
    onChange([...rows, blank]);
  };
  const delRow = (ri: number) => onChange(rows.filter((_, i) => i !== ri));

  const inp =
    "w-full rounded border border-gray-200 px-1.5 " +
    (compact ? "py-0.5 text-[11px]" : "py-1 text-xs");
  return (
    <div className="w-full">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold text-gray-500">
            <th className="py-1 pr-1 w-6">#</th>
            {safeCols.map((c) => (
              <th key={c.name} className="py-1 pr-2">
                {c.name}
                {c.unit ? <span className="font-normal text-gray-400"> ({c.unit})</span> : null}
              </th>
            ))}
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={safeCols.length + 2} className="py-1.5 text-[11px] text-gray-400">
                항목이 없습니다 — 아래 “+ 행 추가”로 입력하거나 문서 업로드로 채워집니다.
              </td>
            </tr>
          )}
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-gray-100">
              <td className="py-1 pr-1 text-[10px] font-mono text-gray-400">{ri + 1}</td>
              {safeCols.map((c) => (
                <td key={c.name} className="py-1 pr-2">
                  {c.type === "select" && c.options?.length ? (
                    <select
                      value={String(r[c.name] ?? "")}
                      onChange={(e) => setCell(ri, c.name, e.target.value)}
                      className={inp}
                    >
                      <option value="">(선택)</option>
                      {c.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={c.type === "number" ? "number" : "text"}
                      value={r[c.name] ?? ""}
                      onChange={(e) =>
                        setCell(
                          ri,
                          c.name,
                          c.type === "number"
                            ? e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                            : e.target.value
                        )
                      }
                      className={inp + " font-mono"}
                    />
                  )}
                </td>
              ))}
              <td className="py-1">
                <button
                  onClick={() => delRow(ri)}
                  className="text-rose-500 hover:text-rose-700 text-xs"
                  title="행 삭제"
                  aria-label="행 삭제"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="mt-1 rounded border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
      >
        + 행 추가
      </button>
    </div>
  );
}
