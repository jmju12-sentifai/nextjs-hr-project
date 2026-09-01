"use client";

import { useMemo, useState } from "react";
import { FAQS } from "@/lib/faq";

/** 엑셀 7번의 "챗봇 기반 실시간 FAQ" 를 검색으로 대체한 것 */
export default function FaqSearch() {
  const [q, setQ] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return FAQS.map((f, i) => ({ f, i }));
    const terms = t.split(/\s+/);
    return FAQS.map((f, i) => ({ f, i })).filter(({ f }) => {
      const hay = `${f.q} ${f.a} ${f.tags.join(" ")}`.toLowerCase();
      return terms.every((x) => hay.includes(x));
    });
  }, [q]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-4 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="자주 묻는 질문 검색"
          placeholder="궁금한 내용을 검색하세요. 예: 환불, 보관, 오류"
          className="w-full bg-transparent text-[13.5px] text-[var(--sec-heading)] outline-none placeholder:text-[var(--sec-muted)]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")}
            className="shrink-0 text-[11px] font-bold text-[var(--sec-muted)] hover:text-[var(--accent)]">
            지우기
          </button>
        )}
      </div>

      {hits.length === 0 ? (
        <p className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-10 text-center text-[13px] text-[var(--sec-muted)]">
          &lsquo;{q}&rsquo; 에 해당하는 답변이 없습니다. 아래 1:1 문의로 남겨주세요.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)]">
          {hits.map(({ f, i }) => {
            const on = openIdx === i;
            return (
              <div key={f.q} className="border-b border-[var(--sec-line)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenIdx(on ? null : i)}
                  aria-expanded={on}
                  className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-[var(--accent-soft)]"
                >
                  <span className="flex-1 text-[13.5px] font-bold text-[var(--sec-heading)]">
                    {f.q}
                  </span>
                  <span aria-hidden
                    className={`shrink-0 text-[var(--accent)] transition-transform ${on ? "rotate-180" : ""}`}>
                    ⌄
                  </span>
                </button>
                {on && (
                  <p className="break-keep px-6 pb-5 text-[13px] leading-[1.85] text-[var(--sec-muted)]">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
