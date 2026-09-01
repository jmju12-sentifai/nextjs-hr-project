"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterSearchItems, type SearchItem } from "@/lib/catalog";

type Props = {
  items: SearchItem[];
  /** 히어로 안 배경에 따라 라벨 색이 달라진다 */
  tone?: "light" | "dark";
  label?: string;
  placeholder?: string;
  className?: string;
};

/**
 * 엑셀 Home > Quick Search — "필요 인사 산출물 및 키워드 기반 통합 검색".
 * 색인이 앱 + 도구 수십 건 규모라 서버 왕복 없이 클라이언트에서 필터링한다.
 */
export default function QuickSearch({
  items,
  tone = "light",
  label = "APP FINDER",
  placeholder = "필요한 산출물이나 업무를 검색하세요",
  className = "",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 드롭다운은 미리보기다. 버튼·엔터는 전체 결과 페이지로 넘긴다.
  const goToResults = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/apps?q=${encodeURIComponent(q)}`);
  };

  const results = useMemo(() => filterSearchItems(items, query), [items, query]);
  const hasQuery = query.trim().length > 0;

  // 바깥 클릭 시 결과 패널을 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToResults();
        }}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[14px] border border-[#d7e2ee] bg-white p-[7px] shadow-[0_22px_50px_-35px_rgba(7,27,66,0.55)]"
      >
        <span className="hidden px-3 text-[8px] font-black tracking-[0.16em] text-brand-blue sm:block">
          {label}
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="인사 앱 검색"
          placeholder={placeholder}
          className="h-[45px] min-w-0 border-0 border-l border-[#dce5ef] px-4 text-[11px] text-brand-ink outline-none placeholder:text-[#96a5b9] sm:text-xs"
        />
        <button
          type="submit"
          disabled={!hasQuery}
          className="flex h-[45px] items-center gap-2 rounded-[9px] bg-brand-ink px-4 text-[9px] font-black text-white transition disabled:opacity-45 sm:text-[10px]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          앱 검색
        </button>
      </form>

      {open && hasQuery && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[340px] overflow-y-auto rounded-2xl border border-[#dbe5f1] bg-white p-2 shadow-[0_30px_60px_-30px_rgba(7,27,66,0.45)]">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-brand-muted">
              &lsquo;{query}&rsquo; 에 해당하는 앱이 없습니다.
              <br />
              <span className="text-[11px]">
                찾는 업무가 없다면{" "}
                <Link href="/requests" className="font-bold text-brand-blue underline">
                  앱개발요청
                </Link>
                에 남겨주세요.
              </span>
            </p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-2 text-[9px] font-black tracking-[0.14em] text-brand-muted">
                검색 결과 {results.length}건
              </p>
              <ul>
                {results.map((it) => (
                  <li key={it.id}>
                    <Link
                      href={it.href}
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[#f2f7ff]"
                    >
                      <span className="mt-0.5 shrink-0 rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[9px] font-bold text-brand-blue">
                        {it.kind === "tool" ? "TOOL" : "APP"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <b className="truncate text-[12px] font-bold text-brand-ink">
                            {it.title}
                          </b>
                          {it.badge && (
                            <span className="shrink-0 rounded bg-brand-blue px-1 py-px text-[8px] font-black text-white">
                              {it.badge}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-brand-muted">
                          <span>{it.category}</span>
                          <span className="text-[#c8d3e2]">|</span>
                          <span className="truncate">산출물 · {it.output}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goToResults}
                className="mt-1 block w-full rounded-xl px-3 py-2.5 text-center text-[11.5px] font-bold text-brand-blue transition hover:bg-[#f2f7ff]"
              >
                검색 결과 전체 보기 →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
