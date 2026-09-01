"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchItem } from "@/lib/catalog";
import FlowSteps from "./FlowSteps";

/** 엑셀 Home > Curation Board — "이달의 추천 앱, 신규 업데이트 앱 슬라이드 제공" */
type Props = {
  recommended: SearchItem[];
  updated: SearchItem[];
};

const TABS = [
  { key: "rec", label: "이달의 추천 앱" },
  { key: "new", label: "신규 업데이트" },
] as const;

export default function CurationBoard({ recommended, updated }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("rec");
  const items = tab === "rec" ? recommended : updated;

  // 가로 레일 — 스크롤바만으로는 더 있는지 모르니 좌우 버튼을 붙인다.
  const railRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync, items]);

  const nudge = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="site-wrap py-20">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
            MONTHLY CURATION
          </p>
          <h2 className="text-[30px] font-bold tracking-[-0.045em] text-[var(--sec-heading)] sm:text-[34px]">
            지금 바로 쓸 수 있는 앱
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={on}
                className={`rounded-[var(--chip-radius)] border px-4 py-2 text-[12px] font-bold transition ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                    : "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
          <div className="ml-2 hidden gap-1.5 sm:flex">
            {([-1, 1] as const).map((d) => {
              const disabled = d === -1 ? edge.start : edge.end;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => nudge(d)}
                  disabled={disabled}
                  aria-label={d === -1 ? "이전" : "다음"}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--card-line)] disabled:hover:text-[var(--sec-heading)]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <path d={d === -1 ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-14 text-center text-sm text-[var(--sec-muted)]">
          이 목록은 곧 채워집니다.{" "}
          <Link href="/requests" className="font-bold text-[var(--accent)] underline">
            원하는 앱을 요청
          </Link>
          해 주세요.
        </p>
      ) : (
        <div ref={railRef} className="rail -mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2">
          {items.map((it, i) => (
            <Link
              key={it.id}
              href={it.href}
              className="group relative flex min-h-[268px] w-[300px] shrink-0 snap-start flex-col rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--card-shadow)]"
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-black tracking-wider text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[11px] font-bold text-[var(--sec-muted)]">{it.category}</span>
                {it.badge && (
                  <span className="ml-auto rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent-on)]">
                    {it.badge}
                  </span>
                )}
              </div>
              <h3 className="break-keep text-[16px] font-bold leading-snug text-[var(--sec-heading)]">
                {it.title}
              </h3>
              <p className="mt-2 line-clamp-3 break-keep text-[12px] leading-relaxed text-[var(--sec-muted)]">
                {it.summary}
              </p>
              {it.flow && it.flow.length > 0 && (
                <div className="mt-auto border-t border-[var(--sec-line)] pt-3">
                  <FlowSteps flow={it.flow} />
                </div>
              )}
              <span className="absolute right-5 top-5 text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
