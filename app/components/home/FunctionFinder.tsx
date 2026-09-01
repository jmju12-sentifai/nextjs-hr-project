"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HR_CATEGORIES, type HrCategory, type SearchItem } from "@/lib/catalog";
import FlowSteps from "./FlowSteps";

/**
 * 엑셀 "2. 인사기능별 앱" — 비고가 "통합검색 메뉴에서 기능별로만 구분" 이라
 * 위는 필터 칩, 아래는 그 필터가 적용된 목록으로 한 화면에서 끝낸다.
 */
export default function FunctionFinder({ items }: { items: SearchItem[] }) {
  const [active, setActive] = useState<HrCategory | null>(null);

  const countBy = useMemo(() => {
    const m = new Map<HrCategory, number>();
    for (const it of items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
    return m;
  }, [items]);

  const shown = useMemo(
    () => (active ? items.filter((it) => it.category === active) : items),
    [items, active]
  );

  return (
    <>
      <div className="mb-7 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActive(null)}
          aria-pressed={!active}
          className={`flex items-center gap-2 rounded-[var(--chip-radius)] border px-4 py-2.5 text-[12.5px] font-bold transition ${
            active
              ? "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)]"
              : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
          }`}
        >
          전체
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
              active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-white/20"
            }`}
          >
            {items.length}
          </span>
        </button>

        {HR_CATEGORIES.map((cat) => {
          const n = countBy.get(cat) ?? 0;
          const on = cat === active;
          return (
            <button
              key={cat}
              type="button"
              disabled={n === 0}
              onClick={() => setActive(on ? null : cat)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-[var(--chip-radius)] border px-4 py-2.5 text-[12.5px] font-bold transition ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                  : n > 0
                    ? "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    : "cursor-not-allowed border-transparent bg-[var(--card-bg)]/50 text-[var(--sec-muted)] opacity-55"
              }`}
            >
              {cat}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  on
                    ? "bg-white/20"
                    : n > 0
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--sec-line)] text-[var(--sec-muted)]"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--card-bg)] px-6 py-14 text-center">
          <p className="text-sm font-bold text-[var(--sec-heading)]">
            {active} 영역의 앱은 아직 준비 중입니다.
          </p>
          <p className="mt-2 text-[13px] text-[var(--sec-muted)]">
            <Link href="/requests" className="font-bold text-[var(--accent)] underline">
              앱개발요청
            </Link>
            에 남겨주시면 우선순위에 반영합니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, 6).map((it) => (
            <Link
              key={it.id}
              href={it.href}
              className="group flex min-h-[178px] flex-col rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--card-shadow)]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent)]">
                  {it.kind === "tool" ? "TOOL" : "APP"}
                </span>
                <span className="text-[11px] font-bold text-[var(--sec-muted)]">{it.category}</span>
                {it.badge && (
                  <span className="ml-auto rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent-on)]">
                    {it.badge}
                  </span>
                )}
              </div>
              <h3 className="break-keep text-[15.5px] font-bold leading-snug text-[var(--sec-heading)]">
                {it.title}
              </h3>
              <p className="mt-2 line-clamp-2 break-keep text-[12px] leading-relaxed text-[var(--sec-muted)]">
                {it.summary}
              </p>
              {it.flow && it.flow.length > 0 && (
                <div className="mt-auto border-t border-[var(--sec-line)] pt-3">
                  <FlowSteps flow={it.flow} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {shown.length > 6 && (
        <div className="mt-6 text-center">
          <Link
            href={active ? `/apps?cat=${encodeURIComponent(active)}` : "/apps"}
            className="inline-flex rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-6 py-3.5 text-[13px] font-bold text-[var(--sec-heading)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {active ? `${active} 전체 보기` : "전체 앱 보기"} ({shown.length}) →
          </Link>
        </div>
      )}
    </>
  );
}
