"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Figure } from "./content";

/** 글씨가 촘촘한 도식이 많아서, 누르면 원본 크기로 볼 수 있게 한다. */
export function ZoomFigure({ figure }: { figure: Figure }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // 세로로 긴 도식은 목록에서 너무 길어지지 않게 높이를 묶는다.
  const tall = figure.height > figure.width;

  return (
    <figure className="m-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${figure.caption} 도식 크게 보기`}
        className="group block w-full cursor-zoom-in overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-white transition hover:border-[var(--accent)]"
      >
        <Image
          src={figure.src}
          alt={figure.alt}
          width={figure.width}
          height={figure.height}
          sizes="(min-width: 1024px) 900px, 100vw"
          className={`mx-auto h-auto ${tall ? "max-h-[720px] w-auto" : "w-full"}`}
        />
      </button>
      <figcaption className="mt-2.5 flex items-center justify-between gap-3 text-[12.5px] text-[var(--sec-muted)]">
        <span>{figure.caption}</span>
        <span className="shrink-0 text-[11.5px]">눌러서 크게 보기</span>
      </figcaption>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto max-h-[94vh] max-w-[min(96vw,1700px)] overflow-auto rounded-xl bg-white p-0 backdrop:bg-[rgba(4,12,28,0.85)]"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="sticky left-full top-3 z-10 mr-3 mt-3 block rounded-full bg-[var(--sec-heading)] px-3.5 py-1.5 text-[12px] font-bold text-white"
        >
          닫기 ✕
        </button>
        {open && (
          <Image
            src={figure.src}
            alt={figure.alt}
            width={figure.width}
            height={figure.height}
            sizes="96vw"
            className="-mt-10 h-auto w-full"
          />
        )}
      </dialog>
    </figure>
  );
}

/** 4장처럼 연결 맵이 여러 장인 경우 탭으로 바꿔 본다. */
export function FigureTabs({ tabs }: { tabs: { label: string; figure: Figure }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div role="tablist" aria-label="연결 맵 선택" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-[var(--chip-radius)] border px-4 py-2 text-[12.5px] font-bold transition ${
              i === active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                : "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ZoomFigure key={tabs[active].figure.src} figure={tabs[active].figure} />
    </div>
  );
}
