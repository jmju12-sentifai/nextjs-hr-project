import Link from "next/link";
import SectionShell from "../../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";
import { CHAPTERS } from "./content";
import { FigureTabs, ZoomFigure } from "./Figures";

export const metadata = {
  title: "HRCoach AX 방법론 — HRcoach",
  description:
    "거대한 인사시스템 대신 프로세스와 문서로 된 업무 단위를 앱으로 만들어 조립합니다. HRcoach가 인사 AX를 보는 방식.",
};

/** AI인사솔루션 안내 하위 페이지. 원고 출처는 content.ts 주석 참고. */
export default async function MethodologyPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="HRCOACH AX METHODOLOGY"
      title="인사 업무를 작은 단위로 나눠, AI로 자동화합니다."
      lead="거대한 하나의 시스템이 아니라 프로세스와 문서로 된 업무 단위를 앱으로 만들고, 필요한 만큼 조립해 씁니다. HRcoach가 앱을 만드는 방식입니다."
    >
      <nav
        aria-label="장 목록"
        className="sticky top-0 z-20 -mx-1 mb-14 flex gap-2 overflow-x-auto border-y border-[var(--sec-line)] bg-[var(--sec-bg)]/95 px-1 py-3 backdrop-blur"
      >
        {CHAPTERS.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="flex shrink-0 items-center gap-2 rounded-[var(--chip-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--sec-heading)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span className="text-[10.5px] text-[var(--accent)]">{c.no}</span>
            {c.nav}
          </a>
        ))}
      </nav>

      <div className="space-y-20">
        {CHAPTERS.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-24">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
              <div>
                <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
                  CHAPTER {c.no}
                </p>
                <h2 className="break-keep text-[26px] font-bold leading-snug tracking-[-0.045em] text-[var(--sec-heading)]">
                  {c.title}
                </h2>
                <div className="mt-4 space-y-2.5">
                  {c.summary.map((s) => (
                    <p key={s} className="break-keep text-[14px] leading-[1.85] text-[var(--sec-fg)]">
                      {s}
                    </p>
                  ))}
                </div>
                {c.later && (
                  <p className="mt-4 break-keep text-[12.5px] leading-relaxed text-[var(--sec-muted)]">
                    ※ {c.later}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                {c.quote && (
                  <blockquote className="m-0 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] p-7">
                    <p className="break-keep text-[17px] font-bold leading-[1.75] tracking-[-0.03em] text-[var(--sec-heading)]">
                      “{c.quote}”
                    </p>
                  </blockquote>
                )}
                {c.figures && (
                  <div className="grid gap-5">
                    {c.figures.map((f) => (
                      <ZoomFigure key={f.src} figure={f} />
                    ))}
                  </div>
                )}
                {c.tabs && <FigureTabs tabs={c.tabs} />}
              </div>
            </div>

            <details className="group mt-6 border-y border-[var(--sec-line)]">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[13px] font-bold text-[var(--sec-heading)] [&::-webkit-details-marker]:hidden">
                {c.no}장 원문 읽기
                <span className="text-[18px] leading-none text-[var(--accent)] group-open:hidden">+</span>
                <span className="hidden text-[18px] leading-none text-[var(--accent)] group-open:inline">–</span>
              </summary>
              <div className="max-w-[760px] space-y-3.5 pb-6 pt-1">
                {c.original.map((p) => (
                  <p key={p.slice(0, 24)} className="break-keep text-[14px] leading-[1.9] text-[var(--sec-fg)]">
                    {p}
                  </p>
                ))}
              </div>
            </details>
          </section>
        ))}
      </div>

      <div className="band mt-20 flex flex-col items-start justify-between gap-5 px-8 py-9 md:flex-row md:items-center">
        <div>
          <p className="text-[24px] font-bold leading-snug tracking-[-0.03em]">
            거대한 시스템 대신,
            <br />
            오늘 필요한 업무 하나부터.
          </p>
          <p className="mt-2.5 text-[13px] opacity-70">
            회사 규정을 올리면 판단과 근거 문서가 나오는 앱으로 시작해 보세요.
          </p>
        </div>
        <Link
          href="/apps"
          className="shrink-0 rounded-xl bg-[var(--accent)] px-7 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
        >
          앱 둘러보기 →
        </Link>
      </div>
    </SectionShell>
  );
}
